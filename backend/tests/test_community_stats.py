"""Tests for /admin/community-stats endpoint."""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article, ArticleStatus
from app.models.job import Job, JobStatus
from app.models.user import User, UserRole
from app.models.chapter import Chapter
from app.core.security import hash_password


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


class TestCommunityStats:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/admin/community-stats")
        assert r.status_code == 401

    async def test_superadmin_sees_all_chapters(
        self, client: AsyncClient, admin_headers,
        db_session: AsyncSession, sf_chapter,
    ):
        berlin = await _make_other_chapter(db_session)

        dummy_user_id = str(uuid.uuid4())

        # Seed data for SF
        db_session.add(Article(chapter_id=sf_chapter.id, title="A1", status=ArticleStatus.draft))
        db_session.add(Article(chapter_id=sf_chapter.id, title="A2", status=ArticleStatus.published))
        db_session.add(Job(chapter_id=sf_chapter.id, user_id=dummy_user_id, status=JobStatus.completed))
        db_session.add(User(
            email="m1@x", username="m1", hashed_password=hash_password("x"),
            role=UserRole.chapter_lead, chapter_id=sf_chapter.id, is_active=True,
        ))

        # Seed data for Berlin
        db_session.add(Article(chapter_id=berlin.id, title="B1", status=ArticleStatus.draft))
        db_session.add(Job(chapter_id=berlin.id, user_id=dummy_user_id, status=JobStatus.failed))
        db_session.add(User(
            email="m2@x", username="m2", hashed_password=hash_password("x"),
            role=UserRole.chapter_lead, chapter_id=berlin.id, is_active=True,
        ))
        db_session.add(User(
            email="m3@x", username="m3", hashed_password=hash_password("x"),
            role=UserRole.host, chapter_id=berlin.id, is_active=True,
        ))
        await db_session.commit()

        r = await client.get("/admin/community-stats", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()

        assert len(data["chapters"]) == 2

        # Totals
        totals = data["totals"]
        assert totals["articles_count"] == 3
        assert totals["published_count"] == 1
        assert totals["draft_count"] == 2
        assert totals["jobs_count"] == 2
        assert totals["completed_jobs"] == 1
        assert totals["failed_jobs"] == 1
        assert totals["team_size"] == 3

    async def test_chapter_lead_sees_own_chapter(
        self, client: AsyncClient, lead_headers,
        db_session: AsyncSession, sf_chapter,
    ):
        berlin = await _make_other_chapter(db_session)

        db_session.add(Article(chapter_id=sf_chapter.id, title="SF1", status=ArticleStatus.draft))
        db_session.add(Article(chapter_id=berlin.id, title="B1", status=ArticleStatus.draft))
        await db_session.commit()

        r = await client.get("/admin/community-stats", headers=lead_headers)
        assert r.status_code == 200
        data = r.json()

        assert len(data["chapters"]) == 1
        assert data["chapters"][0]["chapter_code"] == "sf"
        assert data["totals"]["articles_count"] == 1

    async def test_empty_stats(
        self, client: AsyncClient, admin_headers,
        db_session: AsyncSession, sf_chapter,
    ):
        r = await client.get("/admin/community-stats", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data["chapters"]) == 1
        assert data["chapters"][0]["articles_count"] == 0
        assert data["chapters"][0]["team_size"] == 0
