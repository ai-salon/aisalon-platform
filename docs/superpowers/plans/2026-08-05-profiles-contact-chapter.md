# Profiles, Contact-a-Chapter, and Chapter Editor Live Preview — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-serve profile editing with verified email change, a public contact-a-chapter form forwarding to chapter leads, and a chapter editor with a live preview that renders the real public page — all backed by a thin Resend email foundation.

**Architecture:** One new backend service (`services/email.py`, Resend over httpx, fail-closed), one combined Alembic migration (users email-change columns, new `contact_messages` table, drop dead chapter JSON columns), new/extended endpoints in `api/profile.py`, `api/auth.py`, `api/chapters.py`. Frontend: new `/profile` and `/verify-email` pages, shared `ChapterView` component consumed by both the public chapter page and a side-by-side live-preview editor.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic + slowapi + httpx (backend); Next.js 15 App Router + Tailwind v4 tokens (frontend); pytest with in-memory SQLite; Resend HTTP API.

**Spec:** `docs/superpowers/specs/2026-08-05-profiles-contact-chapter-design.md`

## Global Constraints

- Worktree: `/Users/ian/Projects/AiSalon/aisalon-platform/.claude/worktrees/profiles-contact`, branch `feature/profiles-contact-chapter`. All paths below are relative to the worktree root.
- **Never chain shell commands with `&&`** (workspace rule). Run each command separately.
- Backend tests: `cd backend` then `poetry run pytest -q` (or a single file with `poetry run pytest tests/test_email_service.py -q`). Lint: `poetry run ruff check app/` (py311, line-length 88).
- Frontend check: `cd frontend` then `npm run build`; lint with `npm run lint`.
- TDD red-green: write the failing test, see it fail, implement, see it pass, commit.
- Commit after every task (small commits within a task are fine). Never push to `main`. Do not merge to `develop` until Task 11.
- Existing test fixtures (`backend/tests/conftest.py`): `client`, `superadmin`, `admin_headers`, `sf_chapter`, `chapter_lead`, `lead_headers`, `host_user`, `host_headers`.
- The slowapi limiter is **disabled** when `ENVIRONMENT in ("development", "test")` — tests don't trip rate limits; do not write tests asserting 429s.
- Brand tokens (already in `globals.css`): `salon-blue #56a1d2`, `salon-gold #d2b356`, `salon-cream #f8f6ec`, muted `#696969`. Reuse classes `.section-label`, `.section-title`, `.section-subtitle`, `.btn-primary`.
- UI copy: "Read on Substack →" for article CTAs (never internal article routes).

---

### Task 1: Email service foundation

**Files:**
- Modify: `backend/app/core/config.py` (add two settings after `LOG_LEVEL`)
- Create: `backend/app/services/email.py`
- Test: `backend/tests/test_email_service.py`

**Interfaces:**
- Consumes: `app.core.config.settings`, structlog via `app.core.logging.get_logger`
- Produces: `async def send_email(to: list[str], subject: str, html: str, reply_to: str | None = None) -> bool` — later tasks import `from app.services.email import send_email`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_email_service.py
from unittest.mock import AsyncMock, patch

from app.services.email import send_email


async def test_send_email_refuses_when_unconfigured(monkeypatch):
    monkeypatch.setattr("app.services.email.settings.RESEND_API_KEY", "")
    ok = await send_email(["a@b.co"], "Hi", "<p>hi</p>")
    assert ok is False


async def test_send_email_posts_to_resend(monkeypatch):
    monkeypatch.setattr("app.services.email.settings.RESEND_API_KEY", "re_test_123")
    monkeypatch.setattr(
        "app.services.email.settings.EMAIL_FROM", "Ai Salon <noreply@aisalon.xyz>"
    )
    fake_resp = AsyncMock()
    fake_resp.status_code = 200
    with patch("app.services.email.httpx.AsyncClient.post", return_value=fake_resp) as post:
        ok = await send_email(
            ["lead@x.co"], "Subject", "<p>body</p>", reply_to="visitor@y.co"
        )
    assert ok is True
    payload = post.call_args.kwargs["json"]
    assert payload["to"] == ["lead@x.co"]
    assert payload["from"] == "Ai Salon <noreply@aisalon.xyz>"
    assert payload["reply_to"] == "visitor@y.co"


async def test_send_email_returns_false_on_http_error(monkeypatch):
    monkeypatch.setattr("app.services.email.settings.RESEND_API_KEY", "re_test_123")
    fake_resp = AsyncMock()
    fake_resp.status_code = 422
    fake_resp.text = "invalid"
    with patch("app.services.email.httpx.AsyncClient.post", return_value=fake_resp):
        ok = await send_email(["a@b.co"], "Hi", "<p>hi</p>")
    assert ok is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend` then `poetry run pytest tests/test_email_service.py -q`
Expected: FAIL — `ModuleNotFoundError: app.services.email`

- [ ] **Step 3: Add settings**

In `backend/app/core/config.py`, after the `LOG_LEVEL` line add:

```python
    # Transactional email (Resend). Empty key ⇒ sends refused (fail-closed).
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "Ai Salon <noreply@aisalon.xyz>"
```

- [ ] **Step 4: Implement the service**

```python
# backend/app/services/email.py
import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

RESEND_URL = "https://api.resend.com/emails"


