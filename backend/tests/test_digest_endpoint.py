"""Tests for POST /admin/digests/run-test (superadmin-only test-send)."""
from unittest.mock import AsyncMock, patch

from sqlalchemy import select

from app.models.digest_run import DigestRun


async def test_run_test_digest_superadmin_sends_only_to_self(
    client, superadmin, admin_headers
):
    """The superadmin fixture is itself created moments before the request,
    so it falls inside the trailing window as a "new member" — the digest
    is non-empty and send_email is awaited exactly once, to the caller."""
    with patch(
        "app.services.digest.send_email", new=AsyncMock(return_value=True)
    ) as mock_send:
        r = await client.post(
            "/admin/digests/run-test",
            json={"window_days": 7, "only_me": True},
            headers=admin_headers,
        )
    assert r.status_code == 200
    body = r.json()
    assert body == {"sent": 1, "window_days": 7}
    mock_send.assert_awaited_once()
    assert mock_send.await_args.args[0] == [superadmin.email]


async def test_run_test_digest_superadmin_defaults_and_sends(
    client, db_session, superadmin, admin_headers, sf_chapter
):
    """With a real item in-window, send_email is awaited exactly once for
    the caller's own email when only_me is true (the default)."""
    from app.models.contact_message import ContactMessage

    msg = ContactMessage(chapter_id=sf_chapter.id, email="c@x.co", message="hi there")
    db_session.add(msg)
    await db_session.commit()

    with patch(
        "app.services.digest.send_email", new=AsyncMock(return_value=True)
    ) as mock_send:
        r = await client.post(
            "/admin/digests/run-test",
            json={},
            headers=admin_headers,
        )
    assert r.status_code == 200
    body = r.json()
    assert body == {"sent": 1, "window_days": 7}
    mock_send.assert_awaited_once()
    assert mock_send.await_args.args[0] == [superadmin.email]


async def test_run_test_digest_lead_forbidden(client, chapter_lead, lead_headers):
    with patch(
        "app.services.digest.send_email", new=AsyncMock(return_value=True)
    ) as mock_send:
        r = await client.post(
            "/admin/digests/run-test",
            json={"window_days": 7, "only_me": True},
            headers=lead_headers,
        )
    assert r.status_code == 403
    mock_send.assert_not_called()


async def test_run_test_digest_window_days_too_low_is_422(
    client, superadmin, admin_headers
):
    r = await client.post(
        "/admin/digests/run-test",
        json={"window_days": 0},
        headers=admin_headers,
    )
    assert r.status_code == 422


async def test_run_test_digest_window_days_too_high_is_422(
    client, superadmin, admin_headers
):
    r = await client.post(
        "/admin/digests/run-test",
        json={"window_days": 32},
        headers=admin_headers,
    )
    assert r.status_code == 422


async def test_run_test_digest_requires_auth(client):
    r = await client.post("/admin/digests/run-test", json={})
    assert r.status_code in (401, 403)


async def test_run_test_digest_never_writes_digest_run(
    client, db_session, superadmin, admin_headers
):
    with patch(
        "app.services.digest.send_email", new=AsyncMock(return_value=True)
    ):
        r = await client.post(
            "/admin/digests/run-test",
            json={"window_days": 7, "only_me": True},
            headers=admin_headers,
        )
    assert r.status_code == 200
    runs = (await db_session.execute(select(DigestRun))).scalars().all()
    assert runs == []


# ── Profile: digest_opt_out ─────────────────────────────────────────────────

async def test_patch_profile_digest_opt_out_persists(client, chapter_lead, lead_headers):
    r = await client.patch(
        "/profile/me",
        json={"digest_opt_out": True},
        headers=lead_headers,
    )
    assert r.status_code == 200
    assert r.json()["digest_opt_out"] is True

    r2 = await client.get("/profile/me", headers=lead_headers)
    assert r2.status_code == 200
    assert r2.json()["digest_opt_out"] is True


async def test_patch_profile_rejects_explicit_null_digest_opt_out(client, lead_headers):
    r = await client.patch(
        "/profile/me",
        json={"digest_opt_out": None},
        headers=lead_headers,
    )
    assert r.status_code == 422
    errors = r.json()["detail"]
    assert any("digest_opt_out" in str(err) for err in errors)


async def test_get_profile_me_includes_digest_opt_out(client, chapter_lead, lead_headers):
    r = await client.get("/profile/me", headers=lead_headers)
    assert r.status_code == 200
    assert "digest_opt_out" in r.json()
    assert r.json()["digest_opt_out"] is False
