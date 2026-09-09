"""Admin API endpoints: api-keys, jobs, articles, chapters, team."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, func, cast, Date, or_

from app.core.database import get_db, AsyncSessionLocal
from app.core.deps import get_current_user
from app.core.config import settings
from app.core.encryption import encrypt_key
from app.core.logging import get_logger
from app.models.user import User, UserRole
from app.models.api_key import UserAPIKey, APIKeyProvider
from app.models.job import Job, JobStatus
from app.models.article import Article, ArticleStatus
from app.models.chapter import Chapter
from app.models.contact_message import ContactMessage
from app.models.hosting_interest import HostingInterest, InterestType
from app.models.invite import Invite
from app.models.system_setting import SystemSetting
from app.models.login_event import UserLoginEvent
from app.models.volunteer import ApplicationStatus, VolunteerApplication, VolunteerRole
from app.models.community_upload import CommunityUpload, UploadStatus
from app.core.security import hash_password
from app.schemas.admin import (
    APIKeySetRequest, APIKeyResponse,
    JobResponse,
    ArticleResponse, ArticleUpdate, ArticleCreate,
    ChapterCreate, ChapterUpdate, ChapterResponse,
    UserCreate, UserUpdate, UserResponse, GuideReadRequest,
    InviteCreate, InviteResponse,
    ChapterStats, CommunityStatsResponse,
    SystemSettingRequest, SystemSettingResponse,
    ProcessingConfigResponse, ProcessingTestRequest, ProcessingTestResponse,
    HandledPatch, ContactMessageOut, HostingInterestAdminResponse,
    NotificationsSummaryResponse,
    DigestRunTestRequest, DigestRunTestResponse,
)
from app.services import password_reset
from app.services.digest import run_digest
from app.services.storage import save_upload
from app.services.processor import SocraticProcessor, system_key_for
from app.services import key_verification
from app.services.system_settings import (
    get_setting,
    set_setting,
    resolve_provider_key,
    resolve_model,
    ASSEMBLYAI_API_KEY as SETTING_ASSEMBLYAI,
    GOOGLE_API_KEY as SETTING_GOOGLE,
)

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


async def _find_duplicate(db: AsyncSession, content_hash: str, user: User) -> dict | None:
    """Detect a prior upload of the same file content (chapter-scoped; superadmin global).

    Returns a 409 detail dict, or None if this content is new. The Job's
    ``content_hash`` is the reliable dedup key: we flag any prior pending,
    processing, or completed job for this content. A completed job whose article
    happens to have an empty transcript (e.g. anonymization produced no transcript
    file) would otherwise slip past an article-only check and re-upload — so we
    match on the job itself and only offer "regenerate" when a reusable transcript
    actually exists.
    """
    chapter_id = _chapter_filter(user)

    def _scope_job(stmt):
        return stmt.where(Job.chapter_id == chapter_id) if chapter_id else stmt

    def _scope_art(stmt):
        return stmt.where(Article.chapter_id == chapter_id) if chapter_id else stmt

    # 1. Still in flight → tell the caller to wait rather than queue a second run.
    job_stmt = _scope_job(
        select(Job).where(
            Job.content_hash == content_hash,
            Job.status.in_([JobStatus.pending, JobStatus.processing]),
        )
    )
    job = (await db.execute(job_stmt.order_by(Job.created_at.desc()))).scalars().first()
    if job is not None:
        return {
            "code": "duplicate_processing",
            "message": "This file is already being processed.",
            "job_id": job.id,
        }

    # 2. Already produced an article with a reusable transcript → offer regenerate.
    art_stmt = _scope_art(
        select(Article).where(
            Article.content_hash == content_hash,
            Article.anonymized_transcript.is_not(None),
            Article.anonymized_transcript != "",
        )
    )
    art = (await db.execute(art_stmt.order_by(Article.created_at.desc()))).scalars().first()
    if art is not None:
        return {
            "code": "duplicate_upload",
            "message": "This file has already been turned into an article.",
            "can_regenerate": True,
            "existing_article": {
                "id": art.id,
                "title": art.title,
                "status": getattr(art.status, "value", art.status),
            },
        }

    # 3. Already processed by a completed job, even if no reusable transcript was
    #    stored. Surface the produced article (if any) for "view existing", but
    #    don't offer regenerate since there's no transcript to reuse.
    done_stmt = _scope_job(
        select(Job).where(
            Job.content_hash == content_hash,
            Job.status == JobStatus.completed,
        )
    )
    done = (await db.execute(done_stmt.order_by(Job.created_at.desc()))).scalars().first()
    if done is not None:
        detail: dict = {
            "code": "duplicate_upload",
            "message": "This file has already been processed.",
            "can_regenerate": False,
        }
        existing = (
            await db.execute(
                select(Article)
                .where(Article.job_id == done.id)
                .order_by(Article.created_at.desc())
            )
        ).scalars().first()
        if existing is not None:
            detail["existing_article"] = {
                "id": existing.id,
                "title": existing.title,
                "status": getattr(existing.status, "value", existing.status),
            }
        return detail

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
            if job.source_article_id:
                # Regenerate from a prior article's stored transcript — no audio, no
                # re-transcription.
                src = (await db.execute(
                    select(Article).where(Article.id == job.source_article_id)
                )).scalar_one_or_none()
                if src is None or not src.anonymized_transcript:
                    raise ValueError("Source article has no transcript to regenerate from")
                article_data = await processor.process_from_transcript(
                    transcript_text=src.anonymized_transcript,
                    source_filename=job.input_filename,
                    chapter_id=job.chapter_id,
                    user_id=job.user_id,
                    db=db,
                    on_step=set_step,
                )
            else:
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
                source_filename=job.input_filename,
                content_hash=job.content_hash,
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

        # Trigger graph ingestion if we have an article and meta. Uses the same
        # tiered key resolution as the pipeline (user → admin system key → env), so
        # ingestion works with the admin-managed Google key, not just a personal one.
        if job.status == JobStatus.completed and article is not None and article.meta:
            try:
                google_key = await resolve_provider_key(
                    db, APIKeyProvider.google, user_id=job.user_id
                )
                if google_key:
                    from app.services.graph import GraphIngestionService
                    svc = GraphIngestionService(db, google_key)
                    await svc.ingest_article(
                        article_id=article.id,
                        chapter_id=article.chapter_id,
                        publish_date=article.publish_date,
                        meta=article.meta,
                    )
                    job_log.info("graph_ingestion_complete", article_id=article.id)
                else:
                    job_log.warning("graph_ingestion_skipped_no_key", article_id=article.id)
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

        # Team size: count active users assigned to this chapter
        team_result = await db.execute(
            select(func.count(User.id)).where(
                User.chapter_id == ch.id,
                User.is_active.is_(True),
            )
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
        select(UserAPIKey.provider).where(UserAPIKey.user_id == current_user.id)
    )
    user_providers = {row[0] for row in result}
    out: list[APIKeyResponse] = []
    for provider in APIKeyProvider:
        user_has = provider in user_providers
        system_has = bool(system_key_for(provider))
        out.append(
            APIKeyResponse(
                provider=provider.value,
                has_key=user_has or system_has,
                user_has_key=user_has,
                system_has_key=system_has,
            )
        )
    return out


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

# Audio/video containers AssemblyAI can transcribe. content_type is client-supplied
# and spoofable, so we accept an "audio/" or "video/" prefix OR a known extension —
# enough to reject obvious mistakes (PDFs, images, text) before burning API credits.
ALLOWED_AUDIO_EXTENSIONS = {
    ".mp3", ".m4a", ".wav", ".ogg", ".oga", ".flac", ".aac",
    ".webm", ".mp4", ".mov", ".mpeg", ".mpga", ".opus", ".wma",
}


def _validate_audio_upload(file: UploadFile, size: int) -> None:
    if size > settings.MAX_UPLOAD_BYTES:
        limit_mb = settings.MAX_UPLOAD_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=413, detail=f"File too large (max {limit_mb} MB)"
        )
    ext = Path(file.filename or "").suffix.lower()
    ctype = (file.content_type or "").lower()
    if not (ctype.startswith(("audio/", "video/")) or ext in ALLOWED_AUDIO_EXTENSIONS):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Upload an audio recording "
            "(mp3, m4a, wav, etc.).",
        )


@router.post("/jobs", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    background_tasks: BackgroundTasks,
    chapter_id: str = Form(...),
    file: UploadFile = File(...),
    force: bool = Form(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Non-superadmins can only create jobs for their own chapter
    if current_user.role != UserRole.superadmin:
        if current_user.chapter_id != chapter_id:
            raise HTTPException(status_code=403, detail="Forbidden")

    # Reject early on the content-length-derived size when available, before
    # the whole body is buffered into memory.
    if file.size is not None:
        _validate_audio_upload(file, file.size)

    data = await file.read()
    _validate_audio_upload(file, len(data))

    content_hash = hashlib.sha256(data).hexdigest()
    # Unless explicitly forced, refuse to re-process a file we already have. The
    # caller can regenerate from the existing transcript instead (see the 409 detail).
    if not force:
        dup = await _find_duplicate(db, content_hash, current_user)
        if dup is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=dup)

    # Commit the job row before writing the (potentially large) file to disk so it
    # appears in the processing-history poll right away rather than only after the
    # disk write finishes. run_job (enqueued below) runs after the response is sent,
    # by which point input_storage_key is set.
    job = Job(
        user_id=current_user.id,
        chapter_id=chapter_id,
        status=JobStatus.pending,
        input_filename=file.filename,
        content_hash=content_hash,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    try:
        storage_key = await save_upload(file.filename or "upload", data)
    except Exception as exc:
        job.status = JobStatus.failed
        job.error_message = f"Could not save the uploaded file: {exc}"
        await db.commit()
        logger.exception("upload_save_failed", job_id=job.id)
        raise HTTPException(
            status_code=500, detail="Could not save the uploaded file."
        ) from exc

    job.input_storage_key = storage_key
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
    result = await db.execute(stmt.order_by(
        func.coalesce(Article.publish_date, cast(Article.created_at, Date)).desc(),
        Article.created_at.desc(),
    ))
    return result.scalars().all()


@router.get("/articles/draft-count")
async def get_draft_article_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(func.count(Article.id)).where(Article.status == ArticleStatus.draft)
    chapter_id = _chapter_filter(current_user)
    if chapter_id:
        stmt = stmt.where(Article.chapter_id == chapter_id)
    result = await db.execute(stmt)
    return {"count": result.scalar() or 0}


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


@router.post(
    "/articles/{article_id}/regenerate",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
)
async def regenerate_article(
    article_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Regenerate a fresh article from an existing article's stored transcript.

    Reuses the anonymized transcript (no re-transcription) and runs only the LLM steps
    with the current model. Produces a new draft alongside the original (keep-both).
    """
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if current_user.role != UserRole.superadmin and article.chapter_id != current_user.chapter_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not article.anonymized_transcript:
        raise HTTPException(status_code=400, detail="No stored transcript to regenerate from")

    job = Job(
        user_id=current_user.id,
        chapter_id=article.chapter_id,
        status=JobStatus.pending,
        input_filename=article.source_filename,
        input_storage_key=None,
        content_hash=article.content_hash,
        source_article_id=article.id,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    logger.info("regenerate_requested", job_id=job.id, source_article_id=article.id)
    background_tasks.add_task(run_job, job.id)
    return job


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

@router.get("/chapters", response_model=list[ChapterResponse])
async def list_chapters_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all chapters regardless of status (superadmin view)."""
    _require_admin(current_user)
    result = await db.execute(select(Chapter).order_by(Chapter.name))
    return result.scalars().all()


@router.post("/chapters", status_code=status.HTTP_201_CREATED)
async def create_chapter(
    body: ChapterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    existing = await db.execute(select(Chapter).where(Chapter.code == body.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Chapter code already exists")
    chapter = Chapter(
        code=body.code,
        name=body.name,
        title=body.name,
        description="",
        tagline="",
        about="",
        event_link="",
        calendar_embed="",
        events_description="",
        status="draft",
    )
    db.add(chapter)
    await db.flush()

    ghost_email = f"{chapter.code}@aisalon.xyz"
    existing_ghost = await db.execute(select(User).where(User.email == ghost_email))
    if not existing_ghost.scalar_one_or_none():
        ghost = User(
            email=ghost_email,
            username=chapter.code,
            hashed_password=hash_password(secrets.token_urlsafe(24)),
            role=UserRole.chapter_lead,
            chapter_id=chapter.id,
            is_active=True,
        )
        db.add(ghost)

    await db.commit()
    await db.refresh(chapter)
    return {
        "id": chapter.id,
        "code": chapter.code,
        "name": chapter.name,
        "status": chapter.status,
    }


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


@router.patch("/chapters/{identifier}", response_model=ChapterResponse)
async def update_chapter(
    identifier: str,
    body: ChapterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_lead_or_above(current_user)
    result = await db.execute(
        select(Chapter).where(
            (Chapter.id == identifier) | (Chapter.code == identifier)
        )
    )
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    if current_user.role != UserRole.superadmin and current_user.chapter_id != chapter.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(chapter, field, value)
    await db.commit()
    await db.refresh(chapter)
    return chapter


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
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    if not body.password and not body.send_password_link:
        raise HTTPException(
            status_code=400,
            detail="Give a password or send the person a link to set one",
        )
    if body.send_password_link and not password_reset.email_configured():
        raise HTTPException(
            status_code=503,
            detail="Email is not configured — set a password instead",
        )
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")
    if body.username:
        existing_un = await db.execute(select(User).where(User.username == body.username))
        if existing_un.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Username already taken")
    if body.chapter_id is not None:
        chapter_result = await db.execute(select(Chapter).where(Chapter.id == body.chapter_id))
        if not chapter_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Chapter not found")
    user = User(
        email=body.email,
        username=body.username,
        # No password given: an unguessable placeholder until the person sets one.
        hashed_password=hash_password(body.password or secrets.token_urlsafe(24)),
        role=body.role,
        chapter_id=body.chapter_id,
        is_active=True,
        name=body.name,
        title=body.title,
        linkedin=body.linkedin,
        description=body.description,
        is_founder=body.is_founder,
        # An account created with a name is complete; no onboarding prompt.
        profile_completed_at=datetime.now(timezone.utc) if body.name else None,
    )
    token = password_reset.issue_reset_token(user) if body.send_password_link else None
    db.add(user)
    await db.commit()
    await db.refresh(user)
    if token:
        background_tasks.add_task(
            password_reset.send_password_reset_email, user.email, token, new_account=True
        )
        logger.info("password_link_sent_on_create", user_id=user.id)
    return user


@router.post("/users/{user_id}/password-reset-link", status_code=status.HTTP_202_ACCEPTED)
async def send_user_password_reset_link(
    user_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Email an existing account a single-use link to set a new password."""
    _require_admin(current_user)
    if not password_reset.email_configured():
        raise HTTPException(
            status_code=503, detail="Email is not configured — contact an administrator"
        )
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    token = password_reset.issue_reset_token(user)
    db.add(user)
    await db.commit()
    background_tasks.add_task(
        password_reset.send_password_reset_email, user.email, token, new_account=True
    )
    logger.info("password_link_sent_by_admin", user_id=user.id)
    return {"detail": f"Set-password link sent to {user.email}"}


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
    # exclude_unset (not exclude_none) so an explicit chapter_id: null clears
    # the chapter; explicit nulls are meaningless for the other fields.
    data = body.model_dump(exclude_unset=True)
    for field in ("role", "is_active", "password", "email", "is_founder"):
        if field in data and data[field] is None:
            data.pop(field)
    # Optional text fields: blank means clear (e.g. turning a login back into a
    # nameless ghost).
    for field in ("name", "username", "title", "linkedin", "description"):
        if isinstance(data.get(field), str):
            data[field] = data[field].strip() or None
    if "role" in data and user_id == current_user.id and data["role"] != current_user.role.value:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    if data.get("chapter_id") is not None:
        chapter_result = await db.execute(
            select(Chapter).where(Chapter.id == data["chapter_id"])
        )
        if not chapter_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Chapter not found")
    if "email" in data:
        taken = await db.execute(
            select(User).where(User.email == data["email"], User.id != user_id)
        )
        if taken.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Email already in use")
    if data.get("username") is not None:
        taken = await db.execute(
            select(User).where(User.username == data["username"], User.id != user_id)
        )
        if taken.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Username already taken")
    if "password" in data:
        data["hashed_password"] = hash_password(data.pop("password"))
    for field, value in data.items():
        setattr(user, field, value)
    # Completeness is "has a name": an admin naming an account completes it.
    if user.name and user.profile_completed_at is None:
        user.profile_completed_at = datetime.now(timezone.utc)
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


# ── People (User profile management) ──────────────────────────────────────────

@router.get("/people")
async def admin_list_people(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(User).options(selectinload(User.chapter))
    if current_user.role in (UserRole.superadmin, UserRole.chapter_lead):
        # Editors also see hidden members who have a profile, so they can un-hide
        # them. Nameless chapter ghost logins stay out of the list.
        stmt = stmt.where(or_(User.hide_from_team.is_(False), User.name.isnot(None)))
    else:
        stmt = stmt.where(User.hide_from_team.is_(False))
    chapter_filter = _chapter_filter(current_user)
    if chapter_filter:
        stmt = stmt.where(User.chapter_id == chapter_filter)
    result = await db.execute(stmt.order_by(User.display_order, User.name))
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role.value,
            "name": u.name,
            "title": u.title,
            "is_founder": u.is_founder,
            "display_order": u.display_order,
            "profile_image_url": u.profile_image_url,
            "profile_completed_at": u.profile_completed_at.isoformat() if u.profile_completed_at else None,
            "hide_from_team": u.hide_from_team,
            "chapter_code": u.chapter.code if u.chapter else None,
            "chapter_name": u.chapter.name if u.chapter else None,
        }
        for u in result.scalars().unique().all()
    ]