async def send_email(
    to: list[str],
    subject: str,
    html: str,
    reply_to: str | None = None,
) -> bool:
    """Send a transactional email via Resend. Fail-closed: returns False
    (never raises) when unconfigured or on any transport/API error."""
    if not settings.RESEND_API_KEY:
        logger.warning("email_not_configured", subject=subject)
        return False
    payload: dict = {
        "from": settings.EMAIL_FROM,
        "to": to,
        "subject": subject,
        "html": html,
    }
    if reply_to:
        payload["reply_to"] = reply_to
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                RESEND_URL,
                json=payload,
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            )
    except httpx.HTTPError as exc:
        logger.error("email_send_transport_error", error=str(exc), subject=subject)
        return False
    if resp.status_code >= 400:
        logger.error(
            "email_send_failed", status=resp.status_code, body=resp.text, subject=subject
        )
        return False
    logger.info("email_sent", to_count=len(to), subject=subject)
    return True
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend` then `poetry run pytest tests/test_email_service.py -q`
Expected: 3 passed

- [ ] **Step 6: Lint and commit**

Run: `poetry run ruff check app/`
Then:

```bash
git add app/core/config.py app/services/email.py tests/test_email_service.py
git commit -m "feat(email): thin fail-closed Resend send_email service"
```

---

### Task 2: Models + combined migration

**Files:**
- Modify: `backend/app/models/user.py` (3 new columns)
- Create: `backend/app/models/contact_message.py`
- Modify: `backend/app/models/__init__.py` (export ContactMessage)
- Modify: `backend/app/models/chapter.py` (drop `about_blocks`, `events_blocks`)
- Modify: `backend/app/schemas/chapter.py` (remove blocks fields if present)
- Create: `backend/alembic/versions/<autogen>_profiles_contact_email_change.py`

**Interfaces:**
- Produces: `User.pending_email: str | None`, `User.email_change_token_hash: str | None`, `User.email_change_expires_at: datetime | None`; model `ContactMessage(id, chapter_id, name, email, message, forwarded_at, created_at, updated_at)` importable as `from app.models.contact_message import ContactMessage`
- Later tasks rely on exactly these names.

- [ ] **Step 1: Confirm the dead columns are truly dead**

Run: `grep -rn "about_blocks\|events_blocks" backend/app frontend/src`
Expected: hits only in `models/chapter.py` and possibly `schemas/chapter.py`. If any *frontend* or endpoint code reads them, STOP and re-check with the spec (they are believed unrendered).

- [ ] **Step 2: Add User columns**

In `backend/app/models/user.py`, after the `hide_from_team` line add:

```python
    # Verified email-change flow (spec 2026-08-05)
    pending_email: Mapped[str | None] = mapped_column(String(256), nullable=True)
    email_change_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    email_change_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

- [ ] **Step 3: Create ContactMessage model**

```python
# backend/app/models/contact_message.py
import uuid
from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.orm import mapped_column, Mapped
from app.models.base import Base, TimestampMixin


class ContactMessage(Base, TimestampMixin):
    __tablename__ = "contact_messages"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    chapter_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("chapters.id"), nullable=False, index=True
    )
    name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    email: Mapped[str] = mapped_column(String(256), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    forwarded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

Register it in `backend/app/models/__init__.py` following the existing import style there.

- [ ] **Step 4: Drop dead Chapter columns**

In `backend/app/models/chapter.py` delete the `about_blocks` and `events_blocks` mapped columns (and the now-unused `JSON`/`Any` imports if nothing else uses them). Remove matching fields from `backend/app/schemas/chapter.py` if present.

- [ ] **Step 5: Generate and inspect the migration**

Run: `cd backend` then `poetry run alembic revision --autogenerate -m "profiles contact email change"`
Inspect the generated file: expect add-column ×3 on `users`, create-table `contact_messages`, drop-column ×2 on `chapters`, nothing else. (Reminder: if hand-editing raw SQL with timestamps, pass `datetime` objects — asyncpg rejects ISO strings.)

- [ ] **Step 6: Apply and verify**

Run: `poetry run alembic upgrade head`
Then: `poetry run pytest -q` — full suite must stay green (schema-derived in-memory DB picks the models up automatically).

- [ ] **Step 7: Lint and commit**

```bash
git add app/models app/schemas alembic/versions
git commit -m "feat(db): email-change columns, contact_messages table, drop dead chapter blocks"
```

---

### Task 3: `PATCH /profile/me` (ongoing profile editing)

**Files:**
- Modify: `backend/app/schemas/profile.py`
- Modify: `backend/app/api/profile.py`
- Test: `backend/tests/test_profile_update.py`

**Interfaces:**
- Consumes: `get_current_user`, existing `ProfileResponse`
- Produces: `PATCH /profile/me` accepting `ProfileUpdateRequest` (all-optional: name, profile_image_url, linkedin, description, title, scheduling_url, hide_from_team); `ProfileResponse` extended with `email: str`, `scheduling_url: str | None`, `hide_from_team: bool`, `pending_email: str | None`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_profile_update.py
async def test_patch_profile_updates_fields(client, chapter_lead, lead_headers):
    r = await client.patch(
        "/profile/me",
        json={"name": "New Name", "description": "New bio", "hide_from_team": True},
        headers=lead_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "New Name"
    assert body["description"] == "New bio"
    assert body["hide_from_team"] is True
    assert body["email"] == chapter_lead.email


async def test_patch_profile_ignores_omitted_fields(client, chapter_lead, lead_headers):
    r1 = await client.patch("/profile/me", json={"name": "Keep Me"}, headers=lead_headers)
    assert r1.status_code == 200
    r2 = await client.patch("/profile/me", json={"title": "Only Title"}, headers=lead_headers)
    assert r2.json()["name"] == "Keep Me"


async def test_patch_profile_requires_auth(client):
    r = await client.patch("/profile/me", json={"name": "X"})
    assert r.status_code in (401, 403)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend` then `poetry run pytest tests/test_profile_update.py -q`
