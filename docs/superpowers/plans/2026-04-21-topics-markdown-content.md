# Topics: Markdown Content Field — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the structured topic fields (`description`, `opening_question`, `prompts[]`) with a single `content` markdown field, and show Topics to all admin roles including hosts.

**Architecture:** One Alembic migration drops three columns and adds `content` (Text). All backend schemas and seed data update in lockstep. The frontend renders `content` with `react-markdown` (already installed); the admin form collapses to title + textarea; the `/start` print page is limited to 3 topics.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, pytest (backend); Next.js 15, react-markdown v10, remark-gfm (frontend)

---

## File Map

| Action | Path |
|--------|------|
| Modify | `backend/app/models/topic.py` |
| Create | `backend/alembic/versions/<hash>_replace_topic_structured_fields_with_content.py` |
| Modify | `backend/app/api/topics.py` |
| Modify | `backend/app/core/seed.py` |
| Modify | `backend/tests/test_topics.py` |
| Modify | `backend/tests/test_seed_topics.py` |
| Modify | `frontend/src/app/(admin)/SidebarNav.tsx` |
| Modify | `frontend/src/app/(admin)/topics/page.tsx` |
| Modify | `frontend/src/app/(public)/start/page.tsx` |
| Create | `frontend/src/app/(public)/start/print/TopicMarkdown.tsx` |
| Modify | `frontend/src/app/(public)/start/print/page.tsx` |

`community_upload/page.tsx` needs no changes — its `Topic` interface only uses `id` and `title`, which are unchanged.

---

## Task 1: Update backend tests (red phase)

**Files:**
- Modify: `backend/tests/test_topics.py`

- [ ] **Step 1: Replace `test_topics.py` with the updated version**

Replace the entire file content:

```python
"""Tests for topics API (public + admin)."""
import pytest
from httpx import AsyncClient

from app.models.topic import Topic


async def _create_topic(
    db_session, title="Test Topic", display_order=0, is_active=True
):
    topic = Topic(
        title=title,
        content="## Description\n\nA test topic.",
        is_active=is_active,
        display_order=display_order,
    )
    db_session.add(topic)
    await db_session.commit()
    await db_session.refresh(topic)
    return topic


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


async def test_list_topics_response_has_content_field(client: AsyncClient, db_session):
    await _create_topic(db_session, title="Has Content")
    r = await client.get("/topics")
    assert r.status_code == 200
    topic = r.json()[0]
    assert "content" in topic
    assert "description" not in topic
    assert "opening_question" not in topic
    assert "prompts" not in topic


async def test_admin_list_topics_requires_auth(client: AsyncClient):
    r = await client.get("/admin/topics")
    assert r.status_code == 401


async def test_admin_list_topics_includes_inactive(
    client: AsyncClient, db_session, admin_headers
):
    await _create_topic(db_session, title="Active")
    await _create_topic(db_session, title="Inactive", is_active=False)
    r = await client.get("/admin/topics", headers=admin_headers)
    assert r.status_code == 200
    assert len(r.json()) == 2


async def test_admin_create_topic(client: AsyncClient, admin_headers):
    payload = {
        "title": "AI Ethics",
        "content": "## Description\n\nExploring ethical AI.",
    }
    r = await client.post("/admin/topics", json=payload, headers=admin_headers)
    assert r.status_code == 201
    assert r.json()["title"] == "AI Ethics"
    assert r.json()["content"] == "## Description\n\nExploring ethical AI."
    assert r.json()["is_active"] is True


async def test_admin_create_topic_requires_superadmin(
    client: AsyncClient, lead_headers
):
    payload = {"title": "Test", "content": "Test content."}
    r = await client.post("/admin/topics", json=payload, headers=lead_headers)
    assert r.status_code == 403


async def test_admin_update_topic(client: AsyncClient, db_session, admin_headers):
    topic = await _create_topic(db_session)
    r = await client.put(
        f"/admin/topics/{topic.id}",
        json={"title": "Updated", "content": "Updated markdown."},
        headers=admin_headers,
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Updated"
    assert r.json()["content"] == "Updated markdown."


async def test_admin_update_topic_not_found(client: AsyncClient, admin_headers):
    r = await client.put(
        "/admin/topics/fake-id",
        json={"title": "X", "content": "X"},
        headers=admin_headers,
    )
    assert r.status_code == 404


async def test_admin_delete_topic(client: AsyncClient, db_session, admin_headers):
    topic = await _create_topic(db_session)
    r = await client.delete(f"/admin/topics/{topic.id}", headers=admin_headers)
    assert r.status_code == 204
    r2 = await client.get("/admin/topics", headers=admin_headers)
    deactivated = [t for t in r2.json() if t["id"] == topic.id]
    assert len(deactivated) == 1
    assert deactivated[0]["is_active"] is False


async def test_admin_delete_topic_requires_superadmin(
    client: AsyncClient, db_session, lead_headers
):
    topic = await _create_topic(db_session)
    r = await client.delete(f"/admin/topics/{topic.id}", headers=lead_headers)
    assert r.status_code == 403
```

