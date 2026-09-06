"""Tests for the weekly digest service (app/services/digest.py)."""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from sqlalchemy import select

from app.core.security import hash_password
from app.models.article import Article, ArticleStatus
from app.models.community_upload import CommunityUpload
from app.models.contact_message import ContactMessage
from app.models.digest_run import DigestRun
from app.models.hosting_interest import HostingInterest, InterestType
from app.models.job import Job, JobStatus
from app.models.user import User, UserRole
from app.models.volunteer import ApplicationStatus, VolunteerApplication, VolunteerRole
from app.services.digest import (
    build_digest,
    gather_recipients,
    previous_week_window,
    run_digest,
)

# A fixed Monday-aligned window used by all content tests, independent of
# previous_week_window's own math (tested separately below).
WSTART = datetime(2026, 8, 24, tzinfo=timezone.utc)  # Monday
WEND = datetime(2026, 8, 31, tzinfo=timezone.utc)  # following Monday
IN_WINDOW = WSTART + timedelta(days=2)
BEFORE_WINDOW = WSTART - timedelta(days=1)
AFTER_WINDOW = WEND + timedelta(days=1)


# ── Seeding helpers ──────────────────────────────────────────────────────────

async def _mk_user(db_session, email, role, chapter_id=None, **kw):
    user = User(
        email=email,
        username=email.split("@")[0],
        hashed_password=hash_password("password"),
        role=role,
        chapter_id=chapter_id,
        is_active=kw.pop("is_active", True),
        digest_opt_out=kw.pop("digest_opt_out", False),
        **kw,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def _mk_contact(db_session, chapter_id, created_at=IN_WINDOW, **kw):
    msg = ContactMessage(
        chapter_id=chapter_id,
        email="c@x.co",
        message=kw.pop("message", "hello there"),
        created_at=created_at,
        **kw,
    )
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(msg)
    return msg


async def _mk_hosting(
    db_session, interest_type, chapter_id=None, created_at=IN_WINDOW, **kw
):
    hi = HostingInterest(
        name=kw.pop("name", "A"),
        email="a@x.co",
        city="SF",
        interest_type=interest_type,
        chapter_id=chapter_id,
        created_at=created_at,
        **kw,
    )
    db_session.add(hi)
    await db_session.commit()
    await db_session.refresh(hi)
    return hi


async def _mk_volunteer_role(db_session, chapter_id=None, slug="role"):
    role = VolunteerRole(
        title="Greeter", slug=slug, description="A volunteer role", chapter_id=chapter_id
    )
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    return role


async def _mk_volunteer_application(db_session, role_id, created_at=IN_WINDOW, **kw):
    app = VolunteerApplication(
        role_id=role_id,
        name=kw.pop("name", "V"),
        email="v@x.co",
        city="SF",
        why_interested="w",
        relevant_experience="r",
        availability="a",
        status=ApplicationStatus.pending,
        created_at=created_at,
    )
    db_session.add(app)
    await db_session.commit()
    await db_session.refresh(app)
    return app


async def _mk_upload(db_session, created_at=IN_WINDOW):
    upload = CommunityUpload(
        city="SF", audio_path="community/test.wav", created_at=created_at
    )
    db_session.add(upload)
    await db_session.commit()
    await db_session.refresh(upload)
    return upload


async def _mk_member(db_session, chapter_id, created_at=IN_WINDOW, role=UserRole.host):
    return await _mk_user(
        db_session,
        f"member-{uuid.uuid4().hex[:8]}@x.co",
        role,
        chapter_id=chapter_id,
        created_at=created_at,
    )


async def _mk_article(db_session, chapter_id, status=ArticleStatus.draft, created_at=IN_WINDOW):
    article = Article(
        chapter_id=chapter_id, title="T", content_md="", status=status, created_at=created_at
    )
    db_session.add(article)
    await db_session.commit()
    await db_session.refresh(article)
    return article


async def _mk_job(db_session, user_id, chapter_id, status=JobStatus.failed, created_at=IN_WINDOW):
    job = Job(user_id=user_id, chapter_id=chapter_id, status=status, created_at=created_at)
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)
    return job


# ── Window math ──────────────────────────────────────────────────────────────

def test_previous_week_window_mid_week():
    # Wednesday 2026-08-26 14:30 UTC
    now = datetime(2026, 8, 26, 14, 30, tzinfo=timezone.utc)
    start, end = previous_week_window(now)
    assert end == datetime(2026, 8, 24, tzinfo=timezone.utc)  # this week's Monday 00:00
    assert start == datetime(2026, 8, 17, tzinfo=timezone.utc)  # previous Monday 00:00
    assert start.tzinfo is not None
    assert end.tzinfo is not None


