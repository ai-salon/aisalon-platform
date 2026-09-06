# Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Role-scoped sidebar badges with team-wide handled state, weekly Resend email digests with opt-out, and a synthesis script to exercise it all on develop.

**Architecture:** No notification table — one aggregated summary endpoint counts unhandled rows straight from source tables; handled state (`status`/`handled_by`/`handled_at`) is added to `contact_messages` and `hosting_interest` (which also gains a real `chapter_id`). Weekly digests are computed by `services/digest.py`, sent by `scripts/send_digests.py` (Railway cron, guarded by a `digest_runs` table), and testable on demand via a superadmin `run-test` endpoint. Synthesis happens through the real public HTTP API.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic, slowapi limiter, existing `services/email.send_email`, Next.js 15 admin UI, httpx (script).

**Spec:** `docs/superpowers/specs/2026-09-06-notifications-design.md` (read it first — routing/scoping decisions live there).

## Global Constraints

- Worktree: `/Users/ian/Projects/AiSalon/aisalon-platform/.claude/worktrees/notifications`, branch `feature/notifications`. Paths below relative to it. **First command in Task 1: `poetry install` from `backend/` — the worktree has no venv yet.**
- **Never chain shell commands with `&&`** — run separately.
- Backend: `cd backend` then `poetry run pytest -q` / `poetry run ruff check app/` (py311, line 88). Frontend: `npm run build` then `npm run lint`. TDD red-green; commit per task; never push.
- RBAC via existing helpers in `api/admin.py`: `_require_admin`, `_require_lead_or_above`, `_chapter_filter` (returns user.chapter_id for lead/host, None for superadmin).
- Current Alembic head: `b2c1e9a4d6f7`. asyncpg rule: real `datetime`/`date` objects in raw SQL, never ISO strings.
- All user-content interpolation into email HTML goes through `html.escape`.
- Routing/visibility rules (spec): leads see contact messages, host_existing hosting interest, pending volunteer apps for their chapter's roles, members joined ≤7d — all chapter-scoped; superadmins see everything incl. start_chapter + pending community uploads. Hosts get zeros. Existing Articles draft pill untouched.
- Test fixtures (`backend/tests/conftest.py`): `client`, `superadmin`/`admin_headers`, `sf_chapter`, `chapter_lead`/`lead_headers`, `host_user`/`host_headers`; seeded passwords are the literal `"password"`; ASGITransport awaits BackgroundTasks before returning; `chapters_module.AsyncSessionLocal` monkeypatch pattern exists — mirror it for any new module-global session use.

---

### Task 1: Models + combined migration

**Files:**
- Modify: `backend/app/models/contact_message.py`, `backend/app/models/hosting_interest.py`, `backend/app/models/user.py`, `backend/app/models/__init__.py`
- Create: `backend/app/models/digest_run.py`
- Create: `backend/alembic/versions/<autogen>_notifications_handled_state.py`

**Interfaces (later tasks depend on these exact names):**
- `ContactMessage.status: str` (`'new'|'handled'`, default `'new'`), `handled_by: str|None`, `handled_at: datetime|None`
- `HostingInterest.status/handled_by/handled_at` (same), `HostingInterest.chapter_id: str|None` (FK chapters, indexed)
- `User.digest_opt_out: bool` (NOT NULL, default False)
- `DigestRun(id, period_start: date unique, period_end: date, recipients_count: int)` + TimestampMixin, `__tablename__ = "digest_runs"`

- [ ] **Step 1: Setup** — from `backend/`: `poetry install` (worktree venv). Then `poetry run pytest -q` to confirm the baseline is green before touching anything.

- [ ] **Step 2: Model edits**

`contact_message.py` — add after `forwarded_at`:

```python
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="new")
    handled_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    handled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

`hosting_interest.py` — add the same three columns plus:

```python
    chapter_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("chapters.id"), nullable=True, index=True
    )
```

(add `ForeignKey`, `DateTime`, `datetime` imports as needed.)

`user.py` — after `hide_from_team`:

```python
    digest_opt_out: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
```

New `digest_run.py`:

```python
import uuid
from datetime import date
from sqlalchemy import String, Date, Integer
from sqlalchemy.orm import mapped_column, Mapped
from app.models.base import Base, TimestampMixin


class DigestRun(Base, TimestampMixin):
    __tablename__ = "digest_runs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    recipients_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
