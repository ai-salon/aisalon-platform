import html
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.api.auth import limiter
from app.core.database import get_db, AsyncSessionLocal
from app.core.logging import get_logger
from app.models.chapter import Chapter
from app.models.contact_message import ContactMessage
from app.models.user import User, UserRole
from app.schemas.chapter import ChapterSummary, ChapterDetail
from app.schemas.contact import ContactRequest
from app.services.email import send_email

logger = get_logger(__name__)

router = APIRouter(prefix="/chapters", tags=["chapters"])


@router.get("", response_model=list[ChapterSummary])
async def list_chapters(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Chapter)
        .where(Chapter.status == "active")
        .order_by(Chapter.name)
    )
    return result.scalars().all()


@router.get("/{identifier}", response_model=ChapterDetail)
async def get_chapter(identifier: str, db: AsyncSession = Depends(get_db)):
    # Accept either code (string slug) or id (UUID)
    stmt = (
        select(Chapter)
        .where(
            (Chapter.status == "active")
            & ((Chapter.code == identifier) | (Chapter.id == identifier))
        )
    )
    result = await db.execute(stmt)
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    return chapter


@router.post("/{identifier}/contact", status_code=202)
@limiter.limit("5/hour")
async def contact_chapter(
    request: Request,
    identifier: str,
    body: ContactRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Chapter).where(
            (Chapter.status == "active")
            & ((Chapter.id == identifier) | (Chapter.code == identifier))
        )
    )
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    if body.website:  # honeypot — accept and drop
        return {"detail": "Message sent"}

    msg = ContactMessage(
        chapter_id=chapter.id, name=body.name, email=body.email, message=body.message
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    leads = (
        await db.execute(
            select(User).where(
                User.chapter_id == chapter.id,
                User.role == UserRole.chapter_lead,
                User.is_active.is_(True),
            )
        )
    ).scalars().all()
    if not leads:
        leads = (
            await db.execute(
                select(User).where(
                    User.role == UserRole.superadmin, User.is_active.is_(True)
                )
            )
        ).scalars().all()
    recipients = [u.email for u in leads]
    sender = body.name or body.email

    safe_name = html.escape(body.name) if body.name else "—"
    safe_email = html.escape(body.email)
    safe_message = html.escape(body.message)

    async def _forward() -> None:
        ok = await send_email(
            recipients,
            f"[Ai Salon] New message for {chapter.name} from {sender}",
            f"<p><b>From:</b> {safe_name} &lt;{safe_email}&gt;</p>"
            f"<p><b>Chapter:</b> {chapter.name}</p>"
            f"<p>{safe_message}</p>"
            f"<p style='color:#696969'>Reply to this email to answer directly.</p>",
            reply_to=body.email,
        )
        if not ok:
            logger.warning("contact_forward_failed", chapter_id=chapter.id, message_id=msg.id)
            return
        try:
            async with AsyncSessionLocal() as session:
                await session.execute(
                    update(ContactMessage)
                    .where(ContactMessage.id == msg.id)
                    .values(forwarded_at=datetime.now(timezone.utc))
                )
                await session.commit()
        except Exception as exc:
            logger.warning(
                "contact_forward_mark_sent_failed",
                chapter_id=chapter.id,
                message_id=msg.id,
                error_type=type(exc).__name__,
            )

    if recipients:
        background_tasks.add_task(_forward)
    return {"detail": "Message sent"}
