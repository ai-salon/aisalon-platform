"""Admin API endpoints: api-keys, jobs, articles, chapters, team."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, nullslast

from app.core.database import get_db, AsyncSessionLocal
from app.core.deps import get_current_user
from app.core.config import settings
from app.core.encryption import encrypt_key, decrypt_key
from app.core.logging import get_logger
from app.models.user import User, UserRole
from app.models.api_key import UserAPIKey, APIKeyProvider
from app.models.job import Job, JobStatus
from app.models.article import Article, ArticleStatus
from app.models.chapter import Chapter
from app.models.team_member import TeamMember
from app.models.hosting_interest import HostingInterest, InterestType
from app.models.invite import Invite
from app.models.system_setting import SystemSetting
from app.models.login_event import UserLoginEvent
from app.core.security import hash_password
from app.schemas.admin import (
    APIKeySetRequest, APIKeyResponse,
    JobResponse,
    ArticleResponse, ArticleUpdate, ArticleCreate,
    ChapterUpdate, ChapterResponse,
    TeamMemberCreate, TeamMemberUpdate, TeamMemberResponse,
    UserCreate, UserUpdate, UserResponse, GuideReadRequest,
    InviteCreate, InviteResponse,
    ChapterStats, CommunityStatsResponse,
    SystemSettingRequest, SystemSettingResponse,
)
from app.services.storage import save_upload
from app.services.processor import SocraticProcessor

logger = get_logger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_admin(user: User) -> None:
    """Superadmin-only guard."""
    if user.role != UserRole.superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _require_lead_or_above(user: User) -> None:
    """Chapter-lead-or-superadmin guard."""
    if user.role not in (UserRole.superadmin, UserRole.chapter_lead):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _chapter_filter(user: User):
    """Return chapter_id to filter by, or None if superadmin (no filter)."""
    if user.role in (UserRole.chapter_lead, UserRole.host):
        return user.chapter_id
    return None


# ── Background job runner ─────────────────────────────────────────────────────

async def run_job(job_id: str) -> None:
    """Background task: transcribe audio → generate article → update job status."""
    job_log = logger.bind(job_id=job_id)
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if not job:
            job_log.error("job_not_found")
            return

        job.status = JobStatus.processing
        job.started_at = datetime.now(timezone.utc)
        await db.commit()
        job_log.info("job_processing", chapter_id=job.chapter_id)

        async def set_step(label: str) -> None:
            job.step = label
            await db.commit()

        article = None
        try:
            processor = SocraticProcessor()
            article_data = await processor.process(
                storage_key=job.input_storage_key or "",
                chapter_id=job.chapter_id,
                user_id=job.user_id,
                db=db,
                on_step=set_step,
            )
            article = Article(
                job_id=job.id,
                user_id=job.user_id,
                chapter_id=job.chapter_id,
                title=article_data["title"],
                content_md=article_data["content_md"],
                anonymized_transcript=article_data.get("anonymized_transcript"),
                meta=article_data.get("meta") or None,
                status=ArticleStatus.draft,
            )
            db.add(article)
            job.status = JobStatus.completed
            job.completed_at = datetime.now(timezone.utc)
            job_log.info("job_completed", title=article_data["title"])
            if job.input_storage_key:
                try:
                    (Path(settings.UPLOAD_DIR) / job.input_storage_key).unlink(missing_ok=True)
                    job_log.info("audio_deleted", storage_key=job.input_storage_key)
                except OSError:
                    job_log.warning("audio_delete_failed", storage_key=job.input_storage_key)
        except Exception as exc:
            job_log.exception("job_failed", error=str(exc))
            job.status = JobStatus.failed
            job.error_message = str(exc)

        await db.commit()

        # Trigger graph ingestion if we have an article and meta
        if job.status == JobStatus.completed and article is not None and article.meta:
            try:
                from app.core.encryption import decrypt_key
                from app.models.api_key import APIKeyProvider
                google_key_result = await db.execute(
                    select(UserAPIKey).where(
                        UserAPIKey.user_id == job.user_id,
                        UserAPIKey.provider == APIKeyProvider.google,
                    )
                )
                google_key_row = google_key_result.scalar_one_or_none()
                if google_key_row:
                    from app.services.graph import GraphIngestionService
                    google_key = decrypt_key(google_key_row.encrypted_key, settings.SECRET_KEY)
                    svc = GraphIngestionService(db, google_key)
                    await svc.ingest_article(
                        article_id=article.id,
                        chapter_id=article.chapter_id,
                        publish_date=article.publish_date,
                        meta=article.meta,
                    )
                    job_log.info("graph_ingestion_complete", article_id=article.id)
            except Exception as exc:
                job_log.warning("graph_ingestion_failed", error=str(exc))


# ── Community Stats ───────────────────────────────────────────────────────────

@router.get("/community-stats", response_model=CommunityStatsResponse)
async def community_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chapter_id = _chapter_filter(current_user)

    stmt = select(Chapter)
    if chapter_id:
        stmt = stmt.where(Chapter.id == chapter_id)
    result = await db.execute(stmt.order_by(Chapter.name))
    chapters = result.scalars().all()

    stats_list: list[ChapterStats] = []
    total_articles = total_published = total_draft = 0
    total_jobs = total_completed = total_failed = 0
    total_team = 0

    for ch in chapters:
        # Article counts
        art_result = await db.execute(
            select(
                func.count(Article.id),
                func.count(Article.id).filter(Article.status == ArticleStatus.published),
                func.count(Article.id).filter(Article.status == ArticleStatus.draft),
            ).where(Article.chapter_id == ch.id)
        )
        art_row = art_result.one()
        articles_count, published_count, draft_count = (
            art_row[0] or 0, art_row[1] or 0, art_row[2] or 0,
        )

        # Job counts
        job_result = await db.execute(
            select(
                func.count(Job.id),
                func.count(Job.id).filter(Job.status == JobStatus.completed),
                func.count(Job.id).filter(Job.status == JobStatus.failed),
            ).where(Job.chapter_id == ch.id)
        )
        job_row = job_result.one()
        jobs_count, completed_jobs, failed_jobs = (
            job_row[0] or 0, job_row[1] or 0, job_row[2] or 0,
        )

        # Team size
        team_result = await db.execute(
            select(func.count(TeamMember.id)).where(TeamMember.chapter_id == ch.id)
        )
        team_size = team_result.scalar() or 0

        stats_list.append(ChapterStats(
            chapter_id=ch.id,
            chapter_name=ch.name,
            chapter_code=ch.code,
            articles_count=articles_count,
            published_count=published_count,
            draft_count=draft_count,
            jobs_count=jobs_count,
            completed_jobs=completed_jobs,
            failed_jobs=failed_jobs,
            team_size=team_size,
        ))

        total_articles += articles_count
        total_published += published_count
        total_draft += draft_count
        total_jobs += jobs_count
        total_completed += completed_jobs
        total_failed += failed_jobs
        total_team += team_size

    totals = ChapterStats(
        chapter_name="All Chapters",
        chapter_code="all",
        articles_count=total_articles,
        published_count=total_published,
        draft_count=total_draft,
        jobs_count=total_jobs,
        completed_jobs=total_completed,
        failed_jobs=total_failed,
        team_size=total_team,
    )

    return CommunityStatsResponse(chapters=stats_list, totals=totals)


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
    # Non-superadmins can only create jobs for their own chapter
    if current_user.role != UserRole.superadmin:
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
    logger.info(
        "job_created",
        job_id=job.id,
        chapter_id=chapter_id,
        filename=file.filename,
    )
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
    if current_user.role != UserRole.superadmin and job.chapter_id != current_user.chapter_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return job


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Discard a pending or stuck processing job. Completed jobs cannot be deleted."""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if current_user.role != UserRole.superadmin and job.chapter_id != current_user.chapter_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if job.status == JobStatus.completed:
        raise HTTPException(status_code=400, detail="Completed jobs cannot be deleted")
    await db.delete(job)
    await db.commit()
    logger.info("job_cancelled", job_id=job_id, user_id=str(current_user.id))