Expected: FAIL — 405 (no PATCH route yet)

- [ ] **Step 3: Extend schemas**

In `backend/app/schemas/profile.py` add (mirroring `ProfileCompleteRequest` validation style):

```python
class ProfileUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    profile_image_url: str | None = Field(default=None, max_length=512)
    linkedin: str | None = Field(default=None, max_length=512)
    description: str | None = Field(default=None, max_length=350)
    title: str | None = Field(default=None, max_length=160)
    scheduling_url: str | None = Field(default=None, max_length=512)
    hide_from_team: bool | None = None

    @field_validator("profile_image_url", "linkedin", "scheduling_url")
    @classmethod
    def _normalize_optional(cls, v: str | None) -> str | None:
        if v is None or v.strip() == "":
            return None
        return v.strip()
```

Extend `ProfileResponse` with:

```python
    email: str
    scheduling_url: str | None
    hide_from_team: bool
    pending_email: str | None
```

- [ ] **Step 4: Implement the endpoint**

In `backend/app/api/profile.py` add (import `ProfileUpdateRequest`):

```python
@router.patch("/me", response_model=ProfileResponse)
async def update_my_profile(
    body: ProfileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `poetry run pytest tests/test_profile_update.py -q` — expected 3 passed.
Then full suite: `poetry run pytest -q` (ProfileResponse changes must not break existing profile tests; fix any response-shape assertions).

- [ ] **Step 6: Lint and commit**

```bash
git add app/schemas/profile.py app/api/profile.py tests/test_profile_update.py
git commit -m "feat(profile): PATCH /profile/me for ongoing self-serve edits"
```

---

### Task 4: Verified email change (initiate / verify / cancel)

**Files:**
- Modify: `backend/app/schemas/profile.py` (EmailChangeRequest)
- Modify: `backend/app/schemas/auth.py` (VerifyEmailChangeRequest)
- Modify: `backend/app/api/profile.py` (initiate + cancel)
- Modify: `backend/app/api/auth.py` (verify endpoint)
- Test: `backend/tests/test_email_change.py`

**Interfaces:**
- Consumes: `send_email` (Task 1), User columns (Task 2), `verify_password` from `app.core.security`, `limiter` from `app.api.auth`
- Produces: `POST /profile/email-change {new_email, current_password}` → 202; `DELETE /profile/email-change` → 204; `POST /auth/verify-email-change {token}` → 200 `{email}`; verification link format `{settings.FRONTEND_URL}/verify-email?token=<urlsafe>`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_email_change.py
import hashlib
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

LEAD_PASSWORD = "impactsf"  # matches conftest chapter_lead fixture password


async def _initiate(client, headers, new_email="new@x.co", password=LEAD_PASSWORD):
    with patch("app.api.profile.send_email", new=AsyncMock(return_value=True)) as m:
        r = await client.post(
            "/profile/email-change",
            json={"new_email": new_email, "current_password": password},
            headers=headers,
        )
    return r, m


async def test_initiate_requires_correct_password(client, lead_headers):
    r, _ = await _initiate(client, lead_headers, password="wrong")
    assert r.status_code == 403


async def test_initiate_rejects_taken_email(client, lead_headers, superadmin):
    r, _ = await _initiate(client, lead_headers, new_email=superadmin.email)
    assert r.status_code == 409


async def test_initiate_sets_pending_and_sends_to_new_address(
    client, lead_headers, chapter_lead, db_session
):
    r, mail = await _initiate(client, lead_headers)
    assert r.status_code == 202
    mail.assert_awaited_once()
    assert mail.await_args.kwargs.get("to") == ["new@x.co"] or mail.await_args.args[0] == ["new@x.co"]
    await db_session.refresh(chapter_lead)
    assert chapter_lead.pending_email == "new@x.co"
    assert chapter_lead.email_change_token_hash is not None


async def test_verify_swaps_email_and_clears_pending(
    client, lead_headers, chapter_lead, db_session
):
    token = "known-test-token"
    chapter_lead.pending_email = "new@x.co"
    chapter_lead.email_change_token_hash = hashlib.sha256(token.encode()).hexdigest()
    chapter_lead.email_change_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    db_session.add(chapter_lead)
    await db_session.commit()
    with patch("app.api.auth.send_email", new=AsyncMock(return_value=True)):
        r = await client.post("/auth/verify-email-change", json={"token": token})
    assert r.status_code == 200
    await db_session.refresh(chapter_lead)
    assert chapter_lead.email == "new@x.co"
    assert chapter_lead.pending_email is None
    assert chapter_lead.email_change_token_hash is None


async def test_verify_rejects_expired_token(client, chapter_lead, db_session):
    token = "expired-token"
    chapter_lead.pending_email = "new@x.co"
    chapter_lead.email_change_token_hash = hashlib.sha256(token.encode()).hexdigest()
    chapter_lead.email_change_expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    db_session.add(chapter_lead)
    await db_session.commit()
    r = await client.post("/auth/verify-email-change", json={"token": token})
    assert r.status_code == 400


async def test_verify_rejects_unknown_token(client):
    r = await client.post("/auth/verify-email-change", json={"token": "nope"})
    assert r.status_code == 400


async def test_cancel_clears_pending(client, lead_headers, chapter_lead, db_session):
    await _initiate(client, lead_headers)
    r = await client.delete("/profile/email-change", headers=lead_headers)
    assert r.status_code == 204
    await db_session.refresh(chapter_lead)
    assert chapter_lead.pending_email is None
```

