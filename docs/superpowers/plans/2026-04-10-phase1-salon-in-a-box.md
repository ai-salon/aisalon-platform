# Phase 1: "Salon in a Box" — Topics, Upload Queue, and /start Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give anyone everything they need to host their own AI conversation in one page — no sign-up, no approval, no friction. Includes a topic database, community audio upload queue, public `/start` page, and two admin pages.

**Architecture:** Two new SQLAlchemy models (Topic, CommunityUpload) with a new `api/topics.py` router handling both public and admin endpoints, and a new `api/community.py` router for the upload endpoint + admin queue. Frontend adds a public `/start` page and two admin pages. Follows the existing volunteer router pattern (public + admin in one router file with inline RBAC helpers).

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Alembic, Pydantic v2, Next.js 15, Tailwind v4, FontAwesome 4.7

---

### Task 1: Topic Model

**Files:**
- Create: `backend/app/models/topic.py`
- Modify: `backend/alembic/env.py` (add model import)

- [ ] **Step 1: Create the Topic model**

Create `backend/app/models/topic.py`:

```python
"""Topic model for salon conversation topics."""
import enum
import uuid

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.models.base import Base, TimestampMixin


class Topic(Base, TimestampMixin):
    __tablename__ = "topics"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    opening_question: Mapped[str] = mapped_column(Text, nullable=False)
    prompts: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
```

- [ ] **Step 2: Register model in alembic/env.py**

Add this import after the `app.models.volunteer` line in `backend/alembic/env.py`:

```python
import app.models.topic  # noqa: F401
```

- [ ] **Step 3: Generate Alembic migration**

Run:
```bash
cd backend && poetry run alembic revision --autogenerate -m "add topics table"
```

Expected: A new migration file is created in `alembic/versions/`.

- [ ] **Step 4: Apply migration and verify**

Run:
```bash
cd backend && poetry run alembic upgrade head
```