# ── Articles ──────────────────────────────────────────────────────────────────

@router.post("/articles", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    body: ArticleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed = {UserRole.superadmin, UserRole.chapter_lead, UserRole.host}
    if current_user.role not in allowed:
        raise HTTPException(status_code=403, detail="Forbidden")

    if current_user.role == UserRole.superadmin:
        if not body.chapter_id:
            raise HTTPException(status_code=422, detail="chapter_id is required for superadmins")
        chapter = await db.get(Chapter, body.chapter_id)
        if not chapter:
            raise HTTPException(status_code=422, detail="Chapter not found")
        chapter_id = body.chapter_id
    else:
        if not current_user.chapter_id:
            raise HTTPException(status_code=422, detail="User has no chapter assigned")
        chapter_id = current_user.chapter_id

    article = Article(
        chapter_id=chapter_id,
        title=body.title,
        content_md="",
        substack_url=body.substack_url,
        publish_date=body.publish_date,
        status=ArticleStatus.published,
    )
    db.add(article)
    await db.commit()
    await db.refresh(article)
    return article


@router.get("/articles", response_model=list[ArticleResponse])
async def list_articles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Article)
    chapter_id = _chapter_filter(current_user)
    if chapter_id:
        stmt = stmt.where(Article.chapter_id == chapter_id)
    result = await db.execute(stmt.order_by(nullslast(Article.publish_date.desc()), Article.created_at.desc()))
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
    if current_user.role != UserRole.superadmin and article.chapter_id != current_user.chapter_id:
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
    if current_user.role != UserRole.superadmin and article.chapter_id != current_user.chapter_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if body.title is not None:
        article.title = body.title
    if body.content_md is not None:
        article.content_md = body.content_md
    if body.substack_url is not None:
        article.substack_url = body.substack_url or None  # empty string → NULL
    if body.status is not None:
        article.status = body.status
    if body.publish_date is not None:
        article.publish_date = body.publish_date
    await db.commit()
    await db.refresh(article)
    return article


