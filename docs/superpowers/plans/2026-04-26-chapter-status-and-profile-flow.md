# Chapter Status, Profile Flow, and User/Team Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `draft`/`active`/`archived` lifecycle to Chapters, gate first-login behind a profile-completion flow with photo cropping, and replace the curated `TeamMember` model with profile fields on `User` so the homepage filter (founders + active-chapter leads) is a simple SQL query.

**Architecture:** Additive migrations first, then build the new behavior in parallel with the old `TeamMember` system, then a single backfill+drop migration removes `TeamMember`. The frontend gains a `/profile/complete` page reached from registration and enforced by a layout-level gate. Photo upload uses client-side cropping via `react-easy-crop` to a 512×512 JPEG, posted to a new endpoint that reuses existing `services/storage.py`.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, pytest (backend); Next.js 15, NextAuth, react-easy-crop (frontend). Spec at `docs/superpowers/specs/2026-04-26-chapter-status-and-profile-flow-design.md`.

---

## File Map

| Action | Path |
|--------|------|
| Modify | `backend/app/models/user.py` |
| Modify | `backend/app/models/chapter.py` |
| Delete | `backend/app/models/team_member.py` |
| Create | `backend/alembic/versions/<hash>_add_user_profile_and_chapter_status.py` |
| Create | `backend/alembic/versions/<hash>_drop_team_members.py` |
| Modify | `backend/app/schemas/chapter.py` |
| Create | `backend/app/schemas/profile.py` |
| Modify | `backend/app/schemas/team.py` |
| Modify | `backend/app/schemas/admin.py` |
| Create | `backend/app/api/profile.py` |
| Modify | `backend/app/api/team.py` |
| Modify | `backend/app/api/chapters.py` |
| Modify | `backend/app/api/admin.py` |
| Modify | `backend/app/main.py` |
| Modify | `backend/app/core/seed.py` |
| Modify | `backend/tests/conftest.py` |
| Modify | `backend/tests/test_chapters.py` |
| Create | `backend/tests/test_admin_chapters.py` |
| Modify | `backend/tests/test_admin_invites.py` (or `test_admin.py` invite section) |
| Create | `backend/tests/test_profile.py` |
| Create | `backend/tests/test_profile_photo.py` |
| Modify | `backend/tests/test_team.py` |
| Delete | `backend/tests/test_admin_team.py` |
| Modify | `frontend/package.json` |
| Create | `frontend/src/components/PhotoCropper.tsx` |
| Create | `frontend/src/app/(public)/profile/complete/page.tsx` |
| Modify | `frontend/src/app/(public)/register/page.tsx` |
| Modify | `frontend/src/app/(admin)/layout.tsx` |
| Modify | `frontend/src/app/(admin)/chapters/page.tsx` |
| Modify | `frontend/src/app/(admin)/chapters/edit/[code]/page.tsx` |
| Delete | `frontend/src/app/(admin)/team/page.tsx` |
| Create | `frontend/src/app/(admin)/people/page.tsx` |
| Modify | `frontend/src/app/(admin)/SidebarNav.tsx` |
| Modify | `frontend/src/app/(public)/page.tsx` |

---

## Phase 1: Schema foundation

### Task 1: Add User profile columns and Chapter status constraint (additive migration)

**Files:**
- Modify: `backend/app/models/user.py`
- Modify: `backend/app/models/chapter.py`
- Create: `backend/alembic/versions/<timestamp>_add_user_profile_and_chapter_status.py`

- [ ] **Step 1: Update `backend/app/models/user.py`**

Replace the entire file:

```python
import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Boolean, ForeignKey, Enum as SAEnum, DateTime, Integer, Text
from sqlalchemy.orm import mapped_column, Mapped, relationship
from app.models.base import Base, TimestampMixin


class UserRole(str, enum.Enum):
    superadmin = "superadmin"
    chapter_lead = "chapter_lead"
    host = "host"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True)
    username: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False, default=UserRole.chapter_lead)
    chapter_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("chapters.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    hosting_guide_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lead_guide_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scheduling_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Profile fields (added 2026-04-26)
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    linkedin: Mapped[str | None] = mapped_column(String(512), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str | None] = mapped_column(String(160), nullable=True)
    is_founder: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    profile_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    chapter: Mapped["Chapter | None"] = relationship("Chapter", back_populates="users")  # noqa: F821
```

- [ ] **Step 2: Update `backend/app/models/chapter.py`**

Replace the entire file:

```python
import uuid
from typing import Any
from sqlalchemy import String, Text, JSON, CheckConstraint
from sqlalchemy.orm import mapped_column, Mapped, relationship
from app.models.base import Base, TimestampMixin


class Chapter(Base, TimestampMixin):
    __tablename__ = "chapters"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'active', 'archived')",
            name="chapter_status_check",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    tagline: Mapped[str] = mapped_column(String(256), nullable=False)
    about: Mapped[str] = mapped_column(Text, nullable=False)
    event_link: Mapped[str] = mapped_column(String(512), nullable=False)
    calendar_embed: Mapped[str] = mapped_column(String(512), nullable=False)
    events_description: Mapped[str] = mapped_column(Text, nullable=False)
    about_blocks: Mapped[Any] = mapped_column(JSON, nullable=False, default=list)
    events_blocks: Mapped[Any] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    chapter_guide: Mapped[str | None] = mapped_column(Text, nullable=True)

    team_members: Mapped[list["TeamMember"]] = relationship(  # noqa: F821
        "TeamMember", back_populates="chapter", lazy="select"
    )
    users: Mapped[list["User"]] = relationship(  # noqa: F821
        "User", back_populates="chapter", lazy="select"
    )
```

Note: `TeamMember` relationship stays for now; removed in Phase 7.

- [ ] **Step 3: Generate Alembic migration**

```bash
cd backend
poetry run alembic revision --autogenerate -m "add_user_profile_and_chapter_status"
```

- [ ] **Step 4: Edit the generated migration**

Open the new file under `backend/alembic/versions/`. Verify it adds the 8 new User columns and the Chapter `CheckConstraint`. Replace its body with this canonical form (autogenerate may miss the `CheckConstraint` for SQLite — make it explicit):

```python
"""add_user_profile_and_chapter_status

Revision ID: <generated>
Revises: <previous>
Create Date: 2026-04-26 ...
"""
from alembic import op
import sqlalchemy as sa


revision = "<generated>"
down_revision = "<previous>"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("name", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("profile_image_url", sa.String(length=512), nullable=True))
    op.add_column("users", sa.Column("linkedin", sa.String(length=512), nullable=True))
    op.add_column("users", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("title", sa.String(length=160), nullable=True))
    op.add_column(
        "users",
        sa.Column("is_founder", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "users",
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "users",
        sa.Column("profile_completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Drop server_defaults after backfill so app-level defaults take over
    op.alter_column("users", "is_founder", server_default=None)
    op.alter_column("users", "display_order", server_default=None)

    with op.batch_alter_table("chapters") as batch_op:
        batch_op.create_check_constraint(
            "chapter_status_check",
            "status IN ('draft', 'active', 'archived')",
        )


def downgrade() -> None:
    with op.batch_alter_table("chapters") as batch_op:
        batch_op.drop_constraint("chapter_status_check", type_="check")
    op.drop_column("users", "profile_completed_at")
    op.drop_column("users", "display_order")
    op.drop_column("users", "is_founder")
    op.drop_column("users", "title")
    op.drop_column("users", "description")
    op.drop_column("users", "linkedin")
    op.drop_column("users", "profile_image_url")
    op.drop_column("users", "name")
```

- [ ] **Step 5: Run migration + tests to verify schema works**

```bash
cd backend
poetry run alembic upgrade head
poetry run pytest -q
```

Expected: all existing tests still pass. New columns are nullable so nothing breaks.

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/user.py backend/app/models/chapter.py backend/alembic/versions/
git commit -m "feat: add User profile columns and Chapter status check constraint"
```

---

## Phase 2: Profile-completion API

### Task 2: Profile schemas

**Files:**
- Create: `backend/app/schemas/profile.py`

- [ ] **Step 1: Create `backend/app/schemas/profile.py`**

```python
from datetime import datetime
from pydantic import BaseModel, Field, HttpUrl, field_validator


class ProfileCompleteRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    profile_image_url: str = Field(..., min_length=1, max_length=512)
    linkedin: str | None = Field(default=None, max_length=512)
    description: str | None = Field(default=None, max_length=350)

    @field_validator("linkedin")
    @classmethod
    def _normalize_linkedin(cls, v: str | None) -> str | None:
        if v is None or v.strip() == "":
            return None
        # Light validation; accept full URLs or "linkedin.com/in/..." paths
        return v.strip()


class ProfileResponse(BaseModel):
    id: str
    name: str | None
    profile_image_url: str | None
    linkedin: str | None
    description: str | None
    title: str | None
    is_founder: bool
    profile_completed_at: datetime | None

    model_config = {"from_attributes": True}


class ProfilePhotoResponse(BaseModel):
    url: str
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/profile.py
git commit -m "feat: add profile request/response schemas"
```

### Task 3: Profile photo upload endpoint

**Files:**
- Create: `backend/app/api/profile.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_profile_photo.py`

- [ ] **Step 1: Write failing tests in `backend/tests/test_profile_photo.py`**

```python
"""Tests for profile photo upload."""
import io
import pytest
from httpx import AsyncClient