Note: check `conftest.py` for the actual lead password and a `db_session` fixture; adapt fixture names to what exists (if there is no `db_session`, query through a fresh session helper the conftest provides — read conftest first and adjust imports, keeping assertions identical).

- [ ] **Step 2: Run tests to verify they fail**

Run: `poetry run pytest tests/test_email_change.py -q` — expected FAIL (404s).

- [ ] **Step 3: Add schemas**

`backend/app/schemas/profile.py`:

```python
class EmailChangeRequest(BaseModel):
    new_email: str = Field(..., max_length=256, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    current_password: str = Field(..., min_length=1)
```

`backend/app/schemas/auth.py`:

```python
class VerifyEmailChangeRequest(BaseModel):
    token: str = Field(..., min_length=1, max_length=128)


class VerifyEmailChangeResponse(BaseModel):
    email: str
```

- [ ] **Step 4: Implement initiate + cancel in `api/profile.py`**

Imports to add: `hashlib`, `secrets`, `timedelta`, `BackgroundTasks`, `settings`, `verify_password`, `send_email`, `EmailChangeRequest`, and `from app.api.auth import limiter` plus `Request`.

```python
EMAIL_CHANGE_TTL_HOURS = 24


@router.post("/email-change", status_code=202)
@limiter.limit("3/hour")
async def initiate_email_change(
    request: Request,
    body: EmailChangeRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=403, detail="Current password is incorrect")
    new_email = body.new_email.strip().lower()
    if new_email == current_user.email.lower():
        raise HTTPException(status_code=400, detail="That is already your email")
    existing = await db.execute(select(User).where(User.email == new_email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already in use")
    if not settings.RESEND_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Email is not configured — contact an administrator",
        )
    token = secrets.token_urlsafe(32)
    current_user.pending_email = new_email
    current_user.email_change_token_hash = hashlib.sha256(token.encode()).hexdigest()
    current_user.email_change_expires_at = datetime.now(timezone.utc) + timedelta(
        hours=EMAIL_CHANGE_TTL_HOURS
    )
    db.add(current_user)
    await db.commit()
    link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    background_tasks.add_task(
        send_email,
        [new_email],
        "Confirm your new Ai Salon login email",
        f"<p>Click to confirm your new login email for aisalon.xyz:</p>"
        f'<p><a href="{link}">{link}</a></p>'
        f"<p>This link expires in {EMAIL_CHANGE_TTL_HOURS} hours. "
        f"If you didn't request this, ignore this email.</p>",
    )
    return {"detail": f"Verification sent to {new_email}"}


@router.delete("/email-change", status_code=204)
async def cancel_email_change(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.pending_email = None
    current_user.email_change_token_hash = None
    current_user.email_change_expires_at = None
    db.add(current_user)
    await db.commit()
```

Fail-closed nuance: the 503 branch must come *before* state is written, so an unconfigured server never strands a pending change it can't email. (In tests `send_email` is patched, and RESEND_API_KEY must be monkeypatched non-empty in `_initiate` — add `monkeypatch`-style `patch("app.api.profile.settings.RESEND_API_KEY", "re_test")` inside `_initiate` alongside the send_email patch.)

- [ ] **Step 5: Implement verify in `api/auth.py`**

Imports to add: `hashlib`, `BackgroundTasks`, `from app.services.email import send_email`, new schemas.

