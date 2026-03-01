"""Tests for public article endpoints."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article, ArticleStatus


async def _seed_article(session, chapter_id: str, title: str, status: ArticleStatus) -> Article:
    a = Article(chapter_id=chapter_id, title=title, content_md="# Hello", status=status)
    session.add(a)
    await session.commit()
    await session.refresh(a)
    return a


class TestPublicArticlesList:
    async def test_no_auth_required(self, client: AsyncClient, sf_chapter, db_session: AsyncSession):
        await _seed_article(db_session, sf_chapter.id, "Published", ArticleStatus.published)
        r = await client.get("/articles")
        assert r.status_code == 200

    async def test_only_published_returned(self, client: AsyncClient, sf_chapter, db_session: AsyncSession):
        await _seed_article(db_session, sf_chapter.id, "Published", ArticleStatus.published)
        await _seed_article(db_session, sf_chapter.id, "Draft", ArticleStatus.draft)
        r = await client.get("/articles")
        assert len(r.json()) == 1
        assert r.json()[0]["title"] == "Published"

    async def test_article_shape(self, client: AsyncClient, sf_chapter, db_session: AsyncSession):
        await _seed_article(db_session, sf_chapter.id, "Article", ArticleStatus.published)
        r = await client.get("/articles")
        for key in ("id", "title", "status", "chapter_id", "created_at"):
            assert key in r.json()[0]

    async def test_content_md_excluded_from_list(self, client: AsyncClient, sf_chapter, db_session: AsyncSession):
        await _seed_article(db_session, sf_chapter.id, "Art", ArticleStatus.published)
        r = await client.get("/articles")
        assert "content_md" not in r.json()[0]


class TestPublicArticleDetail:
    async def test_get_published(self, client: AsyncClient, sf_chapter, db_session: AsyncSession):
        a = await _seed_article(db_session, sf_chapter.id, "Published", ArticleStatus.published)
        r = await client.get(f"/articles/{a.id}")
        assert r.status_code == 200
        assert r.json()["content_md"] == "# Hello"

    async def test_draft_is_404(self, client: AsyncClient, sf_chapter, db_session: AsyncSession):
        a = await _seed_article(db_session, sf_chapter.id, "Draft", ArticleStatus.draft)
        r = await client.get(f"/articles/{a.id}")
        assert r.status_code == 404

    async def test_nonexistent_is_404(self, client: AsyncClient):
        r = await client.get("/articles/nonexistent-id")
        assert r.status_code == 404


class TestChapterWithTeam:
    async def test_chapter_includes_team(self, client: AsyncClient, sf_chapter, db_session):
        from app.models.team_member import TeamMember
        m = TeamMember(name="Alice", role="Speaker", chapter_id=sf_chapter.id)
        db_session.add(m)
        await db_session.commit()
        r = await client.get(f"/chapters/{sf_chapter.code}")
        assert r.status_code == 200
        assert "team_members" in r.json()
        assert len(r.json()["team_members"]) == 1
        assert r.json()["team_members"][0]["name"] == "Alice"
