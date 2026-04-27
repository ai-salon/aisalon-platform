"""Tests for profile-completion endpoint."""
from httpx import AsyncClient


async def test_profile_complete_requires_auth(client: AsyncClient):
    r = await client.post("/profile/complete", json={
        "name": "Bob",
        "profile_image_url": "/uploads/x.jpg",
    })
    assert r.status_code in (401, 403)


async def test_profile_complete_sets_completed_at(
    client: AsyncClient, host_user, host_headers, db_session
):
    r = await client.post("/profile/complete", headers=host_headers, json={
        "name": "Bob Roberts",
        "profile_image_url": "/uploads/bob.jpg",
        "linkedin": "https://linkedin.com/in/bob",
        "description": "Loves AI and salons.",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Bob Roberts"
    assert body["profile_completed_at"] is not None

    await db_session.refresh(host_user)
    assert host_user.name == "Bob Roberts"
    assert host_user.profile_completed_at is not None


async def test_profile_complete_rejects_long_description(client: AsyncClient, host_headers):
    r = await client.post("/profile/complete", headers=host_headers, json={
        "name": "Bob",
        "profile_image_url": "/uploads/bob.jpg",
        "description": "x" * 351,
    })
    assert r.status_code == 422


async def test_profile_complete_requires_name(client: AsyncClient, host_headers):
    r = await client.post("/profile/complete", headers=host_headers, json={
        "name": "",
        "profile_image_url": "/uploads/bob.jpg",
    })
    assert r.status_code == 422


async def test_profile_complete_requires_image(client: AsyncClient, host_headers):
    r = await client.post("/profile/complete", headers=host_headers, json={
        "name": "Bob",
        "profile_image_url": "",
    })
    assert r.status_code == 422


async def test_profile_status_endpoint(client: AsyncClient, host_user, host_headers):
    r = await client.get("/profile/me", headers=host_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == host_user.id
    assert body["profile_completed_at"] is None