```python
@router.post("/auth/verify-email-change", response_model=VerifyEmailChangeResponse)
@limiter.limit("10/15minutes")
async def verify_email_change(
    request: Request,
    body: VerifyEmailChangeRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    result = await db.execute(
        select(User).where(User.email_change_token_hash == token_hash)
    )
    user = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    expires = user.email_change_expires_at if user else None
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)  # SQLite drops tzinfo
    if not user or not user.pending_email or not expires or expires < now:
        raise HTTPException(status_code=400, detail="Invalid or expired link")
    taken = await db.execute(
        select(User).where(User.email == user.pending_email, User.id != user.id)
    )
    if taken.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already in use")
    old_email = user.email
    user.email = user.pending_email
    user.pending_email = None
    user.email_change_token_hash = None
    user.email_change_expires_at = None
    db.add(user)
    await db.commit()
    logger.info("email_change_verified", user_id=user.id)
    background_tasks.add_task(
        send_email,
        [old_email],
        "Your Ai Salon login email was changed",
        f"<p>Your login email was changed to <b>{user.email}</b>. "
        f"If this wasn't you, contact an administrator immediately.</p>",
    )
    return VerifyEmailChangeResponse(email=user.email)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `poetry run pytest tests/test_email_change.py -q` — expected 7 passed. Then `poetry run pytest -q` full suite.

- [ ] **Step 7: Lint and commit**

```bash
git add app/schemas app/api tests/test_email_change.py
git commit -m "feat(auth): verified email-change flow (initiate, verify, cancel)"
```

---

### Task 5: Public contact-a-chapter endpoint

**Files:**
- Create: `backend/app/schemas/contact.py`
- Modify: `backend/app/api/chapters.py`
- Test: `backend/tests/test_contact.py`

**Interfaces:**
- Consumes: `send_email` (Task 1), `ContactMessage` (Task 2), `limiter` from `app.api.auth`
- Produces: `POST /chapters/{identifier}/contact` with body `{name?, email, message, website?}` → 202 `{detail}`. `website` is the honeypot: non-empty ⇒ 202 with **no** row and **no** email.

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_contact.py
from unittest.mock import AsyncMock, patch

from sqlalchemy import select

from app.models.contact_message import ContactMessage

VALID = {"name": "Vis Itor", "email": "vis@x.co", "message": "Hello chapter, tell me more!"}


async def _post(client, code, payload):
    with patch("app.api.chapters.send_email", new=AsyncMock(return_value=True)) as m:
        r = await client.post(f"/chapters/{code}/contact", json=payload)
    return r, m


async def test_contact_stores_row_and_emails_leads(
    client, sf_chapter, chapter_lead, db_session
):
    r, mail = await _post(client, sf_chapter.code, VALID)
    assert r.status_code == 202
    rows = (await db_session.execute(select(ContactMessage))).scalars().all()
    assert len(rows) == 1
    assert rows[0].chapter_id == sf_chapter.id
    mail.assert_awaited_once()
    to = mail.await_args.args[0] if mail.await_args.args else mail.await_args.kwargs["to"]
    assert chapter_lead.email in to
    assert mail.await_args.kwargs.get("reply_to") == "vis@x.co"


async def test_contact_falls_back_to_superadmins(client, sf_chapter, superadmin, db_session):
    # sf_chapter with no chapter_lead user in this test's fixtures
    r, mail = await _post(client, sf_chapter.code, VALID)
    assert r.status_code == 202
    to = mail.await_args.args[0] if mail.await_args.args else mail.await_args.kwargs["to"]
    assert superadmin.email in to


async def test_contact_honeypot_drops_silently(client, sf_chapter, db_session):
    r, mail = await _post(client, sf_chapter.code, {**VALID, "website": "spam.biz"})
    assert r.status_code == 202
    rows = (await db_session.execute(select(ContactMessage))).scalars().all()
    assert rows == []
    mail.assert_not_awaited()


async def test_contact_validates_message_length(client, sf_chapter):
    r, _ = await _post(client, sf_chapter.code, {**VALID, "message": "short"})
    assert r.status_code == 422


async def test_contact_404_on_unknown_chapter(client):
    r, _ = await _post(client, "nope", VALID)
    assert r.status_code == 404
```

Fixture note: `test_contact_falls_back_to_superadmins` must not request the `chapter_lead` fixture. If the conftest's `sf_chapter` implicitly creates a lead, adapt by deactivating that lead in the test body before posting.

- [ ] **Step 2: Run tests to verify they fail**

Run: `poetry run pytest tests/test_contact.py -q` — expected FAIL (404 route not found ≠ chapter 404: all cases fail with 404/405).

- [ ] **Step 3: Create the schema**

```python
# backend/app/schemas/contact.py
from pydantic import BaseModel, Field


class ContactRequest(BaseModel):
    name: str | None = Field(default=None, max_length=256)
    email: str = Field(..., max_length=256, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    message: str = Field(..., min_length=10, max_length=5000)
    website: str | None = Field(default=None, max_length=256)  # honeypot
```

- [ ] **Step 4: Implement the endpoint in `api/chapters.py`**

Imports to add: `Request`, `BackgroundTasks`, `HTTPException`, `datetime/timezone`, `from app.api.auth import limiter`, `from app.services.email import send_email`, `from app.models.contact_message import ContactMessage`, `from app.models.user import User, UserRole`, `from app.schemas.contact import ContactRequest`, logger.

```python
@router.post("/{identifier}/contact", status_code=202)
@limiter.limit("5/hour")
async def contact_chapter(
    request: Request,
    identifier: str,
    body: ContactRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Chapter).where((Chapter.id == identifier) | (Chapter.code == identifier))
    )
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    if body.website:  # honeypot — accept and drop
        return {"detail": "Message sent"}

    msg = ContactMessage(
        chapter_id=chapter.id, name=body.name, email=body.email, message=body.message
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    leads = (
        await db.execute(
            select(User).where(
                User.chapter_id == chapter.id,
                User.role == UserRole.chapter_lead,
                User.is_active.is_(True),
            )
        )
    ).scalars().all()
    if not leads:
        leads = (
            await db.execute(
                select(User).where(
                    User.role == UserRole.superadmin, User.is_active.is_(True)
                )
            )
        ).scalars().all()
    recipients = [u.email for u in leads]
    sender = body.name or body.email

    async def _forward() -> None:
        ok = await send_email(
            recipients,
            f"[Ai Salon] New message for {chapter.name} from {sender}",
            f"<p><b>From:</b> {body.name or '—'} &lt;{body.email}&gt;</p>"
            f"<p><b>Chapter:</b> {chapter.name}</p>"
            f"<p>{body.message}</p>"
            f"<p style='color:#696969'>Reply to this email to answer directly.</p>",
            reply_to=body.email,
        )
        if ok:
            msg.forwarded_at = datetime.now(timezone.utc)
            db.add(msg)
            await db.commit()

    if recipients:
        background_tasks.add_task(_forward)
    return {"detail": "Message sent"}
```

Note: the `_forward` closure reuses the request-scoped `db` session inside a background task, which runs after the response. If the session is closed by then (conftest/app teardown differences), refactor `_forward` to open its own session via the session factory in `app.core.database` — keep the observable behavior identical (row updated with `forwarded_at` on success).