@router.delete("/articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_article(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if current_user.role != UserRole.superadmin and article.chapter_id != current_user.chapter_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.delete(article)
    await db.commit()


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
    if current_user.role != UserRole.superadmin and article.chapter_id != current_user.chapter_id:
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

@router.get("/chapters/{chapter_id}/guide")
async def get_chapter_guide(
    chapter_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the chapter guide for any authenticated member of the chapter."""
    if current_user.role != UserRole.superadmin and current_user.chapter_id != chapter_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return {"chapter_guide": chapter.chapter_guide}


@router.patch("/chapters/{chapter_id}", response_model=ChapterResponse)
async def update_chapter(
    chapter_id: str,
    body: ChapterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_lead_or_above(current_user)
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    if current_user.role != UserRole.superadmin and current_user.chapter_id != chapter_id:
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
    _require_lead_or_above(current_user)
    if current_user.role != UserRole.superadmin and current_user.chapter_id != body.chapter_id:
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
    _require_lead_or_above(current_user)
    result = await db.execute(select(TeamMember).where(TeamMember.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    if current_user.role != UserRole.superadmin and current_user.chapter_id != member.chapter_id:
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
    _require_lead_or_above(current_user)
    result = await db.execute(select(TeamMember).where(TeamMember.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    if current_user.role != UserRole.superadmin and current_user.chapter_id != member.chapter_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.delete(member)
    await db.commit()


@router.post("/team/{member_id}/photo")
async def upload_team_photo(
    member_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_lead_or_above(current_user)
    result = await db.execute(select(TeamMember).where(TeamMember.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    if current_user.role != UserRole.superadmin and current_user.chapter_id != member.chapter_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    data = await file.read()
    key = await save_upload(file.filename or "photo", data)
    url = f"/uploads/{key}"
    member.profile_image_url = url
    await db.commit()
    return {"profile_image_url": url}


# ── Users (superadmin only) ───────────────────────────────────────────────────

@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    result = await db.execute(select(User).order_by(User.email))
    users = result.scalars().all()

    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    counts_result = await db.execute(
        select(UserLoginEvent.user_id, func.count(UserLoginEvent.id).label("cnt"))
        .where(UserLoginEvent.logged_in_at >= cutoff)
        .group_by(UserLoginEvent.user_id)
    )
    login_counts = {row.user_id: row.cnt for row in counts_result}

    api_key_result = await db.execute(select(UserAPIKey.user_id).distinct())
    users_with_keys = {row.user_id for row in api_key_result}

    job_result = await db.execute(select(Job.user_id).distinct())
    users_with_jobs = {row.user_id for row in job_result}

    article_result = await db.execute(select(Article.user_id).distinct())
    users_with_articles = {row.user_id for row in article_result}

    responses = []
    for u in users:
        r = UserResponse.model_validate(u)
        r.login_count_30d = login_counts.get(u.id, 0)
        r.has_api_key = u.id in users_with_keys
        r.has_uploaded = u.id in users_with_jobs
        r.has_article = u.id in users_with_articles
        r.has_read_hosting_guide = u.hosting_guide_read_at is not None
        r.has_read_lead_guide = u.lead_guide_read_at is not None
        responses.append(r)
    return responses


@router.get("/me", response_model=UserResponse)
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = UserResponse.model_validate(current_user)
    r.has_read_hosting_guide = current_user.hosting_guide_read_at is not None
    r.has_read_lead_guide = current_user.lead_guide_read_at is not None
    return r


@router.post("/me/guide-read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_guide_read(
    body: GuideReadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.guide == "hosting" and current_user.hosting_guide_read_at is None:
        current_user.hosting_guide_read_at = datetime.now(timezone.utc)
        await db.commit()
    elif body.guide == "lead" and current_user.lead_guide_read_at is None:
        current_user.lead_guide_read_at = datetime.now(timezone.utc)
        await db.commit()


class SchedulingUrlUpdate(BaseModel):
    scheduling_url: str | None = None


@router.patch("/me/scheduling-url", response_model=UserResponse)
async def update_scheduling_url(
    body: SchedulingUrlUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.scheduling_url = body.scheduling_url or None
    await db.commit()
    await db.refresh(current_user)
    r = UserResponse.model_validate(current_user)
    r.has_read_hosting_guide = current_user.hosting_guide_read_at is not None
    r.has_read_lead_guide = current_user.lead_guide_read_at is not None
    return r


@router.get("/chapter-leads")
async def get_chapter_leads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chapter_id = current_user.chapter_id
    if not chapter_id:
        return []
    result = await db.execute(
        select(User.id, User.email, User.username, User.scheduling_url)
        .where(User.chapter_id == chapter_id)
        .where(User.role == UserRole.chapter_lead)
        .where(User.is_active.is_(True))
    )
    rows = result.all()
    return [
        {
            "id": row.id,
            "name": row.username or row.email.split("@")[0],
            "scheduling_url": row.scheduling_url,
        }
        for row in rows
    ]


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
    if body.username:
        existing_un = await db.execute(select(User).where(User.username == body.username))
        if existing_un.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Username already taken")
    user = User(
        email=body.email,
        username=body.username,
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
    data = body.model_dump(exclude_none=True)
    if "password" in data:
        data["hashed_password"] = hash_password(data.pop("password"))
    for field, value in data.items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()


# ── Invites ───────────────────────────────────────────────────────────────────

@router.post("/invites", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
async def create_invite(
    body: InviteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_lead_or_above(current_user)
    # Chapter leads can only create host invites for their own chapter
    if current_user.role == UserRole.chapter_lead:
        if body.chapter_id != current_user.chapter_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        if body.role != "host":
            raise HTTPException(status_code=403, detail="Chapter leads can only create host invites")
    invite = Invite(
        chapter_id=body.chapter_id,
        role=body.role,
        max_uses=body.max_uses,
        created_by=current_user.id,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)
    return invite


@router.get("/invites", response_model=list[InviteResponse])
async def list_invites(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_lead_or_above(current_user)
    stmt = select(Invite).where(Invite.is_active.is_(True))
    chapter_id = _chapter_filter(current_user)
    if chapter_id:
        stmt = stmt.where(Invite.chapter_id == chapter_id)
    result = await db.execute(stmt.order_by(Invite.created_at.desc()))
    return result.scalars().all()


@router.delete("/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_invite(
    invite_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_lead_or_above(current_user)
    result = await db.execute(select(Invite).where(Invite.id == invite_id))
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if current_user.role != UserRole.superadmin and invite.chapter_id != current_user.chapter_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    invite.is_active = False
    await db.commit()


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
    stmt = select(HostingInterest).order_by(HostingInterest.created_at.desc())
    if current_user.role != UserRole.superadmin:
        ch_result = await db.execute(select(Chapter).where(Chapter.id == current_user.chapter_id))
        chapter = ch_result.scalar_one_or_none()
        if not chapter:
            return []
        stmt = stmt.where(
            HostingInterest.interest_type == InterestType.host_existing,
            HostingInterest.existing_chapter == chapter.name,
        )
    result = await db.execute(stmt)
    return result.scalars().all()


# ── System Settings (superadmin only) ────────────────────────────────────────

@router.post("/system-settings", response_model=SystemSettingResponse)
async def set_system_setting(
    body: SystemSettingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == body.key)
    )
    existing = result.scalar_one_or_none()
    encrypted = encrypt_key(body.value, settings.SECRET_KEY)
    if existing:
        existing.encrypted_value = encrypted
    else:
        db.add(SystemSetting(key=body.key, encrypted_value=encrypted))
    await db.commit()
    return SystemSettingResponse(key=body.key, has_value=True)


@router.get("/system-settings", response_model=list[SystemSettingResponse])
async def list_system_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    result = await db.execute(select(SystemSetting).order_by(SystemSetting.key))
    return [
        SystemSettingResponse(key=s.key, has_value=True)
        for s in result.scalars().all()
    ]


@router.delete("/system-settings/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_system_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == key)
    )
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    await db.delete(setting)
    await db.commit()


# ── Publishing ───────────────────────────────────────────────────────────────

@router.get("/substack-publication-url")
async def get_substack_publication_url(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    pub_url = await _get_setting(db, "substack_publication_url")
    return {"publication_url": pub_url}


async def _get_setting(db: AsyncSession, key: str) -> str | None:
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == key)
    )
    s = result.scalar_one_or_none()
    if not s:
        return None
    return decrypt_key(s.encrypted_value, settings.SECRET_KEY)