```

Register `DigestRun` in `models/__init__.py` beside `ContactMessage`.

- [ ] **Step 3: Migration** — `poetry run alembic revision --autogenerate -m "notifications handled state"`. Inspect: expect add-column ×3 on contact_messages, ×4 on hosting_interest, ×1 on users, create-table digest_runs — nothing else (strip drift). Because the three tables have existing rows and the new NOT NULL columns need values, ensure `status` columns carry `server_default="'new'"` (autogenerate usually emits `server_default=sa.text("'new'")` only if you add it — add it by hand) and `digest_opt_out` gets `server_default=sa.false()`. Then append the backfill to `upgrade()`:

```python
    op.execute(
        sa.text(
            "UPDATE hosting_interest SET chapter_id = c.id "
            "FROM chapters c "
            "WHERE hosting_interest.interest_type = 'host_existing' "
            "AND hosting_interest.chapter_id IS NULL "
            "AND lower(trim(hosting_interest.existing_chapter)) = lower(trim(c.name))"
        )
        if op.get_bind().dialect.name == "postgresql"
        else sa.text(
            "UPDATE hosting_interest SET chapter_id = "
            "(SELECT c.id FROM chapters c WHERE lower(trim(hosting_interest.existing_chapter)) = lower(trim(c.name))) "
            "WHERE interest_type = 'host_existing' AND chapter_id IS NULL"
        )
    )
```

(`UPDATE ... FROM` is Postgres syntax; SQLite needs the correlated-subquery form — hence the dialect branch.) `downgrade()` drops the added columns/table only.

- [ ] **Step 4: Apply + verify** — `poetry run alembic upgrade head`; then `poetry run alembic downgrade -1`; then `upgrade head` again (round-trip). Check backfill against dev.db with sqlite3 if it has hosting_interest rows.

- [ ] **Step 5: Full suite + lint** — `poetry run pytest -q` green; `poetry run ruff check app/` clean.

- [ ] **Step 6: Commit** — `git add app/models alembic/versions` ; `git commit -m "feat(db): handled state, hosting-interest chapter link, digest opt-out and runs"`

---

### Task 2: Handled endpoints + hosting-interest chapter resolution

**Files:**
- Modify: `backend/app/api/hosting_interest.py` (resolve chapter at insert)
- Modify: `backend/app/api/admin.py` (contact-message list/patch; hosting-interest patch + lead scoping)
- Modify: `backend/app/schemas/admin.py` (response/patch schemas)
- Test: `backend/tests/test_handled_state.py`

**Interfaces:**
- Consumes: Task 1 columns.
- Produces: `GET /admin/contact-messages` → list of `ContactMessageOut(id, chapter_id, chapter_name, name, email, message, status, handled_by, handled_at, created_at)` scoped by `_chapter_filter`; `PATCH /admin/contact-messages/{id}` body `{"status": "handled"|"new"}` → 200 `ContactMessageOut`; `PATCH /admin/hosting-interest/{id}` same body → 200. Lead access rules: contact = own chapter only; hosting interest = own chapter + `interest_type == host_existing` only (404 otherwise); superadmin unrestricted. Public `POST /hosting-interest` now sets `chapter_id` when `existing_chapter` case-insensitively matches a chapter name.

- [ ] **Step 1: Failing tests**

```python
# backend/tests/test_handled_state.py
from sqlalchemy import select

from app.models.contact_message import ContactMessage
from app.models.hosting_interest import HostingInterest


async def _mk_contact(db_session, chapter_id, **kw):
    msg = ContactMessage(
        chapter_id=chapter_id, email="v@x.co", message="hello there friend", **kw
    )
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(msg)
    return msg


async def test_lead_lists_own_chapter_contact_messages(
    client, lead_headers, sf_chapter, db_session
):
    await _mk_contact(db_session, sf_chapter.id)
    r = await client.get("/admin/contact-messages", headers=lead_headers)
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["status"] == "new"


async def test_lead_cannot_see_other_chapters_messages(
    client, lead_headers, sf_chapter, db_session, admin_headers
):
    # create a second chapter via admin API, put a message there
    rc = await client.post(
        "/admin/chapters", json={"code": "zz", "name": "Zed"}, headers=admin_headers
    )
    other_id = rc.json()["id"]
    await _mk_contact(db_session, other_id)
    r = await client.get("/admin/contact-messages", headers=lead_headers)
    assert r.json() == []


