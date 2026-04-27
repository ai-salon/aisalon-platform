"""Tests for admin /people CRUD."""
from httpx import AsyncClient


async def test_list_people_requires_auth(client: AsyncClient):
    r = await client.get("/admin/people")
    assert r.status_code in (401, 403)


async def test_list_people_returns_users(
    client: AsyncClient, admin_headers, host_user
):
    r = await client.get("/admin/people", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert any(p["id"] == host_user.id for p in body)


async def test_patch_person_sets_is_founder(
    client: AsyncClient, admin_headers, host_user
):
    r = await client.patch(
        f"/admin/people/{host_user.id}",
        headers=admin_headers,
        json={"is_founder": True, "title": "Co-Founder"},
    )
    assert r.status_code == 200


async def test_patch_person_requires_superadmin(
    client: AsyncClient, lead_headers, host_user
):
    r = await client.patch(
        f"/admin/people/{host_user.id}",
        headers=lead_headers,
        json={"is_founder": True},
    )
    assert r.status_code == 403
