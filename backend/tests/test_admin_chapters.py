"""Tests for PATCH /admin/chapters/{id} — chapter editing."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chapter import Chapter


async def _make_chapter(session: AsyncSession, code: str) -> Chapter:
    ch = Chapter(
        code=code, name=f"City {code}", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="active",
    )
    session.add(ch)
    await session.commit()
    await session.refresh(ch)
    return ch


class TestUpdateChapter:
    async def test_requires_auth(self, client: AsyncClient, sf_chapter):
        r = await client.patch(f"/admin/chapters/{sf_chapter.id}", json={"name": "New Name"})
        assert r.status_code == 401

    async def test_superadmin_can_update(self, client: AsyncClient, admin_headers, sf_chapter):
        r = await client.patch(
            f"/admin/chapters/{sf_chapter.id}",
            json={"name": "Updated SF", "tagline": "New tagline"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["name"] == "Updated SF"
        assert r.json()["tagline"] == "New tagline"

    async def test_partial_update_preserves_other_fields(
        self, client: AsyncClient, admin_headers, sf_chapter
    ):
        r = await client.patch(
            f"/admin/chapters/{sf_chapter.id}",
            json={"name": "Partial Update"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["name"] == "Partial Update"
        assert r.json()["code"] == "sf"  # unchanged

    async def test_chapter_lead_can_update_own(
        self, client: AsyncClient, lead_headers, sf_chapter
    ):
        r = await client.patch(
            f"/admin/chapters/{sf_chapter.id}",
            json={"tagline": "Lead updated tagline"},
            headers=lead_headers,
        )
        assert r.status_code == 200
        assert r.json()["tagline"] == "Lead updated tagline"

    async def test_chapter_lead_cannot_update_other(
        self, client: AsyncClient, lead_headers, db_session: AsyncSession
    ):
        other = await _make_chapter(db_session, "nyc")
        r = await client.patch(
            f"/admin/chapters/{other.id}",
            json={"name": "Hacked"},
            headers=lead_headers,
        )
        assert r.status_code == 403

    async def test_not_found(self, client: AsyncClient, admin_headers):
        r = await client.patch(
            "/admin/chapters/nonexistent-id",
            json={"name": "x"},
            headers=admin_headers,
        )
        assert r.status_code == 404


async def test_create_chapter_requires_superadmin(
    client: AsyncClient, lead_headers
):
    r = await client.post("/admin/chapters", headers=lead_headers, json={
        "code": "tokyo", "name": "Tokyo",
    })
    assert r.status_code == 403


async def test_create_chapter_succeeds_as_superadmin(
    client: AsyncClient, admin_headers
):
    r = await client.post("/admin/chapters", headers=admin_headers, json={
        "code": "tokyo", "name": "Tokyo",
    })
    assert r.status_code == 201
    body = r.json()
    assert body["code"] == "tokyo"
    assert body["status"] == "draft"


async def test_create_chapter_rejects_duplicate_code(
    client: AsyncClient, admin_headers, sf_chapter
):
    r = await client.post("/admin/chapters", headers=admin_headers, json={
        "code": "sf", "name": "Another SF",
    })
    assert r.status_code == 400


async def test_create_chapter_rejects_invalid_code(
    client: AsyncClient, admin_headers
):
    r = await client.post("/admin/chapters", headers=admin_headers, json={
        "code": "Bad Code!", "name": "Bad",
    })
    assert r.status_code == 422


async def test_patch_chapter_status_to_archived(
    client: AsyncClient, admin_headers, sf_chapter
):
    r = await client.patch(
        f"/admin/chapters/{sf_chapter.code}",
        headers=admin_headers,
        json={"status": "archived"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "archived"


async def test_patch_chapter_status_rejects_invalid_value(
    client: AsyncClient, admin_headers, sf_chapter
):
    r = await client.patch(
        f"/admin/chapters/{sf_chapter.code}",
        headers=admin_headers,
        json={"status": "garbage"},
    )
    assert r.status_code == 422


async def test_admin_list_chapters_includes_all_statuses(
    client: AsyncClient, admin_headers, db_session
):
    from app.models.chapter import Chapter
    for code, st in [("d", "draft"), ("a", "active"), ("z", "archived")]:
        db_session.add(Chapter(
            code=code, name=code, title="t", description="d",
            tagline="t", about="a", event_link="e", calendar_embed="c",
            events_description="e", status=st,
        ))
    await db_session.commit()
    r = await client.get("/admin/chapters", headers=admin_headers)
    assert r.status_code == 200
    codes = [c["code"] for c in r.json()]
    for code in ["d", "a", "z"]:
        assert code in codes
