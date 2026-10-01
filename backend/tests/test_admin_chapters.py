"""Tests for the admin chapter endpoints.

Chapter status (draft / active / archived) governs *public* visibility only.
Inside admin a draft chapter is fully operational: its lead can read and edit
it, and it appears in every chapter picker. Changing status is the one thing
reserved for superadmins.
"""
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chapter import Chapter
from app.models.user import UserRole
from tests.conftest import _get_token, _make_user


async def _make_chapter(session: AsyncSession, code: str, status: str = "active") -> Chapter:
    ch = Chapter(
        code=code, name=f"City {code}", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status=status,
    )
    session.add(ch)
    await session.commit()
    await session.refresh(ch)
    return ch


async def _set_status(session: AsyncSession, chapter: Chapter, status: str) -> None:
    chapter.status = status
    await session.commit()


class TestGetChapterAdmin:
    """GET /admin/chapters/{identifier} — read one chapter regardless of status."""

    async def test_requires_auth(self, client: AsyncClient, sf_chapter):
        r = await client.get(f"/admin/chapters/{sf_chapter.id}")
        assert r.status_code == 401

    async def test_superadmin_reads_draft_chapter_by_code(
        self, client: AsyncClient, admin_headers, db_session: AsyncSession
    ):
        draft = await _make_chapter(db_session, "berlin", status="draft")
        r = await client.get(f"/admin/chapters/{draft.code}", headers=admin_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == draft.id
        assert body["status"] == "draft"
        assert body["about"] == "a"  # full detail, not the public summary

    async def test_lead_reads_own_draft_chapter(
        self, client: AsyncClient, lead_headers, sf_chapter, db_session: AsyncSession
    ):
        await _set_status(db_session, sf_chapter, "draft")
        r = await client.get(f"/admin/chapters/{sf_chapter.id}", headers=lead_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "draft"

    async def test_host_reads_own_chapter(
        self, client: AsyncClient, host_headers, sf_chapter
    ):
        r = await client.get(f"/admin/chapters/{sf_chapter.code}", headers=host_headers)
        assert r.status_code == 200
        assert r.json()["code"] == "sf"

    async def test_lead_cannot_read_other_chapter(
        self, client: AsyncClient, lead_headers, db_session: AsyncSession
    ):
        other = await _make_chapter(db_session, "nyc")
        r = await client.get(f"/admin/chapters/{other.id}", headers=lead_headers)
        assert r.status_code == 403

    async def test_not_found(self, client: AsyncClient, admin_headers):
        r = await client.get("/admin/chapters/nonexistent", headers=admin_headers)
        assert r.status_code == 404


class TestListChaptersAdmin:
    """GET /admin/chapters — superadmins see every chapter; others see their own."""

    async def test_lead_sees_only_own_chapter_even_when_draft(
        self, client: AsyncClient, lead_headers, sf_chapter, db_session: AsyncSession
    ):
        await _set_status(db_session, sf_chapter, "draft")
        await _make_chapter(db_session, "nyc")
        r = await client.get("/admin/chapters", headers=lead_headers)
        assert r.status_code == 200
        assert [c["code"] for c in r.json()] == ["sf"]

    async def test_host_sees_only_own_chapter(
        self, client: AsyncClient, host_headers, sf_chapter, db_session: AsyncSession
    ):
        await _make_chapter(db_session, "nyc")
        r = await client.get("/admin/chapters", headers=host_headers)
        assert r.status_code == 200
        assert [c["code"] for c in r.json()] == ["sf"]

    async def test_user_without_chapter_sees_nothing(
        self, client: AsyncClient, sf_chapter, db_session: AsyncSession
    ):
        orphan = await _make_user(db_session, "orphan@aisalon.xyz", UserRole.host, username="orphan")
        token = await _get_token(client, orphan.email)
        r = await client.get("/admin/chapters", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json() == []


class TestChapterStatusIsSuperadminOnly:
    async def test_lead_cannot_publish_own_chapter(
        self, client: AsyncClient, lead_headers, sf_chapter, db_session: AsyncSession
    ):
        await _set_status(db_session, sf_chapter, "draft")
        r = await client.patch(
            f"/admin/chapters/{sf_chapter.id}",
            json={"status": "active"},
            headers=lead_headers,
        )
        assert r.status_code == 403
        await db_session.refresh(sf_chapter)
        assert sf_chapter.status == "draft"

    async def test_lead_may_round_trip_unchanged_status(
        self, client: AsyncClient, lead_headers, sf_chapter
    ):
        # The edit form PATCHes every field it loaded, status included.
        r = await client.patch(
            f"/admin/chapters/{sf_chapter.id}",
            json={"status": "active", "tagline": "Still editable"},
            headers=lead_headers,
        )
        assert r.status_code == 200
        assert r.json()["tagline"] == "Still editable"

    async def test_superadmin_publishes_draft(
        self, client: AsyncClient, admin_headers, db_session: AsyncSession
    ):
        draft = await _make_chapter(db_session, "berlin", status="draft")
        r = await client.patch(
            f"/admin/chapters/{draft.id}", json={"status": "active"}, headers=admin_headers
        )
        assert r.status_code == 200
        assert r.json()["status"] == "active"


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

    async def test_description_over_120_chars_rejected(
        self, client: AsyncClient, admin_headers, sf_chapter
    ):
        r = await client.patch(
            f"/admin/chapters/{sf_chapter.id}",
            json={"description": "x" * 121},
            headers=admin_headers,
        )
        assert r.status_code == 422

    async def test_description_at_120_chars_accepted(
        self, client: AsyncClient, admin_headers, sf_chapter
    ):
        r = await client.patch(
            f"/admin/chapters/{sf_chapter.id}",
            json={"description": "x" * 120},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["description"] == "x" * 120


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
