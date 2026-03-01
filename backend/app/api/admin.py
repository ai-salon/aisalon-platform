"""Admin API endpoints: api-keys, jobs, articles, chapters, team."""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db, AsyncSessionLocal
from app.core.deps import get_current_user
from app.core.config import settings
from app.core.encryption import encrypt_key, decrypt_key
from app.models.user import User, UserRole
from app.models.api_key import UserAPIKey, APIKeyProvider
from app.models.job import Job, JobStatus
from app.models.article import Article, ArticleStatus
from app.models.chapter import Chapter
from app.models.team_member import TeamMember
from app.models.hosting_interest import HostingInterest, InterestType
from app.core.security import hash_password
from app.schemas.admin import (
    APIKeySetRequest, APIKeyResponse,
    JobResponse,
    ArticleResponse, ArticleUpdate,
    ChapterUpdate, ChapterResponse,
    TeamMemberCreate, TeamMemberUpdate, TeamMemberResponse,
    UserCreate, UserUpdate, UserResponse,
)
from app.services.storage import save_upload
from app.services.processor import SocraticProcessor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_admin(user: User) -> None:
    """Superadmin-only guard."""
    if user.role != UserRole.superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _chapter_filter(user: User):
    """Return chapter_id to filter by, or None if superadmin (no filter)."""
    if user.role == UserRole.chapter_lead:
        return user.chapter_id
    return None


# ── Background job runner ─────────────────────────────────────────────────────

async def run_job(job_id: str) -> None:
    """Background task: transcribe audio → generate article → update job status."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if not job:
            logger.error("run_job: job %s not found", job_id)
            return

        job.status = JobStatus.processing
        job.started_at = datetime.now(timezone.utc)
        await db.commit()

        try:
            processor = SocraticProcessor()
            article_data = await processor.process(
                storage_key=job.input_storage_key or "",
                chapter_id=job.chapter_id,
                user_id=job.user_id,
                db=db,
            )
            article = Article(
                job_id=job.id,
                chapter_id=job.chapter_id,
                title=article_data["title"],
                content_md=article_data["content_md"],
                anonymized_transcript=article_data.get("anonymized_transcript"),
                status=ArticleStatus.draft,
            )
            db.add(article)
            job.status = JobStatus.completed
            job.completed_at = datetime.now(timezone.utc)
        except Exception as exc:
            logger.exception("run_job %s failed", job_id)
            job.status = JobStatus.failed
            job.error_message = str(exc)

        await db.commit()


# ── API Keys ──────────────────────────────────────────────────────────────────

@router.get("/api-keys", response_model=list[APIKeyResponse])
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserAPIKey).where(UserAPIKey.user_id == current_user.id)
    )
    keys = result.scalars().all()
    return [APIKeyResponse(provider=k.provider, has_key=True) for k in keys]


@router.post("/api-keys", response_model=APIKeyResponse)
async def set_api_key(
    body: APIKeySetRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserAPIKey).where(
            UserAPIKey.user_id == current_user.id,
            UserAPIKey.provider == body.provider,
        )
    )
    existing = result.scalar_one_or_none()
    encrypted = encrypt_key(body.key, settings.SECRET_KEY)
    if existing:
        existing.encrypted_key = encrypted
    else:
        existing = UserAPIKey(
            user_id=current_user.id,
            provider=body.provider,
            encrypted_key=encrypted,
        )
        db.add(existing)
    await db.commit()
    return APIKeyResponse(provider=body.provider, has_key=True)


@router.delete("/api-keys/{provider}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    provider: APIKeyProvider,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserAPIKey).where(
            UserAPIKey.user_id == current_user.id,
            UserAPIKey.provider == provider,
        )
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    await db.delete(key)
    await db.commit()


# ── Jobs ──────────────────────────────────────────────────────────────────────

@router.post("/jobs", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    background_tasks: BackgroundTasks,
    chapter_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Chapter leads can only create jobs for their own chapter
    if current_user.role == UserRole.chapter_lead:
        if current_user.chapter_id != chapter_id:
            raise HTTPException(status_code=403, detail="Forbidden")

    data = await file.read()
    storage_key = await save_upload(file.filename or "upload", data)

    job = Job(
        user_id=current_user.id,
        chapter_id=chapter_id,
        status=JobStatus.pending,
        input_filename=file.filename,
        input_storage_key=storage_key,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    background_tasks.add_task(run_job, job.id)
    return job


@router.get("/jobs", response_model=list[JobResponse])
async def list_jobs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Job)
    chapter_id = _chapter_filter(current_user)
    if chapter_id:
        stmt = stmt.where(Job.chapter_id == chapter_id)
    result = await db.execute(stmt.order_by(Job.created_at.desc()))
    return result.scalars().all()


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if current_user.role == UserRole.chapter_lead and job.chapter_id != current_user.chapter_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return job


# ── Articles ──────────────────────────────────────────────────────────────────

@router.get("/articles", response_model=list[ArticleResponse])
async def list_articles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Article)
    chapter_id = _chapter_filter(current_user)
    if chapter_id:
        stmt = stmt.where(Article.chapter_id == chapter_id)
    result = await db.execute(stmt.order_by(Article.created_at.desc()))
    return result.scalars().all()


@router.get("/articles/{article_id}", response_model=ArticleResponse)
async def get_article(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if current_user.role == UserRole.chapter_lead and article.chapter_id != current_user.chapter_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return article


@router.patch("/articles/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_id: str,
    body: ArticleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if current_user.role == UserRole.chapter_lead and article.chapter_id != current_user.chapter_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if body.title is not None:
        article.title = body.title
    if body.content_md is not None:
        article.content_md = body.content_md
    if body.status is not None:
        article.status = body.status
    await db.commit()
    await db.refresh(article)
    return article


# ── Transcripts ───────────────────────────────────────────────────────────────

@router.get("/transcripts", response_model=list[dict])
async def list_transcripts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return anonymized transcripts. Superadmin sees all; chapter_lead sees own chapter."""
    stmt = select(
        Article.id,
        Article.title,
        Article.chapter_id,
        Article.job_id,
        Article.anonymized_transcript,
        Article.created_at,
    ).where(Article.anonymized_transcript.is_not(None))

    chapter_id = _chapter_filter(current_user)
    if chapter_id:
        stmt = stmt.where(Article.chapter_id == chapter_id)

    result = await db.execute(stmt.order_by(Article.created_at.desc()))
    rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.get("/transcripts/{article_id}", response_model=dict)
