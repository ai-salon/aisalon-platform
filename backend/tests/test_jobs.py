"""Tests for /admin/jobs endpoints."""
import hashlib
import io
from pathlib import Path
from unittest.mock import AsyncMock, patch
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin import run_job
from app.core.config import settings
from app.core.security import hash_password
from app.models.article import Article, ArticleStatus
from app.models.job import Job, JobStatus
from app.models.chapter import Chapter
from app.models.user import User, UserRole

_AUDIO_BYTES = b"fake audio bytes"


def _audio_file():
    return ("recording.mp3", io.BytesIO(_AUDIO_BYTES), "audio/mpeg")


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


async def _seed_processed_article(session, chapter_id, content_hash,
                                  transcript="a fairly long anonymized transcript",
                                  title="Prior Article"):
    """An article that already came out of the pipeline (has a stored transcript)."""
    art = Article(
        chapter_id=chapter_id, title=title, content_md="x",
        status=ArticleStatus.draft, anonymized_transcript=transcript,
        content_hash=content_hash,
    )
    session.add(art)
    await session.commit()
    await session.refresh(art)
    return art


async def _other_chapter(session):
    ch = Chapter(code="berlin", name="Berlin", title="t", description="d",
                 tagline="t", about="a", event_link="e", calendar_embed="c",
                 events_description="e", status="active")
    session.add(ch)
    await session.commit()
    await session.refresh(ch)
    return ch


class TestCreateJob:
    async def test_requires_auth(self, client: AsyncClient, sf_chapter):
        r = await client.post("/admin/jobs",
                              files={"file": _audio_file()},
                              data={"chapter_id": sf_chapter.id})
        assert r.status_code == 401

    async def test_creates_pending_job(self, client: AsyncClient, admin_headers, sf_chapter):
        r = await client.post("/admin/jobs",
                              files={"file": _audio_file()},
                              data={"chapter_id": sf_chapter.id},
                              headers=admin_headers)
        assert r.status_code == 201
        body = r.json()
        assert body["status"] == "pending"
        assert body["chapter_id"] == sf_chapter.id
        assert "id" in body

    async def test_chapter_lead_can_create_for_own_chapter(
        self, client: AsyncClient, lead_headers, sf_chapter
    ):
        r = await client.post("/admin/jobs",
                              files={"file": _audio_file()},
                              data={"chapter_id": sf_chapter.id},
                              headers=lead_headers)
        assert r.status_code == 201

    async def test_chapter_lead_cannot_create_for_other_chapter(
        self, client: AsyncClient, lead_headers, db_session: AsyncSession
    ):
        other = Chapter(code="berlin", name="Berlin", title="t", description="d",
                        tagline="t", about="a", event_link="e", calendar_embed="c",
                        events_description="e", status="active")
        db_session.add(other)
        await db_session.commit()
        r = await client.post("/admin/jobs",
                              files={"file": _audio_file()},
                              data={"chapter_id": other.id},
                              headers=lead_headers)
        assert r.status_code == 403


