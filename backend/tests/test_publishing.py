"""Tests for publishing endpoints (system settings, scheduling, publish)."""
import datetime as dt
import pytest
from unittest.mock import patch, MagicMock
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article, ArticleStatus
from app.models.system_setting import SystemSetting
from app.models.chapter import Chapter
from app.core.encryption import encrypt_key
from app.core.config import settings


async def _seed_article(session: AsyncSession, chapter_id: str, title: str = "Test Article") -> Article:
    article = Article(
        chapter_id=chapter_id,
        title=title,
        content_md="# Test\n\nContent here.",
        status=ArticleStatus.draft,
    )
    session.add(article)
    await session.commit()
    await session.refresh(article)
    return article


async def _seed_substack_settings(session: AsyncSession):
    for key, value in [
        ("substack_email", "test@example.com"),
        ("substack_password", "testpass"),
        ("substack_publication_url", "https://test.substack.com"),
    ]:
        session.add(SystemSetting(
            key=key,
            encrypted_value=encrypt_key(value, settings.SECRET_KEY),
        ))
    await session.commit()


async def _make_other_chapter(session: AsyncSession) -> Chapter:
    ch = Chapter(
        code="berlin", name="Berlin", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="active",
    )
    session.add(ch)
    await session.commit()
    await session.refresh(ch)
    return ch


class TestSystemSettings:
    async def test_requires_superadmin(self, client: AsyncClient, lead_headers):
        r = await client.post(
            "/admin/system-settings",
            json={"key": "test_key", "value": "test_val"},
            headers=lead_headers,
        )
        assert r.status_code == 403

    async def test_set_and_list(self, client: AsyncClient, admin_headers):
        r = await client.post(
            "/admin/system-settings",
            json={"key": "substack_email", "value": "admin@test.com"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["key"] == "substack_email"
        assert r.json()["has_value"] is True

        r2 = await client.get("/admin/system-settings", headers=admin_headers)
        assert r2.status_code == 200
        keys = [s["key"] for s in r2.json()]
        assert "substack_email" in keys

    async def test_update_existing(self, client: AsyncClient, admin_headers):
        await client.post(
            "/admin/system-settings",
            json={"key": "test_key", "value": "value1"},
            headers=admin_headers,
        )
        r = await client.post(
            "/admin/system-settings",
            json={"key": "test_key", "value": "value2"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        # Should only be one entry
        r2 = await client.get("/admin/system-settings", headers=admin_headers)
        count = sum(1 for s in r2.json() if s["key"] == "test_key")
        assert count == 1

    async def test_delete(self, client: AsyncClient, admin_headers):
        await client.post(
            "/admin/system-settings",
            json={"key": "to_delete", "value": "val"},
            headers=admin_headers,
        )
        r = await client.delete("/admin/system-settings/to_delete", headers=admin_headers)
        assert r.status_code == 204

        r2 = await client.get("/admin/system-settings", headers=admin_headers)
        keys = [s["key"] for s in r2.json()]
        assert "to_delete" not in keys

    async def test_delete_not_found(self, client: AsyncClient, admin_headers):
        r = await client.delete("/admin/system-settings/nonexistent", headers=admin_headers)
        assert r.status_code == 404

    async def test_unauthenticated(self, client: AsyncClient):
        r = await client.get("/admin/system-settings")
        assert r.status_code == 401


class TestPublishingList:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/admin/publishing")
        assert r.status_code == 401

    async def test_groups_by_status(
        self, client: AsyncClient, admin_headers,
        db_session: AsyncSession, sf_chapter,
    ):
        # Create articles with different statuses
        draft = await _seed_article(db_session, sf_chapter.id, "Draft Article")
        published = Article(
            chapter_id=sf_chapter.id, title="Published Article",
            content_md="pub", status=ArticleStatus.published,
            substack_url="https://test.substack.com/p/published",
        )
        scheduled = Article(
            chapter_id=sf_chapter.id, title="Scheduled Article",
            content_md="sched", status=ArticleStatus.scheduled,
            scheduled_publish_date=dt.date(2026, 4, 1),
        )
        db_session.add_all([published, scheduled])
        await db_session.commit()

        r = await client.get("/admin/publishing", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data["drafts"]) == 1
        assert len(data["scheduled"]) == 1
        assert len(data["published"]) == 1
        assert data["drafts"][0]["title"] == "Draft Article"

    async def test_chapter_lead_scoped(
        self, client: AsyncClient, lead_headers,
        db_session: AsyncSession, sf_chapter,
    ):
        berlin = await _make_other_chapter(db_session)
        await _seed_article(db_session, sf_chapter.id, "SF Article")
        await _seed_article(db_session, berlin.id, "Berlin Article")

        r = await client.get("/admin/publishing", headers=lead_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data["drafts"]) == 1
        assert data["drafts"][0]["title"] == "SF Article"


class TestScheduleSubstack:
    async def test_requires_superadmin(self, client: AsyncClient, lead_headers, db_session, sf_chapter):
        article = await _seed_article(db_session, sf_chapter.id)
        r = await client.post(
            f"/admin/articles/{article.id}/schedule-substack",
            json={"scheduled_date": "2026-04-01"},
            headers=lead_headers,
        )
        assert r.status_code == 403

    async def test_no_credentials(self, client: AsyncClient, admin_headers, db_session, sf_chapter):
        article = await _seed_article(db_session, sf_chapter.id)
        r = await client.post(
            f"/admin/articles/{article.id}/schedule-substack",
            json={"scheduled_date": "2026-04-01"},
            headers=admin_headers,
        )
        assert r.status_code == 400
        assert "not configured" in r.json()["detail"]

    @patch("app.services.substack.SubstackPublisher")
    async def test_schedule_success(
        self, mock_cls, client: AsyncClient, admin_headers,
        db_session: AsyncSession, sf_chapter,
    ):
        await _seed_substack_settings(db_session)
        article = await _seed_article(db_session, sf_chapter.id)

        mock_instance = MagicMock()
        mock_instance.create_scheduled_draft.return_value = ("draft-123", "https://test.substack.com/p/test")
        mock_cls.return_value = mock_instance

        r = await client.post(
            f"/admin/articles/{article.id}/schedule-substack",
            json={"scheduled_date": "2026-04-01"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "scheduled"
        assert r.json()["draft_id"] == "draft-123"


class TestPublishSubstack:
    @patch("app.services.substack.SubstackPublisher")
    async def test_publish_now(
        self, mock_cls, client: AsyncClient, admin_headers,
        db_session: AsyncSession, sf_chapter,
    ):
        await _seed_substack_settings(db_session)
        article = await _seed_article(db_session, sf_chapter.id)

        mock_instance = MagicMock()
        mock_instance.publish_now.return_value = "https://test.substack.com/p/test"
        mock_cls.return_value = mock_instance

        r = await client.post(
            f"/admin/articles/{article.id}/publish-substack",
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "published"
