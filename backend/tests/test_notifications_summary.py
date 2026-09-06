"""Tests for the role-scoped notifications summary endpoint."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.models.community_upload import CommunityUpload, UploadStatus
from app.models.contact_message import ContactMessage
from app.models.hosting_interest import HostingInterest, InterestType
from app.models.user import User
from app.models.volunteer import ApplicationStatus, VolunteerApplication, VolunteerRole

SUMMARY_URL = "/admin/notifications/summary"

SUMMARY_KEYS = {
    "contact_messages",
    "hosting_interest",
    "volunteer_applications",
    "new_members",
    "community_uploads",
}


# ── Seeding helpers ──────────────────────────────────────────────────────────

async def _mk_contact(db_session, chapter_id, status="new"):
    msg = ContactMessage(
        chapter_id=chapter_id, email="c@x.co", message="hello there", status=status
    )
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(msg)
    return msg


async def _mk_hosting(db_session, interest_type, chapter_id=None, status="new"):
    hi = HostingInterest(
        name="A",
        email="a@x.co",
        city="SF",
        interest_type=interest_type,
        chapter_id=chapter_id,
        status=status,
    )
    db_session.add(hi)
    await db_session.commit()
    await db_session.refresh(hi)
    return hi


async def _mk_volunteer_role(db_session, chapter_id=None, slug="role"):
    role = VolunteerRole(
        title="Role",
        slug=slug,
        description="A volunteer role",
        chapter_id=chapter_id,
    )
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    return role


async def _mk_volunteer_application(
    db_session, role_id, app_status=ApplicationStatus.pending
):
    app = VolunteerApplication(
        role_id=role_id,
        name="V",
        email="v@x.co",
        city="SF",
        why_interested="w",
        relevant_experience="r",
        availability="a",
        status=app_status,
    )
    db_session.add(app)
    await db_session.commit()
    await db_session.refresh(app)
    return app


async def _mk_upload(db_session, upload_status=UploadStatus.pending):
    upload = CommunityUpload(
        city="SF", audio_path="community/test.wav", status=upload_status
    )
    db_session.add(upload)
    await db_session.commit()
    await db_session.refresh(upload)
    return upload


async def _count_new_members(db_session, chapter_id=None) -> int:
    """Compute the expected new_members count directly from the DB.

    Mirrors the endpoint's own windowing rule so tests never hard-code a count
    that depends on which conftest fixtures happened to create users.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    stmt = select(func.count(User.id)).where(
        User.is_active.is_(True), User.created_at >= cutoff
    )
    if chapter_id:
        stmt = stmt.where(User.chapter_id == chapter_id)
    return (await db_session.execute(stmt)).scalar_one()


# ── Admin ────────────────────────────────────────────────────────────────────

async def test_summary_for_admin_counts_everything(
    client, admin_headers, sf_chapter, db_session
):
    await _mk_contact(db_session, sf_chapter.id)
    await _mk_hosting(db_session, InterestType.host_existing, sf_chapter.id)
    await _mk_hosting(db_session, InterestType.start_chapter)
    role = await _mk_volunteer_role(db_session, sf_chapter.id)
    await _mk_volunteer_application(db_session, role.id)
    await _mk_upload(db_session)

    expected_new_members = await _count_new_members(db_session)

    r = await client.get(SUMMARY_URL, headers=admin_headers)
    assert r.status_code == 200
    assert r.json() == {
        "contact_messages": 1,
        "hosting_interest": 2,  # host_existing + start_chapter
        "volunteer_applications": 1,
        "new_members": expected_new_members,
        "community_uploads": 1,
    }


async def test_admin_response_has_exact_keys(client, admin_headers):
    r = await client.get(SUMMARY_URL, headers=admin_headers)
    assert r.status_code == 200
    assert set(r.json().keys()) == SUMMARY_KEYS


# ── Chapter lead ─────────────────────────────────────────────────────────────

