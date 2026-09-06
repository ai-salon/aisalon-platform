"""Tests for scripts/send_digests.py: the claim-first DigestRun guard and the
fail-loud check for an unconfigured RESEND_API_KEY.

main() talks to the DB via `scripts.send_digests.AsyncSessionLocal` directly
(it isn't wired through FastAPI's `get_db` dependency), so these tests point
that module attribute at the same in-memory sqlite engine the `db_session`
fixture uses, mirroring how tests/conftest.py's `client` fixture patches
app.api.admin.AsyncSessionLocal / app.api.chapters.AsyncSessionLocal.
"""
import sys
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.security import hash_password
from app.models.contact_message import ContactMessage
from app.models.digest_run import DigestRun
from app.models.user import User, UserRole
from app.services.digest import previous_week_window
from scripts import send_digests


@pytest.fixture
def bound_session_local(db_engine):
    """Point scripts.send_digests.AsyncSessionLocal at the test DB engine."""
    Session = async_sessionmaker(db_engine, expire_on_commit=False)
    original = send_digests.AsyncSessionLocal
    send_digests.AsyncSessionLocal = Session
    yield Session
    send_digests.AsyncSessionLocal = original


async def _seed_lead_with_item(Session, sf_chapter):
    """One active chapter lead + one in-window contact message in their own
    chapter, so run_digest has exactly one non-empty recipient to email."""
    now = datetime.now(timezone.utc)
    start, end = previous_week_window(now)
    async with Session() as session:
        lead = User(
            email="digestlead@x.co",
            username="digestlead",
            hashed_password=hash_password("password"),
            role=UserRole.chapter_lead,
            chapter_id=sf_chapter.id,
            is_active=True,
        )
        session.add(lead)
        msg = ContactMessage(
            chapter_id=sf_chapter.id,
            email="c@x.co",
            message="hi there",
            created_at=start + (end - start) / 2,
        )
        session.add(msg)
        await session.commit()
    return start, end


def _set_argv(monkeypatch, *args):
    monkeypatch.setattr(sys, "argv", ["send_digests.py", *args])


# ── Fail loud when email is unconfigured ─────────────────────────────────────

async def test_main_exits_nonzero_and_records_nothing_when_resend_unconfigured(
    monkeypatch, db_session, sf_chapter, capsys,
):
    monkeypatch.setattr(send_digests.settings, "RESEND_API_KEY", "")
    _set_argv(monkeypatch)

    code = await send_digests.main()

    assert code == 1
    assert "RESEND_API_KEY" in capsys.readouterr().out
    runs = (await db_session.execute(select(DigestRun))).scalars().all()
    assert runs == []


# ── Claim-first guard ────────────────────────────────────────────────────────

async def test_second_weekly_run_refused_even_after_a_mid_send_crash(
    monkeypatch, db_session, sf_chapter, bound_session_local,
):
    """The guard row must be committed BEFORE any email is sent: if the
    process crashes mid-loop, the row is already in place and a retried run
    is refused instead of resending (the up-to-4x Railway restart scenario)."""
    await _seed_lead_with_item(bound_session_local, sf_chapter)
    monkeypatch.setattr(send_digests.settings, "RESEND_API_KEY", "test-key")
    _set_argv(monkeypatch)

    with patch(
        "app.services.digest.send_email",
        new=AsyncMock(side_effect=RuntimeError("simulated mid-send crash")),
    ):
        with pytest.raises(RuntimeError):
            await send_digests.main()

    # The claim row exists even though the send crashed before completing;
    # recipients_count was never reached so it stays at its initial 0.
    runs = (await db_session.execute(select(DigestRun))).scalars().all()
    assert len(runs) == 1
    assert runs[0].recipients_count == 0

    # A second run (no --force) is refused — no duplicate row, no re-send.
    with patch(
        "app.services.digest.send_email", new=AsyncMock(return_value=True)
    ) as mock_send:
        code = await send_digests.main()
    assert code == 0
    mock_send.assert_not_called()
    runs2 = (await db_session.execute(select(DigestRun))).scalars().all()
    assert len(runs2) == 1  # still just the one claim row
    assert runs2[0].recipients_count == 0  # untouched by the refused run


async def test_force_reclaims_existing_row_and_records_final_recipients_count(
    monkeypatch, db_session, sf_chapter, bound_session_local,
):
    await _seed_lead_with_item(bound_session_local, sf_chapter)
    monkeypatch.setattr(send_digests.settings, "RESEND_API_KEY", "test-key")

    # First run claims the row but crashes mid-send (recipients_count stays 0).
    _set_argv(monkeypatch)
    with patch(
        "app.services.digest.send_email",
        new=AsyncMock(side_effect=RuntimeError("boom")),
    ):
        with pytest.raises(RuntimeError):
            await send_digests.main()

    # --force re-claims the SAME row (period_start is unique — no duplicate)
    # and, once the send succeeds this time, records the real count.
    _set_argv(monkeypatch, "--force")
    with patch(
        "app.services.digest.send_email", new=AsyncMock(return_value=True)
    ) as mock_send:
        code = await send_digests.main()
    assert code == 0
    mock_send.assert_awaited_once()

    runs = (await db_session.execute(select(DigestRun))).scalars().all()
    assert len(runs) == 1
    assert runs[0].recipients_count == 1


async def test_normal_run_claims_row_and_records_final_recipients_count(
    monkeypatch, db_session, sf_chapter, bound_session_local,
):
    """A clean (non-crashing) run: recipients_count reflects the final,
    post-loop send count."""
    await _seed_lead_with_item(bound_session_local, sf_chapter)
    monkeypatch.setattr(send_digests.settings, "RESEND_API_KEY", "test-key")
    _set_argv(monkeypatch)

    with patch(
        "app.services.digest.send_email", new=AsyncMock(return_value=True)
    ) as mock_send:
        code = await send_digests.main()
    assert code == 0
    mock_send.assert_awaited_once()

    runs = (await db_session.execute(select(DigestRun))).scalars().all()
    assert len(runs) == 1
    assert runs[0].recipients_count == 1
