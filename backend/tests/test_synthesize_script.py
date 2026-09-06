"""Tests for scripts/synthesize_test_events.py.

Unit-level: the WAV stub is real RIFF/WAVE audio, and each payload builder
produces a dict that validates against the *actual* Pydantic request models
used by the corresponding API endpoints. One integration test drives
`synthesize()` (and `cleanup()`) against the test app via the `client`
fixture (httpx.AsyncClient + ASGITransport) and asserts that
`GET /admin/notifications/summary` counts rise by exactly what was created —
this doubles as an end-to-end test of the whole notifications feature.
"""
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.api.hosting_interest import HostingInterestCreate
from app.api.volunteer import VolunteerApplyRequest
from app.models.user import UserRole
from app.schemas.contact import ContactRequest
from scripts.synthesize_test_events import (
    cleanup,
    contact_payload,
    hosting_payloads,
    make_wav_stub,
    synthesize,
    volunteer_payload,
)

FIXTURE_PASSWORD = "password"  # matches tests/conftest.py::_make_user


# ── make_wav_stub ─────────────────────────────────────────────────────────────


def test_make_wav_stub_has_valid_riff_wave_magic_bytes():
    data = make_wav_stub()
    assert data[:4] == b"RIFF"
    assert b"WAVE" in data[:16]


def test_make_wav_stub_is_longer_than_bare_header():
    data = make_wav_stub()
    assert len(data) > 44


# ── payload builders ─────────────────────────────────────────────────────────


def test_contact_payload_is_test_prefixed_and_schema_valid():
    payload = contact_payload(3, "visitor@example.com")
    req = ContactRequest(**payload)  # raises if the shape drifts
    assert req.name == "[TEST] Visitor 3"
    assert req.email == "visitor@example.com"
    assert len(req.message) >= 10
    assert not payload["website"]  # honeypot must stay empty


def test_hosting_payloads_cover_both_interest_types_and_are_schema_valid():
    payloads = hosting_payloads("San Francisco", "visitor@example.com")
    assert len(payloads) == 2
    for payload in payloads:
        HostingInterestCreate(**payload)  # raises if the shape drifts
        assert payload["name"].startswith("[TEST]")
    types = {p["interest_type"] for p in payloads}
    assert types == {"host_existing", "start_chapter"}
    host_existing = next(p for p in payloads if p["interest_type"] == "host_existing")
    assert host_existing["existing_chapter"] == "San Francisco"


def test_volunteer_payload_is_schema_valid():
    payload = volunteer_payload("visitor@example.com")
    req = VolunteerApplyRequest(**payload)  # raises if the shape drifts
    assert req.why_interested
    assert req.relevant_experience
    assert req.availability
    assert payload["name"].startswith("[TEST]")


# ── integration: synthesize() end-to-end against the test app ────────────────


async def test_synthesize_raises_all_summary_counts(
    client, sf_chapter, chapter_lead, superadmin, admin_headers
):
    with patch("app.api.chapters.send_email", new=AsyncMock(return_value=True)) as mail:
        before = (
            await client.get("/admin/notifications/summary", headers=admin_headers)
        ).json()

        result = await synthesize(
            client,
            chapter_code=sf_chapter.code,
            count=2,
            contact_email="visitor@example.com",
            admin_email=superadmin.email,
            admin_password=FIXTURE_PASSWORD,
            include_member=True,
        )

        after = (
            await client.get("/admin/notifications/summary", headers=admin_headers)
        ).json()

    # Contact messages email the chapter lead — exercised for real, mocked transport.
    assert mail.await_count == 2

    assert after["contact_messages"] - before["contact_messages"] == 2
    assert after["hosting_interest"] - before["hosting_interest"] == 2
    assert after["volunteer_applications"] - before["volunteer_applications"] == 1
    assert after["community_uploads"] - before["community_uploads"] == 1
    assert after["new_members"] - before["new_members"] == 1

    # Everything the script reports creating actually resolved to a real id.
    assert len(result.contact_message_ids) == 2
    assert len(result.hosting_interest_ids) == 2
    assert result.volunteer_application_id
    assert result.community_upload_id
    assert result.member is not None
    assert result.member["email"].endswith("@aisalon-synth.test")
    assert result.member["role"] == UserRole.host.value
    # No active role existed for this fresh chapter, so the fallback path ran.
    assert result.volunteer_role_created is True