- [ ] **Step 5: Run tests to verify they pass**

Run: `poetry run pytest tests/test_contact.py -q` — expected 5 passed. Then the full suite.

- [ ] **Step 6: Lint and commit**

```bash
git add app/schemas/contact.py app/api/chapters.py tests/test_contact.py
git commit -m "feat(contact): public contact-a-chapter endpoint with honeypot and lead forwarding"
```

---

### Task 6: Frontend — My Profile page, verify-email page, sidebar entry, Settings cleanup

**Files:**
- Create: `frontend/src/app/(admin)/profile/page.tsx`
- Create: `frontend/src/app/(public)/verify-email/page.tsx`
- Modify: `frontend/src/app/(admin)/SidebarNav.tsx` (add nav item)
- Modify: `frontend/src/app/(admin)/settings/page.tsx` (remove password card)

**Interfaces:**
- Consumes: `GET /profile/me` (now returns `email`, `pending_email`, `scheduling_url`, `hide_from_team`), `PATCH /profile/me`, `POST /profile/photo`, `POST /profile/email-change`, `DELETE /profile/email-change`, `POST /auth/change-password`, `POST /auth/verify-email-change`
- Produces: routes `/profile` (auth) and `/verify-email` (public)

- [ ] **Step 1: Add the sidebar entry**

In `frontend/src/app/(admin)/SidebarNav.tsx`, in the base items array insert after the `/people` entry:

```tsx
    { href: '/profile', label: 'My Profile', icon: 'fa-user-o' },
```

- [ ] **Step 2: Build `/profile`**

Client component styled like existing admin pages (cards on `#fafaf8`, uppercase field labels). Structure — three cards per the approved mock:

```tsx
"use client";
// frontend/src/app/(admin)/profile/page.tsx
// Data flow:
//  - on mount: GET /profile/me → { name, title, linkedin, description,
//    scheduling_url, hide_from_team, profile_image_url, email, pending_email }
//  - photo card: reuse the upload pattern from (public)/profile/complete
//    (POST /profile/photo multipart → returns {url}; then PATCH /profile/me
//    with profile_image_url)
//  - info card: local state per field; Save → PATCH /profile/me (only changed
//    keys); toast success/error like settings/page.tsx does
//  - account card:
//      email row: shows current email; "Change…" reveals inline
//        {new_email, current_password} form → POST /profile/email-change;
//        202 → show pending banner; 503 → "Email is not configured" message
//      pending banner (when pending_email set): amber box (bg #f8f6ec,
//        border #d2b356): "Verification sent to {pending_email}" with
//        Resend (re-POST same payload — asks password again) and Cancel
//        (DELETE /profile/email-change) actions
//      password: move the exact form JSX + submit handler from
//        settings/page.tsx (the block calling POST /auth/change-password,
//        including the 12-char and match validations) into this card
// The subtitle under the page title reads:
//   "This is how you appear on aisalon.xyz — the homepage team section and
//    your chapter's page."
```

Write the full component implementing exactly that comment block; follow `settings/page.tsx` for fetch/toast idioms (`apiFetch` or raw fetch with `Authorization: Bearer`, matching what settings uses).

- [ ] **Step 3: Move (not copy) the password form**

Delete the change-password card/section from `frontend/src/app/(admin)/settings/page.tsx` (the JSX + handler around the `POST /auth/change-password` call, currently near lines 355–385). Settings must build cleanly with no unused imports left.

- [ ] **Step 4: Build `/verify-email`**

```tsx
// frontend/src/app/(public)/verify-email/page.tsx
"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function VerifyInner() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (!token) { setState("error"); return; }
    fetch(`${API_URL}/auth/verify-email-change`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const b = await r.json();
        setEmail(b.email);
        setState("ok");
      })
      .catch(() => setState("error"));
  }, [token]);
  return (
    <section style={{ background: "#f8f6ec", minHeight: "60vh", padding: "96px 30px", textAlign: "center" }}>
      {state === "working" && <p className="section-subtitle">Confirming your new email…</p>}
      {state === "ok" && (
        <>
          <h2 className="section-title" style={{ display: "inline-block" }}>Email updated</h2>
          <p className="section-subtitle">Your login email is now <b>{email}</b>.</p>
        </>
      )}
      {state === "error" && (
        <>
          <h2 className="section-title" style={{ display: "inline-block" }}>Link invalid or expired</h2>
          <p className="section-subtitle">Request a new verification email from your profile page.</p>
        </>
      )}
    </section>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={null}><VerifyInner /></Suspense>;
}
```

- [ ] **Step 5: Build + lint**