# 1×1 JPEG (smallest valid JPEG)
JPEG_BYTES = bytes.fromhex(
    "ffd8ffe000104a46494600010100000100010000ffdb0043000806060706"
    "0506080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c"
    "20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432"
    "ffc0000b080001000101011100ffc4001f0000010501010101010100000000"
    "00000000010203040506070809000affda0008010100003f00d2cf20ffd9"
)


async def test_upload_profile_photo_requires_auth(client: AsyncClient):
    files = {"file": ("photo.jpg", io.BytesIO(JPEG_BYTES), "image/jpeg")}
    r = await client.post("/profile/photo", files=files)
    assert r.status_code in (401, 403)


async def test_upload_profile_photo_accepts_jpeg(client: AsyncClient, host_headers):
    files = {"file": ("photo.jpg", io.BytesIO(JPEG_BYTES), "image/jpeg")}
    r = await client.post("/profile/photo", files=files, headers=host_headers)
    assert r.status_code == 200
    body = r.json()
    assert "url" in body
    assert body["url"].startswith("/uploads/")


async def test_upload_profile_photo_rejects_non_image(client: AsyncClient, host_headers):
    files = {"file": ("notes.txt", io.BytesIO(b"hello world"), "text/plain")}
    r = await client.post("/profile/photo", files=files, headers=host_headers)
    assert r.status_code == 400


async def test_upload_profile_photo_rejects_oversize(client: AsyncClient, host_headers):
    big = JPEG_BYTES + b"\x00" * (5 * 1024 * 1024 + 1)
    files = {"file": ("big.jpg", io.BytesIO(big), "image/jpeg")}
    r = await client.post("/profile/photo", files=files, headers=host_headers)
    assert r.status_code == 413
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
poetry run pytest tests/test_profile_photo.py -v
```

Expected: all FAIL (404 — endpoint doesn't exist).

- [ ] **Step 3: Create `backend/app/api/profile.py`**

```python
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.profile import (
    ProfileCompleteRequest,
    ProfileResponse,
    ProfilePhotoResponse,
)
from app.services.storage import save_upload

router = APIRouter(prefix="/profile", tags=["profile"])

MAX_PHOTO_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_IMAGE_PREFIXES = (b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n")  # jpeg, png


@router.post("/photo", response_model=ProfilePhotoResponse)
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    data = await file.read()
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 5 MB)")
    if not any(data.startswith(p) for p in ALLOWED_IMAGE_PREFIXES):
        raise HTTPException(status_code=400, detail="Only JPEG or PNG images are allowed")
    filename = file.filename or "photo.jpg"
    key = await save_upload(filename, data)
    return ProfilePhotoResponse(url=f"/uploads/{key}")