async def test_summary_for_lead_scopes_to_chapter(
    client, lead_headers, chapter_lead, sf_chapter, db_session, admin_headers
):
    rc = await client.post(
        "/admin/chapters", json={"code": "zz", "name": "Zed"}, headers=admin_headers
    )
    other_id = rc.json()["id"]

    # Own chapter — counted.
    await _mk_contact(db_session, sf_chapter.id)
    await _mk_hosting(db_session, InterestType.host_existing, sf_chapter.id)
    own_role = await _mk_volunteer_role(db_session, sf_chapter.id, slug="own-role")
    await _mk_volunteer_application(db_session, own_role.id)

    # Other chapter — excluded.
    await _mk_contact(db_session, other_id)
    await _mk_hosting(db_session, InterestType.host_existing, other_id)
    other_role = await _mk_volunteer_role(db_session, other_id, slug="other-role")
    await _mk_volunteer_application(db_session, other_role.id)

    # start_chapter interest — excluded for leads regardless of chapter.
    await _mk_hosting(db_session, InterestType.start_chapter, sf_chapter.id)

    # Global (null-chapter) volunteer role — excluded for leads.
    global_role = await _mk_volunteer_role(db_session, None, slug="global-role")
    await _mk_volunteer_application(db_session, global_role.id)

    # Community uploads — leads always get 0.
    await _mk_upload(db_session)

    expected_new_members = await _count_new_members(db_session, sf_chapter.id)

    r = await client.get(SUMMARY_URL, headers=lead_headers)
    assert r.status_code == 200
    assert r.json() == {
        "contact_messages": 1,
        "hosting_interest": 1,
        "volunteer_applications": 1,
        "new_members": expected_new_members,
        "community_uploads": 0,
    }

    # Admin view of the same data: sees own + other + the global (null-chapter)
    # role's pending application — proving the admin branch's un-joined,
    # unfiltered count really does include null-chapter roles (no join means
    # no accidental exclusion), not just that it happens to equal the lead's.
    r_admin = await client.get(SUMMARY_URL, headers=admin_headers)
    assert r_admin.status_code == 200
    assert r_admin.json()["volunteer_applications"] == 3


# ── Host ─────────────────────────────────────────────────────────────────────

async def test_summary_for_host_is_all_zeros(
    client, host_headers, sf_chapter, db_session
):
    # Seed data in the host's own chapter to prove it's still hidden from them.
    await _mk_contact(db_session, sf_chapter.id)
    await _mk_hosting(db_session, InterestType.host_existing, sf_chapter.id)
    role = await _mk_volunteer_role(db_session, sf_chapter.id)
    await _mk_volunteer_application(db_session, role.id)
    await _mk_upload(db_session)

    r = await client.get(SUMMARY_URL, headers=host_headers)
    assert r.status_code == 200
    assert r.json() == {
        "contact_messages": 0,
        "hosting_interest": 0,
        "volunteer_applications": 0,
        "new_members": 0,
        "community_uploads": 0,
    }


# ── Handled items drop out ──────────────────────────────────────────────────

async def test_handled_items_drop_out(
    client, lead_headers, admin_headers, chapter_lead, sf_chapter, db_session
):
    msg = await _mk_contact(db_session, sf_chapter.id)
    hi = await _mk_hosting(db_session, InterestType.host_existing, sf_chapter.id)
    role = await _mk_volunteer_role(db_session, sf_chapter.id)
    app = await _mk_volunteer_application(db_session, role.id)
    upload = await _mk_upload(db_session)

    r = await client.get(SUMMARY_URL, headers=lead_headers)
    body = r.json()
    assert body["contact_messages"] == 1
    assert body["hosting_interest"] == 1
    assert body["volunteer_applications"] == 1

    r_admin = await client.get(SUMMARY_URL, headers=admin_headers)
    assert r_admin.json()["community_uploads"] == 1

    patch_contact = await client.patch(
        f"/admin/contact-messages/{msg.id}",
        json={"status": "handled"},
        headers=lead_headers,
    )
    assert patch_contact.status_code == 200
    patch_hosting = await client.patch(
        f"/admin/hosting-interest/{hi.id}",
        json={"status": "handled"},
        headers=lead_headers,
    )
    assert patch_hosting.status_code == 200
    patch_volunteer = await client.patch(
        f"/admin/volunteer-applications/{app.id}",
        json={"status": "accepted"},
        headers=lead_headers,
    )
    assert patch_volunteer.status_code == 200
    patch_upload = await client.patch(
        f"/admin/community-uploads/{upload.id}",
        json={"status": "reviewed"},
        headers=admin_headers,
    )
    assert patch_upload.status_code == 200

    r2 = await client.get(SUMMARY_URL, headers=lead_headers)
    body2 = r2.json()
    assert body2["contact_messages"] == 0
    assert body2["hosting_interest"] == 0
    assert body2["volunteer_applications"] == 0

    r_admin2 = await client.get(SUMMARY_URL, headers=admin_headers)
    assert r_admin2.json()["community_uploads"] == 0
