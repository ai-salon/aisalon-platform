"""Admin API endpoints: api-keys, jobs, articles, chapters, team."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.config import settings
from app.core.encryption import encrypt_key, decrypt_key
from app.models.user import User, UserRole
from app.models.api_key import UserAPIKey, APIKeyProvider
from app.models.job import Job, JobStatus
from app.models.article import Article
from app.models.chapter import Chapter
from app.models.team_member import TeamMember
from app.schemas.admin import (
    APIKeySetRequest, APIKeyResponse,
    JobResponse,
    ArticleResponse, ArticleUpdate,
    ChapterUpdate, ChapterResponse,
    TeamMemberCreate, TeamMemberUpdate, TeamMemberResponse,
)
from app.services.storage import save_upload

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
    if body.title is not None:
        article.title = body.title
    if body.content_md is not None:
        article.content_md = body.content_md
    if body.status is not None:
        article.status = body.status
    await db.commit()
    await db.refresh(article)
    return article


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