def test_previous_week_window_exactly_monday():
    # Exactly Monday 00:00 UTC — window is the week that just ended.
    now = datetime(2026, 8, 24, 0, 0, tzinfo=timezone.utc)
    start, end = previous_week_window(now)
    assert end == now
    assert start == now - timedelta(days=7)


# ── Recipient selection ──────────────────────────────────────────────────────

async def test_gather_recipients_excludes_optout_inactive_hosts(db_session, sf_chapter):
    lead = await _mk_user(db_session, "lead1@x.co", UserRole.chapter_lead, sf_chapter.id)
    admin = await _mk_user(db_session, "admin1@x.co", UserRole.superadmin)
    await _mk_user(
        db_session, "optout@x.co", UserRole.chapter_lead, sf_chapter.id, digest_opt_out=True
    )
    await _mk_user(
        db_session, "inactive@x.co", UserRole.chapter_lead, sf_chapter.id, is_active=False
    )
    await _mk_user(db_session, "host1@x.co", UserRole.host, sf_chapter.id)

    recipients = await gather_recipients(db_session)
    emails = {u.email for u in recipients}
    assert emails == {lead.email, admin.email}


# ── Empty digest ─────────────────────────────────────────────────────────────

async def test_build_digest_empty_is_none_for_lead(db_session, sf_chapter):
    lead = await _mk_user(db_session, "lead2@x.co", UserRole.chapter_lead, sf_chapter.id)
    result = await build_digest(db_session, lead, WSTART, WEND)
    assert result is None


async def test_build_digest_empty_is_none_for_admin(db_session):
    admin = await _mk_user(db_session, "admin2@x.co", UserRole.superadmin)
    result = await build_digest(db_session, admin, WSTART, WEND)
    assert result is None


# ── Lead scoping ─────────────────────────────────────────────────────────────

async def test_build_digest_lead_excludes_other_chapters_and_start_chapter(
    db_session, sf_chapter
):
    other = await _mk_user(db_session, "otheradmin@x.co", UserRole.superadmin)
    # (need a second chapter — create directly)
    from app.models.chapter import Chapter

    other_chapter = Chapter(
        code="ny", name="New York", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="active",
    )
    db_session.add(other_chapter)
    await db_session.commit()
    await db_session.refresh(other_chapter)

    lead = await _mk_user(db_session, "lead3@x.co", UserRole.chapter_lead, sf_chapter.id)

    # Own chapter, host_existing — included.
    await _mk_contact(db_session, sf_chapter.id, message="own contact")
    await _mk_hosting(db_session, InterestType.host_existing, sf_chapter.id, name="own-host")
    own_role = await _mk_volunteer_role(db_session, sf_chapter.id, slug="own-role")
    await _mk_volunteer_application(db_session, own_role.id, name="own-vol")
    await _mk_member(db_session, sf_chapter.id)

    # Other chapter — excluded.
    await _mk_contact(db_session, other_chapter.id, message="other contact")
    await _mk_hosting(
        db_session, InterestType.host_existing, other_chapter.id, name="other-host"
    )
    other_role = await _mk_volunteer_role(db_session, other_chapter.id, slug="other-role")
    await _mk_volunteer_application(db_session, other_role.id, name="other-vol")
    await _mk_member(db_session, other_chapter.id)

    # start_chapter interest for the lead's own chapter — excluded regardless.
    await _mk_hosting(
        db_session, InterestType.start_chapter, sf_chapter.id, name="start-chapter-interest"
    )

    subject, html_body, item_count = await build_digest(db_session, lead, WSTART, WEND)

    assert "San Francisco" in subject
    assert item_count == 4  # contact, host_existing hosting, volunteer app, member
    assert "own contact" in html_body
    assert "own-host" in html_body
    assert "own-vol" in html_body
    assert "other contact" not in html_body
    assert "other-host" not in html_body
    assert "other-vol" not in html_body
    assert "start-chapter-interest" not in html_body
    del other  # unused beyond seeding-neutral


# ── Admin scoping ────────────────────────────────────────────────────────────

