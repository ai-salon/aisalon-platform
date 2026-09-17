"""Users is the superset: /admin/users also carries the presentation fields
(photo, display order, public visibility) the Team page edits."""
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User, UserRole


async def _make_chapter_lead(session: AsyncSession, email: str, chapter_id: str) -> User:
    u = User(
        email=email, hashed_password=hash_password("password"),
        role=UserRole.chapter_lead, chapter_id=chapter_id, is_active=True,
    )
    session.add(u)
    await session.commit()
    await session.refresh(u)
    return u


async def test_create_user_with_photo_order_and_visibility(
    client: AsyncClient, admin_headers, sf_chapter
):
    r = await client.post("/admin/users", json={
        "email": "whole@aisalon.xyz", "password": "securepass", "role": "host",
        "chapter_id": sf_chapter.id, "name": "Whole Person",
        "profile_image_url": "/uploads/abc/photo.jpg", "display_order": 7, "hide_from_team": True,
    }, headers=admin_headers)
    assert r.status_code == 201
    body = r.json()
    assert body["profile_image_url"] == "/uploads/abc/photo.jpg"
    assert body["display_order"] == 7
    assert body["hide_from_team"] is True


async def test_create_user_defaults_to_public_and_order_zero(
    client: AsyncClient, admin_headers
):
    r = await client.post("/admin/users", json={
        "email": "defaults@aisalon.xyz", "password": "securepass", "role": "host",
    }, headers=admin_headers)
    assert r.status_code == 201
    assert r.json()["hide_from_team"] is False
    assert r.json()["display_order"] == 0
    assert r.json()["profile_image_url"] is None


async def test_update_user_presentation_fields_and_remove_photo(
    client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
):
    lead = await _make_chapter_lead(db_session, "present@aisalon.xyz", sf_chapter.id)
    r = await client.patch(f"/admin/users/{lead.id}", json={
        "name": "Present Lead",
        "profile_image_url": "/uploads/abc/photo.jpg", "display_order": 3, "hide_from_team": True,
    }, headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["profile_image_url"] == "/uploads/abc/photo.jpg"
    assert r.json()["display_order"] == 3
    assert r.json()["hide_from_team"] is True

    # The Team page sees the same values: one record, two lenses.
    people = await client.get("/admin/people", headers=admin_headers)
    row = next(p for p in people.json() if p["id"] == lead.id)
    assert row["display_order"] == 3
    assert row["hide_from_team"] is True
    assert row["profile_image_url"] == "/uploads/abc/photo.jpg"

    # Blank removes the photo; explicit nulls for order/visibility are ignored.
    r = await client.patch(f"/admin/users/{lead.id}", json={
        "profile_image_url": "", "display_order": None, "hide_from_team": None,
    }, headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["profile_image_url"] is None
    assert r.json()["display_order"] == 3
    assert r.json()["hide_from_team"] is True


async def test_users_list_returns_presentation_fields(
    client: AsyncClient, admin_headers, superadmin
):
    r = await client.get("/admin/users", headers=admin_headers)
    row = next(u for u in r.json() if u["id"] == superadmin.id)
    for key in ("profile_image_url", "display_order", "hide_from_team", "is_founder"):
        assert key in row