async def test_mark_contact_handled_sets_audit_fields(
    client, lead_headers, chapter_lead, sf_chapter, db_session
):
    msg = await _mk_contact(db_session, sf_chapter.id)
    r = await client.patch(
        f"/admin/contact-messages/{msg.id}", json={"status": "handled"},
        headers=lead_headers,
    )
    assert r.status_code == 200
    await db_session.refresh(msg)
    assert msg.status == "handled"
    assert msg.handled_by == chapter_lead.id
    assert msg.handled_at is not None


async def test_host_cannot_patch_contact(client, host_headers, sf_chapter, db_session):
    msg = await _mk_contact(db_session, sf_chapter.id)
    r = await client.patch(
        f"/admin/contact-messages/{msg.id}", json={"status": "handled"},
        headers=host_headers,
    )
    assert r.status_code == 403


async def test_public_hosting_interest_resolves_chapter(client, sf_chapter, db_session):
    r = await client.post(
        "/hosting-interest",
        json={
            "name": "T", "email": "t@x.co", "city": "SF",
            "interest_type": "host_existing",
            "existing_chapter": f"  {sf_chapter.name.upper()}  ",
        },
    )
    assert r.status_code in (200, 201)
    row = (await db_session.execute(select(HostingInterest))).scalars().one()
    assert row.chapter_id == sf_chapter.id
    assert row.status == "new"


async def test_lead_patches_own_hosting_interest_only(
    client, lead_headers, sf_chapter, db_session
):
    hi = HostingInterest(
        name="A", email="a@x.co", city="SF", interest_type="start_chapter"
    )
    db_session.add(hi)
    await db_session.commit()
    await db_session.refresh(hi)
    r = await client.patch(
        f"/admin/hosting-interest/{hi.id}", json={"status": "handled"},
        headers=lead_headers,
    )
    assert r.status_code == 404  # start_chapter is admin-only
```

Adapt fixture names to conftest reality (there IS a `db_session`-style access — check and mirror `test_contact.py`). Also verify how `POST /admin/chapters` payload looks (ChapterCreate: code, name) — adjust if it needs more fields.

- [ ] **Step 2: Run to fail** — `poetry run pytest tests/test_handled_state.py -q` → 404/405s.

- [ ] **Step 3: Implement**

Schemas (`schemas/admin.py`):

```python
class HandledPatch(BaseModel):
    status: Literal["new", "handled"]


class ContactMessageOut(BaseModel):
    id: str
    chapter_id: str
    chapter_name: str | None = None
    name: str | None
    email: str
    message: str
    status: str
    handled_by: str | None
    handled_at: datetime | None
    created_at: datetime
    model_config = {"from_attributes": True}
```

`api/admin.py` endpoints (follow the file's existing section style):

```python
@router.get("/contact-messages", response_model=list[ContactMessageOut])
async def list_contact_messages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_lead_or_above(current_user)
    stmt = select(ContactMessage, Chapter.name).join(
        Chapter, Chapter.id == ContactMessage.chapter_id
    ).order_by(ContactMessage.created_at.desc())
    chapter_id = _chapter_filter(current_user)
    if chapter_id:
        stmt = stmt.where(ContactMessage.chapter_id == chapter_id)
    rows = (await db.execute(stmt)).all()
    out = []
    for msg, chapter_name in rows:
        item = ContactMessageOut.model_validate(msg)
        item.chapter_name = chapter_name
        out.append(item)
    return out


