"""Tests for the emailed password reset flow."""
import hashlib
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient

from app.models.user import User

STRONG = "Correct-Horse-42"


def _configured():
    return patch("app.services.password_reset.settings.RESEND_API_KEY", "re_test")


def _mock_send():
    return patch("app.services.password_reset.send_email", new=AsyncMock(return_value=True))


def _token_from_email(mock) -> str:
    html = mock.await_args.args[2]
    return html.split("reset-password?token=")[1].split('"')[0]


async def test_forgot_password_emails_a_link(client: AsyncClient, chapter_lead, db_session):
    with _configured(), _mock_send() as m:
        r = await client.post("/auth/forgot-password", json={"email": chapter_lead.email.upper()})
    assert r.status_code == 202
    m.assert_awaited_once()
    assert m.await_args.args[0] == [chapter_lead.email]
    assert "Reset your" in m.await_args.args[1]
    await db_session.refresh(chapter_lead)
    assert chapter_lead.password_reset_token_hash is not None
    assert chapter_lead.password_reset_expires_at is not None


async def test_forgot_password_unknown_email_is_silent(client: AsyncClient):
    with _configured(), _mock_send() as m:
        r = await client.post("/auth/forgot-password", json={"email": "nobody@example.com"})
    assert r.status_code == 202
    m.assert_not_awaited()


async def test_forgot_password_fails_closed_without_email(client: AsyncClient, chapter_lead):
    with patch("app.services.password_reset.settings.RESEND_API_KEY", ""), _mock_send() as m:
        r = await client.post("/auth/forgot-password", json={"email": chapter_lead.email})
    assert r.status_code == 503
    m.assert_not_awaited()


async def test_reset_password_sets_new_password_once(
    client: AsyncClient, chapter_lead, db_session
):
    with _configured(), _mock_send() as m:
        await client.post("/auth/forgot-password", json={"email": chapter_lead.email})
    token = _token_from_email(m)

    r = await client.post("/auth/reset-password", json={"token": token, "new_password": STRONG})
    assert r.status_code == 204

    login = await client.post(
        "/auth/login", json={"identifier": chapter_lead.email, "password": STRONG}
    )
    assert login.status_code == 200

    # Single use.
    again = await client.post(
        "/auth/reset-password", json={"token": token, "new_password": "Another-Pass-99"}
    )
    assert again.status_code == 400
    await db_session.refresh(chapter_lead)
    assert chapter_lead.password_reset_token_hash is None


async def test_reset_password_rejects_expired_token(
    client: AsyncClient, chapter_lead, db_session
):
    chapter_lead.password_reset_token_hash = hashlib.sha256(b"old").hexdigest()
    chapter_lead.password_reset_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db_session.add(chapter_lead)
    await db_session.commit()
    r = await client.post("/auth/reset-password", json={"token": "old", "new_password": STRONG})
    assert r.status_code == 400


async def test_reset_password_rejects_weak_password(client: AsyncClient, chapter_lead, db_session):
    chapter_lead.password_reset_token_hash = hashlib.sha256(b"live").hexdigest()
    chapter_lead.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    db_session.add(chapter_lead)
    await db_session.commit()
    r = await client.post("/auth/reset-password", json={"token": "live", "new_password": "short"})
    assert r.status_code == 422


async def test_reset_password_rejects_inactive_user(client: AsyncClient, chapter_lead, db_session):
    chapter_lead.password_reset_token_hash = hashlib.sha256(b"live").hexdigest()
    chapter_lead.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    chapter_lead.is_active = False
    db_session.add(chapter_lead)
    await db_session.commit()
    r = await client.post("/auth/reset-password", json={"token": "live", "new_password": STRONG})
    assert r.status_code == 400


async def test_set_password_link_for_admin_created_account_works_end_to_end(
    client: AsyncClient, admin_headers, sf_chapter
):
    with _configured(), _mock_send() as m:
        r = await client.post("/admin/users", json={
            "email": "newlead@example.com", "role": "chapter_lead", "chapter_id": sf_chapter.id,
            "name": "New Lead", "send_password_link": True,
        }, headers=admin_headers)
    assert r.status_code == 201
    token = _token_from_email(m)
    r = await client.post("/auth/reset-password", json={"token": token, "new_password": STRONG})
    assert r.status_code == 204
    login = await client.post(
        "/auth/login", json={"identifier": "newlead@example.com", "password": STRONG}
    )
    assert login.status_code == 200
    assert isinstance(login.json()["access_token"], str)


def test_user_model_has_reset_columns():
    assert hasattr(User, "password_reset_token_hash")
    assert hasattr(User, "password_reset_expires_at")
