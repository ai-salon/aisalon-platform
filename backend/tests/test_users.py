"""Tests for /admin/users endpoints (user management)."""
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.core.security import hash_password


async def _make_chapter_lead(session: AsyncSession, email: str, chapter_id: str) -> User:
    u = User(
        email=email,
        hashed_password=hash_password("password"),
        role=UserRole.chapter_lead,
        chapter_id=chapter_id,
        is_active=True,
    )
    session.add(u)
    await session.commit()
    await session.refresh(u)
    return u


class TestListUsers:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/admin/users")
        assert r.status_code == 401

    async def test_requires_superadmin(self, client: AsyncClient, lead_headers):
        r = await client.get("/admin/users", headers=lead_headers)
        assert r.status_code == 403

    async def test_lists_users(self, client: AsyncClient, admin_headers, superadmin):
        r = await client.get("/admin/users", headers=admin_headers)
        assert r.status_code == 200
        assert len(r.json()) >= 1
        emails = [u["email"] for u in r.json()]
        assert superadmin.email in emails

    async def test_user_shape(self, client: AsyncClient, admin_headers):
        r = await client.get("/admin/users", headers=admin_headers)
        u = r.json()[0]
        for key in ("id", "email", "username", "role", "is_active", "name"):
            assert key in u
        assert "hashed_password" not in u

    async def test_lists_profile_name(
        self, client: AsyncClient, admin_headers, superadmin, db_session: AsyncSession
    ):
        """The Users page shows the display name so accounts are recognisable."""
        superadmin.name = "Ian Eisenberg"
        db_session.add(superadmin)
        await db_session.commit()
        r = await client.get("/admin/users", headers=admin_headers)
        row = next(u for u in r.json() if u["id"] == superadmin.id)
        assert row["name"] == "Ian Eisenberg"


class TestCreateUser:
    async def test_requires_superadmin(self, client: AsyncClient, lead_headers):
        r = await client.post("/admin/users",
                              json={"email": "x@x.com", "password": "pass", "role": "chapter_lead"},
                              headers=lead_headers)
        assert r.status_code == 403

    async def test_creates_user(self, client: AsyncClient, admin_headers, sf_chapter):
        r = await client.post("/admin/users", json={
            "email": "newlead@aisalon.xyz",
            "password": "securepass",
            "role": "chapter_lead",
            "chapter_id": sf_chapter.id,
        }, headers=admin_headers)
        assert r.status_code == 201
        assert r.json()["email"] == "newlead@aisalon.xyz"
        assert r.json()["role"] == "chapter_lead"
        assert "hashed_password" not in r.json()

    async def test_duplicate_email_is_409(self, client: AsyncClient, admin_headers, superadmin):
        r = await client.post("/admin/users", json={
            "email": superadmin.email,
            "password": "x",
            "role": "chapter_lead",
        }, headers=admin_headers)
        assert r.status_code == 409

    async def test_creates_complete_account_with_profile_fields(
        self, client: AsyncClient, admin_headers, sf_chapter
    ):
        r = await client.post("/admin/users", json={
            "email": "Cecilia@Example.com", "password": "securepass", "role": "host",
            "chapter_id": sf_chapter.id, "name": "Cecilia Callas", "title": "Co-Founder",
            "linkedin": "https://linkedin.com/in/cc", "description": "bio", "is_founder": True,
        }, headers=admin_headers)
        assert r.status_code == 201
        body = r.json()
        assert body["email"] == "cecilia@example.com"
        assert body["name"] == "Cecilia Callas"
        assert body["title"] == "Co-Founder"
        assert body["is_founder"] is True
        # Named on creation => complete, and public straight away.
        people = await client.get("/admin/people", headers=admin_headers)
        row = next(p for p in people.json() if p["id"] == body["id"])
        assert row["profile_completed_at"] is not None
        team = await client.get("/team")
        assert "Cecilia Callas" in [m["name"] for m in team.json()]

    async def test_requires_password_or_link(self, client: AsyncClient, admin_headers):
        r = await client.post("/admin/users", json={
            "email": "nopass@aisalon.xyz", "role": "host",
        }, headers=admin_headers)
        assert r.status_code == 400

    async def test_send_password_link_on_create(
        self, client: AsyncClient, admin_headers, db_session: AsyncSession
    ):
        with patch(
            "app.services.password_reset.send_email", new=AsyncMock(return_value=True)
        ) as m, patch("app.services.password_reset.settings.RESEND_API_KEY", "re_test"):
            r = await client.post("/admin/users", json={
                "email": "link@aisalon.xyz", "role": "host", "name": "Link Person",
                "send_password_link": True,
            }, headers=admin_headers)
        assert r.status_code == 201
        m.assert_awaited_once()
        to, subject, html = m.await_args.args[:3]
        assert to == ["link@aisalon.xyz"]
        assert "Set your" in subject
        assert "/reset-password?token=" in html
        created = (
            await db_session.execute(select(User).where(User.email == "link@aisalon.xyz"))
        ).scalar_one()
        assert created.password_reset_token_hash is not None

    async def test_send_password_link_needs_email_configured(
        self, client: AsyncClient, admin_headers
    ):
        with patch("app.services.password_reset.settings.RESEND_API_KEY", ""):
            r = await client.post("/admin/users", json={
                "email": "nolink@aisalon.xyz", "role": "host", "send_password_link": True,
            }, headers=admin_headers)
        assert r.status_code == 503


