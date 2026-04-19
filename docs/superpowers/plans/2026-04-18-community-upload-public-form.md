# Community Upload Public Form — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public `/community_upload` page where anyone can submit an audio recording, secured by a rate limit + honeypot, landing in the existing admin review queue; plus a recording note on the `/start` page and print guide.

**Architecture:** Backend adds `city` + `topic_text` columns, tightens validation, applies rate limiting via the existing `slowapi` limiter, and silently rejects honeypot hits. Frontend adds a new public form page and small cross-links on `/start` and the print guide.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic + slowapi (backend); Next.js 15 client component (frontend)

---

## File Map

**Create:**
- `backend/alembic/versions/<hash>_add_city_topic_text_to_community_uploads.py`
- `frontend/src/app/(public)/community_upload/page.tsx`

**Modify:**
- `backend/app/models/community_upload.py` — add `city`, `topic_text` columns
- `backend/app/api/community.py` — rate limit, honeypot, schemas, required fields, 150 MB cap
- `backend/tests/test_community_upload.py` — update helpers + existing tests, add new cases
- `frontend/src/app/(admin)/community-uploads/page.tsx` — show `city` + `topic_text`
- `frontend/src/app/(public)/start/page.tsx` — add recording note
- `frontend/src/app/(public)/start/print/page.tsx` — add recording note to footer

---

### Task 1: Write failing backend tests for new behavior

**Files:**
- Modify: `backend/tests/test_community_upload.py`

- [ ] **Step 1: Update `_create_upload` helper to include `city`**

Replace the helper in `tests/test_community_upload.py`:

```python
async def _create_upload(
    db_session, topic_id=None, upload_status=UploadStatus.pending, city="San Francisco"
):
    upload = CommunityUpload(
        name="Jane",
        email="jane@example.com",
        topic_id=topic_id,
        city=city,
        audio_path="community/test.wav",
        notes="Great discussion",
        status=upload_status,
    )
    db_session.add(upload)
    await db_session.commit()
    await db_session.refresh(upload)
    return upload
```

- [ ] **Step 2: Update `test_upload_audio` to send required city field**

```python
async def test_upload_audio(client: AsyncClient, db_session, tmp_path):
    topic = await _create_topic(db_session)
    wav_data = _wav_header()
    r = await client.post(
        "/community/upload",
        files={"file": ("recording.wav", io.BytesIO(wav_data), "audio/wav")},
        data={
            "name": "Test User",
            "email": "test@example.com",
            "topic_id": topic.id,
            "city": "San Francisco",
            "notes": "Good convo",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert "id" in body
    assert "audio_path" not in body  # not exposed in public response
```

- [ ] **Step 3: Replace `test_upload_audio_without_optional_fields` — city is now required**

```python
async def test_upload_requires_city(client: AsyncClient, db_session):
    topic = await _create_topic(db_session)
    wav_data = _wav_header()
    r = await client.post(
        "/community/upload",
        files={"file": ("recording.wav", io.BytesIO(wav_data), "audio/wav")},
        data={"topic_id": topic.id},  # city missing
    )
    assert r.status_code == 422
```

- [ ] **Step 4: Add test for missing topic (neither topic_id nor topic_text)**

```python
async def test_upload_requires_topic(client: AsyncClient, db_session):
    wav_data = _wav_header()
    r = await client.post(
        "/community/upload",
        files={"file": ("recording.wav", io.BytesIO(wav_data), "audio/wav")},
        data={"city": "Berlin"},  # no topic_id, no topic_text
    )
    assert r.status_code == 422
```

- [ ] **Step 5: Add test for topic_text as alternative to topic_id**

```python
async def test_upload_with_topic_text(client: AsyncClient, db_session):
    wav_data = _wav_header()
    r = await client.post(
        "/community/upload",
        files={"file": ("recording.wav", io.BytesIO(wav_data), "audio/wav")},
        data={"city": "London", "topic_text": "The future of work"},
    )
    assert r.status_code == 201
```

- [ ] **Step 6: Add honeypot test — filled website field returns silent 200**

```python
async def test_upload_honeypot_silently_accepted(client: AsyncClient, db_session):
    topic = await _create_topic(db_session)
    wav_data = _wav_header()
    r = await client.post(
        "/community/upload",
        files={"file": ("recording.wav", io.BytesIO(wav_data), "audio/wav")},
        data={"city": "Bot City", "topic_id": topic.id, "website": "http://spam.com"},
    )
    # Bots get a fake 200, not a 201 or an error
    assert r.status_code == 200
```