async def test_synthesize_skips_member_when_disabled(
    client, sf_chapter, chapter_lead, superadmin, admin_headers
):
    with patch("app.api.chapters.send_email", new=AsyncMock(return_value=True)):
        before = (
            await client.get("/admin/notifications/summary", headers=admin_headers)
        ).json()
        result = await synthesize(
            client,
            chapter_code=sf_chapter.code,
            count=1,
            contact_email="visitor2@example.com",
            admin_email=superadmin.email,
            admin_password=FIXTURE_PASSWORD,
            include_member=False,
        )
        after = (
            await client.get("/admin/notifications/summary", headers=admin_headers)
        ).json()

    assert result.member is None
    assert result.invite_id is None
    assert after["new_members"] - before["new_members"] == 0


async def test_synthesize_prints_partial_recap_and_reraises_on_mid_flight_failure(
    client, sf_chapter, chapter_lead, superadmin, admin_headers, capsys, monkeypatch
):
    """A failure partway through (here: the community-upload step, by making
    make_wav_stub() return non-audio bytes so the real endpoint 400s) must
    not silently swallow what already succeeded — it re-raises, but only
    after printing a recap of everything already created on the deployment
    so the operator can act on it manually."""
    monkeypatch.setattr(
        "scripts.synthesize_test_events.make_wav_stub", lambda: b"not-audio-bytes"
    )
    with patch("app.api.chapters.send_email", new=AsyncMock(return_value=True)):
        with pytest.raises(httpx.HTTPStatusError):
            await synthesize(
                client,
                chapter_code=sf_chapter.code,
                count=1,
                contact_email="visitor4@example.com",
                admin_email=superadmin.email,
                admin_password=FIXTURE_PASSWORD,
                include_member=True,
            )

    out = capsys.readouterr().out
    assert "synthesize() failed partway through" in out
    assert "Contact messages: 1" in out
    assert "Hosting interest: 2" in out
    assert "Volunteer application" in out
    assert "Community upload" not in out  # never reached — the step that failed
    assert "Member registered" not in out  # never reached — a later step
    assert "clean them up manually" in out

    # The steps that succeeded before the failure really did land in the DB.
    after = (
        await client.get("/admin/notifications/summary", headers=admin_headers)
    ).json()
    assert after["contact_messages"] >= 1
    assert after["hosting_interest"] >= 2
    assert after["volunteer_applications"] >= 1


async def test_cleanup_survives_network_errors_and_reports_them(
    client, sf_chapter, chapter_lead, superadmin, admin_headers, capsys, monkeypatch
):
    """A transient network failure (not just a non-2xx status) during
    cleanup must be reported per-item, not crash the rest of the pass with
    a raw traceback."""
    with patch("app.api.chapters.send_email", new=AsyncMock(return_value=True)):
        result = await synthesize(
            client,
            chapter_code=sf_chapter.code,
            count=1,
            contact_email="visitor5@example.com",
            admin_email=superadmin.email,
            admin_password=FIXTURE_PASSWORD,
            include_member=True,
        )

    async def _boom_patch(*args, **kwargs):
        raise httpx.ConnectError("simulated network blip")

    monkeypatch.setattr(client, "patch", _boom_patch)

    await cleanup(client, result)  # must not raise

    out = capsys.readouterr().out
    assert "Please clean up manually" in out
    assert "simulated network blip" in out


async def test_cleanup_marks_everything_handled_and_deactivates_member(
    client, sf_chapter, chapter_lead, superadmin, admin_headers
):
    with patch("app.api.chapters.send_email", new=AsyncMock(return_value=True)):
        result = await synthesize(
            client,
            chapter_code=sf_chapter.code,
            count=1,
            contact_email="visitor3@example.com",
            admin_email=superadmin.email,
            admin_password=FIXTURE_PASSWORD,
            include_member=True,
        )

        before = (
            await client.get("/admin/notifications/summary", headers=admin_headers)
        ).json()
        await cleanup(client, result)
        after = (
            await client.get("/admin/notifications/summary", headers=admin_headers)
        ).json()

    # Handled/reviewed items and a deactivated member all drop out of badges.
    assert after["contact_messages"] < before["contact_messages"]
    assert after["hosting_interest"] < before["hosting_interest"]
    assert after["volunteer_applications"] < before["volunteer_applications"]
    assert after["community_uploads"] < before["community_uploads"]
    assert after["new_members"] < before["new_members"]

    me = await client.get("/admin/me", headers={
        "Authorization": f"Bearer {result.admin_token}",
    })
    assert me.status_code == 200  # admin token itself remains valid throughout

    user_check = await client.get("/admin/users", headers=admin_headers)
    deactivated = next(u for u in user_check.json() if u["id"] == result.member["id"])
    assert deactivated["is_active"] is False