```

- [ ] **Step 4: Register router in `backend/app/main.py`**

Find the existing `from app.api import` block and add:

```python
from app.api import profile as profile_api
```

Find the existing `app.include_router(...)` lines and add:

```python
app.include_router(profile_api.router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend
poetry run pytest tests/test_profile_photo.py -v
```

Expected: 4 PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/profile.py backend/app/main.py backend/tests/test_profile_photo.py
git commit -m "feat: profile photo upload endpoint with magic-byte and size validation"
```

### Task 4: `POST /profile/complete` endpoint

**Files:**
- Modify: `backend/app/api/profile.py`
- Create: `backend/tests/test_profile.py`

- [ ] **Step 1: Write failing tests in `backend/tests/test_profile.py`**

```python
"""Tests for profile-completion endpoint."""
import pytest
from httpx import AsyncClient


async def test_profile_complete_requires_auth(client: AsyncClient):
    r = await client.post("/profile/complete", json={
        "name": "Bob",
        "profile_image_url": "/uploads/x.jpg",
    })
    assert r.status_code in (401, 403)


async def test_profile_complete_sets_completed_at(
    client: AsyncClient, host_user, host_headers, db_session
):
    r = await client.post("/profile/complete", headers=host_headers, json={
        "name": "Bob Roberts",
        "profile_image_url": "/uploads/bob.jpg",
        "linkedin": "https://linkedin.com/in/bob",
        "description": "Loves AI and salons.",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Bob Roberts"
    assert body["profile_completed_at"] is not None

    await db_session.refresh(host_user)
    assert host_user.name == "Bob Roberts"
    assert host_user.profile_completed_at is not None


async def test_profile_complete_rejects_long_description(client: AsyncClient, host_headers):
    r = await client.post("/profile/complete", headers=host_headers, json={
        "name": "Bob",
        "profile_image_url": "/uploads/bob.jpg",
        "description": "x" * 351,
    })
    assert r.status_code == 422


async def test_profile_complete_requires_name(client: AsyncClient, host_headers):
    r = await client.post("/profile/complete", headers=host_headers, json={
        "name": "",
        "profile_image_url": "/uploads/bob.jpg",
    })
    assert r.status_code == 422


async def test_profile_complete_requires_image(client: AsyncClient, host_headers):
    r = await client.post("/profile/complete", headers=host_headers, json={
        "name": "Bob",
        "profile_image_url": "",
    })
    assert r.status_code == 422


async def test_profile_status_endpoint(client: AsyncClient, host_user, host_headers):
    r = await client.get("/profile/me", headers=host_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == host_user.id
    assert body["profile_completed_at"] is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
poetry run pytest tests/test_profile.py -v
```

Expected: all FAIL.

- [ ] **Step 3: Add endpoints to `backend/app/api/profile.py`**

Add these imports near the top:

```python
from datetime import datetime, timezone
from sqlalchemy import select
```

Add these endpoints to the file (after the existing `upload_profile_photo`):

```python
@router.get("/me", response_model=ProfileResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.post("/complete", response_model=ProfileResponse)
async def complete_profile(
    body: ProfileCompleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.name = body.name
    current_user.profile_image_url = body.profile_image_url
    current_user.linkedin = body.linkedin
    current_user.description = body.description
    if current_user.profile_completed_at is None:
        current_user.profile_completed_at = datetime.now(timezone.utc)
    # Set a sensible default title if none yet
    if not current_user.title:
        current_user.title = _default_title(current_user, db)
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user


async def _default_title(user: User, db: AsyncSession) -> str | None:
    if user.role.value == "chapter_lead" and user.chapter_id:
        from app.models.chapter import Chapter
        result = await db.execute(select(Chapter).where(Chapter.id == user.chapter_id))
        ch = result.scalar_one_or_none()
        if ch:
            return f"{ch.name} Chapter Lead"
    if user.role.value == "host":
        return "Host"
    return None
```

Note: `_default_title` is called synchronously above but is an async function — fix the call:

Replace `current_user.title = _default_title(current_user, db)` with:

```python
        current_user.title = await _default_title(current_user, db)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
poetry run pytest tests/test_profile.py -v
```

Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/profile.py backend/tests/test_profile.py
git commit -m "feat: profile-completion endpoint with default title derivation"
```

---

## Phase 3: Chapter create + status admin

### Task 5: Public chapters filter to active

**Files:**
- Modify: `backend/app/api/chapters.py`
- Modify: `backend/tests/test_chapters.py`

- [ ] **Step 1: Read existing `backend/tests/test_chapters.py` and append failing tests**

Add at the end of the file:

```python
async def test_list_chapters_excludes_draft(client: AsyncClient, db_session):
    from app.models.chapter import Chapter
    db_session.add(Chapter(
        code="draft1", name="Draft", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="draft",
    ))
    await db_session.commit()
    r = await client.get("/chapters")
    codes = [c["code"] for c in r.json()]
    assert "draft1" not in codes


async def test_list_chapters_excludes_archived(client: AsyncClient, db_session):
    from app.models.chapter import Chapter
    db_session.add(Chapter(
        code="arch1", name="Arch", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="archived",
    ))
    await db_session.commit()
    r = await client.get("/chapters")
    codes = [c["code"] for c in r.json()]
    assert "arch1" not in codes


async def test_get_draft_chapter_returns_404(client: AsyncClient, db_session):
    from app.models.chapter import Chapter
    db_session.add(Chapter(
        code="draft2", name="D2", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="draft",
    ))
    await db_session.commit()
    r = await client.get("/chapters/draft2")
    assert r.status_code == 404


async def test_get_archived_chapter_returns_404(client: AsyncClient, db_session):
    from app.models.chapter import Chapter
    db_session.add(Chapter(
        code="arch2", name="A2", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="archived",
    ))
    await db_session.commit()
    r = await client.get("/chapters/arch2")
    assert r.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
poetry run pytest tests/test_chapters.py -v
```

Expected: 4 new tests FAIL.

- [ ] **Step 3: Update `backend/app/api/chapters.py`**

Replace the file body:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.chapter import Chapter
from app.schemas.chapter import ChapterSummary, ChapterDetail

router = APIRouter(prefix="/chapters", tags=["chapters"])


@router.get("", response_model=list[ChapterSummary])
async def list_chapters(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Chapter)
        .where(Chapter.status == "active")
        .order_by(Chapter.name)
    )
    return result.scalars().all()


@router.get("/{identifier}", response_model=ChapterDetail)
async def get_chapter(identifier: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Chapter)
        .options(selectinload(Chapter.team_members))
        .where(
            (Chapter.status == "active")
            & ((Chapter.code == identifier) | (Chapter.id == identifier))
        )
    )
    result = await db.execute(stmt)
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    return chapter
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
poetry run pytest tests/test_chapters.py -v
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/chapters.py backend/tests/test_chapters.py
git commit -m "feat: public chapter endpoints filter to active status only"
```

### Task 6: Admin create chapter + status edit

**Files:**
- Modify: `backend/app/schemas/admin.py`
- Modify: `backend/app/api/admin.py`
- Create: `backend/tests/test_admin_chapters.py`

- [ ] **Step 1: Write failing tests in `backend/tests/test_admin_chapters.py`**

```python
"""Tests for admin chapter create + status updates."""
import pytest
from httpx import AsyncClient


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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
poetry run pytest tests/test_admin_chapters.py -v
```

Expected: most FAIL (endpoint missing or status validation missing).

- [ ] **Step 3: Add `ChapterCreate` schema to `backend/app/schemas/admin.py`**

Find the existing `ChapterUpdate` class. Add `ChapterCreate` and update `ChapterUpdate` to include `status`:

```python
from typing import Literal


class ChapterCreate(BaseModel):
    code: str = Field(..., pattern=r"^[a-z0-9-]+$", min_length=1, max_length=32)
    name: str = Field(..., min_length=1, max_length=128)


# Update existing ChapterUpdate (do not duplicate, edit in place):
class ChapterUpdate(BaseModel):
    name: str | None = None
    title: str | None = None
    tagline: str | None = None
    description: str | None = None
    about: str | None = None
    event_link: str | None = None
    calendar_embed: str | None = None
    events_description: str | None = None
    about_blocks: list | None = None
    events_blocks: list | None = None
    status: Literal["draft", "active", "archived"] | None = None
    chapter_guide: str | None = None
```

(Keep any other fields ChapterUpdate already had.)

- [ ] **Step 4: Add create-chapter endpoint to `backend/app/api/admin.py`**

Find the existing chapter routes section (look for `@router.patch("/chapters/{code}"` or similar) and add above it:

```python
@router.post("/chapters", status_code=status.HTTP_201_CREATED)
async def create_chapter(
    body: ChapterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    existing = await db.execute(select(Chapter).where(Chapter.code == body.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Chapter code already exists")
    chapter = Chapter(
        code=body.code,
        name=body.name,
        title=body.name,
        description="",
        tagline="",
        about="",
        event_link="",
        calendar_embed="",
        events_description="",
        status="draft",
    )
    db.add(chapter)
    await db.commit()
    await db.refresh(chapter)
    return {
        "id": chapter.id,
        "code": chapter.code,
        "name": chapter.name,
        "status": chapter.status,
    }
```

Add `ChapterCreate` to the imports at the top of `admin.py`:

```python
from app.schemas.admin import (
    ...,
    ChapterCreate,
    ...
)
```

- [ ] **Step 5: Confirm there is an `/admin/chapters` GET that returns all statuses**

Search `backend/app/api/admin.py` for `list_chapters` or `@router.get("/chapters"`. If it doesn't exist, add:

```python
@router.get("/chapters")
async def admin_list_chapters(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    result = await db.execute(select(Chapter).order_by(Chapter.name))
    return [
        {
            "id": c.id, "code": c.code, "name": c.name,
            "title": c.title, "tagline": c.tagline, "status": c.status,
        }
        for c in result.scalars().all()
    ]
```

If a similar endpoint already exists, ensure it does **not** filter by status.

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend
poetry run pytest tests/test_admin_chapters.py -v
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/admin.py backend/app/schemas/admin.py backend/tests/test_admin_chapters.py
git commit -m "feat: admin endpoint to create chapters; status field validated on update"
```

### Task 7: Invite gating on archived chapters

**Files:**
- Modify: `backend/app/api/admin.py`
- Modify: `backend/tests/test_admin_invites.py` (or create if missing)

- [ ] **Step 1: Locate or create the invites test file**

```bash
cd backend
ls tests/ | grep -i invite
```

If `test_admin_invites.py` exists, append to it. If not, create it:

```python
"""Tests for invite creation and gating."""
import pytest
from httpx import AsyncClient


async def test_create_invite_blocked_for_archived_chapter(
    client: AsyncClient, admin_headers, db_session
):
    from app.models.chapter import Chapter
    arch = Chapter(
        code="zzz", name="Z", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="archived",
    )
    db_session.add(arch)
    await db_session.commit()
    await db_session.refresh(arch)

    r = await client.post("/admin/invites", headers=admin_headers, json={
        "chapter_id": arch.id,
        "role": "host",
        "max_uses": 1,
    })
    assert r.status_code == 400


async def test_create_invite_allowed_for_draft_chapter(
    client: AsyncClient, admin_headers, db_session
):
    from app.models.chapter import Chapter
    draft = Chapter(
        code="dd", name="D", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="draft",
    )
    db_session.add(draft)
    await db_session.commit()
    await db_session.refresh(draft)

    r = await client.post("/admin/invites", headers=admin_headers, json={
        "chapter_id": draft.id,
        "role": "host",
        "max_uses": 1,
    })
    assert r.status_code == 201
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
poetry run pytest tests/test_admin_invites.py -v
```

Expected: archived test FAILS (currently allows it); draft test may already pass.

- [ ] **Step 3: Update invite creation in `backend/app/api/admin.py`**

Find `async def create_invite(...)` (~line 846). After `_require_lead_or_above(current_user)` and the chapter_lead check, add a chapter status check:

```python
    # Block invites for archived chapters
    ch_result = await db.execute(select(Chapter).where(Chapter.id == body.chapter_id))
    ch = ch_result.scalar_one_or_none()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")
    if ch.status == "archived":
        raise HTTPException(status_code=400, detail="Cannot invite to an archived chapter")
```

Place it before the `Invite(...)` construction.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
poetry run pytest tests/test_admin_invites.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/admin.py backend/tests/test_admin_invites.py
git commit -m "feat: block invite creation for archived chapters"
```

---

## Phase 4: New `/team` (User-backed)

### Task 8: Rewrite `GET /team` to query Users

**Files:**
- Modify: `backend/app/schemas/team.py`
- Modify: `backend/app/api/team.py`
- Modify: `backend/tests/test_team.py`

- [ ] **Step 1: Update `backend/app/schemas/team.py`**

Replace the file:

```python
from pydantic import BaseModel


class TeamMemberOut(BaseModel):
    id: str
    name: str
    title: str | None
    description: str | None
    profile_image_url: str
    linkedin: str | None
    is_founder: bool
    chapter_code: str | None
    chapter_name: str | None

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Rewrite `backend/tests/test_team.py`**

Replace the file:

```python
"""Tests for public /team endpoint (User-backed)."""
import pytest
from datetime import datetime, timezone
from httpx import AsyncClient

from app.models.user import User, UserRole
from app.models.chapter import Chapter
from app.core.security import hash_password


async def _make_completed_user(
    db, *, email, name, role, chapter_id=None, is_founder=False,
    title=None, display_order=0,
):
    u = User(
        email=email,
        username=email.split("@")[0],
        hashed_password=hash_password("x"),
        role=role,
        chapter_id=chapter_id,
        is_active=True,
        name=name,
        profile_image_url=f"/uploads/{name.lower().replace(' ', '_')}.jpg",
        title=title or role.value,
        is_founder=is_founder,
        display_order=display_order,
        profile_completed_at=datetime.now(timezone.utc),
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


async def test_team_includes_founders(client: AsyncClient, db_session):
    await _make_completed_user(
        db_session, email="ian@x", name="Ian E", role=UserRole.superadmin,
        is_founder=True, title="Founder, Executive Director",
    )
    r = await client.get("/team")
    assert r.status_code == 200
    body = r.json()
    names = [m["name"] for m in body]
    assert "Ian E" in names
    ian = next(m for m in body if m["name"] == "Ian E")
    assert ian["is_founder"] is True


async def test_team_includes_active_chapter_leads(client: AsyncClient, db_session, sf_chapter):
    await _make_completed_user(
        db_session, email="lead@x", name="Lead Person", role=UserRole.chapter_lead,
        chapter_id=sf_chapter.id, title="San Francisco Chapter Lead",
    )
    r = await client.get("/team")
    names = [m["name"] for m in r.json()]
    assert "Lead Person" in names


async def test_team_excludes_chapter_leads_from_draft_chapters(
    client: AsyncClient, db_session
):
    draft = Chapter(
        code="dr", name="Dr", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="draft",
    )
    db_session.add(draft)
    await db_session.commit()
    await db_session.refresh(draft)
    await _make_completed_user(
        db_session, email="dlead@x", name="Draft Lead", role=UserRole.chapter_lead,
        chapter_id=draft.id,
    )
    r = await client.get("/team")
    names = [m["name"] for m in r.json()]
    assert "Draft Lead" not in names


async def test_team_excludes_chapter_leads_from_archived_chapters(
    client: AsyncClient, db_session
):
    arch = Chapter(
        code="ar", name="Ar", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="archived",
    )
    db_session.add(arch)
    await db_session.commit()
    await db_session.refresh(arch)
    await _make_completed_user(
        db_session, email="alead@x", name="Arch Lead", role=UserRole.chapter_lead,
        chapter_id=arch.id,
    )
    r = await client.get("/team")
    names = [m["name"] for m in r.json()]
    assert "Arch Lead" not in names


async def test_team_excludes_hosts(client: AsyncClient, db_session, sf_chapter):
    await _make_completed_user(
        db_session, email="host@x", name="Host Person", role=UserRole.host,
        chapter_id=sf_chapter.id,
    )
    r = await client.get("/team")
    names = [m["name"] for m in r.json()]
    assert "Host Person" not in names


async def test_team_includes_founder_who_is_host(client: AsyncClient, db_session, sf_chapter):
    # Cecilia case: role=host, is_founder=true → should appear
    await _make_completed_user(
        db_session, email="cec@x", name="Cecilia", role=UserRole.host,
        chapter_id=sf_chapter.id, is_founder=True, title="Co-Founder, Advisor",
    )
    r = await client.get("/team")
    names = [m["name"] for m in r.json()]
    assert "Cecilia" in names


async def test_team_excludes_users_with_incomplete_profile(
    client: AsyncClient, db_session, sf_chapter
):
    # Lead exists, but profile_completed_at is NULL
    u = User(
        email="incomplete@x", username="incomplete",
        hashed_password=hash_password("x"),
        role=UserRole.chapter_lead, chapter_id=sf_chapter.id, is_active=True,
    )
    db_session.add(u)
    await db_session.commit()
    r = await client.get("/team")
    names = [m["name"] for m in r.json() if m.get("name")]
    assert "incomplete" not in names


async def test_team_sort_order_founders_first(
    client: AsyncClient, db_session, sf_chapter
):
    await _make_completed_user(
        db_session, email="lead@x", name="Lead Person", role=UserRole.chapter_lead,
        chapter_id=sf_chapter.id,
    )
    await _make_completed_user(
        db_session, email="ian@x", name="Ian E", role=UserRole.superadmin,
        is_founder=True,
    )
    r = await client.get("/team")
    names = [m["name"] for m in r.json()]
    assert names.index("Ian E") < names.index("Lead Person")
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend
poetry run pytest tests/test_team.py -v
```

Expected: most FAIL — endpoint still queries TeamMember.

- [ ] **Step 4: Rewrite `backend/app/api/team.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.chapter import Chapter
from app.schemas.team import TeamMemberOut

router = APIRouter(prefix="/team", tags=["team"])


@router.get("", response_model=list[TeamMemberOut])
async def list_team(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(User)
        .options(selectinload(User.chapter))
        .outerjoin(Chapter, User.chapter_id == Chapter.id)
        .where(User.profile_completed_at.is_not(None))
        .where(
            (User.is_founder.is_(True))
            | ((User.role == UserRole.chapter_lead) & (Chapter.status == "active"))
        )
    )
    result = await db.execute(stmt)
    users = result.scalars().unique().all()

    def sort_key(u: User) -> tuple:
        # Founders first; then chapter leads sorted by chapter name then display_order
        founder_bucket = 0 if u.is_founder else 1
        chapter_name = (u.chapter.name if u.chapter else "")
        return (founder_bucket, chapter_name, u.display_order, u.created_at)

    users.sort(key=sort_key)

    return [
        TeamMemberOut(
            id=u.id,
            name=u.name or "",
            title=u.title,
            description=u.description,
            profile_image_url=u.profile_image_url or "",
            linkedin=u.linkedin,
            is_founder=u.is_founder,
            chapter_code=(u.chapter.code if u.chapter else None),
            chapter_name=(u.chapter.name if u.chapter else None),
        )
        for u in users
    ]
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend
poetry run pytest tests/test_team.py -v
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/team.py backend/app/schemas/team.py backend/tests/test_team.py
git commit -m "feat: /team endpoint queries Users (founders + active-chapter leads)"
```

---

## Phase 5: Frontend — profile flow + cropping

### Task 9: Add `react-easy-crop` and create `PhotoCropper` component

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/components/PhotoCropper.tsx`

- [ ] **Step 1: Install `react-easy-crop`**

```bash
cd frontend
npm install react-easy-crop@^5.5.0
```

- [ ] **Step 2: Create `frontend/src/components/PhotoCropper.tsx`**

```tsx
"use client";

import { useCallback, useState } from "react";
import Cropper, { Area } from "react-easy-crop";

const OUTPUT_SIZE = 512;

interface Props {
  file: File;
  onCancel: () => void;
  onConfirm: (croppedBlob: Blob) => void;
}

export default function PhotoCropper({ file, onCancel, onConfirm }: Props) {
  const [imageSrc] = useState(() => URL.createObjectURL(file));
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setBusy(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      onConfirm(blob);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-md aspect-square bg-black rounded">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>
      <div className="mt-4 w-full max-w-md flex flex-col gap-3">
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full"
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="btn">Cancel</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !croppedAreaPixels}
            className="btn btn-primary"
          >
            {busy ? "Cropping..." : "Use photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

async function getCroppedBlob(src: string, pixels: Area): Promise<Blob> {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(
    image,
    pixels.x, pixels.y, pixels.width, pixels.height,
    0, 0, OUTPUT_SIZE, OUTPUT_SIZE,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.9,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
```

- [ ] **Step 3: Verify build**

```bash
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/components/PhotoCropper.tsx
git commit -m "feat: PhotoCropper component using react-easy-crop with circular 1:1 crop"
```

### Task 10: Profile-completion page

**Files:**
- Create: `frontend/src/app/(public)/profile/complete/page.tsx`

- [ ] **Step 1: Create `frontend/src/app/(public)/profile/complete/page.tsx`**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import PhotoCropper from "@/components/PhotoCropper";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

export default function ProfileCompletePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [linkedin, setLinkedin] = useState("");
  const [description, setDescription] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please choose a JPEG or PNG image (HEIC not supported).");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Image must be under 5 MB.");
      return;
    }
    setPendingFile(file);
  }

  async function handleCropConfirm(blob: Blob) {
    setPendingFile(null);
    setError(null);
    const fd = new FormData();
    fd.append("file", new File([blob], "photo.jpg", { type: "image/jpeg" }));
    const token = (session as unknown as { accessToken?: string })?.accessToken;
    const r = await fetch(`${API_URL}/profile/photo`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!r.ok) {
      setError("Photo upload failed. Try again.");
      return;
    }
    const body = await r.json();
    setPhotoUrl(body.url);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !photoUrl) {
      setError("Name and a photo are required.");
      return;
    }
    setSubmitting(true);
    const token = (session as unknown as { accessToken?: string })?.accessToken;
    const r = await fetch(`${API_URL}/profile/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        name: name.trim(),
        profile_image_url: photoUrl,
        linkedin: linkedin.trim() || null,
        description: description.trim() || null,
      }),
    });
    setSubmitting(false);
    if (!r.ok) {
      setError("Could not save profile. Please try again.");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Complete your profile</h1>
      <p className="text-salon-muted mb-6">
        We need a name and photo before you can use the platform.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Name *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            className="border rounded px-3 py-2"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="font-medium">Photo *</span>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${API_URL}${photoUrl}`}
              alt="Profile preview"
              className="w-32 h-32 rounded-full object-cover"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
              No photo
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={onFileSelected}
            className="text-sm"
          />
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-medium">LinkedIn URL (optional)</span>
          <input
            type="url"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            maxLength={512}
            className="border rounded px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">
            Description (optional, {description.length}/350)
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 350))}
            maxLength={350}
            rows={4}
            className="border rounded px-3 py-2"
          />
        </label>

        {error ? <p className="text-red-600 text-sm">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting || !name || !photoUrl}
          className="btn btn-primary self-start"
        >
          {submitting ? "Saving..." : "Save profile"}
        </button>
      </form>

      {pendingFile ? (
        <PhotoCropper
          file={pendingFile}
          onCancel={() => setPendingFile(null)}
          onConfirm={handleCropConfirm}
        />
      ) : null}
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/\(public\)/profile/
git commit -m "feat: profile-completion page with cropper, photo upload, 350-char description"
```

### Task 11: Gate dashboard on incomplete profile

**Files:**
- Modify: `frontend/src/app/(admin)/layout.tsx`
- Modify: `frontend/src/app/(public)/register/page.tsx`

- [ ] **Step 1: Read current admin layout**

```bash
cat frontend/src/app/\(admin\)/layout.tsx | head -80
```

- [ ] **Step 2: Add a profile-incomplete check inside the admin layout**

In `frontend/src/app/(admin)/layout.tsx`, locate the auth check (likely a server-side `auth()` call followed by a redirect to `/login`). Immediately after confirming the user is authenticated, fetch their profile state and redirect:

```tsx
// near top, with other imports
import { redirect } from "next/navigation";