- [ ] **Step 2: Run the tests — confirm they fail**

```bash
cd backend
poetry run pytest tests/test_topics.py -v
```

Expected: Multiple failures. `_create_topic` will error because the model still has `description`/`opening_question`/`prompts` as required fields, not `content`.

---

## Task 2: Update Topic model

**Files:**
- Modify: `backend/app/models/topic.py`

- [ ] **Step 1: Replace `topic.py` with the simplified model**

```python
"""Topic model for salon conversation topics."""
import uuid

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Topic(Base, TimestampMixin):
    __tablename__ = "topics"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
```

- [ ] **Step 2: Run tests again — they should be closer to passing**

```bash
poetry run pytest tests/test_topics.py -v
```

Expected: Tests still fail — the API schemas in `topics.py` still reference `description`/`opening_question`/`prompts`. Fix those in Task 3.

---

## Task 3: Create Alembic migration

**Files:**
- Create: `backend/alembic/versions/<hash>_replace_topic_structured_fields_with_content.py`

- [ ] **Step 1: Generate the migration file**

```bash
cd backend
poetry run alembic revision --autogenerate -m "replace topic structured fields with content"
```

Expected output (hash will differ):
```
Generating .../alembic/versions/abcd1234ef56_replace_topic_structured_fields_with_content.py
```

- [ ] **Step 2: Open the generated file and replace upgrade/downgrade with this exact content**

The autogenerated file will have the wrong `nullable=False` for the new `content` column (which would fail on existing rows). Replace the `upgrade()` and `downgrade()` functions:

```python
def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('topics', sa.Column('content', sa.Text(), nullable=True, server_default=''))
    op.drop_column('topics', 'prompts')
    op.drop_column('topics', 'opening_question')
    op.drop_column('topics', 'description')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('topics', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('topics', sa.Column('opening_question', sa.Text(), nullable=True))
    op.add_column('topics', sa.Column('prompts', sa.JSON(), nullable=True))
    op.drop_column('topics', 'content')
```

Leave the `revision`, `down_revision`, `branch_labels`, `depends_on` fields exactly as autogenerated — only replace the two functions.

- [ ] **Step 3: Apply the migration to dev.db**

```bash
poetry run alembic upgrade head
```

Expected:
```
INFO  [alembic.runtime.migration] Running upgrade e3f1a2b4c8d9 -> <new_hash>, replace topic structured fields with content
```

---

## Task 4: Update API schemas

**Files:**
- Modify: `backend/app/api/topics.py`

- [ ] **Step 1: Replace `topics.py` with the updated schemas**

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


def _require_admin(user: User) -> None:
    if user.role != UserRole.superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


class TopicPublic(BaseModel):
    id: str
    title: str
    content: str
    display_order: int
    model_config = {"from_attributes": True}


