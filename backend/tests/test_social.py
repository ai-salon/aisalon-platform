"""Tests for social sharing endpoints."""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article, ArticleStatus
from app.models.system_setting import SystemSetting
from app.models.chapter import Chapter
from app.core.encryption import encrypt_key
from app.core.config import settings


async def _seed_article(
    session: AsyncSession, chapter_id: str,
    title: str = "Test Article", published: bool = True,
) -> Article:
    article = Article(
        chapter_id=chapter_id,
        title=title,
        content_md="# Test\n\nContent here.",
        status=ArticleStatus.published if published else ArticleStatus.draft,
        substack_url="https://test.substack.com/p/test" if published else None,
    )
    session.add(article)
    await session.commit()
    await session.refresh(article)
    return article


async def _seed_late_settings(session: AsyncSession):
    for key, value in [
        ("late_api_key", "late-test-key"),
        ("late_account_id", "account-123"),
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


class TestGenerateSocialCopy:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.post("/admin/articles/some-id/generate-social-copy")
        assert r.status_code == 401

    async def test_not_found(self, client: AsyncClient, admin_headers):
        r = await client.post(
            "/admin/articles/nonexistent/generate-social-copy",
            headers=admin_headers,
        )
        assert r.status_code == 404

    @patch("app.services.social.generate_social_copy")
    async def test_generates_copy(
        self, mock_gen, client: AsyncClient, admin_headers,
        db_session: AsyncSession, sf_chapter,
    ):
        article = await _seed_article(db_session, sf_chapter.id)
        mock_gen.return_value = "Check out this great article! #AI #Salon"

        r = await client.post(
            f"/admin/articles/{article.id}/generate-social-copy",
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert "generated_copy" in r.json()

    async def test_chapter_lead_scoped(
        self, client: AsyncClient, lead_headers,
        db_session: AsyncSession, sf_chapter,
    ):
        berlin = await _make_other_chapter(db_session)
        article = await _seed_article(db_session, berlin.id, "Berlin Article")

        r = await client.post(
            f"/admin/articles/{article.id}/generate-social-copy",
            headers=lead_headers,
        )
        assert r.status_code == 403


class TestShareSocial:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.post("/admin/articles/some-id/share-social")
        assert r.status_code == 401

    async def test_no_credentials(
        self, client: AsyncClient, admin_headers,
        db_session: AsyncSession, sf_chapter,
    ):
        article = await _seed_article(db_session, sf_chapter.id)
        r = await client.post(
            f"/admin/articles/{article.id}/share-social",
            json={"content": "Hello world!", "platform": "linkedin"},
            headers=admin_headers,
        )
        assert r.status_code == 400
        assert "not configured" in r.json()["detail"]

    @patch("app.services.social.LatePublisher")
    async def test_share_success(
        self, mock_cls, client: AsyncClient, admin_headers,
        db_session: AsyncSession, sf_chapter,
    ):
        await _seed_late_settings(db_session)
        article = await _seed_article(db_session, sf_chapter.id)

        mock_instance = MagicMock()
        mock_instance.post = AsyncMock(return_value="post-456")
        mock_cls.return_value = mock_instance

        r = await client.post(
            f"/admin/articles/{article.id}/share-social",
            json={"content": "Check out our article!", "platform": "linkedin"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "posted"
        assert data["platform"] == "linkedin"

    @patch("app.services.social.LatePublisher")
    async def test_share_failure_records_error(
        self, mock_cls, client: AsyncClient, admin_headers,
        db_session: AsyncSession, sf_chapter,
    ):
        await _seed_late_settings(db_session)
        article = await _seed_article(db_session, sf_chapter.id)

        mock_instance = MagicMock()
        mock_instance.post = AsyncMock(side_effect=Exception("API timeout"))
        mock_cls.return_value = mock_instance

        r = await client.post(
            f"/admin/articles/{article.id}/share-social",
            json={"content": "Check out our article!", "platform": "linkedin"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "failed"