// inside the layout component, after `if (!session) redirect('/login')`:
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const token = (session as unknown as { accessToken?: string }).accessToken;
if (token) {
  const r = await fetch(`${apiUrl}/profile/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (r.ok) {
    const me = await r.json();
    if (!me.profile_completed_at) {
      redirect("/profile/complete");
    }
  }
}
```

If the existing layout is a client component, hoist the check to a server component wrapper or do the redirect from a `useEffect` calling `/profile/me` and `router.replace`. Match the surrounding pattern.

- [ ] **Step 3: Update register page redirect**

In `frontend/src/app/(public)/register/page.tsx`, find the post-registration redirect (look for `router.push("/dashboard")` or similar) and change it to `router.push("/profile/complete")`.

- [ ] **Step 4: Verify build**

```bash
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/\(admin\)/layout.tsx frontend/src/app/\(public\)/register/page.tsx
git commit -m "feat: redirect users with incomplete profiles to /profile/complete"
```

---

## Phase 6: Frontend — chapters admin

### Task 12: Status filter tabs and create-chapter modal

**Files:**
- Modify: `frontend/src/app/(admin)/chapters/page.tsx`

- [ ] **Step 1: Read current `frontend/src/app/(admin)/chapters/page.tsx`**

Open the file and identify (a) where chapters are listed/filtered, (b) the Active badge styling, (c) any superadmin-only UI guards.

- [ ] **Step 2: Add status tabs and create modal**

Replace the file body. Keep existing helper imports (auth, api wrappers) and styling. Reference shape:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const STATUSES = ["draft", "active", "archived", "all"] as const;
type StatusFilter = (typeof STATUSES)[number];

interface Chapter {
  id: string;
  code: string;
  name: string;
  status: "draft" | "active" | "archived";
}

export default function ChaptersAdminPage() {
  const { data: session } = useSession();
  const token = (session as unknown as { accessToken?: string })?.accessToken;

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const r = await fetch(`${API_URL}/admin/chapters`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (r.ok) setChapters(await r.json());
  }

  useEffect(() => {
    if (token) refresh();
  }, [token]);

  const filtered = useMemo(() => {
    if (filter === "all") return chapters;
    return chapters.filter((c) => c.status === filter);
  }, [chapters, filter]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[a-z0-9-]+$/.test(newCode)) {
      setError("Code must be lowercase letters, numbers, and hyphens only.");
      return;
    }
    setCreating(true);
    const r = await fetch(`${API_URL}/admin/chapters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ code: newCode, name: newName }),
    });
    setCreating(false);
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(body.detail || "Failed to create chapter.");
      return;
    }
    setShowCreate(false);
    setNewCode("");
    setNewName("");
    refresh();
  }

  async function setStatus(code: string, status: "draft" | "active" | "archived") {
    await fetch(`${API_URL}/admin/chapters/${code}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ status }),
    });
    refresh();
  }

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Chapters</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          New chapter
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded ${filter === s ? "bg-salon-blue text-white" : "bg-gray-100"}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <ul className="grid gap-3">
        {filtered.map((c) => (
          <li key={c.id} className="border rounded p-4 flex items-center justify-between">
            <div>
              <Link href={`/chapters/edit/${c.code}`} className="font-medium hover:underline">
                {c.name}
              </Link>
              <span className="ml-2 text-xs uppercase text-salon-muted">{c.code}</span>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={c.status}
                onChange={(e) => setStatus(c.code, e.target.value as Chapter["status"])}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
              {c.status !== "archived" ? (
                <Link
                  href={`/users?chapter=${c.code}&invite=1`}
                  className="btn btn-sm"
                >
                  Add person
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {showCreate ? (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={onCreate} className="bg-white rounded p-6 w-full max-w-md flex flex-col gap-3">
            <h2 className="text-lg font-semibold">New chapter</h2>
            <label className="flex flex-col gap-1">
              <span>Code (lowercase, hyphens)</span>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toLowerCase())}
                required
                maxLength={32}
                className="border rounded px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>Name</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                maxLength={128}
                className="border rounded px-3 py-2"
              />
            </label>
            {error ? <p className="text-red-600 text-sm">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 3: Add `status` field to chapter edit page**

Open `frontend/src/app/(admin)/chapters/edit/[code]/page.tsx`. Find the form and add a `<select>` for status after the existing `name` field, wired into the existing PATCH submission. The dropdown options: `draft`, `active`, `archived`.

- [ ] **Step 4: Verify build**

```bash
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/\(admin\)/chapters/
git commit -m "feat: chapter admin — status tabs, create modal, status select"
```

---

## Phase 7: Migrate, seed, and remove TeamMember

### Task 13: Backfill TeamMembers into Users; drop `team_members`

**Files:**
- Create: `backend/alembic/versions/<hash>_drop_team_members.py`
- Modify: `backend/app/core/seed.py`
- Modify: `backend/app/main.py` (remove TeamMember model import if any)
- Delete: `backend/app/models/team_member.py`
- Delete: `backend/app/api/admin.py` team-related endpoints
- Delete: `backend/tests/test_admin_team.py`

- [ ] **Step 1: Generate the data migration**

```bash
cd backend
poetry run alembic revision -m "drop_team_members_and_backfill_users"
```

- [ ] **Step 2: Edit the new migration file**

```python
"""drop_team_members_and_backfill_users

Revision ID: <generated>
Revises: <previous>
Create Date: 2026-04-26 ...
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime, timezone
import re
import secrets


revision = "<generated>"
down_revision = "<previous>"
branch_labels = None
depends_on = None


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or f"user-{secrets.token_hex(4)}"


def upgrade() -> None:
    bind = op.get_bind()
    now = datetime.now(timezone.utc).isoformat()

    # Skip if team_members table doesn't exist (fresh DB)
    insp = sa.inspect(bind)
    if "team_members" not in insp.get_table_names():
        return

    members = bind.execute(sa.text("""
        SELECT tm.id, tm.chapter_id, tm.name, tm.role, tm.description,
               tm.profile_image_url, tm.linkedin, tm.is_cofounder, tm.display_order,
               c.code AS chapter_code
        FROM team_members tm
        LEFT JOIN chapters c ON c.id = tm.chapter_id
    """)).fetchall()

    # Pre-collect existing usernames to avoid collisions
    existing_usernames = {
        row[0] for row in bind.execute(sa.text("SELECT username FROM users WHERE username IS NOT NULL"))
    }

    used_chapter_lead_users: set[str] = set()  # user_ids already claimed

    for m in members:
        role_text = (m.role or "").lower()
        is_founder = bool(m.is_cofounder)
        is_chapter_lead = "chapter lead" in role_text and not is_founder

        # Skip hosts — they aren't migrated
        if not is_founder and not is_chapter_lead:
            continue

        target_user_id = None

        if is_chapter_lead and m.chapter_code:
            row = bind.execute(sa.text(
                "SELECT id FROM users WHERE username = :u"
            ), {"u": m.chapter_code}).fetchone()
            if row and row[0] not in used_chapter_lead_users:
                target_user_id = row[0]
                used_chapter_lead_users.add(target_user_id)

        if is_founder:
            # Try matching by name first
            row = bind.execute(sa.text(
                "SELECT id FROM users WHERE name = :n OR username = :n"
            ), {"n": m.name}).fetchone()
            if row:
                target_user_id = row[0]
            # Special case: Ian Eisenberg → seeded admin user
            if target_user_id is None and (m.name or "").startswith("Ian"):
                row = bind.execute(sa.text(
                    "SELECT id FROM users WHERE username = 'admin'"
                )).fetchone()
                if row:
                    target_user_id = row[0]

        if target_user_id is None:
            # Create a User shell
            base_slug = _slugify(m.name or "person")
            slug = base_slug
            i = 1
            while slug in existing_usernames:
                i += 1
                slug = f"{base_slug}-{i}"
            existing_usernames.add(slug)
            new_id = secrets.token_hex(16)
            role_value = "chapter_lead" if is_chapter_lead else "host"
            bind.execute(sa.text("""
                INSERT INTO users (id, email, username, hashed_password, role, chapter_id,
                                   is_active, name, profile_image_url, linkedin, description,
                                   title, is_founder, display_order, profile_completed_at,
                                   created_at, updated_at)
                VALUES (:id, :email, :username, :pw, :role, :chapter_id,
                        :is_active, :name, :pic, :linkedin, :desc,
                        :title, :is_founder, :display_order, :completed,
                        :now, :now)
            """), {
                "id": new_id,
                "email": f"{slug}@aisalon.placeholder",
                "username": slug,
                "pw": "!disabled",
                "role": role_value,
                "chapter_id": m.chapter_id,
                "is_active": False,
                "name": m.name,
                "pic": m.profile_image_url,
                "linkedin": m.linkedin or None,
                "desc": m.description or None,
                "title": m.role,
                "is_founder": is_founder,
                "display_order": m.display_order or 0,
                "completed": now,
                "now": now,
            })
        else:
            # Update existing user with profile fields
            bind.execute(sa.text("""
                UPDATE users SET
                    name = :name,
                    profile_image_url = :pic,
                    linkedin = :linkedin,
                    description = :desc,
                    title = :title,
                    is_founder = :is_founder,
                    display_order = :display_order,
                    profile_completed_at = :completed
                WHERE id = :id
            """), {
                "id": target_user_id,
                "name": m.name,
                "pic": m.profile_image_url,
                "linkedin": m.linkedin or None,
                "desc": m.description or None,
                "title": m.role,
                "is_founder": is_founder,
                "display_order": m.display_order or 0,
                "completed": now,
            })

    op.drop_table("team_members")


def downgrade() -> None:
    # Recreate team_members table (empty); data is not restored
    op.create_table(
        "team_members",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("chapter_id", sa.String(length=36), sa.ForeignKey("chapters.id"), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("role", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("profile_image_url", sa.String(length=512), nullable=False),
        sa.Column("linkedin", sa.String(length=512), nullable=True),
        sa.Column("is_cofounder", sa.Boolean(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
```

- [ ] **Step 3: Run migration locally and confirm tables**

```bash
cd backend
poetry run alembic upgrade head
poetry run python -c "
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal
async def go():
    async with AsyncSessionLocal() as db:
        r = await db.execute(text(\"SELECT name FROM sqlite_master WHERE type='table'\"))
        print([row[0] for row in r])
asyncio.run(go())
"
```

Expected: `team_members` not in the list.

- [ ] **Step 4: Rewrite `backend/app/core/seed.py`**

Replace the entire file. Keep `seed_volunteer_roles` and `seed_topics` unchanged. Replace founder/chapter/team-member seeds:

```python
"""Startup seed: superadmin + all chapters + chapter leads + founders + topics + volunteer roles."""
from datetime import datetime, timezone
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.chapter import Chapter
from app.models.volunteer import VolunteerRole
from app.models.topic import Topic

logger = get_logger(__name__)

_P = "/images/people"


def _now():
    return datetime.now(timezone.utc)


_CHAPTERS = [
    dict(
        code="sf",
        name="San Francisco",
        title="The San Francisco Ai Salon",
        tagline="Where AI innovation meets thoughtful conversation",
        description=(
            "The San Francisco Ai Salon is where it all began. As our founding chapter, "
            "we bring together the vibrant Bay Area AI community to discuss the most "
            "pressing topics in artificial intelligence today."
        ),
        about="",
        event_link="https://lu.ma/Ai-salon?tag=SF",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=SF",
        events_description=(
            "Join us in San Francisco for intimate salons and larger symposia exploring "
            "AI's impact on technology, society, and the future."
        ),
        status="active",
        lead_profile=None,  # SF lead handled via founders below
    ),
    dict(
        code="berlin",
        name="Berlin",
        title="The Berlin Ai Salon",
        tagline="Bridging European perspectives on AI",
        description=(
            "The Berlin Ai Salon brings together Europe's diverse perspectives on "
            "artificial intelligence, fostering cross-cultural dialogue on AI's future "
            "development and impact."
        ),
        about="",
        event_link="https://lu.ma/Ai-salon?tag=Berlin",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=Berlin",
        events_description=(
            "Berlin's vibrant tech and policy scene meets to explore AI's transformative "
            "potential through intimate salons and cross-cultural dialogue."
        ),
        status="active",
        lead_profile=dict(
            name="Apurba Kundu",
            title="Berlin Chapter Lead",
            description=(
                "Apurba is a tech lawyer by training and currently a public policy "
                "master's student navigating trustworthy AI governance."
            ),
            profile_image_url=f"{_P}/apurba_kundu.jpeg",
            linkedin="https://www.linkedin.com/in/apurba-kundu-3a445a26/",
        ),
    ),
    dict(
        code="london",
        name="London",
        title="The London Ai Salon",
        tagline="Where British innovation meets global AI discourse",
        description=(
            "The London Ai Salon connects the UK's thriving AI community, bringing "
            "together diverse perspectives from the City's financial district, tech "
            "startups, and world-class universities."
        ),
        about="",
        event_link="https://lu.ma/Ai-salon?tag=London",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=London",
        events_description=(
            "London's world-class AI ecosystem gathers for thoughtful conversations "
            "spanning finance, policy, research, and the arts."
        ),
        status="active",
        lead_profile=None,
    ),
    dict(
        code="bangalore",
        name="Bangalore",
        title="The Bangalore Ai Salon",
        tagline="Where Indian innovation meets global AI transformation",
        description=(
            "The Bangalore Ai Salon brings together India's vibrant tech ecosystem, "
            "connecting engineers, researchers, entrepreneurs, and thought leaders to "
            "shape AI's future in the world's largest democracy."
        ),
        about="",
        event_link="https://lu.ma/Ai-salon?tag=Bangalore",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=Bangalore",
        events_description=(
            "India's tech capital hosts rich conversations on AI's potential to transform "
            "one of the world's fastest-growing economies."
        ),
        status="active",
        lead_profile=dict(
            name="Sharat Satyanarayana",
            title="Bangalore Chapter Lead",
            description="",
            profile_image_url=f"{_P}/sharat_satyanarayana.jpeg",
            linkedin="https://www.linkedin.com/in/sharats/",
        ),
    ),
    dict(
        code="lagos",
        name="Lagos",
        title="The Lagos Ai Salon",
        tagline="Where African innovation shapes AI's global future",
        description=(
            "The Lagos Ai Salon connects Nigeria's growing tech ecosystem with global "
            "AI discourse, exploring how artificial intelligence can address African "
            "challenges and amplify African innovation."
        ),
        about="",
        event_link="https://lu.ma/Ai-salon?tag=Lagos",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=Lagos",
        events_description=(
            "Lagos convenes Africa's AI community to explore how the continent can shape "
            "— and benefit from — the global AI transformation."
        ),
        status="active",
        lead_profile=dict(
            name="Francis Sani",
            title="Lagos Chapter Lead",
            description="",
            profile_image_url=f"{_P}/francis_sani.jpeg",
            linkedin="https://www.linkedin.com/in/francis-sani-o-83534ba9/",
        ),
    ),
    dict(
        code="vancouver",
        name="Vancouver",
        title="The Vancouver Ai Salon",
        tagline="Where Canadian values meet AI innovation",
        description=(
            "The Vancouver Ai Salon connects Canada's West Coast tech community, "
            "bringing together diverse perspectives on responsible AI development from "
            "one of the world's most livable and multicultural cities."
        ),
        about="",
        event_link="https://lu.ma/Ai-salon?tag=Vancouver",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=Vancouver",
        events_description=(
            "Vancouver's diverse tech community gathers to explore responsible AI "
            "development with Canadian values at the forefront."
        ),
        status="active",
        lead_profile=dict(
            name="Mikhail Klassen",
            title="Vancouver Chapter Lead",
            description=(
                "Mikhail is an AI engineer, physicist, and entrepreneur passionate "
                "about AI's impact on science and society."
            ),
            profile_image_url=f"{_P}/mikhail_klassen.jpeg",
            linkedin="https://www.linkedin.com/in/mikhailklassen/",
        ),
    ),
    dict(
        code="zurich",
        name="Zurich",
        title="The Zurich Ai Salon",
        tagline="Where Swiss precision meets the future of AI",
        description=(
            "The Zurich Ai Salon brings together Switzerland's world-class research "
            "institutions, financial sector, and tech community to explore the meaning "
            "and impact of artificial intelligence."
        ),
        about="",
        event_link="https://lu.ma/Ai-salon?tag=Zurich",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=Zurich",
        events_description=(
            "Zurich's unique confluence of leading universities, global finance, and "
            "deep-tech innovation creates a rich setting for exploring AI's future."
        ),
        status="active",
        lead_profile=dict(
            name="Pascale Speck",
            title="Zurich Chapter Lead",
            description="",
            profile_image_url=f"{_P}/pascale_speck.jpeg",
            linkedin="",
        ),
    ),
    dict(
        code="nyc",
        name="New York City",
        title="The New York City Ai Salon",
        tagline="Where AI meets the world's most dynamic city",
        description=(
            "The New York City Ai Salon brings together the city's diverse AI community, "
            "from Wall Street to Silicon Alley, exploring how artificial intelligence "
            "intersects with finance, media, healthcare, and social impact."
        ),
        about="",
        event_link="https://lu.ma/Ai-salon?tag=NY",
        calendar_embed="https://lu.ma/embed/calendar/cal-XHZLGpY8HDOAYm3/events?lt=light&tag=NY",
        events_description=(
            "New York's unparalleled mix of finance, media, tech, and culture creates "
            "a uniquely rich context for conversations about AI's future."
        ),
        status="active",
        lead_profile=dict(
            name="Rupi Sureshkumar",
            title="New York City Chapter Lead",
            description="",
            profile_image_url=f"{_P}/rupi_sureshkumar.jpeg",
            linkedin="https://www.linkedin.com/in/rupi-sureshkumar/",
        ),
    ),
]


_FOUNDERS = [
    dict(
        match_username="admin",  # merge into existing superadmin
        name="Ian Eisenberg",
        title="Founder, Executive Director",
        description=(
            "Ian focuses on system-level interventions to make AI more effective and "
            "beneficial. Besides the salon, he leads Credo AI's AI Governance Research "
            "team."
        ),
        profile_image_url=f"{_P}/ian_eisenberg.jpeg",
        linkedin="https://www.linkedin.com/in/ian-eisenberg-aa17b594/",
        display_order=90,
    ),
    dict(
        match_username=None,  # create new
        username="cecilia",
        email="cecilia@aisalon.placeholder",
        chapter_code="sf",
        name="Cecilia Callas",
        title="Co-Founder, Advisor",
        description=(
            "Cecilia Callas is an AI Ethicist, Responsible AI expert and writer based "
            "in San Francisco, CA."
        ),
        profile_image_url=f"{_P}/cecilia_callas.jpeg",
        linkedin="https://www.linkedin.com/in/ceciliacallas/",
        display_order=91,
    ),
]


async def seed_superadmin() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        if result.scalar_one_or_none():
            return
        db.add(User(
            username="admin",
            email="admin@aisalon.xyz",
            hashed_password=hash_password(settings.ADMIN_PASSWORD),
            role=UserRole.superadmin,
            is_active=True,
        ))
        await db.commit()
        logger.info("Seeded superadmin: admin")


async def seed_chapters() -> None:
    async with AsyncSessionLocal() as db:
        for ch in _CHAPTERS:
            data = {k: v for k, v in ch.items() if k != "lead_profile"}
            result = await db.execute(select(Chapter).where(Chapter.code == data["code"]))
            existing = result.scalar_one_or_none()
            if not existing:
                db.add(Chapter(**data))
                logger.info("Seeded chapter: %s", data["name"])
        await db.commit()


async def seed_chapter_leads() -> None:
    """Create one chapter_lead user per chapter with profile populated from lead_profile."""
    base_pw = settings.BASE_PASSWORD
    async with AsyncSessionLocal() as db:
        for ch in _CHAPTERS:
            code = ch["code"]
            ch_row = await db.execute(select(Chapter).where(Chapter.code == code))
            chapter = ch_row.scalar_one_or_none()
            if not chapter:
                continue

            user_row = await db.execute(select(User).where(User.username == code))
            user = user_row.scalar_one_or_none()
            profile = ch.get("lead_profile")

            if not user:
                user = User(
                    username=code,
                    email=f"{code}@aisalon.xyz",
                    hashed_password=hash_password(f"{base_pw}{code}"),
                    role=UserRole.chapter_lead,
                    chapter_id=chapter.id,
                    is_active=True,
                )
                db.add(user)
                await db.flush()
                logger.info("Seeded chapter lead: %s", code)

            if profile and not user.profile_completed_at:
                user.name = profile["name"]
                user.title = profile["title"]
                user.description = profile.get("description") or None
                user.profile_image_url = profile["profile_image_url"]
                user.linkedin = profile.get("linkedin") or None
                user.profile_completed_at = _now()

        await db.commit()


async def seed_founders() -> None:
    async with AsyncSessionLocal() as db:
        for f in _FOUNDERS:
            target = None
            if f.get("match_username"):
                row = await db.execute(select(User).where(User.username == f["match_username"]))
                target = row.scalar_one_or_none()
            if target is None and f.get("username"):
                row = await db.execute(select(User).where(User.username == f["username"]))
                target = row.scalar_one_or_none()
            if target is None and f.get("username"):
                chapter_id = None
                if f.get("chapter_code"):
                    cr = await db.execute(select(Chapter).where(Chapter.code == f["chapter_code"]))
                    ch = cr.scalar_one_or_none()
                    chapter_id = ch.id if ch else None
                target = User(
                    username=f["username"],
                    email=f.get("email") or f"{f['username']}@aisalon.placeholder",
                    hashed_password=hash_password(secrets_token()),
                    role=UserRole.host,
                    chapter_id=chapter_id,
                    is_active=True,
                )
                db.add(target)
                await db.flush()
                logger.info("Seeded founder user: %s", f["username"])

            if target.profile_completed_at:
                continue

            target.name = f["name"]
            target.title = f["title"]
            target.description = f.get("description") or None
            target.profile_image_url = f["profile_image_url"]
            target.linkedin = f.get("linkedin") or None
            target.is_founder = True
            target.display_order = f.get("display_order", 0)
            target.profile_completed_at = _now()

        await db.commit()


def secrets_token() -> str:
    import secrets
    return secrets.token_urlsafe(16)


# Volunteer roles + topics: keep prior content unchanged
_VOLUNTEER_ROLES = [
    # ... (paste the existing _VOLUNTEER_ROLES list from the prior seed.py unchanged)
]


async def seed_volunteer_roles() -> None:
    async with AsyncSessionLocal() as db:
        for role_data in _VOLUNTEER_ROLES:
            result = await db.execute(
                select(VolunteerRole).where(VolunteerRole.slug == role_data["slug"])
            )
            if not result.scalar_one_or_none():
                db.add(VolunteerRole(**role_data))
                logger.info("Seeded volunteer role: %s", role_data["title"])
        await db.commit()


_TOPICS = [
    # ... (paste the existing _TOPICS list from the prior seed.py unchanged)
]


async def seed_topics() -> None:
    async with AsyncSessionLocal() as db:
        for topic_data in _TOPICS:
            result = await db.execute(
                select(Topic).where(Topic.title == topic_data["title"])
            )
            if not result.scalar_one_or_none():
                db.add(Topic(**topic_data))
                logger.info("Seeded topic: %s", topic_data["title"])
        await db.commit()
```

When you write the file, paste the **actual** content of `_VOLUNTEER_ROLES` and `_TOPICS` from the previous version of `seed.py` into the placeholders. Do not leave them as comments.

- [ ] **Step 5: Update startup to call new seeds**

Find the file that calls the seed functions on startup (likely `backend/app/main.py` or `core/seed.py`'s `seed_all`). Make sure `seed_founders()` is called after `seed_chapter_leads()`. Remove any reference to `seed_team_members` or similar TeamMember-specific seed steps.

- [ ] **Step 6: Delete TeamMember model and remove its references**

```bash
cd backend
rm app/models/team_member.py
rm app/schemas/team.py.bak 2>/dev/null || true
```

Edit `backend/app/api/admin.py`: remove the team-member endpoints (`/admin/team`, `/admin/team/{id}`) and any `TeamMember` imports. Also remove `from app.models.team_member import TeamMember` everywhere it appears (use grep):

```bash
grep -rn "team_member\|TeamMember" backend/app | grep -v test_
```

For each match, delete the import or refactor as needed. The `team_members` relationship on `Chapter` should also be removed:

In `backend/app/models/chapter.py`, delete the `team_members: Mapped[list["TeamMember"]] = relationship(...)` line.

Also update `backend/app/schemas/chapter.py`: remove the `TeamMemberPublic` class and remove `team_members: list[TeamMemberPublic] = []` from `ChapterDetail`. Update the ChapterDetail to remove team_members.

In `backend/app/api/chapters.py`: remove the `selectinload(Chapter.team_members)` line.

- [ ] **Step 7: Delete team-member tests**

```bash
cd backend
rm tests/test_admin_team.py
```

- [ ] **Step 8: Search for any remaining `team_member` references**

```bash
grep -rn "team_member\|TeamMember" backend
```

Expected: only in the data-migration file. Anything else is a leftover — fix it.

- [ ] **Step 9: Run all backend tests**

```bash
cd backend
poetry run pytest -q
```

Expected: all PASS. If a test still references `TeamMember`, update it or delete it.

- [ ] **Step 10: Commit**

```bash
git add -A backend/
git commit -m "refactor: drop TeamMember; backfill into User; rewrite seed for unified profile model"
```

### Task 14: Replace `/admin/team` page with `/admin/people`

**Files:**
- Delete: `frontend/src/app/(admin)/team/page.tsx` (and its directory)
- Create: `frontend/src/app/(admin)/people/page.tsx`
- Modify: `frontend/src/app/(admin)/SidebarNav.tsx`
- Add backend endpoint: `GET /admin/users` already exists; if it doesn't return `name`, `title`, `is_founder`, `display_order`, extend it.

- [ ] **Step 1: Inspect existing `/admin/users` endpoint**

```bash
grep -n "admin/users\|users.*GET\|@router.get.*users" backend/app/api/admin.py
```

If the existing user list endpoint already returns the fields needed (`id`, `name`, `username`, `email`, `role`, `chapter_id`, `chapter_code`, `chapter_name`, `title`, `is_founder`, `display_order`, `profile_image_url`, `profile_completed_at`), reuse it. Otherwise add a new `GET /admin/people` endpoint:

```python
@router.get("/people")
async def admin_list_people(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_lead_or_above(current_user)
    stmt = select(User).options(selectinload(User.chapter))
    chapter_filter = _chapter_filter(current_user)
    if chapter_filter:
        stmt = stmt.where(User.chapter_id == chapter_filter)
    result = await db.execute(stmt.order_by(User.display_order, User.name))
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role.value,
            "name": u.name,
            "title": u.title,
            "is_founder": u.is_founder,
            "display_order": u.display_order,
            "profile_image_url": u.profile_image_url,
            "profile_completed_at": u.profile_completed_at.isoformat() if u.profile_completed_at else None,
            "chapter_code": u.chapter.code if u.chapter else None,
            "chapter_name": u.chapter.name if u.chapter else None,
        }
        for u in result.scalars().unique().all()
    ]


class PersonUpdate(BaseModel):
    title: str | None = None
    is_founder: bool | None = None
    display_order: int | None = None
    profile_image_url: str | None = None


@router.patch("/people/{user_id}")
async def admin_update_person(
    user_id: str,
    body: PersonUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)  # superadmin-only edits
    row = await db.execute(select(User).where(User.id == user_id))
    target = row.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if body.title is not None:
        target.title = body.title
    if body.is_founder is not None:
        target.is_founder = body.is_founder
    if body.display_order is not None:
        target.display_order = body.display_order
    if body.profile_image_url is not None:
        target.profile_image_url = body.profile_image_url
    await db.commit()
    await db.refresh(target)
    return {"ok": True}
```

Add tests in `backend/tests/test_admin_people.py`:

```python
"""Tests for admin /people CRUD."""
import pytest
from httpx import AsyncClient


async def test_list_people_requires_auth(client: AsyncClient):
    r = await client.get("/admin/people")
    assert r.status_code in (401, 403)


async def test_list_people_returns_users(
    client: AsyncClient, admin_headers, host_user
):
    r = await client.get("/admin/people", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert any(p["id"] == host_user.id for p in body)


async def test_patch_person_sets_is_founder(
    client: AsyncClient, admin_headers, host_user
):
    r = await client.patch(
        f"/admin/people/{host_user.id}",
        headers=admin_headers,
        json={"is_founder": True, "title": "Co-Founder"},
    )
    assert r.status_code == 200


async def test_patch_person_requires_superadmin(
    client: AsyncClient, lead_headers, host_user
):
    r = await client.patch(
        f"/admin/people/{host_user.id}",
        headers=lead_headers,
        json={"is_founder": True},
    )
    assert r.status_code == 403
```

- [ ] **Step 2: Run tests**

```bash
cd backend
poetry run pytest tests/test_admin_people.py -v
```

Expected: PASS.

- [ ] **Step 3: Create `frontend/src/app/(admin)/people/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Person {
  id: string;
  username: string | null;
  email: string;
  role: string;
  name: string | null;
  title: string | null;
  is_founder: boolean;
  display_order: number;
  profile_image_url: string | null;
  profile_completed_at: string | null;
  chapter_code: string | null;
  chapter_name: string | null;
}

export default function PeoplePage() {
  const { data: session } = useSession();
  const token = (session as unknown as { accessToken?: string })?.accessToken;
  const [people, setPeople] = useState<Person[]>([]);

  async function refresh() {
    const r = await fetch(`${API_URL}/admin/people`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (r.ok) setPeople(await r.json());
  }

  useEffect(() => {
    if (token) refresh();
  }, [token]);

  async function update(id: string, patch: Partial<Person>) {
    await fetch(`${API_URL}/admin/people/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(patch),
    });
    refresh();
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">People</h1>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-sm text-salon-muted border-b">
            <th className="py-2">Photo</th>
            <th>Name</th>
            <th>Title</th>
            <th>Role</th>
            <th>Chapter</th>
            <th>Founder</th>
            <th>Order</th>
            <th>Profile</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="py-2">
                {p.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.profile_image_url.startsWith("/") ? `${API_URL}${p.profile_image_url}` : p.profile_image_url}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200" />
                )}
              </td>
              <td>{p.name || p.username || p.email}</td>
              <td>
                <input
                  defaultValue={p.title || ""}
                  onBlur={(e) => {
                    if (e.target.value !== (p.title || "")) {
                      update(p.id, { title: e.target.value });
                    }
                  }}
                  className="border rounded px-2 py-1 text-sm w-full"
                />
              </td>
              <td>{p.role}</td>
              <td>{p.chapter_name || "—"}</td>
              <td>
                <input
                  type="checkbox"
                  checked={p.is_founder}
                  onChange={(e) => update(p.id, { is_founder: e.target.checked })}
                />
              </td>
              <td>
                <input
                  type="number"
                  defaultValue={p.display_order}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v !== p.display_order) update(p.id, { display_order: v });
                  }}
                  className="border rounded px-2 py-1 w-16 text-sm"
                />
              </td>
              <td>{p.profile_completed_at ? "Complete" : "Incomplete"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 4: Update sidebar nav**

In `frontend/src/app/(admin)/SidebarNav.tsx`, find the existing "Team" link and replace it with a "People" link pointing to `/people`.

- [ ] **Step 5: Delete the old team page**

```bash
rm -rf frontend/src/app/\(admin\)/team
```

- [ ] **Step 6: Verify build**

```bash
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/admin.py backend/tests/test_admin_people.py frontend/src/app/\(admin\)/
git commit -m "feat: replace admin /team with /people backed by User table"
```

---

## Phase 8: Frontend — homepage swap

### Task 15: Update homepage to consume new `/team` shape

**Files:**
- Modify: `frontend/src/app/(public)/page.tsx`

- [ ] **Step 1: Inspect existing homepage team rendering**

```bash
grep -n "team\|founder\|Co-Founder\|Chapter Lead" frontend/src/app/\(public\)/page.tsx | head -40
```

- [ ] **Step 2: Update the homepage**

In `frontend/src/app/(public)/page.tsx`, locate the `team` interface and the section that renders team members. Update the interface to match the new schema:

```tsx
interface TeamMember {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  profile_image_url: string;
  linkedin: string | null;
  is_founder: boolean;
  chapter_code: string | null;
  chapter_name: string | null;
}
```

The existing render code likely sorts by string-matching role. Replace that with grouping based on `is_founder`:

- "Founders" group: `team.filter(m => m.is_founder)`
- "Chapter Leads" group: `team.filter(m => !m.is_founder)` (already filtered server-side to active-chapter leads)

Update labels: render `member.title` where the old code rendered `member.role`.

If the homepage previously hid a section based on chapter filtering, remove that logic — the API now does the filtering.

- [ ] **Step 3: Verify build**

```bash
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 4: Manual smoke test**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform
./dev.sh
```

In a browser visit `http://localhost:3000/`. Expected:
- "Founders" section shows Ian and Cecilia.
- "Chapter Leads" section shows leads only from chapters with status `active`.
- No hosts visible.

Stop the dev server with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/\(public\)/page.tsx
git commit -m "feat: homepage consumes new /team shape (founders + active-chapter leads)"
```

---

## Phase 9: Final verification and merge

### Task 16: Run full test suite + manual walk-through

- [ ] **Step 1: Backend full test run**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/backend
poetry run ruff check app/
poetry run pytest -q
```

Expected: all PASS, no lint errors.

- [ ] **Step 2: Frontend build**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/frontend
npm run lint
npm run build
```

Expected: both PASS.

- [ ] **Step 3: End-to-end manual walk-through**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform
rm -f backend/dev.db
./dev.sh
```

In a browser:

1. Visit `/` — confirm Ian + Cecilia in Founders, chapter leads visible only for active chapters.
2. Log in as `admin` / `salonconvo` at `/login`.
3. Visit `/chapters` — confirm Draft / Active / Archived / All tabs work.
4. Click "New chapter" — create `tokyo` / `Tokyo`. Confirm it appears under Draft.
5. Switch its status to Active. Confirm it appears on `/`.
6. Switch its status to Archived. Confirm "Add person" button is hidden and `/` no longer shows it.
7. From an active chapter, create an invite. Open the invite URL in a private window. Register. Confirm redirect to `/profile/complete`.
8. Try navigating to `/dashboard` — confirm bounce back to `/profile/complete`.
9. Pick a JPEG, crop it, save profile. Confirm redirect to `/dashboard`.
10. Visit `/people` — confirm the new user appears with the photo and "Complete" status.
11. Toggle that user's `is_founder` checkbox. Confirm they appear on `/`.

Stop dev server.

- [ ] **Step 4: Merge to develop**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform
git checkout develop
git merge --no-ff feature/chapter-status-and-profile-flow
git push origin develop
git branch -d feature/chapter-status-and-profile-flow
git push origin --delete feature/chapter-status-and-profile-flow
```

(Skip the push step if the user has not authorized pushing.)

---

## Self-review notes

Cross-check against spec sections:

- **Data model**: User columns (Task 1), Chapter status default `draft` + CheckConstraint (Task 1), TeamMember removal (Task 13).
- **Chapter status semantics**: public filter (Task 5), admin sees all (Task 6 step 5), invites blocked on archived (Task 7).
- **Homepage filter**: new `/team` (Task 8), homepage consumption (Task 15).
- **Chapter admin UI**: tabs, create modal, status select, Add Person button (Task 12).
- **Profile flow**: schemas (Task 2), photo endpoint (Task 3), complete endpoint (Task 4), cropper component (Task 9), page (Task 10), gating + register redirect (Task 11).
- **Migration / backfill**: data migration + seed rewrite (Task 13). Seed sets all chapters `status="active"` to override new `draft` default.
- **Admin People page**: replaces /team admin (Task 14).
- **Tests**: chapter filter (Task 5), admin chapters (Task 6), invite gating (Task 7), profile (Tasks 3, 4), team (Task 8), admin people (Task 14).
- **Risk note about uploaded photo durability on Railway**: documented in spec; no code change planned.

Type/name consistency check: `profile_completed_at` (timestamp) used everywhere; `is_founder` boolean used in model, schema, frontend, and tests; `title` field consistent; new `/team` schema (`TeamMemberOut`) matches what the homepage expects in Task 15.