class TopicCreate(BaseModel):
    title: str
    content: str
    is_active: bool = True
    display_order: int = 0


class TopicUpdate(BaseModel):
    title: str
    content: str
    is_active: bool | None = None
    display_order: int | None = None


class TopicResponse(BaseModel):
    id: str
    title: str
    content: str
    is_active: bool
    display_order: int
    model_config = {"from_attributes": True}


@router.get("/topics", response_model=list[TopicPublic])
async def list_topics(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Topic)
        .where(Topic.is_active.is_(True))
        .order_by(Topic.display_order, Topic.title)
    )
    return result.scalars().all()


@router.get("/admin/topics", response_model=list[TopicResponse])
async def admin_list_topics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Topic).order_by(Topic.display_order, Topic.title))
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


@router.delete("/admin/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
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

- [ ] **Step 2: Run backend tests — should all pass**

```bash
poetry run pytest tests/test_topics.py -v
```

Expected: All 11 tests PASS.

---

## Task 5: Update seed data and seed tests

**Files:**
- Modify: `backend/app/core/seed.py`
- Modify: `backend/tests/test_seed_topics.py`

- [ ] **Step 1: Replace `_TOPICS` in `seed.py`**

Find and replace the entire `_TOPICS` list (from `_TOPICS = [` through the closing `]` before `async def seed_topics`). The new list:

```python
_TOPICS = [
    dict(
        title="AI and the Future of Work",
        content="""\
## Description

Examines how AI and automation reshape roles, skill demands, and organizational structures—empowering transformative change but also disrupting traditional career paths.

**Conversation Topics**

- AI as coworker: assistant, collaborator, or competitor?
- Reskilling at scale: bootcamps, micro-credentials, lifelong learning
- Hybrid teams: humans steering high-level strategy, AI handling routine
- Universal basic income vs. guaranteed upskilling

**Evocative Questions**

- What tasks should remain human-only, and why?
- How do we design workplaces that blend intuition and algorithms?
- Will AI create more fulfilling jobs or hollow out work entirely?

## Links

**Ai Salon Archive Substacks**

- [HumanX Ai Salon: The Future of Work](https://aisalon.substack.com/p/humanx-ai-salon-the-future-of-work)
- [Personal and Career Impact](https://aisalon.substack.com/p/personal-and-career-impact)\
""",
        display_order=0,
    ),
    dict(
        title="AI Ethics and Governance",
        content="""\
## Description

Explores the frameworks, principles, and policies shaping how AI is developed and deployed—who decides the rules, who benefits, and who bears the risks.

**Conversation Topics**

- Algorithmic bias: detecting and correcting it in high-stakes systems
- Regulation vs. innovation: where should governments draw the line?
- AI in decisions that affect people: hiring, lending, criminal justice
- Who owns AI systems—and who should they answer to?

**Evocative Questions**

- Can a machine be held accountable for harm?
- What values should be baked into AI systems, and who gets to choose?
- Is it possible to have ethical AI in an unequal world?\
""",
        display_order=1,
    ),
    dict(
        title="AI in Creative Arts",
        content="""\
## Description

AI is generating art, music, and writing—raising questions about authorship, originality, and the value we place on human expression in an age of machine-generated content.

**Conversation Topics**

- What makes something "art"—process, intent, or result?
- Copyright and ownership: who holds rights to AI-generated work?
- AI as collaborator vs. replacement for human artists
- The economics of creativity when anyone can generate images or music

**Evocative Questions**

- When an AI creates a painting, is something lost that we can't name?
- How do you decide whether to use AI tools in your own creative work?
- What should we preserve about human-made art, and why?\
""",
        display_order=2,
    ),
    dict(
        title="AI and Personal Privacy",
        content="""\
## Description

AI systems collect and analyze vast amounts of personal data. Explore the tension between personalization and privacy, the rise of surveillance, and what digital autonomy means in the AI era.

**Conversation Topics**

- Where does helpful personalization become invasive surveillance?
- Data ownership: should individuals control what's used to train AI?
- Facial recognition, emotion detection, and the public/private divide
- Privacy by design vs. opt-in consent frameworks

**Evocative Questions**

- How comfortable are you with AI knowing your habits and behaviors?
- What would it take to feel truly in control of your digital self?
- Is privacy even possible in an AI-saturated world?\
""",
        display_order=3,
    ),
    dict(
        title="AI and Education",
        content="""\
## Description

From personalized tutoring to automated grading, AI is reshaping how we learn and teach—raising questions about critical thinking, equity, and the future of knowledge itself.

**Conversation Topics**

- AI tutors: deeper personalization or shallow substitution for human teachers?
- Academic integrity in an age of AI-generated writing
- Teaching critical thinking when AI can answer any question convincingly
- Skills that become more valuable—not less—as AI advances

**Evocative Questions**

- What is the purpose of education when knowledge is instantly accessible?
- Will AI tutors make learning more equitable or widen existing gaps?
- How should we redefine what it means to be "educated"?\
""",
        display_order=4,
    ),
    dict(
        title="AI and Health",
        content="""\
## Description

AI is diagnosing diseases, accelerating drug discovery, and personalizing treatment—but also introducing new risks around bias, access, and the future of the doctor-patient relationship.

**Conversation Topics**

- Diagnostic AI: when to trust it, when to question it
- Equity in health AI: ensuring tools work for all populations
- Mental health support: chatbots, therapists, and the limits of technology
- How AI changes the relationship between patients and doctors

**Evocative Questions**

- Would you trust an AI to diagnose a medical condition?
- What should remain irreducibly human in healthcare?
- Who should be liable when an AI medical tool gets it wrong?\
""",
        display_order=5,
    ),
]
```

- [ ] **Step 2: Replace `test_seed_topics.py`**

```python
"""Test topic seeding."""
from unittest.mock import patch

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.seed import _TOPICS, seed_topics
from app.models.topic import Topic


async def test_seed_topics_creates_topics(db_engine):
    TestSession = async_sessionmaker(db_engine, expire_on_commit=False)
    with patch("app.core.seed.AsyncSessionLocal", TestSession):
        await seed_topics()
    async with TestSession() as session:
        result = await session.execute(select(Topic))
        topics = result.scalars().all()
    assert len(topics) >= 4


async def test_seed_topics_is_idempotent(db_engine):
    TestSession = async_sessionmaker(db_engine, expire_on_commit=False)
    with patch("app.core.seed.AsyncSessionLocal", TestSession):
        await seed_topics()
        await seed_topics()
    async with TestSession() as session:
        result = await session.execute(select(Topic))
        topics = result.scalars().all()
    assert len(topics) >= 4
    titles = [t.title for t in topics]
    assert len(titles) == len(set(titles))


def test_seed_data_has_correct_count():
    assert len(_TOPICS) == 6


def test_all_topics_have_required_fields():
    required = {"title", "content", "display_order"}
    for topic in _TOPICS:
        missing = required - set(topic.keys())
        assert not missing, f"Topic {topic.get('title', '?')} missing fields: {missing}"


def test_all_topics_have_non_empty_content():
    for topic in _TOPICS:
        assert topic["content"].strip(), f"Topic '{topic['title']}' has empty content"


def test_display_orders_are_unique():
    orders = [t["display_order"] for t in _TOPICS]
    assert len(orders) == len(set(orders)), "Duplicate display_order values"
```

- [ ] **Step 3: Run all backend tests**

```bash
poetry run pytest -q
```

Expected: All tests PASS.

- [ ] **Step 4: Commit backend changes**

```bash
git add backend/app/models/topic.py
git add backend/app/api/topics.py
git add backend/app/core/seed.py
git add backend/alembic/versions/
git add backend/tests/test_topics.py
git add backend/tests/test_seed_topics.py
git commit -m "feat: replace topic structured fields with markdown content field"
```

---

## Task 6: Frontend — SidebarNav and admin topics page

**Files:**
- Modify: `frontend/src/app/(admin)/SidebarNav.tsx`
- Modify: `frontend/src/app/(admin)/topics/page.tsx`

- [ ] **Step 1: Make Topics visible to all roles in `SidebarNav.tsx`**

Find this line (around line 68):
```typescript
...(!isHost ? [{ href: '/topics', label: 'Topics', icon: 'fa-lightbulb-o' }] : []),
```

Replace with:
```typescript
{ href: '/topics', label: 'Topics', icon: 'fa-lightbulb-o' },
```

- [ ] **Step 2: Replace the entire `topics/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Topic {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  display_order: number;
}

function snippet(content: string, len = 80): string {
  const plain = content
    .replace(/#+\s/g, "")
    .replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[-*]\s/g, "")
    .trim();
  return plain.length > len ? plain.substring(0, len) + "…" : plain;
}

export default function AdminTopicsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);

  const token = (session as any)?.accessToken;
  const userRole = (session as any)?.user?.role;
  const isSuperadmin = userRole === "superadmin";

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/topics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setTopics(await r.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (token) fetchTopics();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setTitle("");
    setContent("");
    setIsActive(true);
    setDisplayOrder(0);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(topic: Topic) {
    setTitle(topic.title);
    setContent(topic.content);
    setIsActive(topic.is_active);
    setDisplayOrder(topic.display_order);
    setEditingId(topic.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body = { title, content, is_active: isActive, display_order: displayOrder };
    const url = editingId ? `${API}/admin/topics/${editingId}` : `${API}/admin/topics`;
    const method = editingId ? "PUT" : "POST";
    try {
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: topic.title,
        content: topic.content,
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
    boxSizing: "border-box" as const,
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
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
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
          <h3 style={{ marginBottom: 16 }}>{editingId ? "Edit Topic" : "New Topic"}</h3>
          <form onSubmit={handleSubmit}>
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}
            >
              <div>
                <label style={labelStyle}>Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Display Order</label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(Number(e.target.value))}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    Active
                  </label>
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Content (Markdown)</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={16}
                style={{ ...inputStyle, resize: "vertical" as const, fontFamily: "monospace", fontSize: 13 }}
                placeholder={"## Description\n\nA brief description of the topic.\n\n**Conversation Topics**\n\n- Topic 1\n- Topic 2\n\n**Evocative Questions**\n\n- Question 1?\n- Question 2?"}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn"
                style={{ background: "#eee" }}
              >
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
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "white",
            borderRadius: 8,
            overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <thead>
            <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
              <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>Topic</th>
              <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, width: 80 }}>
                Order
              </th>
              <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, width: 100 }}>
                Status
              </th>
              {isSuperadmin && (
                <th style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, width: 160 }}>
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {topics.map((topic) => (
              <tr key={topic.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{topic.title}</div>
                  <div style={{ fontSize: 13, color: "#888", lineHeight: 1.4 }}>
                    {snippet(topic.content)}
                  </div>
                </td>
                <td style={{ padding: "12px 16px", textAlign: "center" }}>
                  {topic.display_order}
                </td>
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
                        style={{
                          fontSize: 13,
                          color: topic.is_active ? "#dc2626" : "#16a34a",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
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

---

## Task 7: Frontend — `/start` page

**Files:**
- Modify: `frontend/src/app/(public)/start/page.tsx`

- [ ] **Step 1: Update the `Topic` interface and expanded card rendering**

Make these targeted edits to `start/page.tsx`:

**Replace** the `Topic` interface (lines 8–13):
```typescript
interface Topic {
  id: string;
  title: string;
  content: string;
}
```

**Add** these two imports directly after the `"use client"` line (before `import { useEffect, useState } from "react"`):
```typescript
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
```

**Replace** the entire topic card JSX inside `topics.map(...)` (the `<div key={topic.id}>` block starting around line 153):
```tsx
<div
  key={topic.id}
  style={{
    background: "white",
    borderRadius: 10,
    padding: "20px 24px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
  }}
>
  <div
    onClick={() => setExpandedTopic(expandedTopic === topic.id ? null : topic.id)}
    style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
  >
    <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{topic.title}</h3>
    <i
      className={`fa ${expandedTopic === topic.id ? "fa-chevron-down" : "fa-chevron-right"}`}
      style={{ color: "#999", fontSize: 14, marginLeft: 12 }}
    />
  </div>
  {expandedTopic === topic.id && (
    <div style={{ marginTop: 16, fontSize: 14, color: "#444", lineHeight: 1.7 }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{topic.content}</ReactMarkdown>
    </div>
  )}
</div>
```

Note: the `<p>` that previously showed `topic.description` below the title is removed — the collapsed state shows title only.

---

## Task 8: Frontend — `/start/print` page

**Files:**
- Create: `frontend/src/app/(public)/start/print/TopicMarkdown.tsx`
- Modify: `frontend/src/app/(public)/start/print/page.tsx`

- [ ] **Step 1: Create `TopicMarkdown.tsx` client component**

The print page is a server component; ReactMarkdown needs a client wrapper:

```tsx
"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function TopicMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p style={{ fontSize: 11, color: "#444", lineHeight: 1.5, margin: "0 0 4px" }}>
            {children}
          </p>
        ),
        h2: ({ children }) => (
          <h2 style={{ fontSize: 11, fontWeight: 700, color: "#111", margin: "8px 0 4px" }}>
            {children}
          </h2>
        ),
        ul: ({ children }) => (
          <ul style={{ margin: "2px 0 6px", paddingLeft: 16 }}>{children}</ul>
        ),
        li: ({ children }) => (
          <li style={{ fontSize: 11, color: "#555", lineHeight: 1.4, marginBottom: 2 }}>
            {children}
          </li>
        ),
        a: ({ href, children }) => (
          <a href={href} style={{ color: "#56a1d2", fontSize: 11 }}>
            {children}
          </a>
        ),
        strong: ({ children }) => (
          <strong style={{ fontWeight: 700, color: "#333" }}>{children}</strong>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

- [ ] **Step 2: Update `page.tsx` — Topic interface, limit to 3, render with TopicMarkdown**

**Replace** the `Topic` interface (lines 9–15):
```typescript
interface Topic {
  id: string;
  title: string;
  content: string;
}
```

**Add** this import after the existing imports at the top of the file:
```typescript
import TopicMarkdown from "./TopicMarkdown";
```

**Replace** the entire `{topics.length > 0 && (...)}` block (the "Topic Inspiration" section, starting around line 152):
```tsx
{topics.length > 0 && (
  <div style={{ marginBottom: 20 }}>
    <h2
      style={{
        fontSize: 12,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: 1,
        color: "#111",
        marginBottom: 10,
      }}
    >
      Topic Inspiration
    </h2>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {topics.slice(0, 3).map((topic) => (
        <div key={topic.id} style={{ borderLeft: "3px solid #56a1d2", paddingLeft: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 6px", color: "#111" }}>
            {topic.title}
          </h3>
          <TopicMarkdown content={topic.content} />
        </div>
      ))}
    </div>
  </div>
)}
```

---

## Task 9: Frontend build and final commit

- [ ] **Step 1: Run the frontend build**

```bash
cd frontend
npm run build
```

Expected: Build succeeds with no errors. Fix any TypeScript errors (typically unused variable warnings from the removed `description`/`opening_question`/`prompts` references).

- [ ] **Step 2: Commit frontend changes**

```bash
git add frontend/src/app/(admin)/SidebarNav.tsx
git add frontend/src/app/(admin)/topics/page.tsx
git add frontend/src/app/(public)/start/page.tsx
git add frontend/src/app/(public)/start/print/TopicMarkdown.tsx
git add frontend/src/app/(public)/start/print/page.tsx
git commit -m "feat: render topics as markdown, show to all roles"
```