Run: `cd frontend` then `npm run build`; then `npm run lint`. Fix all errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app
git commit -m "feat(frontend): My Profile page, verify-email page, move password form out of Settings"
```

---

### Task 7: Extract shared `ChapterView` component (no visual change)

**Files:**
- Create: `frontend/src/components/ChapterView.tsx`
- Modify: `frontend/src/app/(public)/chapters/[code]/page.tsx`

**Interfaces:**
- Produces:

```tsx
export type ChapterViewData = {
  code: string; name: string; title: string; tagline: string;
  about: string; event_link: string; calendar_embed: string;
  events_description: string;
};
export default function ChapterView(props: {
  chapter: ChapterViewData;
  articles: ArticleCard[];      // exactly the shape the page passes today
  ogMap: Record<string, { image: string | null; description: string | null }>;
  members: Member[];            // the page's existing Member type, already sorted
  previewMode?: boolean;        // true inside the editor: disable interactions
  contactSlot?: React.ReactNode; // Task 9 mounts the contact section here
}): JSX.Element
```

- [ ] **Step 1: Extract**

Move the entire returned JSX of `(public)/chapters/[code]/page.tsx` (hero, events, about, insights, members sections) into `ChapterView`, moving the local `Member`/article types alongside (export them). The page keeps: `generateMetadata`, all data fetching (chapter, articles, OG data, members, sorting), and renders `<ChapterView chapter={chapter} articles={articles} ogMap={ogMap} members={sortedMembers} contactSlot={null} />`. In `previewMode`, render the `calendar_embed` iframe as a gray placeholder box (`.placeholder`-style div with the text "Calendar embed") instead of a live iframe, and add `pointerEvents: "none"` on outbound CTA links.

- [ ] **Step 2: Verify zero visual change**

Run: `cd frontend` then `npm run build` — must pass. Diff sanity: `git diff --stat` should show the page shrinking by roughly the moved JSX size and the component gaining it; no logic edits beyond prop threading.

- [ ] **Step 3: Commit**

```bash
git add frontend/src
git commit -m "refactor(frontend): extract ChapterView shared component from public chapter page"
```

---

### Task 8: Chapter editor — side-by-side live preview + field hints

**Files:**
- Modify: `frontend/src/app/(admin)/chapters/edit/[code]/page.tsx`

**Interfaces:**
- Consumes: `ChapterView` + `ChapterViewData` (Task 7), existing `PATCH /chapters/{identifier}`
- Produces: two-pane editor; no API changes

- [ ] **Step 1: Add "where this appears" hints**

Extend the existing `EDITABLE_FIELDS` array (lines ~16–24) with a `hint` string per field and render it inside the label in `salon-blue`, lowercase:

```tsx
const EDITABLE_FIELDS = [
  { key: "name", label: "Name", hint: "chapter name — shown in the hero, nav, and homepage card" },
  { key: "title", label: "Page Title", hint: "big headline at the top of your chapter page" },
  { key: "tagline", label: "Tagline", hint: "appears under the page title" },
  { key: "description", label: "Card Blurb", hint: "short blurb on the homepage chapter card", multiline: true },
  { key: "about", label: "About", hint: "the “About the chapter” section", multiline: true },
  { key: "event_link", label: "Event Link", hint: "the JOIN EVENTS button target (Luma)" },
  { key: "calendar_embed", label: "Calendar Embed URL", hint: "the events calendar iframe" },
  { key: "events_description", label: "Events Description", hint: "intro text in the Events section", multiline: true },
] as const;
```

- [ ] **Step 2: Two-pane layout with debounced preview**

Wrap the form in a flex row: form pane (`flex: 1, minWidth: 420`) and preview pane (`flex: 1.2`, border `2px solid #56a1d2`, radius 8, `overflowY: auto`, `maxHeight: "80vh"`). Preview pane header bar: blue background, white uppercase 11px text "LIVE PREVIEW — UPDATES AS YOU TYPE". Inside, render:

```tsx
<ChapterView
  chapter={{ ...draftValues, code }}
  articles={[]} ogMap={{}} members={[]}
  previewMode
  contactSlot={null}
/>
```

where `draftValues` is the form state debounced ~300 ms (`useEffect` + `setTimeout` on the raw state). Empty articles/members are acceptable — the preview's purpose is the lead-editable copy. Below `~1100px` viewport width (CSS media query or a `matchMedia` hook), stack panes vertically with an Edit/Preview toggle button.

- [ ] **Step 3: Lead dashboard link (spec requirement)**