- [ ] **Step 7: Update `test_admin_list_uploads` to assert city field present**

```python
async def test_admin_list_uploads(
    client: AsyncClient, db_session, admin_headers
):
    await _create_upload(db_session, city="Tokyo")
    r = await client.get("/admin/community-uploads", headers=admin_headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["name"] == "Jane"
    assert r.json()[0]["city"] == "Tokyo"
```

- [ ] **Step 8: Run tests to confirm they fail**

```bash
cd backend && poetry run pytest tests/test_community_upload.py -v
```

Expected: multiple failures — `city` not a field on `CommunityUpload`, `audio_path` still in response, honeypot not handled.

---

### Task 2: Add city + topic_text to the model

**Files:**
- Modify: `backend/app/models/community_upload.py`

- [ ] **Step 1: Add the two new columns**

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
    topic_text: Mapped[str | None] = mapped_column(String(256), nullable=True)
    city: Mapped[str] = mapped_column(String(256), nullable=False, server_default="")
    audio_path: Mapped[str] = mapped_column(String(512), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[UploadStatus] = mapped_column(
        String(32), default=UploadStatus.pending, nullable=False
    )
```

---

### Task 3: Create and apply the Alembic migration

**Files:**
- Create: `backend/alembic/versions/<hash>_add_city_topic_text_to_community_uploads.py`

- [ ] **Step 1: Generate the migration**

```bash
cd backend && poetry run alembic revision --autogenerate -m "add city topic_text to community_uploads"
```

Expected output: `Generating .../versions/<hash>_add_city_topic_text_to_community_uploads.py`

- [ ] **Step 2: Verify the generated migration looks correct**

Open the generated file — it should contain:

```python
def upgrade() -> None:
    op.add_column('community_uploads', sa.Column('topic_text', sa.String(length=256), nullable=True))
    op.add_column('community_uploads', sa.Column('city', sa.String(length=256), server_default='', nullable=False))
```

If autogenerate missed a column, add it manually. The `server_default=''` on `city` ensures existing rows are backfilled safely.

- [ ] **Step 3: Apply the migration**

```bash
poetry run alembic upgrade head
```

Expected: `Running upgrade <prev> -> <new>, add city topic_text to community_uploads`

---

### Task 4: Update the community API

**Files:**
- Modify: `backend/app/api/community.py`

- [ ] **Step 1: Replace the entire file with the updated version**

```python
"""Community upload API: public upload + admin queue management."""
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import limiter
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

MAX_UPLOAD_SIZE = 150 * 1024 * 1024  # 150 MB


def _require_lead_or_above(user: User) -> None:
    if user.role not in (UserRole.superadmin, UserRole.chapter_lead):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _is_audio(data: bytes) -> bool:
    for magic in AUDIO_MAGIC_BYTES:
        if data[: len(magic)] == magic:
            return True
    return False


class CommunityUploadPublicResponse(BaseModel):
    id: str
    status: UploadStatus
    created_at: datetime
    model_config = {"from_attributes": True}


class CommunityUploadResponse(BaseModel):
    id: str
    name: str | None
    email: str | None
    topic_id: str | None
    topic_text: str | None
    city: str
    audio_path: str
    notes: str | None
    status: UploadStatus
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class CommunityUploadUpdate(BaseModel):
    status: UploadStatus


@router.post(
    "/community/upload",
    response_model=CommunityUploadPublicResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("5/hour")
async def community_upload(
    request: Request,
    file: UploadFile = File(...),
    name: str | None = Form(None),
    email: str | None = Form(None),
    topic_id: str | None = Form(None),
    topic_text: str | None = Form(None),
    city: str = Form(...),
    notes: str | None = Form(None),
    website: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    # Honeypot — bots fill this; real users don't
    if website:
        return JSONResponse(
            {"id": "submitted", "status": "pending", "created_at": datetime.utcnow().isoformat()},
            status_code=200,
        )

    if not topic_id and not (topic_text and topic_text.strip()):
        raise HTTPException(status_code=422, detail="topic_id or topic_text is required")

    data = await file.read()
    if not _is_audio(data):
        raise HTTPException(status_code=400, detail="Only audio files are accepted")
    if len(data) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 150 MB)")

    key = await save_upload(f"community/{file.filename or 'upload'}", data)
    upload = CommunityUpload(
        name=name,
        email=email,
        topic_id=topic_id,
        topic_text=topic_text,
        city=city,
        audio_path=key,
        notes=notes,
    )
    db.add(upload)
    await db.commit()
    await db.refresh(upload)
    return upload


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

- [ ] **Step 2: Run all community upload tests**

```bash
cd backend && poetry run pytest tests/test_community_upload.py -v
```

Expected: all tests pass.

- [ ] **Step 3: Run the full test suite**

```bash
poetry run pytest -q
```

Expected: all tests pass.

- [ ] **Step 4: Commit backend changes**

```bash
cd backend
git add app/models/community_upload.py app/api/community.py alembic/versions/
git commit -m "feat: add city/topic_text to community uploads, rate limit, honeypot, 150MB cap"
```

---

### Task 5: Update admin UI to show city and topic_text

**Files:**
- Modify: `frontend/src/app/(admin)/community-uploads/page.tsx`

- [ ] **Step 1: Add city and topic_text to the Upload interface**

```typescript
interface Upload {
  id: string;
  name: string | null;
  email: string | null;
  topic_id: string | null;
  topic_text: string | null;
  city: string;
  audio_path: string;
  notes: string | null;
  status: string;
  created_at: string;
}
```

- [ ] **Step 2: Add city and topic_text display to the upload card**

Replace the submitter info block inside the map:

```tsx
<div>
  <div style={{ fontWeight: 600, marginBottom: 4 }}>{u.name || "Anonymous"}</div>
  <div style={{ fontSize: 13, color: "#888" }}>
    {u.email || "No email"} &middot; {u.city} &middot; {new Date(u.created_at).toLocaleDateString()}
  </div>
  {(u.topic_text || u.topic_id) && (
    <div style={{ fontSize: 13, color: "#56a1d2", marginTop: 4 }}>
      Topic: {u.topic_text || u.topic_id}
    </div>
  )}
  {u.notes && <div style={{ marginTop: 8, fontSize: 14, color: "#555", lineHeight: 1.5 }}>{u.notes}</div>}
</div>
```

- [ ] **Step 3: Build to verify no type errors**

```bash
cd frontend && npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/community-uploads/page.tsx
git commit -m "feat: show city and topic_text in community uploads admin queue"
```

---

### Task 6: Create the public /community_upload page

**Files:**
- Create: `frontend/src/app/(public)/community_upload/page.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Topic {
  id: string;
  title: string;
}

type FormState = "idle" | "submitting" | "success" | "error";

export default function CommunityUploadPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState("");
  const [topicText, setTopicText] = useState("");
  const [city, setCity] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [website, setWebsite] = useState(""); // honeypot
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API}/topics`)
      .then((r) => r.json())
      .then((data: Topic[]) => setTopics(data))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormState("submitting");
    setErrorMsg("");

    const fd = new FormData();
    if (!file) return;
    fd.append("file", file);
    fd.append("city", city);
    if (topicId) fd.append("topic_id", topicId);
    if (topicText) fd.append("topic_text", topicText);
    if (name) fd.append("name", name);
    if (email) fd.append("email", email);
    if (notes) fd.append("notes", notes);
    fd.append("website", website); // honeypot — empty for real users

    try {
      const r = await fetch(`${API}/community/upload`, { method: "POST", body: fd });
      if (r.status === 201 || r.status === 200) {
        setFormState("success");
      } else if (r.status === 429) {
        setErrorMsg("Too many uploads — please try again later.");
        setFormState("error");
      } else {
        const body = await r.json().catch(() => ({}));
        setErrorMsg(body.detail || "Something went wrong — please try again.");
        setFormState("error");
      }
    } catch {
      setErrorMsg("Something went wrong — please try again.");
      setFormState("error");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 6,
    border: "1px solid #ddd",
    fontSize: 15,
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 6,
    color: "#333",
  };

  if (formState === "success") {
    return (
      <div style={{ maxWidth: 600, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <i className="fa fa-check-circle" style={{ fontSize: 48, color: "#56a1d2", marginBottom: 20, display: "block" }} />
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Recording submitted!</h2>
        <p style={{ fontSize: 16, color: "#555", lineHeight: 1.7, marginBottom: 32 }}>
          Thanks for contributing to the Ai Salon&apos;s broader community knowledge base!
        </p>
        <Link href="/start" style={{ color: "#56a1d2", fontWeight: 600, fontSize: 15 }}>
          ← Back to hosting guide
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px" }}>
      {/* Header */}
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 10, color: "#111" }}>
        Share a Recording
      </h1>
      <p style={{ fontSize: 16, color: "#555", lineHeight: 1.6, marginBottom: 36 }}>
        Record your Ai Salon conversation and contribute it to our community knowledge base.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Honeypot — hidden from real users */}
        <div style={{ display: "none" }} aria-hidden="true">
          <input
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        {/* Topic */}
        <div>
          <label style={labelStyle}>
            Topic <span style={{ color: "#dc2626" }}>*</span>
          </label>
          {topics.length > 0 ? (
            <select
              required
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              style={{ ...inputStyle, background: "white" }}
            >
              <option value="">Select a topic…</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              required
              placeholder="What did you discuss?"
              value={topicText}
              onChange={(e) => setTopicText(e.target.value)}
              style={inputStyle}
            />
          )}
        </div>

        {/* City */}
        <div>
          <label style={labelStyle}>
            City <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            type="text"
            required
            placeholder="Where did this take place?"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Audio file */}
        <div>
          <label style={labelStyle}>
            Recording <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            ref={fileRef}
            type="file"
            required
            accept=".mp3,.wav,.m4a,.flac,.ogg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: 14, color: "#333" }}
          />
          <p style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
            Accepts .mp3, .wav, .m4a, .flac, .ogg — max 150 MB
          </p>
        </div>

        {/* Name */}
        <div>
          <label style={labelStyle}>Name <span style={{ color: "#999", fontWeight: 400 }}>(optional)</span></label>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Email */}
        <div>
          <label style={labelStyle}>Email <span style={{ color: "#999", fontWeight: 400 }}>(optional)</span></label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Notes <span style={{ color: "#999", fontWeight: 400 }}>(optional)</span></label>
          <textarea
            rows={3}
            placeholder="Anything you'd like us to know about this recording"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        {errorMsg && (
          <p style={{ color: "#dc2626", fontSize: 14 }}>{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={formState === "submitting"}
          style={{
            background: formState === "submitting" ? "#9ec7e8" : "#56a1d2",
            color: "white",
            border: "none",
            padding: "13px 32px",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 700,
            cursor: formState === "submitting" ? "not-allowed" : "pointer",
            alignSelf: "flex-start",
          }}
        >
          {formState === "submitting" ? "Uploading…" : "Submit Recording"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify no type errors**

```bash
cd frontend && npm run build
```

Expected: `/community_upload` appears in the build output with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(public\)/community_upload/page.tsx
git commit -m "feat: add public /community_upload form page"
```

---

### Task 7: Add recording note to /start page

**Files:**
- Modify: `frontend/src/app/(public)/start/page.tsx`

- [ ] **Step 1: Add the recording note section just above the footer CTA**

In `start/page.tsx`, find the `{/* Footer CTA */}` comment and insert this section immediately before it:

```tsx
      {/* Recording note */}
      <section style={{ padding: "0 24px 32px", textAlign: "center" }}>
        <p style={{ fontSize: 15, color: "#888" }}>
          Want to capture what was said?{" "}
          <Link href="/community_upload" style={{ color: "#56a1d2", fontWeight: 600 }}>
            Record your conversation and submit it to our community archive →
          </Link>
        </p>
      </section>
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(public\)/start/page.tsx
git commit -m "feat: add recording note linking to /community_upload on /start page"
```

---

### Task 8: Add recording note to print guide footer

**Files:**
- Modify: `frontend/src/app/(public)/start/print/page.tsx`

- [ ] **Step 1: Add recording note to the existing footer block**

Find the footer `<div>` block (the one with `borderTop: "2px solid #56a1d2"`) and add a recording line inside the left column `<div>`:

```tsx
        {/* Footer with QR code */}
        <div style={{ marginTop: 24, paddingTop: 12, borderTop: "2px solid #56a1d2", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#111", marginBottom: 3 }}>
              Want to get more involved?
            </div>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>
              Scan to learn about hosting an official Ai Salon chapter.
            </div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>aisalon.xyz/host</div>
            <div style={{ fontSize: 11, color: "#555" }}>
              Record your conversation? Submit at aisalon.xyz/community_upload
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https%3A%2F%2Ffrontend-development-535c.up.railway.app%2Fhost&format=png&margin=2"
            alt="QR code: aisalon.xyz/host"
            width={80}
            height={80}
            style={{ display: "block" }}
          />
        </div>
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 3: Commit and push**

```bash
git add src/app/\(public\)/start/print/page.tsx
git commit -m "feat: add recording note to print guide footer"
git push origin develop
```
