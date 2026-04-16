"""Tests for volunteer roles and applications."""
import pytest
from httpx import AsyncClient

from app.models.volunteer import VolunteerRole, VolunteerApplication


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _create_role(db_session, slug="test-role", chapter_id=None, is_active=True):
    role = VolunteerRole(
        title="Test Role",
        slug=slug,
        description="A test volunteer role",
        requirements="Some requirements",
        time_commitment="4-6 hours/month",
        chapter_id=chapter_id,
        is_active=is_active,
        display_order=0,
    )
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    return role


APPLY_PAYLOAD = {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "city": "San Francisco",
    "why_interested": "I love AI discussions",
    "relevant_experience": "5 years in tech",
    "availability": "4-6h/week",
}


# ── Public: List Roles ───────────────────────────────────────────────────────

async def test_list_roles_empty(client: AsyncClient):
    r = await client.get("/volunteer-roles")
    assert r.status_code == 200
    assert r.json() == []


async def test_list_roles_returns_active_only(client: AsyncClient, db_session):
    await _create_role(db_session, slug="active-role", is_active=True)
    await _create_role(db_session, slug="inactive-role", is_active=False)
    r = await client.get("/volunteer-roles")
    assert r.status_code == 200
    slugs = [r["slug"] for r in r.json()]
    assert "active-role" in slugs
    assert "inactive-role" not in slugs


# ── Public: Get Role ─────────────────────────────────────────────────────────

async def test_get_role_by_slug(client: AsyncClient, db_session):
    role = await _create_role(db_session, slug="chapter-lead")
    r = await client.get("/volunteer-roles/chapter-lead")
    assert r.status_code == 200
    assert r.json()["slug"] == "chapter-lead"
    assert r.json()["title"] == "Test Role"


async def test_get_role_not_found(client: AsyncClient):
    r = await client.get("/volunteer-roles/nonexistent")
    assert r.status_code == 404


async def test_get_inactive_role_returns_404(client: AsyncClient, db_session):
    await _create_role(db_session, slug="hidden", is_active=False)
    r = await client.get("/volunteer-roles/hidden")
    assert r.status_code == 404


# ── Public: Apply ────────────────────────────────────────────────────────────

async def test_apply_for_role(client: AsyncClient, db_session):
    await _create_role(db_session, slug="host")
    r = await client.post("/volunteer-roles/host/apply", json=APPLY_PAYLOAD)
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Jane Doe"
    assert data["status"] == "pending"


async def test_apply_for_nonexistent_role(client: AsyncClient):
    r = await client.post("/volunteer-roles/fake/apply", json=APPLY_PAYLOAD)
    assert r.status_code == 404


async def test_apply_for_inactive_role(client: AsyncClient, db_session):
    await _create_role(db_session, slug="closed", is_active=False)
    r = await client.post("/volunteer-roles/closed/apply", json=APPLY_PAYLOAD)
    assert r.status_code == 404


# ── Admin: List Roles ────────────────────────────────────────────────────────

async def test_admin_list_roles_requires_auth(client: AsyncClient):
    r = await client.get("/admin/volunteer-roles")
    assert r.status_code == 401


async def test_admin_list_roles_forbidden_for_host(
    client: AsyncClient, db_session, host_headers,
):
    r = await client.get("/admin/volunteer-roles", headers=host_headers)
    assert r.status_code == 403


async def test_admin_list_roles_superadmin(
    client: AsyncClient, db_session, admin_headers,
):
    await _create_role(db_session, slug="r1")
    await _create_role(db_session, slug="r2", is_active=False)
    r = await client.get("/admin/volunteer-roles", headers=admin_headers)
    assert r.status_code == 200
    assert len(r.json()) == 2  # includes inactive


async def test_admin_list_roles_includes_application_count(
    client: AsyncClient, db_session, admin_headers,
):
    role = await _create_role(db_session, slug="counted")
    # Add an application
    app = VolunteerApplication(
        role_id=role.id,
        name="Test",
        email="t@t.com",
        city="NYC",
        why_interested="test",
        relevant_experience="test",
        availability="2h/week",
    )
    db_session.add(app)
    await db_session.commit()

    r = await client.get("/admin/volunteer-roles", headers=admin_headers)
    role_data = [x for x in r.json() if x["slug"] == "counted"][0]
    assert role_data["application_count"] == 1


# ── Admin: Create Role ───────────────────────────────────────────────────────

async def test_admin_create_role(client: AsyncClient, admin_headers):
    payload = {
        "title": "Content Writer",
        "slug": "content-writer",
        "description": "Write articles from salon discussions",
        "time_commitment": "2-4 hours/month",
    }
    r = await client.post("/admin/volunteer-roles", json=payload, headers=admin_headers)
    assert r.status_code == 201
    assert r.json()["title"] == "Content Writer"
    assert r.json()["slug"] == "content-writer"
    assert r.json()["is_active"] is True


