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


async def test_host_can_list_chapter_people(
    client: AsyncClient, host_headers, host_user, chapter_lead
):
    r = await client.get("/admin/people", headers=host_headers)
    assert r.status_code == 200
    body = r.json()
    ids = {p["id"] for p in body}
    # Host sees themselves and the chapter lead in their chapter
    assert host_user.id in ids
    assert chapter_lead.id in ids


async def test_host_cannot_patch_person(
    client: AsyncClient, host_headers, host_user
):
    r = await client.patch(
        f"/admin/people/{host_user.id}",
        headers=host_headers,
        json={"is_founder": True},
    )
    assert r.status_code == 403


async def test_patch_person_can_set_hide_from_team(
    client: AsyncClient, admin_headers, host_user
):
    r = await client.patch(
        f"/admin/people/{host_user.id}",
        headers=admin_headers,
        json={"hide_from_team": True},
    )
    assert r.status_code == 200
    listed = await client.get("/admin/people", headers=admin_headers)
    target = next(p for p in listed.json() if p["id"] == host_user.id)
    assert target["hide_from_team"] is True
