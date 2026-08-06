"""Tests for profile update endpoint."""
from httpx import AsyncClient


async def test_patch_profile_updates_fields(client, chapter_lead, lead_headers):
    r = await client.patch(
        "/profile/me",
        json={"name": "New Name", "description": "New bio", "hide_from_team": True},
        headers=lead_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "New Name"
    assert body["description"] == "New bio"
    assert body["hide_from_team"] is True
    assert body["email"] == chapter_lead.email


async def test_patch_profile_ignores_omitted_fields(client, chapter_lead, lead_headers):
    r1 = await client.patch("/profile/me", json={"name": "Keep Me"}, headers=lead_headers)
    assert r1.status_code == 200
    r2 = await client.patch("/profile/me", json={"title": "Only Title"}, headers=lead_headers)
    assert r2.json()["name"] == "Keep Me"


async def test_patch_profile_requires_auth(client):
    r = await client.patch("/profile/me", json={"name": "X"})
    assert r.status_code in (401, 403)


async def test_patch_profile_rejects_explicit_null_hide_from_team(client, lead_headers):
    """Regression: explicit null for hide_from_team should return 422, not 500."""
    r = await client.patch(
        "/profile/me",
        json={"hide_from_team": None},
        headers=lead_headers,
    )
    assert r.status_code == 422
    errors = r.json()["detail"]
    assert any("hide_from_team" in str(err) for err in errors)


async def test_patch_profile_rejects_explicit_null_name(client, lead_headers):
    """Regression: explicit null for name should return 422, not 500."""
    r = await client.patch(
        "/profile/me",
        json={"name": None},
        headers=lead_headers,
    )
    assert r.status_code == 422
    errors = r.json()["detail"]
    assert any("name" in str(err) for err in errors)