Expected: Migration applies successfully.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/topic.py backend/alembic/env.py backend/alembic/versions/*topics*
git commit -m "feat: add Topic model with Alembic migration"
```

---

### Task 2: CommunityUpload Model

**Files:**
- Create: `backend/app/models/community_upload.py`
- Modify: `backend/alembic/env.py` (add model import)

- [ ] **Step 1: Create the CommunityUpload model**

Create `backend/app/models/community_upload.py`:

```python
"""CommunityUpload model for community audio recording queue."""
import enum
import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class UploadStatus(str, enum.Enum):
    pending = "pending"
    reviewed = "reviewed"
    rejected = "rejected"


class CommunityUpload(Base, TimestampMixin):
    __tablename__ = "community_uploads"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    email: Mapped[str | None] = mapped_column(String(256), nullable=True)
    topic_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("topics.id"), nullable=True
    )
    audio_path: Mapped[str] = mapped_column(String(512), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[UploadStatus] = mapped_column(
        String(32), default=UploadStatus.pending, nullable=False
    )
```

- [ ] **Step 2: Register model in alembic/env.py**

Add this import after the `app.models.topic` line in `backend/alembic/env.py`:

```python
import app.models.community_upload  # noqa: F401
```

- [ ] **Step 3: Generate Alembic migration**

Run:
```bash
cd backend && poetry run alembic revision --autogenerate -m "add community_uploads table"
```

- [ ] **Step 4: Apply migration and verify**

Run:
```bash
cd backend && poetry run alembic upgrade head
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/community_upload.py backend/alembic/env.py backend/alembic/versions/*community*
git commit -m "feat: add CommunityUpload model with Alembic migration"
```

---

### Task 3: Topics API Router (Public + Admin)

**Files:**
- Create: `backend/app/api/topics.py`
- Create: `backend/tests/test_topics.py`
- Modify: `backend/app/main.py` (mount router)

- [ ] **Step 1: Write failing tests for public topics endpoints**

Create `backend/tests/test_topics.py`:

```python
"""Tests for topics API (public + admin)."""
import pytest
from httpx import AsyncClient

from app.models.topic import Topic


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _create_topic(db_session, title="Test Topic", display_order=0, is_active=True):
    topic = Topic(
        title=title,
        description="A test topic description",
        opening_question="What do you think about this?",
        prompts=["Follow-up 1?", "Follow-up 2?"],
        is_active=is_active,
        display_order=display_order,
    )
    db_session.add(topic)
    await db_session.commit()
    await db_session.refresh(topic)
    return topic


# ── Public: List Topics ─────────────────────────────────────────────────────

async def test_list_topics_empty(client: AsyncClient):
    r = await client.get("/topics")
    assert r.status_code == 200
    assert r.json() == []


async def test_list_topics_returns_active_only(client: AsyncClient, db_session):
    await _create_topic(db_session, title="Active", is_active=True)
    await _create_topic(db_session, title="Inactive", is_active=False)
    r = await client.get("/topics")
    assert r.status_code == 200
    titles = [t["title"] for t in r.json()]
    assert "Active" in titles
    assert "Inactive" not in titles


async def test_list_topics_ordered_by_display_order(client: AsyncClient, db_session):
    await _create_topic(db_session, title="Second", display_order=2)
    await _create_topic(db_session, title="First", display_order=1)
    r = await client.get("/topics")
    titles = [t["title"] for t in r.json()]
    assert titles == ["First", "Second"]


# ── Admin: List Topics ──────────────────────────────────────────────────────

async def test_admin_list_topics_requires_auth(client: AsyncClient):
    r = await client.get("/admin/topics")
    assert r.status_code == 401


async def test_admin_list_topics_includes_inactive(
    client: AsyncClient, db_session, admin_headers,
):
    await _create_topic(db_session, title="Active")
    await _create_topic(db_session, title="Inactive", is_active=False)
    r = await client.get("/admin/topics", headers=admin_headers)
    assert r.status_code == 200
    assert len(r.json()) == 2


# ── Admin: Create Topic ─────────────────────────────────────────────────────

async def test_admin_create_topic(client: AsyncClient, admin_headers):
    payload = {
        "title": "AI Ethics",
        "description": "Exploring ethical AI",
        "opening_question": "What ethical frameworks should guide AI?",
        "prompts": ["How do we balance innovation and safety?"],
    }
    r = await client.post("/admin/topics", json=payload, headers=admin_headers)
    assert r.status_code == 201
    assert r.json()["title"] == "AI Ethics"
    assert r.json()["is_active"] is True


async def test_admin_create_topic_requires_superadmin(client: AsyncClient, lead_headers):
    payload = {
        "title": "Test",
        "description": "Test",
        "opening_question": "Test?",
        "prompts": [],
    }
    r = await client.post("/admin/topics", json=payload, headers=lead_headers)
    assert r.status_code == 403


# ── Admin: Update Topic ─────────────────────────────────────────────────────

async def test_admin_update_topic(client: AsyncClient, db_session, admin_headers):
    topic = await _create_topic(db_session)
    r = await client.put(
        f"/admin/topics/{topic.id}",
        json={"title": "Updated", "description": "Updated desc",
              "opening_question": "New question?", "prompts": []},
        headers=admin_headers,
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Updated"


async def test_admin_update_topic_not_found(client: AsyncClient, admin_headers):
    r = await client.put(
        "/admin/topics/fake-id",
        json={"title": "X", "description": "X", "opening_question": "X?", "prompts": []},
        headers=admin_headers,
    )
    assert r.status_code == 404


# ── Admin: Delete Topic ─────────────────────────────────────────────────────

async def test_admin_delete_topic(client: AsyncClient, db_session, admin_headers):
    topic = await _create_topic(db_session)
    r = await client.delete(f"/admin/topics/{topic.id}", headers=admin_headers)
    assert r.status_code == 204

    # Verify deactivated, not hard-deleted
    r2 = await client.get("/admin/topics", headers=admin_headers)
    deactivated = [t for t in r2.json() if t["id"] == topic.id]
    assert len(deactivated) == 1
    assert deactivated[0]["is_active"] is False


async def test_admin_delete_topic_requires_superadmin(
    client: AsyncClient, db_session, lead_headers,
):
    topic = await _create_topic(db_session)
    r = await client.delete(f"/admin/topics/{topic.id}", headers=lead_headers)
    assert r.status_code == 403
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd backend && poetry run pytest tests/test_topics.py -v
```

Expected: All tests fail (routes don't exist yet).

- [ ] **Step 3: Create the topics router**

Create `backend/app/api/topics.py`:

```python
"""Topics API: public listing + admin CRUD."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.topic import Topic
from app.models.user import User, UserRole

router = APIRouter(tags=["topics"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _require_admin(user: User) -> None:
    if user.role != UserRole.superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


# ── Schemas ──────────────────────────────────────────────────────────────────

class TopicPublic(BaseModel):
    id: str
    title: str
    description: str
    opening_question: str
    prompts: list[str]
    display_order: int

    model_config = {"from_attributes": True}


class TopicCreate(BaseModel):
    title: str
    description: str
    opening_question: str
    prompts: list[str] = []
    is_active: bool = True
    display_order: int = 0


class TopicUpdate(BaseModel):
    title: str
    description: str
    opening_question: str
    prompts: list[str]
    is_active: bool | None = None
    display_order: int | None = None


class TopicResponse(BaseModel):
    id: str
    title: str
    description: str
    opening_question: str
    prompts: list[str]
    is_active: bool
    display_order: int

    model_config = {"from_attributes": True}


# ── Public ───────────────────────────────────────────────────────────────────

@router.get("/topics", response_model=list[TopicPublic])
async def list_topics(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Topic)
        .where(Topic.is_active.is_(True))
        .order_by(Topic.display_order, Topic.title)
    )
    return result.scalars().all()


# ── Admin ────────────────────────────────────────────────────────────────────

@router.get("/admin/topics", response_model=list[TopicResponse])
async def admin_list_topics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Topic).order_by(Topic.display_order, Topic.title)
    )
    return result.scalars().all()


@router.post(
    "/admin/topics",
    response_model=TopicResponse,
    status_code=status.HTTP_201_CREATED,
)
async def admin_create_topic(
    body: TopicCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    topic = Topic(**body.model_dump())
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.put("/admin/topics/{topic_id}", response_model=TopicResponse)
async def admin_update_topic(
    topic_id: str,
    body: TopicUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    for key, val in body.model_dump(exclude_none=True).items():
        setattr(topic, key, val)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.delete(
    "/admin/topics/{topic_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def admin_delete_topic(
    topic_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    topic.is_active = False
    await db.commit()
```

- [ ] **Step 4: Mount the topics router in main.py**

In `backend/app/main.py`, add the import and `include_router` call:

```python
from app.api.topics import router as topics_router
```

And in the router mounting section:
```python
app.include_router(topics_router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
cd backend && poetry run pytest tests/test_topics.py -v
```

Expected: All 11 tests pass.

- [ ] **Step 6: Run full test suite**

Run:
```bash
cd backend && poetry run pytest -q
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/topics.py backend/tests/test_topics.py backend/app/main.py
git commit -m "feat: add Topics API with public listing and admin CRUD"
```

---

### Task 4: Community Upload API Router

**Files:**
- Create: `backend/app/api/community.py`
- Create: `backend/tests/test_community_upload.py`
- Modify: `backend/app/main.py` (mount router)

- [ ] **Step 1: Write failing tests for community upload endpoints**

Create `backend/tests/test_community_upload.py`:

```python
"""Tests for community upload API (public upload + admin queue)."""
import io
import pytest
from httpx import AsyncClient

from app.models.topic import Topic
from app.models.community_upload import CommunityUpload, UploadStatus


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _create_topic(db_session):
    topic = Topic(
        title="Test Topic",
        description="desc",
        opening_question="question?",
        prompts=[],
        is_active=True,
    )
    db_session.add(topic)
    await db_session.commit()
    await db_session.refresh(topic)
    return topic


async def _create_upload(db_session, topic_id=None, upload_status=UploadStatus.pending):
    upload = CommunityUpload(
        name="Jane",
        email="jane@example.com",
        topic_id=topic_id,
        audio_path="community/test.wav",
        notes="Great discussion",
        status=upload_status,
    )
    db_session.add(upload)
    await db_session.commit()
    await db_session.refresh(upload)
    return upload


def _wav_header() -> bytes:
    """Minimal WAV file header (44 bytes)."""
    import struct
    sample_rate = 44100
    num_channels = 1
    bits_per_sample = 16
    data_size = 0
    header = b"RIFF"
    header += struct.pack("<I", 36 + data_size)
    header += b"WAVE"
    header += b"fmt "
    header += struct.pack("<I", 16)
    header += struct.pack("<H", 1)
    header += struct.pack("<H", num_channels)
    header += struct.pack("<I", sample_rate)
    header += struct.pack("<I", sample_rate * num_channels * bits_per_sample // 8)
    header += struct.pack("<H", num_channels * bits_per_sample // 8)
    header += struct.pack("<H", bits_per_sample)
    header += b"data"
    header += struct.pack("<I", data_size)
    return header


# ── Public: Upload ──────────────────────────────────────────────────────────

async def test_upload_audio(client: AsyncClient, db_session, tmp_path):
    topic = await _create_topic(db_session)
    wav_data = _wav_header()
    r = await client.post(
        "/community/upload",
        files={"file": ("recording.wav", io.BytesIO(wav_data), "audio/wav")},
        data={"name": "Test User", "email": "test@example.com",
              "topic_id": topic.id, "notes": "Good convo"},
    )
    assert r.status_code == 201
    assert "id" in r.json()


async def test_upload_audio_without_optional_fields(client: AsyncClient, db_session):
    wav_data = _wav_header()
    r = await client.post(
        "/community/upload",
        files={"file": ("recording.wav", io.BytesIO(wav_data), "audio/wav")},
    )
    assert r.status_code == 201


async def test_upload_rejects_non_audio(client: AsyncClient, db_session):
    r = await client.post(
        "/community/upload",
        files={"file": ("document.txt", io.BytesIO(b"hello world"), "text/plain")},
    )
    assert r.status_code == 400


# ── Admin: List Uploads ─────────────────────────────────────────────────────

async def test_admin_list_uploads_requires_auth(client: AsyncClient):
    r = await client.get("/admin/community-uploads")
    assert r.status_code == 401


async def test_admin_list_uploads(client: AsyncClient, db_session, admin_headers):
    await _create_upload(db_session)
    r = await client.get("/admin/community-uploads", headers=admin_headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["name"] == "Jane"


async def test_admin_list_uploads_filter_by_status(
    client: AsyncClient, db_session, admin_headers,
):
    await _create_upload(db_session, upload_status=UploadStatus.pending)
    await _create_upload(db_session, upload_status=UploadStatus.reviewed)
    r = await client.get(
        "/admin/community-uploads?upload_status=pending", headers=admin_headers,
    )
    assert r.status_code == 200
    assert len(r.json()) == 1


# ── Admin: Update Upload Status ─────────────────────────────────────────────

async def test_admin_update_upload_status(
    client: AsyncClient, db_session, admin_headers,
):
    upload = await _create_upload(db_session)
    r = await client.patch(
        f"/admin/community-uploads/{upload.id}",
        json={"status": "reviewed"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "reviewed"


async def test_admin_update_upload_not_found(client: AsyncClient, admin_headers):
    r = await client.patch(
        "/admin/community-uploads/fake-id",
        json={"status": "reviewed"},
        headers=admin_headers,
    )
    assert r.status_code == 404


async def test_admin_update_upload_forbidden_for_host(
    client: AsyncClient, db_session, host_headers,
):
    upload = await _create_upload(db_session)
    r = await client.patch(
        f"/admin/community-uploads/{upload.id}",
        json={"status": "reviewed"},
        headers=host_headers,
    )
    assert r.status_code == 403
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd backend && poetry run pytest tests/test_community_upload.py -v
```

Expected: All tests fail.

- [ ] **Step 3: Create the community router**

Create `backend/app/api/community.py`:

```python
"""Community upload API: public upload + admin queue management."""
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.community_upload import CommunityUpload, UploadStatus
from app.models.user import User, UserRole
from app.services.storage import save_upload

router = APIRouter(tags=["community"])

AUDIO_MAGIC_BYTES = {
    b"RIFF": "wav",
    b"ID3": "mp3",
    b"\xff\xfb": "mp3",
    b"\xff\xf3": "mp3",
    b"\xff\xf2": "mp3",
    b"fLaC": "flac",
    b"OggS": "ogg",
    b"\x00\x00\x00": "m4a",
}

MAX_UPLOAD_SIZE = 500 * 1024 * 1024  # 500 MB


# ── Helpers ──────────────────────────────────────────────────────────────────

def _require_lead_or_above(user: User) -> None:
    if user.role not in (UserRole.superadmin, UserRole.chapter_lead):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _is_audio(data: bytes) -> bool:
    for magic, _ in AUDIO_MAGIC_BYTES.items():
        if data[:len(magic)] == magic:
            return True
    return False


# ── Schemas ──────────────────────────────────────────────────────────────────

class CommunityUploadResponse(BaseModel):
    id: str
    name: str | None
    email: str | None
    topic_id: str | None
    audio_path: str
    notes: str | None
    status: UploadStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CommunityUploadUpdate(BaseModel):
    status: UploadStatus


# ── Public ───────────────────────────────────────────────────────────────────

@router.post(
    "/community/upload",
    response_model=CommunityUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def community_upload(
    file: UploadFile = File(...),
    name: str | None = Form(None),
    email: str | None = Form(None),
    topic_id: str | None = Form(None),
    notes: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    data = await file.read()

    if not _is_audio(data):
        raise HTTPException(status_code=400, detail="Only audio files are accepted")

    if len(data) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 500 MB)")

    key = await save_upload(f"community/{file.filename or 'upload'}", data)

    upload = CommunityUpload(
        name=name,
        email=email,
        topic_id=topic_id,
        audio_path=key,
        notes=notes,
    )
    db.add(upload)
    await db.commit()
    await db.refresh(upload)
    return upload


# ── Admin ────────────────────────────────────────────────────────────────────

@router.get(
    "/admin/community-uploads",
    response_model=list[CommunityUploadResponse],
)
async def admin_list_uploads(
    upload_status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_lead_or_above(current_user)
    stmt = select(CommunityUpload).order_by(CommunityUpload.created_at.desc())
    if upload_status:
        stmt = stmt.where(CommunityUpload.status == upload_status)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch(
    "/admin/community-uploads/{upload_id}",
    response_model=CommunityUploadResponse,
)
async def admin_update_upload(
    upload_id: str,
    body: CommunityUploadUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_lead_or_above(current_user)
    result = await db.execute(
        select(CommunityUpload).where(CommunityUpload.id == upload_id)
    )
    upload = result.scalar_one_or_none()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

    upload.status = body.status
    await db.commit()
    await db.refresh(upload)
    return upload
```

- [ ] **Step 4: Mount the community router in main.py**

In `backend/app/main.py`, add the import and `include_router` call:

```python
from app.api.community import router as community_router
```

And in the router mounting section:
```python
app.include_router(community_router)
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
cd backend && poetry run pytest tests/test_community_upload.py -v
```

Expected: All 9 tests pass.

- [ ] **Step 6: Run full test suite**

Run:
```bash
cd backend && poetry run pytest -q
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/community.py backend/tests/test_community_upload.py backend/app/main.py
git commit -m "feat: add community upload API with public upload and admin queue"
```

---

### Task 5: Seed Initial Topics

**Files:**
- Modify: `backend/app/core/seed.py`
- Modify: `backend/app/main.py` (call seed in lifespan)
- Create: `backend/tests/test_seed_topics.py`

- [ ] **Step 1: Write failing test for topic seeding**

Create `backend/tests/test_seed_topics.py`:

```python
"""Test topic seeding."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.seed import seed_topics
from app.models.topic import Topic


async def test_seed_topics_creates_topics(db_session: AsyncSession):
    await seed_topics()
    result = await db_session.execute(select(Topic))
    topics = result.scalars().all()
    assert len(topics) >= 4


async def test_seed_topics_is_idempotent(db_session: AsyncSession):
    await seed_topics()
    await seed_topics()
    result = await db_session.execute(select(Topic))
    topics = result.scalars().all()
    assert len(topics) >= 4
    titles = [t.title for t in topics]
    assert len(titles) == len(set(titles))
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && poetry run pytest tests/test_seed_topics.py -v
```

Expected: Fails because `seed_topics` doesn't exist.

- [ ] **Step 3: Add topic seed data and function to seed.py**

Add to `backend/app/core/seed.py`. Add the import at the top:

```python
from app.models.topic import Topic
```

Then add this data and function after `seed_volunteer_roles`:

```python
_TOPICS = [
    dict(
        title="AI and the Future of Work",
        description=(
            "How will AI transform employment, skills, and the meaning of work itself? "
            "Explore automation, augmentation, and the evolving relationship between "
            "humans and machines in the workplace."
        ),
        opening_question="In what ways is AI already changing how you work, and what shifts do you anticipate in the next five years?",
        prompts=[
            "Which jobs or industries do you think will be most transformed by AI?",
            "How should education systems adapt to prepare people for an AI-augmented workforce?",
            "What policies could help ensure the benefits of AI in the workplace are shared broadly?",
        ],
        display_order=0,
    ),
    dict(
        title="AI Ethics and Governance",
        description=(
            "Who decides how AI systems should behave, and what frameworks should guide "
            "those decisions? Discuss accountability, transparency, bias, and the role of "
            "regulation in shaping responsible AI."
        ),
        opening_question="What ethical principle do you think is most often overlooked in AI development today?",
        prompts=[
            "Should AI systems be required to explain their decisions? In what contexts?",
            "How do we balance innovation speed with the need for safety and fairness?",
            "What role should governments play versus industry self-regulation?",
        ],
        display_order=1,
    ),
    dict(
        title="AI in Creative Arts",
        description=(
            "AI is generating art, music, and writing. Explore what this means for "
            "creativity, authorship, and the value we place on human expression in "
            "an age of machine-generated content."
        ),
        opening_question="When an AI creates a painting or writes a poem, is it art? Why or why not?",
        prompts=[
            "How do you think AI tools will change the creative process for artists and writers?",
            "Should AI-generated works be eligible for copyright protection?",
            "What is lost — or gained — when machines participate in creative expression?",
        ],
        display_order=2,
    ),
    dict(
        title="AI and Personal Privacy",
        description=(
            "AI systems collect and analyze vast amounts of personal data. Discuss the "
            "tension between personalization and privacy, surveillance, and what digital "
            "autonomy means in the AI era."
        ),
        opening_question="How comfortable are you with AI systems knowing your habits, preferences, and behaviors?",
        prompts=[
            "Where do you draw the line between helpful personalization and invasive surveillance?",
            "How should companies handle the data used to train AI models?",
            "What rights should individuals have over AI-generated insights about them?",
        ],
        display_order=3,
    ),
    dict(
        title="AI and Education",
        description=(
            "From personalized tutoring to automated grading, AI is reshaping how we "
            "learn and teach. Explore what this means for students, educators, and the "
            "future of knowledge."
        ),
        opening_question="How should schools and universities integrate AI tools into learning?",
        prompts=[
            "Will AI tutors make education more equitable or widen existing gaps?",
            "How do we teach critical thinking when AI can generate convincing answers to any question?",
            "What skills become more important — not less — in an AI-powered world?",
        ],
        display_order=4,
    ),
    dict(
        title="AI and Health",
        description=(
            "AI is diagnosing diseases, discovering drugs, and personalizing treatment. "
            "Explore the promise and the perils of AI in healthcare — from bias in medical "
            "AI to the future of the doctor-patient relationship."
        ),
        opening_question="Would you trust an AI to diagnose a medical condition? What would make you more or less comfortable?",
        prompts=[
            "How do we ensure AI health tools work equally well for all populations?",
            "What role should AI play in mental health support?",
            "How might AI change the relationship between patients and doctors?",
        ],
        display_order=5,
    ),
]


async def seed_topics() -> None:
    """Create initial conversation topics (idempotent)."""
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

- [ ] **Step 4: Call seed_topics in main.py lifespan**

In `backend/app/main.py`, add import and call in the lifespan function:

```python
from app.core.seed import seed_superadmin, seed_chapters, seed_chapter_leads, seed_volunteer_roles, seed_topics
```

In the lifespan function, add after `seed_volunteer_roles()`:
```python
    await seed_topics()
```

- [ ] **Step 5: Run test to verify it passes**

Run:
```bash
cd backend && poetry run pytest tests/test_seed_topics.py -v
```

Expected: Both tests pass.

- [ ] **Step 6: Run full test suite**

Run:
```bash
cd backend && poetry run pytest -q
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/core/seed.py backend/tests/test_seed_topics.py backend/app/main.py
git commit -m "feat: seed 6 initial conversation topics from Notion database"
```

---

### Task 6: Public /start Page (Frontend)

**Files:**
- Create: `frontend/src/app/(public)/start/page.tsx`

- [ ] **Step 1: Create the /start page**

Create `frontend/src/app/(public)/start/page.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Topic {
  id: string;
  title: string;
  description: string;
  opening_question: string;
  prompts: string[];
}

export default function StartPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/topics`)
      .then((r) => r.json())
      .then(setTopics)
      .catch(() => {});
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select an audio file.");
      return;
    }
    setSubmitting(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    if (name) fd.append("name", name);
    if (email) fd.append("email", email);
    if (selectedTopic) fd.append("topic_id", selectedTopic);
    if (notes) fd.append("notes", notes);

    try {
      const r = await fetch(`${API}/community/upload`, { method: "POST", body: fd });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        throw new Error(data?.detail || `Upload failed (${r.status})`);
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const sectionStyle: React.CSSProperties = {
    maxWidth: 900,
    margin: "0 auto",
    padding: "48px 24px",
  };

  const cardStyle: React.CSSProperties = {
    background: "white",
    borderRadius: 12,
    padding: "28px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 15,
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 14,
    fontWeight: 600,
    color: "#333",
    marginBottom: 6,
  };

  return (
    <div>
      {/* Hero */}
      <section
        style={{
          background: "linear-gradient(135deg, #56a1d2 0%, #4a8bc2 100%)",
          color: "white",
          textAlign: "center",
          padding: "80px 24px 64px",
        }}
      >
        <h1 style={{ fontSize: 42, fontWeight: 700, marginBottom: 16 }}>
          Host Your Own Ai Salon
        </h1>
        <p style={{ fontSize: 20, maxWidth: 640, margin: "0 auto", opacity: 0.95 }}>
          Everything you need to bring people together for a meaningful
          conversation about AI. No sign-up required.
        </p>
      </section>

      {/* What is an AI Salon? */}
      <section style={{ ...sectionStyle }}>
        <h2 className="section-title">What is an AI Salon?</h2>
        <p style={{ fontSize: 17, lineHeight: 1.7, color: "#444", maxWidth: 720 }}>
          An AI Salon is a small-group conversation where people from all
          backgrounds come together to explore how artificial intelligence is
          shaping our world. No expertise required — just curiosity and a
          willingness to listen.
        </p>
      </section>

      {/* How to Run One */}
      <section style={{ background: "#f8f6ec", padding: "48px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 className="section-title">How to Run One</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 24,
              marginTop: 32,
            }}
          >
            {[
              {
                icon: "fa-users",
                title: "1. Gather 4-12 people",
                body: "Invite friends, colleagues, or neighbors. Diverse perspectives make the best conversations.",
              },
              {
                icon: "fa-map-marker",
                title: "2. Pick a space",
                body: "A living room, coffee shop, or office works. Somewhere comfortable where people can talk freely.",
              },
              {
                icon: "fa-lightbulb-o",
                title: "3. Choose a topic",
                body: "Browse our curated topics below, each with an opening question and follow-up prompts.",
              },
              {
                icon: "fa-comments",
                title: "4. Facilitate the discussion",
                body: "Start with the opening question, let the conversation flow, and use prompts to go deeper.",
              },
              {
                icon: "fa-microphone",
                title: "5. Record & share",
                body: "If your group agrees, record the conversation and upload it below. We'll turn it into an insight article.",
              },
            ].map((step) => (
              <div key={step.title} style={cardStyle}>
                <div style={{ marginBottom: 12 }}>
                  <i
                    className={`fa ${step.icon}`}
                    style={{ fontSize: 28, color: "#56a1d2" }}
                  />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 15, color: "#555", lineHeight: 1.6 }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pick a Topic */}
      <section style={sectionStyle}>
        <h2 className="section-title">Pick a Topic</h2>
        <p style={{ color: "#666", marginBottom: 32 }}>
          Each topic comes with an opening question and follow-up prompts to keep
          the conversation flowing.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {topics.map((topic) => (
            <div key={topic.id} style={cardStyle}>
              <div
                onClick={() =>
                  setExpandedTopic(
                    expandedTopic === topic.id ? null : topic.id
                  )
                }
                style={{
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3 style={{ fontSize: 19, fontWeight: 600, margin: 0 }}>
                  {topic.title}
                </h3>
                <i
                  className={`fa ${
                    expandedTopic === topic.id
                      ? "fa-chevron-down"
                      : "fa-chevron-right"
                  }`}
                  style={{ color: "#999", fontSize: 14 }}
                />
              </div>
              <p
                style={{
                  color: "#555",
                  margin: "8px 0 0",
                  fontSize: 15,
                  lineHeight: 1.6,
                }}
              >
                {topic.description}
              </p>
              {expandedTopic === topic.id && (
                <div style={{ marginTop: 20 }}>
                  <div
                    style={{
                      background: "#f0f7fd",
                      borderRadius: 8,
                      padding: "16px 20px",
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#56a1d2",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 6,
                      }}
                    >
                      Opening Question
                    </div>
                    <p style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>
                      {topic.opening_question}
                    </p>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#888",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      marginBottom: 8,
                    }}
                  >
                    Follow-up Prompts
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 20,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {topic.prompts.map((p, i) => (
                      <li
                        key={i}
                        style={{ fontSize: 15, color: "#555", lineHeight: 1.5 }}
                      >
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Upload Form */}
      <section style={{ background: "#f8f6ec", padding: "48px 24px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 className="section-title">Share Your Conversation</h2>
          <p style={{ color: "#666", marginBottom: 24 }}>
            Recorded your salon? Upload it here and we&apos;ll turn it into an
            insight article for the community.
          </p>

          {submitted ? (
            <div
              style={{
                ...cardStyle,
                textAlign: "center",
                padding: 40,
              }}
            >
              <i
                className="fa fa-check-circle"
                style={{ fontSize: 48, color: "#22c55e", marginBottom: 16 }}
              />
              <h3 style={{ fontSize: 20, marginBottom: 8 }}>
                Thank you for sharing!
              </h3>
              <p style={{ color: "#666" }}>
                We&apos;ll review your recording and let you know when it&apos;s
                published.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleUpload}
              style={{ ...cardStyle }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <div>
                  <label style={labelStyle}>Name (optional)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email (optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Topic discussed</label>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select a topic (optional)</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>
                  Audio recording <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything you'd like us to know about this conversation..."
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              {error && (
                <p
                  style={{
                    color: "#ef4444",
                    fontSize: 14,
                    marginBottom: 16,
                  }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{ width: "100%", fontSize: 16, padding: "12px 0" }}
              >
                {submitting ? "Uploading..." : "Upload Recording"}
              </button>
            </form>
          )}

          <p
            style={{
              textAlign: "center",
              marginTop: 32,
              color: "#888",
              fontSize: 14,
            }}
          >
            Want to become an official host?{" "}
            <Link href="/host" style={{ color: "#56a1d2" }}>
              Learn more about hosting
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend builds**

Run:
```bash
cd frontend && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/\(public\)/start/page.tsx
git commit -m "feat: add public /start page with topic cards and upload form"
```

---

### Task 7: Admin Topics Page (Frontend)

**Files:**
- Create: `frontend/src/app/(admin)/topics/page.tsx`
- Modify: `frontend/src/app/(admin)/layout.tsx` (add nav item)

- [ ] **Step 1: Create the admin topics page**

Create `frontend/src/app/(admin)/topics/page.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Topic {
  id: string;
  title: string;
  description: string;
  opening_question: string;
  prompts: string[];
  is_active: boolean;
  display_order: number;
}

export default function AdminTopicsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [openingQuestion, setOpeningQuestion] = useState("");
  const [promptsText, setPromptsText] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);

  const token = (session as any)?.accessToken;
  const userRole = (session as any)?.user?.role;
  const isSuperadmin = userRole === "superadmin";

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (token) fetchTopics();
  }, [token]);

  async function fetchTopics() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/topics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setTopics(await r.json());
    } catch {}
    setLoading(false);
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setOpeningQuestion("");
    setPromptsText("");
    setIsActive(true);
    setDisplayOrder(0);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(topic: Topic) {
    setTitle(topic.title);
    setDescription(topic.description);
    setOpeningQuestion(topic.opening_question);
    setPromptsText(topic.prompts.join("\n"));
    setIsActive(topic.is_active);
    setDisplayOrder(topic.display_order);
    setEditingId(topic.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const prompts = promptsText
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);
    const body = { title, description, opening_question: openingQuestion, prompts, is_active: isActive, display_order: displayOrder };
    const url = editingId
      ? `${API}/admin/topics/${editingId}`
      : `${API}/admin/topics`;
    const method = editingId ? "PUT" : "POST";

    try {
      const r = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        resetForm();
        fetchTopics();
      }
    } catch {}
    setSaving(false);
  }

  async function toggleActive(topic: Topic) {
    await fetch(`${API}/admin/topics/${topic.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: topic.title,
        description: topic.description,
        opening_question: topic.opening_question,
        prompts: topic.prompts,
        is_active: !topic.is_active,
        display_order: topic.display_order,
      }),
    });
    fetchTopics();
  }

  if (status === "loading" || loading) {
    return <div style={{ padding: 32 }}>Loading...</div>;
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#555",
    marginBottom: 4,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #ddd",
    borderRadius: 6,
    fontSize: 14,
    boxSizing: "border-box",
  };

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>
          <i className="fa fa-lightbulb-o" style={{ marginRight: 10, color: "#d2b356" }} />
          Topics
        </h1>
        {isSuperadmin && !showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <i className="fa fa-plus" /> Add Topic
          </button>
        )}
      </div>

      {showForm && isSuperadmin && (
        <div
          style={{
            background: "white",
            borderRadius: 8,
            padding: 24,
            marginBottom: 24,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          <h3 style={{ marginBottom: 16 }}>
            {editingId ? "Edit Topic" : "New Topic"}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required style={inputStyle} />
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Display Order</label>
                  <input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))} style={inputStyle} />
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                    Active
                  </label>
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Opening Question</label>
              <input value={openingQuestion} onChange={(e) => setOpeningQuestion(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Follow-up Prompts (one per line)</label>
              <textarea value={promptsText} onChange={(e) => setPromptsText(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} placeholder={"What do you think about X?\nHow would you approach Y?"} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
              <button type="button" onClick={resetForm} className="btn" style={{ background: "#eee" }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {topics.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#999" }}>
          <i className="fa fa-lightbulb-o" style={{ fontSize: 48, marginBottom: 12 }} />
          <p>No topics yet.</p>
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <thead>
            <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
              <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>Topic</th>
              <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, width: 80 }}>Order</th>
              <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, width: 100 }}>Status</th>
              {isSuperadmin && <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, width: 160 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {topics.map((topic) => (
              <tr key={topic.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{topic.title}</div>
                  <div style={{ fontSize: 13, color: "#888", lineHeight: 1.4 }}>
                    {topic.description.substring(0, 120)}
                    {topic.description.length > 120 && "..."}
                  </div>
                </td>
                <td style={{ padding: "12px 16px", textAlign: "center" }}>{topic.display_order}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 10px",
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      background: topic.is_active ? "#dcfce7" : "#fee2e2",
                      color: topic.is_active ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {topic.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                {isSuperadmin && (
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => startEdit(topic)}
                        style={{ fontSize: 13, color: "#56a1d2", background: "none", border: "none", cursor: "pointer" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(topic)}
                        style={{ fontSize: 13, color: topic.is_active ? "#dc2626" : "#16a34a", background: "none", border: "none", cursor: "pointer" }}
                      >
                        {topic.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add "Topics" to admin sidebar nav**

In `frontend/src/app/(admin)/layout.tsx`, add the Topics nav item to the `navItems` array. Insert it after the `team` entry and before the `users` entry:

```tsx
...(!isHost ? [{ href: "/topics", label: "Topics", icon: "fa-lightbulb-o" }] : []),
```

- [ ] **Step 3: Verify frontend builds**

Run:
```bash
cd frontend && npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/\(admin\)/topics/page.tsx frontend/src/app/\(admin\)/layout.tsx
git commit -m "feat: add admin topics page with CRUD for superadmins"
```

---

### Task 8: Admin Community Uploads Page (Frontend)

**Files:**
- Create: `frontend/src/app/(admin)/community-uploads/page.tsx`
- Modify: `frontend/src/app/(admin)/layout.tsx` (add nav item)

- [ ] **Step 1: Create the admin community uploads page**

Create `frontend/src/app/(admin)/community-uploads/page.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Upload {
  id: string;
  name: string | null;
  email: string | null;
  topic_id: string | null;
  audio_path: string;
  notes: string | null;
  status: string;
  created_at: string;
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending: { bg: "#fef3c7", color: "#92400e" },
  reviewed: { bg: "#dcfce7", color: "#16a34a" },
  rejected: { bg: "#fee2e2", color: "#dc2626" },
};

export default function AdminCommunityUploadsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const token = (session as any)?.accessToken;

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/login");
  }, [authStatus, router]);

  useEffect(() => {
    if (token) fetchUploads();
  }, [token, filter]);

  async function fetchUploads() {
    setLoading(true);
    try {
      const qs = filter ? `?upload_status=${filter}` : "";
      const r = await fetch(`${API}/admin/community-uploads${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setUploads(await r.json());
    } catch {}
    setLoading(false);
  }

  async function updateStatus(uploadId: string, newStatus: string) {
    await fetch(`${API}/admin/community-uploads/${uploadId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchUploads();
  }

  if (authStatus === "loading" || loading) {
    return <div style={{ padding: 32 }}>Loading...</div>;
  }

  const filters = ["", "pending", "reviewed", "rejected"];

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
        <i
          className="fa fa-cloud-upload"
          style={{ marginRight: 10, color: "#56a1d2" }}
        />
        Community Uploads
      </h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {filters.map((f) => (
          <button
            key={f || "all"}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              border: "1px solid #ddd",
              background: filter === f ? "#56a1d2" : "white",
              color: filter === f ? "white" : "#555",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {f || "All"}
          </button>
        ))}
      </div>

      {uploads.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#999" }}>
          <i
            className="fa fa-inbox"
            style={{ fontSize: 48, marginBottom: 12, display: "block" }}
          />
          <p>
            {filter
              ? `No ${filter} uploads.`
              : "No community uploads yet."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {uploads.map((u) => {
            const s = STATUS_STYLES[u.status] || STATUS_STYLES.pending;
            return (
              <div
                key={u.id}
                style={{
                  background: "white",
                  borderRadius: 8,
                  padding: "16px 20px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      {u.name || "Anonymous"}
                    </div>
                    <div style={{ fontSize: 13, color: "#888" }}>
                      {u.email || "No email"} &middot;{" "}
                      {new Date(u.created_at).toLocaleDateString()}
                    </div>
                    {u.notes && (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 14,
                          color: "#555",
                          lineHeight: 1.5,
                        }}
                      >
                        {u.notes}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        background: s.bg,
                        color: s.color,
                      }}
                    >
                      {u.status}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 12,
                    borderTop: "1px solid #f0f0f0",
                    paddingTop: 12,
                  }}
                >
                  {u.status !== "reviewed" && (
                    <button
                      onClick={() => updateStatus(u.id, "reviewed")}
                      style={{
                        fontSize: 13,
                        padding: "4px 12px",
                        borderRadius: 6,
                        border: "1px solid #16a34a",
                        background: "white",
                        color: "#16a34a",
                        cursor: "pointer",
                      }}
                    >
                      Mark Reviewed
                    </button>
                  )}
                  {u.status !== "rejected" && (
                    <button
                      onClick={() => updateStatus(u.id, "rejected")}
                      style={{
                        fontSize: 13,
                        padding: "4px 12px",
                        borderRadius: 6,
                        border: "1px solid #dc2626",
                        background: "white",
                        color: "#dc2626",
                        cursor: "pointer",
                      }}
                    >
                      Reject
                    </button>
                  )}
                  {u.status !== "pending" && (
                    <button
                      onClick={() => updateStatus(u.id, "pending")}
                      style={{
                        fontSize: 13,
                        padding: "4px 12px",
                        borderRadius: 6,
                        border: "1px solid #888",
                        background: "white",
                        color: "#888",
                        cursor: "pointer",
                      }}
                    >
                      Reset to Pending
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add "Community Uploads" to admin sidebar nav**

In `frontend/src/app/(admin)/layout.tsx`, add the nav item. Insert it after the Topics entry:

```tsx
...(!isHost ? [{ href: "/community-uploads", label: "Community Uploads", icon: "fa-cloud-upload" }] : []),
```

- [ ] **Step 3: Verify frontend builds**

Run:
```bash
cd frontend && npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/\(admin\)/community-uploads/page.tsx frontend/src/app/\(admin\)/layout.tsx
git commit -m "feat: add admin community uploads queue page"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Run full backend test suite**

```bash
cd backend && poetry run pytest -q
```

Expected: All tests pass (existing + new topic + upload tests).

- [ ] **Step 2: Run backend lint**

```bash
cd backend && poetry run ruff check app/
```

Expected: No lint errors.

- [ ] **Step 3: Run frontend build**

```bash
cd frontend && npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Run frontend lint**

```bash
cd frontend && npm run lint
```

Expected: No lint errors.

- [ ] **Step 5: Final commit if any lint fixes were needed**

Only if linting required changes:
```bash
git add -A && git commit -m "fix: lint and build fixes"
```
