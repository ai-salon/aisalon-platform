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