class TestCreateJobValidation:
    async def test_rejects_non_audio_file(
        self, client: AsyncClient, admin_headers, sf_chapter
    ):
        r = await client.post(
            "/admin/jobs",
            files={"file": ("notes.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
            data={"chapter_id": sf_chapter.id},
            headers=admin_headers,
        )
        assert r.status_code == 400

    async def test_rejects_oversized_file(
        self, client: AsyncClient, admin_headers, sf_chapter
    ):
        with patch.object(settings, "MAX_UPLOAD_BYTES", 4):
            r = await client.post(
                "/admin/jobs",
                files={"file": _audio_file()},  # 16 bytes > 4
                data={"chapter_id": sf_chapter.id},
                headers=admin_headers,
            )
        assert r.status_code == 413

    async def test_accepts_audio_by_extension_when_octet_stream(
        self, client: AsyncClient, admin_headers, sf_chapter
    ):
        r = await client.post(
            "/admin/jobs",
            files={"file": ("talk.m4a", io.BytesIO(b"fake"), "application/octet-stream")},
            data={"chapter_id": sf_chapter.id},
            headers=admin_headers,
        )
        assert r.status_code == 201


class TestListJobs:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/admin/jobs")
        assert r.status_code == 401

    async def test_empty_list(self, client: AsyncClient, admin_headers):
        r = await client.get("/admin/jobs", headers=admin_headers)
        assert r.status_code == 200
        assert r.json() == []

    async def test_lists_created_jobs(self, client: AsyncClient, admin_headers, sf_chapter):
        await client.post("/admin/jobs",
                          files={"file": _audio_file()},
                          data={"chapter_id": sf_chapter.id},
                          headers=admin_headers)
        r = await client.get("/admin/jobs", headers=admin_headers)
        assert len(r.json()) == 1

    async def test_chapter_lead_only_sees_own_jobs(
        self, client: AsyncClient, admin_headers, lead_headers,
        sf_chapter, db_session: AsyncSession
    ):
        # Admin creates a job for a different chapter
        other = Chapter(code="nyc", name="NYC", title="t", description="d",
                        tagline="t", about="a", event_link="e", calendar_embed="c",
                        events_description="e", status="active")
        db_session.add(other)
        await db_session.commit()
        await client.post("/admin/jobs",
                          files={"file": _audio_file()},
                          data={"chapter_id": other.id},
                          headers=admin_headers)
        # Chapter lead creates job for their chapter
        await client.post("/admin/jobs",
                          files={"file": _audio_file()},
                          data={"chapter_id": sf_chapter.id},
                          headers=lead_headers)
        # Lead should only see their own job
        r = await client.get("/admin/jobs", headers=lead_headers)
        assert len(r.json()) == 1
        assert r.json()[0]["chapter_id"] == sf_chapter.id


class TestGetJob:
    async def test_get_job(self, client: AsyncClient, admin_headers, sf_chapter):
        create = await client.post("/admin/jobs",
                                   files={"file": _audio_file()},
                                   data={"chapter_id": sf_chapter.id},
                                   headers=admin_headers)
        job_id = create.json()["id"]
        r = await client.get(f"/admin/jobs/{job_id}", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["id"] == job_id

    async def test_not_found(self, client: AsyncClient, admin_headers):
        r = await client.get("/admin/jobs/00000000-0000-0000-0000-000000000000", headers=admin_headers)
        assert r.status_code == 404

    async def test_job_shape(self, client: AsyncClient, admin_headers, sf_chapter):
        create = await client.post("/admin/jobs",
                                   files={"file": _audio_file()},
                                   data={"chapter_id": sf_chapter.id},
                                   headers=admin_headers)
        job_id = create.json()["id"]
        r = await client.get(f"/admin/jobs/{job_id}", headers=admin_headers)
        for key in ("id", "status", "chapter_id", "input_filename", "created_at"):
            assert key in r.json()


class TestRunJobFileCleanup:
    async def _make_job(self, db_session: AsyncSession, chapter: Chapter, tmp_path: Path) -> tuple[Job, Path]:
        user = User(
            email="cleanup@test.com",
            hashed_password=hash_password("x"),
            role=UserRole.superadmin,
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        storage_key = "abc123/recording.mp3"
        (tmp_path / "abc123").mkdir()
        audio_file = tmp_path / "abc123" / "recording.mp3"
        audio_file.write_bytes(b"fake audio")

        job = Job(
            chapter_id=chapter.id,
            user_id=user.id,
            input_filename="recording.mp3",
            input_storage_key=storage_key,
            status=JobStatus.pending,
        )
        db_session.add(job)
        await db_session.commit()
        await db_session.refresh(job)
        return job, audio_file

    async def test_deletes_audio_on_success(
        self, tmp_path: Path, db_session: AsyncSession, sf_chapter: Chapter, client
    ):
        job, audio_file = await self._make_job(db_session, sf_chapter, tmp_path)
        assert audio_file.exists()

        mock_result = {"title": "T", "content_md": "body", "anonymized_transcript": "anon"}
        with patch("app.api.admin.SocraticProcessor") as mock_proc, \
             patch.object(settings, "UPLOAD_DIR", str(tmp_path)):
            mock_proc.return_value.process = AsyncMock(return_value=mock_result)
            await run_job(job.id)

        assert not audio_file.exists()

    async def test_keeps_audio_on_failure(
        self, tmp_path: Path, db_session: AsyncSession, sf_chapter: Chapter, client
    ):
        job, audio_file = await self._make_job(db_session, sf_chapter, tmp_path)
        assert audio_file.exists()

        with patch("app.api.admin.SocraticProcessor") as mock_proc, \
             patch.object(settings, "UPLOAD_DIR", str(tmp_path)):
            mock_proc.return_value.process = AsyncMock(side_effect=RuntimeError("transcription failed"))
            await run_job(job.id)

        assert audio_file.exists()


class TestRunJobArticleMetadata:
    """run_job should stamp the produced article with the source filename + hash."""

    async def _make_job(self, db_session, chapter, tmp_path):
        user = User(email="meta@test.com", hashed_password=hash_password("x"),
                    role=UserRole.superadmin, is_active=True)
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        (tmp_path / "k").mkdir()
        (tmp_path / "k" / "recording.mp3").write_bytes(b"fake audio")
        job = Job(chapter_id=chapter.id, user_id=user.id, input_filename="recording.mp3",
                  input_storage_key="k/recording.mp3", content_hash="deadbeef",
                  status=JobStatus.pending)
        db_session.add(job)
        await db_session.commit()
        await db_session.refresh(job)
        return job

    async def test_article_inherits_filename_and_hash(
        self, tmp_path: Path, db_session: AsyncSession, sf_chapter: Chapter, client
    ):
        job = await self._make_job(db_session, sf_chapter, tmp_path)
        mock_result = {"title": "T", "content_md": "body", "anonymized_transcript": "anon"}
        with patch("app.api.admin.SocraticProcessor") as mock_proc, \
             patch.object(settings, "UPLOAD_DIR", str(tmp_path)):
            mock_proc.return_value.process = AsyncMock(return_value=mock_result)
            await run_job(job.id)

        article = (await db_session.execute(
            select(Article).where(Article.job_id == job.id))).scalar_one()
        assert article.source_filename == "recording.mp3"
        assert article.content_hash == "deadbeef"


class TestDuplicateUpload:
    async def test_duplicate_returns_409(self, client, admin_headers, db_session, sf_chapter):
        art = await _seed_processed_article(db_session, sf_chapter.id, _sha(_AUDIO_BYTES))
        r = await client.post("/admin/jobs", files={"file": _audio_file()},
                              data={"chapter_id": sf_chapter.id}, headers=admin_headers)
        assert r.status_code == 409
        detail = r.json()["detail"]
        assert detail["code"] == "duplicate_upload"
        assert detail["existing_article"]["id"] == art.id
        assert detail["existing_article"]["title"] == "Prior Article"

    async def test_duplicate_creates_no_job(self, client, admin_headers, db_session, sf_chapter):
        await _seed_processed_article(db_session, sf_chapter.id, _sha(_AUDIO_BYTES))
        await client.post("/admin/jobs", files={"file": _audio_file()},
                          data={"chapter_id": sf_chapter.id}, headers=admin_headers)
        r = await client.get("/admin/jobs", headers=admin_headers)
        assert r.json() == []

    async def test_force_bypasses_dedup(self, client, admin_headers, db_session, sf_chapter):
        await _seed_processed_article(db_session, sf_chapter.id, _sha(_AUDIO_BYTES))
        r = await client.post("/admin/jobs", files={"file": _audio_file()},
                              data={"chapter_id": sf_chapter.id, "force": "true"},
                              headers=admin_headers)
        assert r.status_code == 201

    async def test_different_bytes_not_duplicate(self, client, admin_headers, db_session, sf_chapter):
        await _seed_processed_article(db_session, sf_chapter.id, _sha(b"different content"))
        r = await client.post("/admin/jobs", files={"file": _audio_file()},
                              data={"chapter_id": sf_chapter.id}, headers=admin_headers)
        assert r.status_code == 201

    async def test_article_without_transcript_not_matched(
        self, client, admin_headers, db_session, sf_chapter
    ):
        # An article carrying the hash but no transcript can't be regenerated → not a dup.
        await _seed_processed_article(db_session, sf_chapter.id, _sha(_AUDIO_BYTES), transcript=None)
        r = await client.post("/admin/jobs", files={"file": _audio_file()},
                              data={"chapter_id": sf_chapter.id}, headers=admin_headers)
        assert r.status_code == 201

    async def test_dedup_chapter_scoped_for_lead(
        self, client, lead_headers, db_session, sf_chapter
    ):
        other = await _other_chapter(db_session)
        await _seed_processed_article(db_session, other.id, _sha(_AUDIO_BYTES))
        # Lead uploads identical bytes to their own chapter → different chapter, not a dup.
        r = await client.post("/admin/jobs", files={"file": _audio_file()},
                              data={"chapter_id": sf_chapter.id}, headers=lead_headers)
        assert r.status_code == 201

    async def test_superadmin_dedup_is_global(
        self, client, admin_headers, db_session, sf_chapter
    ):
        other = await _other_chapter(db_session)
        await _seed_processed_article(db_session, other.id, _sha(_AUDIO_BYTES))
        # Superadmin has no chapter filter → matches across chapters.
        r = await client.post("/admin/jobs", files={"file": _audio_file()},
                              data={"chapter_id": sf_chapter.id}, headers=admin_headers)
        assert r.status_code == 409

    async def test_inflight_job_is_duplicate(
        self, client, admin_headers, db_session, sf_chapter, superadmin
    ):
        job = Job(chapter_id=sf_chapter.id, user_id=superadmin.id,
                  status=JobStatus.processing, content_hash=_sha(_AUDIO_BYTES))
        db_session.add(job)
        await db_session.commit()
        r = await client.post("/admin/jobs", files={"file": _audio_file()},
                              data={"chapter_id": sf_chapter.id}, headers=admin_headers)
        assert r.status_code == 409
        assert r.json()["detail"]["code"] == "duplicate_processing"