async def test_build_digest_admin_includes_uploads_start_chapter_and_counts(
    db_session, sf_chapter
):
    admin = await _mk_user(db_session, "admin3@x.co", UserRole.superadmin)

    await _mk_contact(db_session, sf_chapter.id, message="admin-visible contact")
    await _mk_hosting(
        db_session, InterestType.start_chapter, None, name="new-city-interest"
    )
    await _mk_upload(db_session)

    # Draft articles: current-status snapshot, NOT windowed — seed one outside
    # the window to prove it's still counted.
    await _mk_article(db_session, sf_chapter.id, created_at=BEFORE_WINDOW)
    await _mk_article(db_session, sf_chapter.id, status=ArticleStatus.published)

    # Failed jobs: windowed on created_at — one inside, one outside.
    await _mk_job(db_session, admin.id, sf_chapter.id, created_at=IN_WINDOW)
    await _mk_job(db_session, admin.id, sf_chapter.id, created_at=AFTER_WINDOW)
    await _mk_job(db_session, admin.id, sf_chapter.id, status=JobStatus.completed)

    subject, html_body, item_count = await build_digest(db_session, admin, WSTART, WEND)

    assert "across Ai Salon" in subject
    assert "new-city-interest" in html_body  # start_chapter visible to admin
    assert "Community uploads" in html_body
    assert item_count == 3  # contact + start_chapter hosting + upload
    assert "Draft articles currently awaiting publish: 1" in html_body
    assert "Jobs failed this week: 1" in html_body


# ── run_digest ───────────────────────────────────────────────────────────────

async def test_run_digest_sends_per_recipient_and_respects_only_email(
    db_session, sf_chapter
):
    lead = await _mk_user(db_session, "lead4@x.co", UserRole.chapter_lead, sf_chapter.id)
    admin = await _mk_user(db_session, "admin4@x.co", UserRole.superadmin)
    # One item visible to both (lead sees own-chapter, admin sees globally).
    await _mk_contact(db_session, sf_chapter.id, message="shared item")

    with patch(
        "app.services.digest.send_email", new=AsyncMock(return_value=True)
    ) as mock_send:
        sent = await run_digest(db_session, WSTART, WEND)
    assert sent == 2
    assert mock_send.call_count == 2
    sent_to = {call.args[0][0] for call in mock_send.call_args_list}
    assert sent_to == {lead.email, admin.email}

    with patch(
        "app.services.digest.send_email", new=AsyncMock(return_value=True)
    ) as mock_send_only:
        sent_only = await run_digest(db_session, WSTART, WEND, only_email=lead.email)
    assert sent_only == 1
    assert mock_send_only.call_args.args[0] == [lead.email]

    # run_digest never touches DigestRun — the script owns that guard.
    runs = (await db_session.execute(select(DigestRun))).scalars().all()
    assert runs == []


async def test_run_digest_counts_only_successful_sends(db_session, sf_chapter):
    await _mk_user(db_session, "lead5@x.co", UserRole.chapter_lead, sf_chapter.id)
    await _mk_contact(db_session, sf_chapter.id, message="item")

    with patch("app.services.digest.send_email", new=AsyncMock(return_value=False)):
        sent = await run_digest(db_session, WSTART, WEND)
    assert sent == 0


async def test_run_digest_skips_recipients_with_empty_digest(db_session, sf_chapter):
    # A lead with nothing in their own chapter's window gets no email at all.
    lead = await _mk_user(db_session, "lead6@x.co", UserRole.chapter_lead, sf_chapter.id)

    from app.models.chapter import Chapter

    other_chapter = Chapter(
        code="la", name="Los Angeles", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="active",
    )
    db_session.add(other_chapter)
    await db_session.commit()
    await db_session.refresh(other_chapter)
    await _mk_contact(db_session, other_chapter.id, message="not lead's chapter")

    with patch(
        "app.services.digest.send_email", new=AsyncMock(return_value=True)
    ) as mock_send:
        sent = await run_digest(db_session, WSTART, WEND, only_email=lead.email)
    assert sent == 0
    mock_send.assert_not_called()


# ── Escaping ─────────────────────────────────────────────────────────────────

async def test_build_digest_escapes_user_content(db_session, sf_chapter):
    lead = await _mk_user(db_session, "lead7@x.co", UserRole.chapter_lead, sf_chapter.id)
    await _mk_contact(db_session, sf_chapter.id, message="<b>x</b>")

    _subject, html_body, _count = await build_digest(db_session, lead, WSTART, WEND)

    assert "<b>x</b>" not in html_body
    assert "&lt;b&gt;x&lt;/b&gt;" in html_body
