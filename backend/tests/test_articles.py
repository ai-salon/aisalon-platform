"""Tests for /admin/articles endpoints."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article, ArticleStatus


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


class TestListArticles:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/admin/articles")
        assert r.status_code == 401

    async def test_empty_list(self, client: AsyncClient, admin_headers):
        r = await client.get("/admin/articles", headers=admin_headers)
        assert r.status_code == 200
        assert r.json() == []

    async def test_returns_articles(self, client: AsyncClient, admin_headers,
                                    db_session: AsyncSession, sf_chapter):
        await _seed_article(db_session, sf_chapter.id, "Article A")
        await _seed_article(db_session, sf_chapter.id, "Article B")
        r = await client.get("/admin/articles", headers=admin_headers)
        assert len(r.json()) == 2

    async def test_chapter_lead_scoped(self, client: AsyncClient, lead_headers,
                                       db_session: AsyncSession, sf_chapter):
        other_chapter = await _make_other_chapter(db_session)
        await _seed_article(db_session, sf_chapter.id, "SF Article")
        await _seed_article(db_session, other_chapter.id, "Berlin Article")
        r = await client.get("/admin/articles", headers=lead_headers)
        assert len(r.json()) == 1
        assert r.json()[0]["title"] == "SF Article"


class TestGetArticle:
    async def test_get_article(self, client: AsyncClient, admin_headers,
                               db_session: AsyncSession, sf_chapter):
        article = await _seed_article(db_session, sf_chapter.id)
        r = await client.get(f"/admin/articles/{article.id}", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["id"] == article.id
        assert "content_md" in r.json()

    async def test_not_found(self, client: AsyncClient, admin_headers):
        r = await client.get("/admin/articles/nonexistent-id", headers=admin_headers)
        assert r.status_code == 404


class TestDeleteArticle:
    async def test_delete_article(self, client: AsyncClient, admin_headers,
                                  db_session: AsyncSession, sf_chapter):
        article = await _seed_article(db_session, sf_chapter.id)
        r = await client.delete(f"/admin/articles/{article.id}", headers=admin_headers)
        assert r.status_code == 204
        # Verify it's gone
        r2 = await client.get(f"/admin/articles/{article.id}", headers=admin_headers)
        assert r2.status_code == 404

    async def test_delete_not_found(self, client: AsyncClient, admin_headers):
        r = await client.delete("/admin/articles/nonexistent-id", headers=admin_headers)
        assert r.status_code == 404

    async def test_chapter_lead_cannot_delete_other_chapter(
        self, client: AsyncClient, lead_headers, db_session: AsyncSession, sf_chapter
    ):
        other_chapter = await _make_other_chapter(db_session)
        article = await _seed_article(db_session, other_chapter.id, "Berlin Article")
        r = await client.delete(f"/admin/articles/{article.id}", headers=lead_headers)
        assert r.status_code == 403

    async def test_requires_auth(self, client: AsyncClient):
        r = await client.delete("/admin/articles/some-id")
        assert r.status_code == 401


class TestUpdateArticle:
    async def test_update_title_and_content(self, client: AsyncClient, admin_headers,
                                            db_session: AsyncSession, sf_chapter):
        article = await _seed_article(db_session, sf_chapter.id)
        r = await client.patch(
            f"/admin/articles/{article.id}",
            json={"title": "Updated Title", "content_md": "# Updated\n\nNew content."},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["title"] == "Updated Title"
        assert r.json()["content_md"] == "# Updated\n\nNew content."

    async def test_partial_update(self, client: AsyncClient, admin_headers,
                                  db_session: AsyncSession, sf_chapter):
        article = await _seed_article(db_session, sf_chapter.id, "Original")
        r = await client.patch(
            f"/admin/articles/{article.id}",
            json={"title": "New Title"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["title"] == "New Title"
        assert "# Test" in r.json()["content_md"]  # content unchanged


# Helper
from app.models.chapter import Chapter

async def _make_other_chapter(session: AsyncSession) -> Chapter:
    ch = Chapter(code="berlin", name="Berlin", title="t", description="d",
                 tagline="t", about="a", event_link="e", calendar_embed="c",
                 events_description="e", status="active")
    session.add(ch)
    await session.commit()
    await session.refresh(ch)
    return ch