In `frontend/src/app/(admin)/dashboard/page.tsx`, for users whose session role is `chapter_lead` with a `chapterId`, render a prominent card/button "Edit your chapter page" linking to `/chapters/edit/${chapterCode}` (resolve the code the same way the sidebar resolves the chapter name — via `GET /chapters` and matching `chapterId`; follow the dashboard's existing data-fetch idiom). Superadmins and hosts see no change.

- [ ] **Step 4: Build, lint, commit**

Run: `cd frontend` then `npm run build`; then `npm run lint`.

```bash
git add frontend/src/app
git commit -m "feat(editor): side-by-side live preview and where-this-appears hints for chapter editing"
```

---

### Task 9: Contact form section on the public chapter page

**Files:**
- Create: `frontend/src/components/ChapterContactForm.tsx`
- Modify: `frontend/src/components/ChapterView.tsx` (render `contactSlot` after the members section)
- Modify: `frontend/src/app/(public)/chapters/[code]/page.tsx` (pass the form as `contactSlot`)

**Interfaces:**
- Consumes: `POST /chapters/{identifier}/contact` (Task 5)
- Produces: inline "Get in Touch" section per approved mock

- [ ] **Step 1: Build the form component**

```tsx
"use client";
// frontend/src/components/ChapterContactForm.tsx
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function ChapterContactForm({ code, chapterName }: { code: string; chapterName: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — hidden field
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const r = await fetch(`${API_URL}/chapters/${code}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || null, email, message, website: website || null }),
      });
      setState(r.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <p className="section-subtitle">
        Message sent — the {chapterName} chapter leads will get back to you.
      </p>
    );
  }
  return (
    <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 640 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" style={inputStyle} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" type="email" required style={inputStyle} />
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your message" required minLength={10} maxLength={5000} rows={4} style={{ ...inputStyle, gridColumn: "1 / 3", resize: "vertical" }} />
      {/* Honeypot: visually hidden, real bots fill it */}
      <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, height: 0, width: 0, opacity: 0 }} placeholder="Website" />
      <div style={{ gridColumn: "1 / 3" }}>
        <button type="submit" className="btn-primary" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Send Message"}
        </button>
        {state === "error" && (
          <span style={{ marginLeft: 12, color: "#b91c1c", fontSize: 14 }}>
            Something went wrong — please try again.
          </span>
        )}
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#fff", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 6,
  padding: "12px 14px", fontSize: 15, fontFamily: "inherit", color: "#111",
};
```

- [ ] **Step 2: Mount it**

In `ChapterView`, after the members section render:

```tsx
{contactSlot && (
  <section style={{ background: "#f8f6ec", padding: "72px 30px" }}>
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <span className="section-label">Contact</span>
      <h2 className="section-title">Get in Touch</h2>
      <p className="section-subtitle" style={{ marginBottom: 28 }}>
        Questions, ideas, or want to get involved? The chapter leads read every message.
      </p>
      {contactSlot}
    </div>
  </section>
)}
```

In the public page: `contactSlot={<ChapterContactForm code={chapter.code} chapterName={chapter.name} />}`. Also update the editor preview (from Task 8) to pass `contactSlot={<p className="section-subtitle">Contact form appears here</p>}` so leads see in the preview that the section exists, without a working form.

- [ ] **Step 3: Build, lint, commit**

Run: `cd frontend` then `npm run build`; then `npm run lint`.

```bash
git add frontend/src
git commit -m "feat(frontend): inline Get in Touch contact section on chapter pages"
```

---

### Task 10: Render `description` — homepage card blurb + SEO meta

**Files:**
- Modify: `frontend/src/app/(public)/page.tsx` (chapter cards, ~lines 335–345)
- Modify: `frontend/src/app/(public)/chapters/[code]/page.tsx` (`generateMetadata`)

**Interfaces:**
- Consumes: `description` already present in the public `GET /chapters` list and single-chapter responses (verify in `backend/app/schemas/chapter.py`; if absent from the list response schema, add it there first)

- [ ] **Step 1: Homepage card blurb**

Replace the card interior (keep `.chapter-card` class and click tracking):

```tsx
<Link key={ch.id} href={`/chapters/${ch.code}`} className="chapter-card"
      onClick={() => window.umami?.track('chapter-card-click', { chapter: ch.code })}
      style={{ alignItems: "flex-start", flexDirection: "column", gap: 6 }}>
  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <i className="fa fa-map-marker" aria-hidden="true" />
    <span>{ch.name}</span>
  </span>
  {ch.description && (
    <span style={{ fontSize: 13, fontWeight: 300, color: "#696969", lineHeight: 1.6 }}>
      {ch.description}
    </span>
  )}
</Link>
```

Add `description` to the homepage's chapter type if its local type omits it.

- [ ] **Step 2: SEO meta description**

In `(public)/chapters/[code]/page.tsx` `generateMetadata`, extend the return:

```tsx
return {
  title: `${chapter.name} – Ai Salon`,
  description: chapter.description || chapter.tagline,
};
```

- [ ] **Step 3: Build, lint, commit**

Run: `cd frontend` then `npm run build`; then `npm run lint`.

```bash
git add frontend/src/app
git commit -m "feat(frontend): surface chapter description on homepage cards and page meta"
```

---

### Task 11: Integration pass, docs, merge

**Files:**
- Modify: `.gitignore` (add `.superpowers/`)
- Modify: `CLAUDE.md` (env vars section: `RESEND_API_KEY`, `EMAIL_FROM`; route map: `/profile`, `/verify-email`)

- [ ] **Step 1: Full verification**

Run each separately from the worktree root:
1. `cd backend` then `poetry run pytest -q` — all green
2. `poetry run ruff check app/` — clean
3. `cd frontend` then `npm run build` — passes
4. `npm run lint` — clean

- [ ] **Step 2: Docs + gitignore**

Append `.superpowers/` to `.gitignore`. In `CLAUDE.md`: add the two env vars to the backend env section with the fail-closed note; add `/profile` (Yes) and `/verify-email` (No) to the route map; note password change moved from Settings to My Profile.

- [ ] **Step 3: Commit, merge to develop, push, verify deploy**

```bash
git add .gitignore CLAUDE.md
git commit -m "docs: RESEND_API_KEY/EMAIL_FROM env vars, new routes, gitignore .superpowers"
```

Then per repo workflow (each command separate, from the main checkout `/Users/ian/Projects/AiSalon/aisalon-platform` — note the worktree holds the branch):
1. `git -C /Users/ian/Projects/AiSalon/aisalon-platform checkout develop`
2. `git -C /Users/ian/Projects/AiSalon/aisalon-platform merge feature/profiles-contact-chapter`
3. `git -C /Users/ian/Projects/AiSalon/aisalon-platform push origin develop`
4. Verify Railway deploy SUCCESS per CLAUDE.md "Verifying Railway deploys" (the migration runs on deploy)
5. Delete the feature branch and worktree only after deploy verification.

- [ ] **Step 4: Human setup handoff**

Remind the user (email features stay inert until done): Resend account → API key → Railway env vars `RESEND_API_KEY` + `EMAIL_FROM` → Cloudflare DNS records from Resend's domain-verification screen.