async def test_admin_create_role_as_lead(
    client: AsyncClient, lead_headers,
):
    payload = {
        "title": "Local Host",
        "slug": "local-host",
        "description": "Host salons",
    }
    r = await client.post("/admin/volunteer-roles", json=payload, headers=lead_headers)
    assert r.status_code == 201


# ── Admin: Update Role ───────────────────────────────────────────────────────

async def test_admin_update_role(client: AsyncClient, db_session, admin_headers):
    role = await _create_role(db_session, slug="updatable")
    r = await client.patch(
        f"/admin/volunteer-roles/{role.id}",
        json={"title": "Updated Title", "is_active": False},
        headers=admin_headers,
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Updated Title"
    assert r.json()["is_active"] is False


async def test_admin_update_role_not_found(client: AsyncClient, admin_headers):
    r = await client.patch(
        "/admin/volunteer-roles/fake-id",
        json={"title": "Nope"},
        headers=admin_headers,
    )
    assert r.status_code == 404


# ── Admin: Delete (Deactivate) Role ──────────────────────────────────────────

async def test_admin_delete_role(client: AsyncClient, db_session, admin_headers):
    role = await _create_role(db_session, slug="deletable")
    r = await client.delete(f"/admin/volunteer-roles/{role.id}", headers=admin_headers)
    assert r.status_code == 204

    # Verify deactivated, not deleted
    r2 = await client.get("/admin/volunteer-roles", headers=admin_headers)
    deactivated = [x for x in r2.json() if x["slug"] == "deletable"]
    assert len(deactivated) == 1
    assert deactivated[0]["is_active"] is False


# ── Admin: List Applications ─────────────────────────────────────────────────

async def test_admin_list_applications(client: AsyncClient, db_session, admin_headers):
    role = await _create_role(db_session, slug="apply-role")
    await client.post("/volunteer-roles/apply-role/apply", json=APPLY_PAYLOAD)

    r = await client.get("/admin/volunteer-applications", headers=admin_headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["name"] == "Jane Doe"
    assert r.json()[0]["role_title"] == "Test Role"


async def test_admin_list_applications_filter_by_role(
    client: AsyncClient, db_session, admin_headers,
):
    role1 = await _create_role(db_session, slug="role-a")
    role2 = await _create_role(db_session, slug="role-b")
    await client.post("/volunteer-roles/role-a/apply", json=APPLY_PAYLOAD)
    await client.post("/volunteer-roles/role-b/apply", json={**APPLY_PAYLOAD, "name": "Bob"})

    r = await client.get(
        f"/admin/volunteer-applications?role_id={role1.id}", headers=admin_headers,
    )
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["name"] == "Jane Doe"


async def test_admin_list_applications_filter_by_status(
    client: AsyncClient, db_session, admin_headers,
):
    role = await _create_role(db_session, slug="status-filter")
    await client.post("/volunteer-roles/status-filter/apply", json=APPLY_PAYLOAD)

    r = await client.get(
        "/admin/volunteer-applications?app_status=reviewed", headers=admin_headers,
    )
    assert r.status_code == 200
    assert len(r.json()) == 0  # all are pending


# ── Admin: Get Application ───────────────────────────────────────────────────

async def test_admin_get_application(client: AsyncClient, db_session, admin_headers):
    role = await _create_role(db_session, slug="get-app")
    apply_r = await client.post("/volunteer-roles/get-app/apply", json=APPLY_PAYLOAD)
    app_id = apply_r.json()["id"]

    r = await client.get(f"/admin/volunteer-applications/{app_id}", headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["name"] == "Jane Doe"
    assert r.json()["city"] == "San Francisco"


async def test_admin_get_application_not_found(client: AsyncClient, admin_headers):
    r = await client.get("/admin/volunteer-applications/fake-id", headers=admin_headers)
    assert r.status_code == 404


# ── Admin: Update Application ────────────────────────────────────────────────

async def test_admin_update_application_status(
    client: AsyncClient, db_session, admin_headers,
):
    role = await _create_role(db_session, slug="review-app")
    apply_r = await client.post("/volunteer-roles/review-app/apply", json=APPLY_PAYLOAD)
    app_id = apply_r.json()["id"]

    r = await client.patch(
        f"/admin/volunteer-applications/{app_id}",
        json={"status": "accepted", "admin_notes": "Great candidate!"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "accepted"
    assert r.json()["admin_notes"] == "Great candidate!"
    assert r.json()["reviewed_by"] is not None
    assert r.json()["reviewed_at"] is not None


# ── RBAC: Chapter Lead Scoping ───────────────────────────────────────────────

async def test_lead_sees_only_own_chapter_roles(
    client: AsyncClient, db_session, sf_chapter, lead_headers,
):
    await _create_role(db_session, slug="global-role", chapter_id=None)
    await _create_role(db_session, slug="sf-role", chapter_id=sf_chapter.id)

    r = await client.get("/admin/volunteer-roles", headers=lead_headers)
    assert r.status_code == 200
    slugs = [x["slug"] for x in r.json()]
    assert "global-role" not in slugs
    assert "sf-role" in slugs
