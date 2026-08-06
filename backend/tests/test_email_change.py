import hashlib
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

LEAD_PASSWORD = "password"  # matches conftest chapter_lead fixture password


async def _initiate(client, headers, new_email="new@x.co", password=LEAD_PASSWORD):
    with patch("app.api.profile.send_email", new=AsyncMock(return_value=True)) as m, patch(
        "app.api.profile.settings.RESEND_API_KEY", "re_test"
    ):
        r = await client.post(
            "/profile/email-change",
            json={"new_email": new_email, "current_password": password},
            headers=headers,
        )
    return r, m


async def test_initiate_requires_correct_password(client, lead_headers):
    r, _ = await _initiate(client, lead_headers, password="wrong")
    assert r.status_code == 403


async def test_initiate_rejects_taken_email(client, lead_headers, superadmin):
    r, _ = await _initiate(client, lead_headers, new_email=superadmin.email)
    assert r.status_code == 409


async def test_initiate_sets_pending_and_sends_to_new_address(
    client, lead_headers, chapter_lead, db_session
):
    r, mail = await _initiate(client, lead_headers)
    assert r.status_code == 202
    mail.assert_awaited_once()
    assert mail.await_args.kwargs.get("to") == ["new@x.co"] or mail.await_args.args[0] == ["new@x.co"]
    await db_session.refresh(chapter_lead)
    assert chapter_lead.pending_email == "new@x.co"
    assert chapter_lead.email_change_token_hash is not None


async def test_verify_swaps_email_and_clears_pending(
    client, lead_headers, chapter_lead, db_session
):
    token = "known-test-token"
    chapter_lead.pending_email = "new@x.co"
    chapter_lead.email_change_token_hash = hashlib.sha256(token.encode()).hexdigest()
    chapter_lead.email_change_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    db_session.add(chapter_lead)
    await db_session.commit()
    with patch("app.api.auth.send_email", new=AsyncMock(return_value=True)):
        r = await client.post("/auth/verify-email-change", json={"token": token})
    assert r.status_code == 200
    await db_session.refresh(chapter_lead)
    assert chapter_lead.email == "new@x.co"
    assert chapter_lead.pending_email is None
    assert chapter_lead.email_change_token_hash is None


async def test_verify_rejects_expired_token(client, chapter_lead, db_session):
    token = "expired-token"
    chapter_lead.pending_email = "new@x.co"
    chapter_lead.email_change_token_hash = hashlib.sha256(token.encode()).hexdigest()
    chapter_lead.email_change_expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    db_session.add(chapter_lead)
    await db_session.commit()
    r = await client.post("/auth/verify-email-change", json={"token": token})
    assert r.status_code == 400


async def test_verify_rejects_unknown_token(client):
    r = await client.post("/auth/verify-email-change", json={"token": "nope"})
    assert r.status_code == 400


async def test_cancel_clears_pending(client, lead_headers, chapter_lead, db_session):
    await _initiate(client, lead_headers)
    r = await client.delete("/profile/email-change", headers=lead_headers)
    assert r.status_code == 204
    await db_session.refresh(chapter_lead)
    assert chapter_lead.pending_email is None