class PersonUpdate(BaseModel):
    # Presentation only. Account attributes (founder, role, chapter, identity)
    # live on the Users page / PATCH /admin/users.
    title: str | None = None
    display_order: int | None = None
    profile_image_url: str | None = None
    hide_from_team: bool | None = None


@router.patch("/people/{user_id}")
async def admin_update_person(
    user_id: str,
    body: PersonUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_lead_or_above(current_user)
    row = await db.execute(select(User).where(User.id == user_id))
    target = row.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.role != UserRole.superadmin:
        # Chapter leads: own chapter only (404 so other chapters' members aren't
        # enumerable), never superadmins or founders, presentational fields only.
        if current_user.chapter_id is None or target.chapter_id != current_user.chapter_id:
            raise HTTPException(status_code=404, detail="User not found")
        if target.role == UserRole.superadmin or target.is_founder:
            raise HTTPException(
                status_code=403,
                detail="Chapter leads can only edit hosts and co-leads in their chapter",
            )
        if body.profile_image_url is not None:
            raise HTTPException(
                status_code=403,
                detail="Chapter leads can only change title, order, and visibility",
            )
    if body.title is not None:
        target.title = body.title
    if body.display_order is not None:
        target.display_order = body.display_order
    if body.profile_image_url is not None:
        target.profile_image_url = body.profile_image_url
    if body.hide_from_team is not None:
        target.hide_from_team = body.hide_from_team
    await db.commit()
    await db.refresh(target)
    return {"ok": True}


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
    ch_result = await db.execute(select(Chapter).where(Chapter.id == body.chapter_id))
    ch = ch_result.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")
    if ch.status == "archived":
        raise HTTPException(status_code=400, detail="Cannot invite to an archived chapter")
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


# ── Contact Messages ────────────────────────────────────────────────────────

@router.get("/contact-messages", response_model=list[ContactMessageOut])
async def list_contact_messages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_lead_or_above(current_user)
    stmt = select(ContactMessage, Chapter.name).join(
        Chapter, Chapter.id == ContactMessage.chapter_id
    ).order_by(ContactMessage.created_at.desc())
    chapter_id = _chapter_filter(current_user)
    if chapter_id:
        stmt = stmt.where(ContactMessage.chapter_id == chapter_id)
    rows = (await db.execute(stmt)).all()
    out = []
    for msg, chapter_name in rows:
        item = ContactMessageOut.model_validate(msg)
        item.chapter_name = chapter_name
        out.append(item)
    return out


@router.patch("/contact-messages/{message_id}", response_model=ContactMessageOut)
async def patch_contact_message(
    message_id: str,
    body: HandledPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_lead_or_above(current_user)
    msg = (
        await db.execute(select(ContactMessage).where(ContactMessage.id == message_id))
    ).scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Not found")
    chapter_id = _chapter_filter(current_user)
    if chapter_id and msg.chapter_id != chapter_id:
        raise HTTPException(status_code=404, detail="Not found")
    msg.status = body.status
    if body.status == "handled":
        msg.handled_by = current_user.id
        msg.handled_at = datetime.now(timezone.utc)
    else:
        msg.handled_by = None
        msg.handled_at = None
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    # Mirror list_contact_messages: chapter_name isn't a column on the ORM
    # model, so returning `msg` directly leaves it null and blanks the
    # contact page's Chapter cell after a status toggle.
    chapter_name = (
        await db.execute(select(Chapter.name).where(Chapter.id == msg.chapter_id))
    ).scalar_one_or_none()
    item = ContactMessageOut.model_validate(msg)
    item.chapter_name = chapter_name
    return item


# ── Hosting Interest ────────────────────────────────────────────────────────

@router.get("/hosting-interest", response_model=list[HostingInterestAdminResponse])
async def list_hosting_interest(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_lead_or_above(current_user)
    stmt = (
        select(HostingInterest, Chapter.name)
        .outerjoin(Chapter, Chapter.id == HostingInterest.chapter_id)
        .order_by(HostingInterest.created_at.desc())
    )
    chapter_id = _chapter_filter(current_user)
    if chapter_id:
        stmt = stmt.where(
            HostingInterest.interest_type == InterestType.host_existing,
            HostingInterest.chapter_id == chapter_id,
        )
    rows = (await db.execute(stmt)).all()
    out = []
    for hi, chapter_name in rows:
        item = HostingInterestAdminResponse.model_validate(hi)
        item.chapter_name = chapter_name
        out.append(item)
    return out


@router.patch(
    "/hosting-interest/{interest_id}", response_model=HostingInterestAdminResponse
)
async def patch_hosting_interest(
    interest_id: str,
    body: HandledPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_lead_or_above(current_user)
    hi = (
        await db.execute(
            select(HostingInterest).where(HostingInterest.id == interest_id)
        )
    ).scalar_one_or_none()
    if not hi:
        raise HTTPException(status_code=404, detail="Not found")
    chapter_id = _chapter_filter(current_user)
    if chapter_id and not (
        hi.interest_type == InterestType.host_existing and hi.chapter_id == chapter_id
    ):
        raise HTTPException(status_code=404, detail="Not found")
    hi.status = body.status
    if body.status == "handled":
        hi.handled_by = current_user.id
        hi.handled_at = datetime.now(timezone.utc)
    else:
        hi.handled_by = None
        hi.handled_at = None
    db.add(hi)
    await db.commit()
    await db.refresh(hi)
    # Mirror list_hosting_interest: chapter_name isn't a column on the ORM
    # model, so returning `hi` directly leaves it null (blanking the Chapter
    # cell after a toggle) — or, previously, left the frontend falling back
    # to the user-typed `existing_chapter` free-text, which can be
    # stale/differently-cased than the resolved chapter's canonical name.
    chapter_name = None
    if hi.chapter_id:
        chapter_name = (
            await db.execute(select(Chapter.name).where(Chapter.id == hi.chapter_id))
        ).scalar_one_or_none()
    item = HostingInterestAdminResponse.model_validate(hi)
    item.chapter_name = chapter_name
    return item


# ── Notifications Summary ───────────────────────────────────────────────────

@router.get("/notifications/summary", response_model=NotificationsSummaryResponse)
async def notifications_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Role-scoped counts feeding the admin sidebar's notification badges.

    Hosts get a 200 with all-zero counts (not 403) — they simply have nothing
    to action here. Chapter leads see counts scoped to their own chapter;
    superadmins see everything.
    """
    if current_user.role == UserRole.host:
        return NotificationsSummaryResponse(
            contact_messages=0,
            hosting_interest=0,
            volunteer_applications=0,
            new_members=0,
            community_uploads=0,
        )

    chapter_id = _chapter_filter(current_user)
    is_admin = current_user.role == UserRole.superadmin

    contact_stmt = select(func.count(ContactMessage.id)).where(
        ContactMessage.status == "new"
    )
    if chapter_id:
        contact_stmt = contact_stmt.where(ContactMessage.chapter_id == chapter_id)
    contact_count = (await db.execute(contact_stmt)).scalar_one()

    hosting_stmt = select(func.count(HostingInterest.id)).where(
        HostingInterest.status == "new"
    )
    if chapter_id:
        hosting_stmt = hosting_stmt.where(
            HostingInterest.interest_type == InterestType.host_existing,
            HostingInterest.chapter_id == chapter_id,
        )
    hosting_count = (await db.execute(hosting_stmt)).scalar_one()

    if chapter_id:
        volunteer_stmt = (
            select(func.count(VolunteerApplication.id))
            .join(VolunteerRole)
            .where(
                VolunteerApplication.status == ApplicationStatus.pending,
                VolunteerRole.chapter_id == chapter_id,
            )
        )
    else:
        volunteer_stmt = select(func.count(VolunteerApplication.id)).where(
            VolunteerApplication.status == ApplicationStatus.pending
        )
    volunteer_count = (await db.execute(volunteer_stmt)).scalar_one()

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    members_stmt = select(func.count(User.id)).where(
        User.is_active.is_(True), User.created_at >= cutoff
    )
    if chapter_id:
        members_stmt = members_stmt.where(User.chapter_id == chapter_id)
    new_members_count = (await db.execute(members_stmt)).scalar_one()

    uploads_count = 0
    if is_admin:
        uploads_stmt = select(func.count(CommunityUpload.id)).where(
            CommunityUpload.status == UploadStatus.pending
        )
        uploads_count = (await db.execute(uploads_stmt)).scalar_one()

    return NotificationsSummaryResponse(
        contact_messages=contact_count,
        hosting_interest=hosting_count,
        volunteer_applications=volunteer_count,
        new_members=new_members_count,
        community_uploads=uploads_count,
    )


# ── Digest test-send (superadmin only) ──────────────────────────────────────

@router.post("/digests/run-test", response_model=DigestRunTestResponse)
async def run_test_digest(
    body: DigestRunTestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a real digest immediately so a superadmin can eyeball it.

    Runs inline (not via BackgroundTasks) so the caller gets the actual sent
    count back. Never writes DigestRun — that guard belongs solely to the
    scheduled send_digests.py script.

    only_me=true is an explicit, self-directed test request, so the caller's
    own digest_opt_out is ignored for it — an opted-out superadmin still gets
    their own test send (they just won't receive the real weekly digest).
    """
    _require_admin(current_user)
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=body.window_days)
    only_email = current_user.email if body.only_me else None
    sent = await run_digest(
        db, window_start, now,
        only_email=only_email,
        include_opted_out_email=only_email,
    )
    return DigestRunTestResponse(sent=sent, window_days=body.window_days)


# ── System Settings (superadmin only) ────────────────────────────────────────

@router.post("/system-settings", response_model=SystemSettingResponse)
async def set_system_setting(
    body: SystemSettingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    await set_setting(db, body.key, body.value)
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
    pub_url = await get_setting(db, "substack_publication_url")
    return {"publication_url": pub_url}


# ── AI Processing config: admin-managed keys + model (superadmin only) ─────────

@router.get("/processing-config", response_model=ProcessingConfigResponse)
async def get_processing_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Report whether system keys are set and the effective processing model.

    Keys are never echoed — only set/not-set. The model value is non-secret and returned
    so the admin UI can show the current selection.
    """
    _require_admin(current_user)
    assemblyai_set = bool(await get_setting(db, SETTING_ASSEMBLYAI)) or bool(settings.ASSEMBLYAI_API_KEY)
    google_set = bool(await get_setting(db, SETTING_GOOGLE)) or bool(settings.GOOGLE_API_KEY)
    model, source = await resolve_model(db)
    return ProcessingConfigResponse(
        assemblyai_set=assemblyai_set,
        google_set=google_set,
        model=model,
        model_source=source,
    )


@router.post("/processing/test", response_model=ProcessingTestResponse)
async def test_processing_config(
    body: ProcessingTestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run a live verification of a candidate key or model before it is saved.

    The check runs in a thread executor (sync external SDKs). For a model test we resolve
    the currently-saved Google system key, so the model is exercised exactly as a real job
    would (an unsupported model fails here rather than silently at job time).
    """
    _require_admin(current_user)
    import asyncio

    loop = asyncio.get_running_loop()
    if body.target == "assemblyai":
        ok, message = await loop.run_in_executor(
            None, key_verification.verify_assemblyai_key, body.value
        )
    elif body.target == "google":
        ok, message = await loop.run_in_executor(
            None, key_verification.verify_google_key, body.value
        )
    elif body.target == "model":
        google_key = await resolve_provider_key(db, APIKeyProvider.google)
        ok, message = await loop.run_in_executor(
            None, key_verification.verify_model, body.value, google_key
        )
    else:
        raise HTTPException(status_code=422, detail="Unknown test target")
    return ProcessingTestResponse(ok=ok, message=message)