async def get_transcript(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if current_user.role == UserRole.chapter_lead and article.chapter_id != current_user.chapter_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not article.anonymized_transcript:
        raise HTTPException(status_code=404, detail="No transcript available for this article")
    return {
        "id": article.id,
        "title": article.title,
        "chapter_id": article.chapter_id,
        "job_id": article.job_id,
        "anonymized_transcript": article.anonymized_transcript,
        "created_at": article.created_at,
    }


# ── Chapters (admin edit) ─────────────────────────────────────────────────────

@router.patch("/chapters/{chapter_id}", response_model=ChapterResponse)
async def update_chapter(
    chapter_id: str,
    body: ChapterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    if current_user.role == UserRole.chapter_lead and current_user.chapter_id != chapter_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(chapter, field, value)
    await db.commit()
    await db.refresh(chapter)
    return chapter


# ── Team members (admin CRUD) ─────────────────────────────────────────────────

@router.post("/team", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
async def create_team_member(
    body: TeamMemberCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.chapter_lead and current_user.chapter_id != body.chapter_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    member = TeamMember(**body.model_dump())
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


@router.patch("/team/{member_id}", response_model=TeamMemberResponse)
async def update_team_member(
    member_id: str,
    body: TeamMemberUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(TeamMember).where(TeamMember.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    if current_user.role == UserRole.chapter_lead and current_user.chapter_id != member.chapter_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(member, field, value)
    await db.commit()
    await db.refresh(member)
    return member


@router.delete("/team/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team_member(
    member_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(TeamMember).where(TeamMember.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    if current_user.role == UserRole.chapter_lead and current_user.chapter_id != member.chapter_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.delete(member)
    await db.commit()


# ── Users (superadmin only) ───────────────────────────────────────────────────

@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    result = await db.execute(select(User).order_by(User.email))
    return result.scalars().all()


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        role=body.role,
        chapter_id=body.chapter_id,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


# ── Hosting Interest (superadmin only) ────────────────────────────────────────

from datetime import datetime as _dt  # noqa: E402
from pydantic import BaseModel as _BM  # noqa: E402


class HostingInterestAdminResponse(_BM):
    id: str
    name: str
    email: str
    city: str
    interest_type: InterestType
    existing_chapter: str | None
    message: str | None
    created_at: _dt

    model_config = {"from_attributes": True}


@router.get("/hosting-interest", response_model=list[HostingInterestAdminResponse])
async def list_hosting_interest(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    result = await db.execute(
        select(HostingInterest).order_by(HostingInterest.created_at.desc())
    )
    return result.scalars().all()