@router.patch("/contact-messages/{message_id}", response_model=ContactMessageOut)
async def patch_contact_message(
    message_id: str,
    body: HandledPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_lead_or_above(current_user)
    msg = (
        await db.execute(select(ContactMessage).where(ContactMessage.id == message_id))
    ).scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Not found")
    chapter_id = _chapter_filter(current_user)
    if chapter_id and msg.chapter_id != chapter_id:
        raise HTTPException(status_code=404, detail="Not found")
    msg.status = body.status
    if body.status == "handled":
        msg.handled_by = current_user.id
        msg.handled_at = datetime.now(timezone.utc)
    else:
        msg.handled_by = None
        msg.handled_at = None
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg
```

`PATCH /hosting-interest/{id}`: same pattern; lead scoping rule = 404 unless (`superadmin`) or (`interest_type == host_existing` and `chapter_id == lead's chapter`). Public insert resolution in `api/hosting_interest.py`:

```python
    chapter_id = None
    if body.interest_type == InterestType.host_existing and body.existing_chapter:
        result = await db.execute(
            select(Chapter).where(
                func.lower(func.trim(Chapter.name))
                == body.existing_chapter.strip().lower()
            )
        )
        ch = result.scalar_one_or_none()
        chapter_id = ch.id if ch else None
    # pass chapter_id=chapter_id when constructing HostingInterest
```

Also update `list_hosting_interest` in admin.py: allow leads (`_require_lead_or_above`), and for leads filter `chapter_id == lead's chapter AND interest_type == host_existing` (replace/augment the existing name-string match with the FK). Extend its response schema with `status`/`handled_by`/`handled_at`/`chapter_id` fields.

- [ ] **Step 4: Green + full suite** — task file passes; `poetry run pytest -q` all green (existing hosting-interest tests may assert the old admin-only behavior — update them to the new access rules without weakening unrelated assertions); ruff clean.

- [ ] **Step 5: Commit** — `git commit -m "feat(api): handled state for contact messages and hosting interest, lead scoping"`

---

### Task 3: Notifications summary endpoint

**Files:**
- Modify: `backend/app/api/admin.py`
- Test: `backend/tests/test_notifications_summary.py`

**Interfaces:**
- Produces: `GET /admin/notifications/summary` → `{"contact_messages": int, "hosting_interest": int, "volunteer_applications": int, "new_members": int, "community_uploads": int}` — exact keys; Task 7's sidebar consumes them verbatim.
- Counting rules (from spec): contact = `status=='new'` (lead: own chapter). hosting_interest = `status=='new'`; lead: `host_existing` + own chapter; admin: all types. volunteer_applications = `ApplicationStatus.pending`; lead: join `VolunteerRole.chapter_id == lead's chapter` (global/null-chapter roles count for admins only). new_members = `User.created_at >= now-7d AND User.is_active` (lead: own chapter; exclude the counting user themselves is NOT required). community_uploads = `UploadStatus.pending`, admins only (0 for leads). Hosts: all zeros.

- [ ] **Step 1: Failing tests** — seed one of each via models (`db_session`), then:

```python
async def test_summary_for_admin_counts_everything(client, admin_headers, ...):
    r = await client.get("/admin/notifications/summary", headers=admin_headers)
    assert r.status_code == 200
    assert r.json() == {
        "contact_messages": 1, "hosting_interest": 2,  # host_existing + start_chapter
        "volunteer_applications": 1, "new_members": <seeded count>,
        "community_uploads": 1,
    }

async def test_summary_for_lead_scopes_to_chapter(...):  # other-chapter rows excluded; start_chapter excluded; uploads 0
async def test_summary_for_host_is_all_zeros(client, host_headers):
async def test_handled_items_drop_out(...):  # patch to handled → count decrements
```

Write these fully (seeding helpers can live in the test file); new_members assertions must account for conftest-seeded users' `created_at` (they are created "now", so they count — compute expected from the fixtures actually present rather than hard-coding).

- [ ] **Step 2: Fail** — 404.

- [ ] **Step 3: Implement** — one endpoint building five `select(func.count())` queries per the rules; reuse `_chapter_filter`. Volunteer join: `select(func.count(VolunteerApplication.id)).join(VolunteerRole).where(VolunteerApplication.status == ApplicationStatus.pending, VolunteerRole.chapter_id == chapter_id)` for leads; admins without the chapter filter and without excluding null-chapter roles.

- [ ] **Step 4: Green + full suite + ruff.**

- [ ] **Step 5: Commit** — `git commit -m "feat(api): role-scoped notifications summary endpoint"`

---

### Task 4: Digest service + send script

**Files:**
- Create: `backend/app/services/digest.py`
- Create: `backend/scripts/send_digests.py`
- Test: `backend/tests/test_digest.py`

**Interfaces:**
- Produces:
  - `async def gather_recipients(db) -> list[User]` — active `chapter_lead`/`superadmin` with `digest_opt_out == False`
  - `async def build_digest(db, user: User, window_start: datetime, window_end: datetime) -> tuple[str, str, int] | None` — (subject, html, item_count); `None` when empty
  - `async def run_digest(db, window_start, window_end, only_email: str | None = None) -> int` — builds + sends via `send_email([user.email], subject, html)`, returns emails sent; does NOT touch DigestRun
  - `def previous_week_window(now: datetime) -> tuple[datetime, datetime]` — previous Mon 00:00 UTC → this Mon 00:00 UTC
  - Task 5 imports `run_digest`; the script wraps it with the DigestRun guard.
- Content rules: leads → sections for contact messages, hosting interest (host_existing, their chapter), volunteer applications (their chapter's roles), new members (their chapter) created in window; admins → those globally + start_chapter + community uploads + one-line counts of draft articles currently awaiting publish and jobs failed in window. Items rendered with `html.escape` on every user string; each section links to the matching admin page (`{settings.FRONTEND_URL}/contact-messages` etc.). Subjects exactly: `[Ai Salon] Weekly digest — {n} new item(s) for {chapter_name}` / `[Ai Salon] Weekly digest — {n} new items across Ai Salon`.

- [ ] **Step 1: Failing tests** — cover: window math (`previous_week_window` returns Monday-aligned UTC datetimes for a mid-week and a Monday `now`); recipient selection (opt-out and inactive excluded, hosts excluded); empty digest → `None`; lead digest excludes other chapters and start_chapter; admin digest includes uploads + start_chapter; `run_digest` sends one email per non-empty recipient with `send_email` patched (`patch("app.services.digest.send_email", new=AsyncMock(return_value=True))`) and respects `only_email`; user-content escaping (`<b>x</b>` message appears escaped in html). Write the actual test functions with seed helpers.

- [ ] **Step 2: Fail.** — ImportError.

- [ ] **Step 3: Implement `services/digest.py`** — straightforward queries mirroring Task 3's rules but windowed on `created_at` and ignoring handled state (spec: digest = weekly summary of what arrived). Simple HTML: `<h2 style="color:#111">Ai Salon — weekly digest</h2>` + per-section `<h3 style="color:#56a1d2">` + `<ul>` items + link; keep it one function, no templating dependency.

- [ ] **Step 4: Implement `scripts/send_digests.py`**

```python
"""Send weekly notification digests. Run by Railway cron (Mon 09:30 UTC).

Usage: poetry run python scripts/send_digests.py [--window-days N] [--force] [--only-email X]
"""
import argparse
import asyncio
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, ".")  # run from backend/

from sqlalchemy import select  # noqa: E402

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.models.digest_run import DigestRun  # noqa: E402
from app.services.digest import previous_week_window, run_digest  # noqa: E402


async def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--window-days", type=int, default=None)
    p.add_argument("--force", action="store_true")
    p.add_argument("--only-email", default=None)
    args = p.parse_args()

    now = datetime.now(timezone.utc)
    if args.window_days:
        start, end = now - timedelta(days=args.window_days), now
    else:
        start, end = previous_week_window(now)

    async with AsyncSessionLocal() as db:
        if not args.window_days:  # guard only applies to real weekly runs
            existing = (
                await db.execute(
                    select(DigestRun).where(DigestRun.period_start == start.date())
                )
            ).scalar_one_or_none()
            if existing and not args.force:
                print(f"digest for week {start.date()} already sent; use --force")
                return 0
        sent = await run_digest(db, start, end, only_email=args.only_email)
        if not args.window_days and not args.only_email:
            db.add(
                DigestRun(
                    period_start=start.date(), period_end=end.date(),
                    recipients_count=sent,
                )
            )
            await db.commit()
        print(f"sent {sent} digest(s) for {start.date()}..{end.date()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
```

(If a DigestRun row exists and `--force` is passed, update it rather than inserting a duplicate — unique constraint.)

- [ ] **Step 5: Green + full suite + ruff. Manual smoke:** `poetry run python scripts/send_digests.py --window-days 7` against local dev.db (unconfigured Resend ⇒ send_email returns False, script still exits 0 — verify it prints sensibly).

- [ ] **Step 6: Commit** — `git commit -m "feat(digest): weekly digest service, send script with run guard"`

---

### Task 5: run-test endpoint + digest_opt_out in profile API

**Files:**
- Modify: `backend/app/api/admin.py` (run-test endpoint)
- Modify: `backend/app/schemas/profile.py`, `backend/app/api/profile.py` (opt-out field)
- Test: `backend/tests/test_digest_endpoint.py`

**Interfaces:**
- Produces: `POST /admin/digests/run-test` body `{"window_days": 7, "only_me": true}` (defaults shown), superadmin only → 200 `{"sent": int, "window_days": int}`. `only_me=true` passes the caller's email as `only_email`. Never writes DigestRun. Sends via BackgroundTasks? **No — run inline** (superadmin pressing a test button wants the count back; sends are few).
- `ProfileUpdateRequest.digest_opt_out: bool | None = None` with the same explicit-null-rejecting validator as `hide_from_team`; `ProfileResponse.digest_opt_out: bool`.

- [ ] **Step 1: Failing tests** — run-test: superadmin 200 + `send_email` awaited once when only_me (patched at `app.services.digest.send_email`); lead → 403; `window_days` clamped 1–31 (422 outside). Profile: PATCH digest_opt_out true → persisted; explicit null → 422; GET /profile/me includes the field.
- [ ] **Step 2: Fail.**
- [ ] **Step 3: Implement** (endpoint calls `previous_week... no — trailing window: start = now - timedelta(days=body.window_days)`, `run_digest(db, start, now, only_email=current_user.email if body.only_me else None)`).
- [ ] **Step 4: Green + full suite + ruff.**
- [ ] **Step 5: Commit** — `git commit -m "feat(api): digest run-test endpoint and profile digest opt-out"`

---

### Task 6: Frontend — sidebar badges + Contact Messages page

**Files:**
- Modify: `frontend/src/app/(admin)/SidebarNav.tsx`
- Create: `frontend/src/app/(admin)/contact-messages/page.tsx`

**Interfaces:**
- Consumes: `GET /admin/notifications/summary` (Task 3 keys verbatim), `GET /admin/contact-messages`, `PATCH /admin/contact-messages/{id}` (Task 2 shapes).

- [ ] **Step 1: SidebarNav** — add `const [summary, setSummary] = useState<Record<string, number>>({})` + a `useEffect` on `token` that fetches `/admin/notifications/summary` immediately and on a 60s `setInterval` (clear on cleanup; keep the existing draft-count effect untouched). Extend `buildNav` to take `summary` and attach `badge:` values: new item `{ href: '/contact-messages', label: 'Contact Messages', icon: 'fa-envelope-o', badge: summary.contact_messages || undefined }` placed right after the Team entry and visible to leads + admins (not hosts); `badge: summary.hosting_interest` on Host Interest; `summary.volunteer_applications` on Volunteer Applications; `summary.community_uploads` on Community Uploads; `summary.new_members` on the Team entry. Badges render via the existing gold-pill mechanism (only when > 0). NOTE: Host Interest / Volunteer Applications / Community Uploads currently live in role-gated groups — for chapter leads, ensure Host Interest is reachable (move it from the admin-only group to the lead-visible Team Management group or equivalent) consistent with Task 2's access opening.

- [ ] **Step 2: Contact Messages page** — client component modeled on the existing hosting-interest admin page's table idioms: fetch list on mount; columns Date, From (name + mailto email), Message (truncated, click to expand row), Chapter (render only when the user is superadmin — infer from session role like other pages), Status chip (gold "new" / gray "handled"), and a "Mark handled" button per `new` row (PATCH then update local state; "Mark new" to undo on handled rows). Empty state: "No contact messages yet."

- [ ] **Step 3: Build + lint** — `npm run build`; `npm run lint`.
- [ ] **Step 4: Commit** — `git commit -m "feat(frontend): notification badges and contact-messages inbox"`

---

### Task 7: Frontend — hosting-interest handled controls + digest toggle

**Files:**
- Modify: `frontend/src/app/(admin)/hosting-interest/page.tsx`
- Modify: `frontend/src/app/(admin)/profile/page.tsx`

- [ ] **Step 1: Hosting-interest page** — add Status chip column + Mark handled/new button using `PATCH /admin/hosting-interest/{id}` (same interaction as Task 6's page); page must no longer assume superadmin (leads now get their scoped list from the API; remove any client-side role gate that hides the page from leads, and show the chapter column from the new `chapter_id`/name data where present).
- [ ] **Step 2: Profile toggle** — in the Account card add a checkbox row "Email me a weekly digest of new activity" checked when `digest_opt_out === false`; toggling PATCHes `/profile/me` with `{digest_opt_out: !checked}` (never null), optimistic update + toast on failure, mirroring `hide_from_team`'s handling.
- [ ] **Step 3: Build + lint; commit** — `git commit -m "feat(frontend): hosting-interest handled controls and digest opt-out toggle"`

---

### Task 8: Synthesis script

**Files:**
- Create: `backend/scripts/synthesize_test_events.py`
- Test: `backend/tests/test_synthesize_script.py` (unit-level: payload builders + WAV stub)

**Interfaces:**
- CLI: `poetry run python scripts/synthesize_test_events.py --api-url https://<develop-backend> --chapter sf --count 2 --contact-email you@x.co [--cleanup]`; admin creds via `SYNTH_ADMIN_EMAIL`/`SYNTH_ADMIN_PASSWORD` env (or `--admin-email/--admin-password`).

- [ ] **Step 1: Structure the script as importable functions** (so tests can hit them via ASGI too):

```python
# key functions, all taking an httpx.Client/AsyncClient + base_url implicitly via client
def make_wav_stub() -> bytes: ...        # 44-byte RIFF/WAVE header + 1s of silence, valid magic bytes
def contact_payload(i, contact_email): ...   # {"name": f"[TEST] Visitor {i}", "email": contact_email, "message": ...}
def hosting_payloads(chapter_name, contact_email): ...  # one host_existing (existing_chapter=chapter_name), one start_chapter
def volunteer_payload(contact_email): ...    # VolunteerApplyRequest fields incl. why_interested/relevant_experience/availability
async def synthesize(client, chapter_code, count, contact_email, admin_email, admin_password, include_member=True): ...
```

Flow inside `synthesize`: GET `/chapters/{code}` (resolve name) → POST contact ×count → POST `/hosting-interest` ×2 → GET `/volunteer/roles` public list (check the actual public roles path in `api/volunteer.py`; create a `[TEST]` role via admin API if none active) → POST `/volunteer-roles/{slug}/apply` → POST `/community/upload` (multipart: `make_wav_stub()` as `file`, `city`, `topic_text="[TEST] synthetic topic"`) → admin login `POST /auth/login {identifier, password}` → `POST /admin/invites {chapter_id, role: "host"}` → `POST /auth/register` with `[TEST]`-prefixed username/unique email + 12+-char password. Print each created item + where to see it, the up-front WARNING that contact messages email real chapter leads, and the closing hint: trigger a digest with `POST /admin/digests/run-test` (or the profile UI once built). `--cleanup`: mark created contact/hosting rows handled via admin API, deactivate the `[TEST]` user via the admin users API if an endpoint exists (check; otherwise print what to clean manually — do not invent endpoints).

- [ ] **Step 2: Unit tests** — `make_wav_stub()` starts with `b"RIFF"` and contains `b"WAVE"`, length > 44; payload builders produce schema-valid dicts (validate by constructing the actual Pydantic classes imported from the api modules). One integration test: run `synthesize` against the test app via `httpx.AsyncClient(transport=ASGITransport(app=app))` with `send_email` patched, then assert the summary endpoint counts rose accordingly (this doubles as an end-to-end test of the whole feature).
- [ ] **Step 3: Green + full suite + ruff; commit** — `git commit -m "feat(scripts): synthesize_test_events for develop testing"`

---

### Task 9: Integration pass + docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Full verification** — backend `poetry run pytest -q` (expect ~350+), `poetry run ruff check app/`; frontend `npm run build`, `npm run lint`. All green or STOP/BLOCKED.
- [ ] **Step 2: Docs** — CLAUDE.md: route map + `/contact-messages` row; a short "Notifications" subsection under Architecture: summary endpoint, handled-state fields, digest script + `run-test` endpoint, synthesis script usage one-liner, and the **manual Railway cron setup**: dashboard → New Service → same repo/Dockerfile → Cron Schedule `30 9 * * 1` → Start Command `poetry run python scripts/send_digests.py` → attach same env vars as backend (esp. DATABASE_URL, RESEND_API_KEY, EMAIL_FROM, SECRET_KEY, FRONTEND_URL) → repeat per environment.
- [ ] **Step 3: Commit** — `git commit -m "docs: notifications architecture, routes, cron setup"`

Merge to develop, push, and deploy verification are the controller's job after the final whole-branch review (Railway CLI is logged out — verify by probing the develop backend `/health` and exercising the synthesis script + run-test digest as the acceptance pass).