class TestPasswordResetLink:
    async def test_admin_can_email_a_reset_link(
        self, client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
    ):
        lead = await _make_chapter_lead(db_session, "linkme@aisalon.xyz", sf_chapter.id)
        with patch(
            "app.services.password_reset.send_email", new=AsyncMock(return_value=True)
        ) as m, patch("app.services.password_reset.settings.RESEND_API_KEY", "re_test"):
            r = await client.post(
                f"/admin/users/{lead.id}/password-reset-link", headers=admin_headers
            )
        assert r.status_code == 202
        m.assert_awaited_once()
        assert m.await_args.args[0] == ["linkme@aisalon.xyz"]

    async def test_requires_superadmin(
        self, client: AsyncClient, lead_headers, chapter_lead
    ):
        r = await client.post(
            f"/admin/users/{chapter_lead.id}/password-reset-link", headers=lead_headers
        )
        assert r.status_code == 403

    async def test_unknown_user_is_404(self, client: AsyncClient, admin_headers):
        with patch("app.services.password_reset.settings.RESEND_API_KEY", "re_test"):
            r = await client.post("/admin/users/nope/password-reset-link", headers=admin_headers)
        assert r.status_code == 404


class TestUpdateUser:
    async def test_set_founder_and_name_completes_profile(
        self, client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
    ):
        lead = await _make_chapter_lead(db_session, "founder@aisalon.xyz", sf_chapter.id)
        r = await client.patch(f"/admin/users/{lead.id}",
                               json={"is_founder": True, "name": "Ian Eisenberg"},
                               headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["is_founder"] is True
        people = await client.get("/admin/people", headers=admin_headers)
        row = next(p for p in people.json() if p["id"] == lead.id)
        assert row["is_founder"] is True
        assert row["profile_completed_at"] is not None

    async def test_deactivate_user(
        self, client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
    ):
        lead = await _make_chapter_lead(db_session, "lead2@aisalon.xyz", sf_chapter.id)
        r = await client.patch(f"/admin/users/{lead.id}",
                               json={"is_active": False},
                               headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["is_active"] is False

    async def test_reassign_chapter(
        self, client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
    ):
        from app.models.chapter import Chapter
        other = Chapter(code="tokyo", name="Tokyo", title="t", description="d",
                        tagline="t", about="a", event_link="e", calendar_embed="c",
                        events_description="e", status="active")
        db_session.add(other)
        await db_session.commit()
        await db_session.refresh(other)
        lead = await _make_chapter_lead(db_session, "lead3@aisalon.xyz", sf_chapter.id)
        r = await client.patch(f"/admin/users/{lead.id}",
                               json={"chapter_id": other.id},
                               headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["chapter_id"] == other.id

    async def test_not_found(self, client: AsyncClient, admin_headers):
        r = await client.patch("/admin/users/nonexistent", json={"is_active": False}, headers=admin_headers)
        assert r.status_code == 404

    async def test_change_role(
        self, client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
    ):
        lead = await _make_chapter_lead(db_session, "promote@aisalon.xyz", sf_chapter.id)
        r = await client.patch(f"/admin/users/{lead.id}",
                               json={"role": "host"},
                               headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "host"

    async def test_edit_identity_and_profile_fields(
        self, client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
    ):
        """Superadmins can edit everything about an account from the Users page."""
        lead = await _make_chapter_lead(db_session, "edit@aisalon.xyz", sf_chapter.id)
        r = await client.patch(f"/admin/users/{lead.id}", json={
            "name": "Ian Eisenberg",
            "email": "  Ian@Example.com ",
            "username": "ian",
            "title": "Founder",
            "linkedin": "https://linkedin.com/in/ian",
            "description": "bio",
        }, headers=admin_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["name"] == "Ian Eisenberg"
        assert body["email"] == "ian@example.com"
        assert body["username"] == "ian"
        assert body["title"] == "Founder"
        assert body["linkedin"] == "https://linkedin.com/in/ian"
        assert body["description"] == "bio"

    async def test_blank_text_fields_are_cleared(
        self, client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
    ):
        lead = await _make_chapter_lead(db_session, "ghost@aisalon.xyz", sf_chapter.id)
        lead.name = "Ian"
        lead.username = "sfghost"
        db_session.add(lead)
        await db_session.commit()
        r = await client.patch(f"/admin/users/{lead.id}",
                               json={"name": "  ", "username": ""},
                               headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["name"] is None
        assert r.json()["username"] is None

    async def test_duplicate_email_is_409(
        self, client: AsyncClient, admin_headers, superadmin, sf_chapter, db_session: AsyncSession
    ):
        lead = await _make_chapter_lead(db_session, "dup@aisalon.xyz", sf_chapter.id)
        r = await client.patch(f"/admin/users/{lead.id}",
                               json={"email": superadmin.email},
                               headers=admin_headers)
        assert r.status_code == 409

    async def test_duplicate_username_is_409(
        self, client: AsyncClient, admin_headers, superadmin, sf_chapter, db_session: AsyncSession
    ):
        lead = await _make_chapter_lead(db_session, "dup2@aisalon.xyz", sf_chapter.id)
        r = await client.patch(f"/admin/users/{lead.id}",
                               json={"username": superadmin.username},
                               headers=admin_headers)
        assert r.status_code == 409

    async def test_invalid_email_is_422(
        self, client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
    ):
        lead = await _make_chapter_lead(db_session, "bad@aisalon.xyz", sf_chapter.id)
        r = await client.patch(f"/admin/users/{lead.id}",
                               json={"email": "not-an-email"},
                               headers=admin_headers)
        assert r.status_code == 422

    async def test_clear_chapter_with_explicit_null(
        self, client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
    ):
        lead = await _make_chapter_lead(db_session, "nochapter@aisalon.xyz", sf_chapter.id)
        r = await client.patch(f"/admin/users/{lead.id}",
                               json={"chapter_id": None},
                               headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["chapter_id"] is None

    async def test_invalid_role_is_422(
        self, client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
    ):
        lead = await _make_chapter_lead(db_session, "badrole@aisalon.xyz", sf_chapter.id)
        r = await client.patch(f"/admin/users/{lead.id}",
                               json={"role": "emperor"},
                               headers=admin_headers)
        assert r.status_code == 422

    async def test_nonexistent_chapter_is_404(
        self, client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
    ):
        lead = await _make_chapter_lead(db_session, "badchapter@aisalon.xyz", sf_chapter.id)
        r = await client.patch(f"/admin/users/{lead.id}",
                               json={"chapter_id": "no-such-chapter"},
                               headers=admin_headers)
        assert r.status_code == 404

    async def test_set_title(
        self, client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
    ):
        lead = await _make_chapter_lead(db_session, "titled@aisalon.xyz", sf_chapter.id)
        r = await client.patch(f"/admin/users/{lead.id}",
                               json={"title": "Head of Salons"},
                               headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["title"] == "Head of Salons"

    async def test_clear_title_with_explicit_null(
        self, client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
    ):
        lead = await _make_chapter_lead(db_session, "untitled@aisalon.xyz", sf_chapter.id)
        lead.title = "Old Title"
        await db_session.commit()
        r = await client.patch(f"/admin/users/{lead.id}",
                               json={"title": None},
                               headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["title"] is None

    async def test_list_users_includes_title(
        self, client: AsyncClient, admin_headers, superadmin
    ):
        r = await client.get("/admin/users", headers=admin_headers)
        assert r.status_code == 200
        assert "title" in r.json()[0]

    async def test_cannot_change_own_role(
        self, client: AsyncClient, admin_headers, superadmin
    ):
        r = await client.patch(f"/admin/users/{superadmin.id}",
                               json={"role": "host"},
                               headers=admin_headers)
        assert r.status_code == 400

    async def test_untouched_fields_survive_partial_update(
        self, client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
    ):
        lead = await _make_chapter_lead(db_session, "partial@aisalon.xyz", sf_chapter.id)
        r = await client.patch(f"/admin/users/{lead.id}",
                               json={"role": "host"},
                               headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["chapter_id"] == sf_chapter.id
        assert r.json()["is_active"] is True


class TestDeleteUser:
    async def test_delete_user(self, client: AsyncClient, admin_headers,
                               sf_chapter, db_session: AsyncSession):
        lead = await _make_chapter_lead(db_session, "todelete@aisalon.xyz", sf_chapter.id)
        r = await client.delete(f"/admin/users/{lead.id}", headers=admin_headers)
        assert r.status_code == 204
        # Verify gone
        r2 = await client.get("/admin/users", headers=admin_headers)
        ids = [u["id"] for u in r2.json()]
        assert lead.id not in ids

    async def test_cannot_delete_self(self, client: AsyncClient, admin_headers, superadmin):
        r = await client.delete(f"/admin/users/{superadmin.id}", headers=admin_headers)
        assert r.status_code == 400

    async def test_not_found(self, client: AsyncClient, admin_headers):
        r = await client.delete("/admin/users/nonexistent", headers=admin_headers)
        assert r.status_code == 404

    async def test_requires_superadmin(self, client: AsyncClient, lead_headers):
        r = await client.delete("/admin/users/some-id", headers=lead_headers)
        assert r.status_code == 403
