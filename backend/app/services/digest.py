"""Weekly digest service: recipient selection, per-user content, and send.

Unlike the sidebar notifications summary (Task 3), the digest is a "what
arrived this week" report: sections are windowed on `created_at` and ignore
handled/pending state entirely — except the two admin-only one-line counts,
which use different semantics on purpose (see `build_digest`).
"""
import html
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.article import Article, ArticleStatus
from app.models.chapter import Chapter
from app.models.community_upload import CommunityUpload
from app.models.contact_message import ContactMessage
from app.models.hosting_interest import HostingInterest, InterestType
from app.models.job import Job, JobStatus
from app.models.user import User, UserRole
from app.models.volunteer import VolunteerApplication, VolunteerRole
from app.services.email import send_email


def previous_week_window(now: datetime) -> tuple[datetime, datetime]:
    """Previous Mon 00:00 UTC -> most recent Mon 00:00 UTC.

    If `now` is exactly Monday 00:00, the window returned is the week that
    just ended (`now` itself is the window's end).
    """
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    else:
        now = now.astimezone(timezone.utc)
    most_recent_monday = (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return most_recent_monday - timedelta(days=7), most_recent_monday


async def gather_recipients(db: AsyncSession) -> list[User]:
    """Active chapter leads and superadmins who have not opted out of digests."""
    stmt = select(User).where(
        User.is_active.is_(True),
        User.digest_opt_out.is_(False),
        User.role.in_([UserRole.chapter_lead, UserRole.superadmin]),
    )
    return list((await db.execute(stmt)).scalars().all())


def _esc(value) -> str:
    """html.escape every user-originated string before it lands in an email."""
    if value is None:
        return ""
    value = getattr(value, "value", value)  # unwrap str-enums, no-op on plain str
    return html.escape(str(value))


def _section(title: str, count: int, items_html: str, link: str) -> str:
    if count == 0:
        return ""
    return (
        f'<h3 style="color:#56a1d2">{title} ({count})</h3>'
        f"<ul>{items_html}</ul>"
        f'<p><a href="{link}">View all &rarr;</a></p>'
    )


async def build_digest(
    db: AsyncSession, user: User, window_start: datetime, window_end: datetime
) -> tuple[str, str, int] | None:
    """Build one user's digest email. Returns (subject, html, item_count),
    or None when there is nothing to report (no email should be sent).
    """
    is_admin = user.role == UserRole.superadmin
    chapter_id = None if is_admin else user.chapter_id

    chapters_by_id: dict[str, str] = {}
    if is_admin:
        chapters_by_id = {
            c.id: c.name for c in (await db.execute(select(Chapter))).scalars().all()
        }

    def _tag(cid: str | None) -> str:
        # Admin sections span every chapter — prefix each item with which one.
        if not is_admin:
            return ""
        label = chapters_by_id.get(cid, "Unassigned") if cid else "Unassigned"
        return f"[{_esc(label)}] "

    # Contact messages
    contact_stmt = select(ContactMessage).where(
        ContactMessage.created_at >= window_start,
        ContactMessage.created_at < window_end,
    )
    if chapter_id:
        contact_stmt = contact_stmt.where(ContactMessage.chapter_id == chapter_id)
    contacts = (await db.execute(contact_stmt)).scalars().all()
    contact_items = "".join(
        f"<li>{_tag(c.chapter_id)}{_esc(c.name or 'Anonymous')} "
        f"({_esc(c.email)}): {_esc(c.message)}</li>"
        for c in contacts
    )

    # Hosting interest — leads: host_existing in their own chapter only.
    # Admins: everything, including start_chapter proposals.
    hosting_stmt = select(HostingInterest).where(
        HostingInterest.created_at >= window_start,
        HostingInterest.created_at < window_end,
    )
    if chapter_id:
        hosting_stmt = hosting_stmt.where(
            HostingInterest.interest_type == InterestType.host_existing,
            HostingInterest.chapter_id == chapter_id,
        )
    hostings = (await db.execute(hosting_stmt)).scalars().all()
    hosting_items = "".join(
        f"<li>{_tag(h.chapter_id)}{_esc(h.name)} ({_esc(h.email)}) — "
        f"{_esc(h.city)}, {_esc(h.interest_type)}</li>"
        for h in hostings
    )

    # Volunteer applications, scoped via their role's chapter.
    volunteer_stmt = (
        select(VolunteerApplication)
        .options(selectinload(VolunteerApplication.role))
        .join(VolunteerRole, VolunteerApplication.role_id == VolunteerRole.id)
        .where(
            VolunteerApplication.created_at >= window_start,
            VolunteerApplication.created_at < window_end,
        )
    )
    if chapter_id:
        volunteer_stmt = volunteer_stmt.where(VolunteerRole.chapter_id == chapter_id)
    volunteer_apps = (await db.execute(volunteer_stmt)).scalars().all()
    volunteer_items = "".join(
        f"<li>{_tag(a.role.chapter_id)}{_esc(a.name)} ({_esc(a.email)}) "
        f"for {_esc(a.role.title)}</li>"
        for a in volunteer_apps
    )

    # New members.
    members_stmt = select(User).where(
        User.is_active.is_(True),
        User.created_at >= window_start,
        User.created_at < window_end,
    )
    if chapter_id:
        members_stmt = members_stmt.where(User.chapter_id == chapter_id)
    members = (await db.execute(members_stmt)).scalars().all()
    member_items = "".join(
        f"<li>{_tag(m.chapter_id)}{_esc(m.name or m.email)}</li>" for m in members
    )

    # Community uploads — admin only.
    uploads = []
    if is_admin:
        uploads_stmt = select(CommunityUpload).where(
            CommunityUpload.created_at >= window_start,
            CommunityUpload.created_at < window_end,
        )
        uploads = (await db.execute(uploads_stmt)).scalars().all()
    upload_items = "".join(
        f"<li>{_esc(u.name or 'Anonymous')} — {_esc(u.city)}</li>" for u in uploads
    )

    # Failed jobs — admin only, windowed on created_at like everything else
    # above. Unlike drafts-awaiting (a standing snapshot), this DOES count as
    # an "arrived" item: being window-scoped, it can't defeat skip-empty the
    # way an ever-present draft count would.
    failed_jobs_count = 0
    if is_admin:
        failed_jobs_count = (
            await db.execute(
                select(func.count(Job.id)).where(
                    Job.status == JobStatus.failed,
                    Job.created_at >= window_start,
                    Job.created_at < window_end,
                )
            )
        ).scalar_one()

    item_count = (
        len(contacts) + len(hostings) + len(volunteer_apps) + len(members)
        + len(uploads) + failed_jobs_count
    )
    if item_count == 0:
        return None

    parts = ['<h2 style="color:#111">Ai Salon — weekly digest</h2>']
    parts.append(
        _section(
            "Contact messages", len(contacts), contact_items,
            f"{settings.FRONTEND_URL}/contact-messages",
        )
    )
    parts.append(
        _section(
            "Hosting interest", len(hostings), hosting_items,
            f"{settings.FRONTEND_URL}/hosting-interest",
        )
    )
    parts.append(
        _section(
            "Volunteer applications", len(volunteer_apps), volunteer_items,
            f"{settings.FRONTEND_URL}/volunteer-applications",
        )
    )
    parts.append(
        _section(
            "New members", len(members), member_items,
            f"{settings.FRONTEND_URL}/people",
        )
    )

    if is_admin:
        parts.append(
            _section(
                "Community uploads", len(uploads), upload_items,
                f"{settings.FRONTEND_URL}/community-uploads",
            )
        )
        # Draft count is a standing status snapshot (not windowed) — display
        # only, deliberately excluded from item_count: otherwise any
        # lingering draft would defeat skip-empty forever. failed_jobs_count
        # was already computed above (it DOES count toward item_count).
        draft_count = (
            await db.execute(
                select(func.count(Article.id)).where(
                    Article.status == ArticleStatus.draft
                )
            )
        ).scalar_one()
        parts.append(
            f"<p>Draft articles currently awaiting publish: {draft_count}</p>"
            f"<p>Jobs failed this week: {failed_jobs_count}</p>"
        )
        subject = f"[Ai Salon] Weekly digest — {item_count} new items across Ai Salon"
    else:
        chapter_name = "your chapter"
        if user.chapter_id:
            chapter = (
                await db.execute(select(Chapter).where(Chapter.id == user.chapter_id))
            ).scalar_one_or_none()
            if chapter:
                chapter_name = chapter.name
        subject = (
            f"[Ai Salon] Weekly digest — {item_count} new item(s) for "
            f"{chapter_name}"
        )

    return subject, "".join(parts), item_count


async def run_digest(
    db: AsyncSession,
    window_start: datetime,
    window_end: datetime,
    only_email: str | None = None,
) -> int:
    """Build and send digests to every eligible recipient. Returns the number
    of emails actually sent (send_email returned True). Never touches
    DigestRun — the caller (send_digests.py) owns that guard.
    """
    recipients = await gather_recipients(db)
    if only_email:
        recipients = [u for u in recipients if u.email == only_email]

    sent = 0
    for user in recipients:
        built = await build_digest(db, user, window_start, window_end)
        if built is None:
            continue
        subject, body, _item_count = built
        if await send_email([user.email], subject, body):
            sent += 1
    return sent
