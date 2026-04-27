# Chapter Status, User Profiles, and Homepage Filtering

**Date:** 2026-04-26
**Status:** Approved
**Branch target:** `develop`

## Goals

Three related cleanups for `develop` before pushing to production:

1. Give Chapters an explicit lifecycle (`draft` / `active` / `archived`) controlled by superadmin, with a UI to create chapters.
2. Restrict the homepage's people section to founders and chapter leads of active chapters only.
3. Replace the current curated `TeamMember` table with profile fields on `User`, gated by a profile-completion flow that runs on first login after invite.

The unifying decision: **`User` becomes the single source of truth for people**. The current `TeamMember` model is deprecated and removed.

## Non-goals

- Email notifications when invited.
- Admin marking a user's profile complete on their behalf.
- HEIC photo support (rejected client-side with a clear message).
- Changes to chapter detail pages (`/chapters/[code]`) beyond filtering archived/draft chapters out of the list.
- Read-only access for archived chapters' members.

## Data model

### Chapter (`backend/app/models/chapter.py`)

The `status` column already exists (`String(32)`, default `"active"`). Constrain to one of `draft`, `active`, `archived` via a `CheckConstraint`. The Python-side default changes to `"draft"` so chapters created via the admin endpoint start as drafts; the seed file (`core/seed.py`) explicitly sets `status="active"` on every seeded chapter so existing chapters stay active. No DB enum type is added — validation lives in the Pydantic schema and the `CheckConstraint`.

### User (`backend/app/models/user.py`)

Add columns (all nullable except `is_founder` and `display_order`):

| Column | Type | Notes |
|---|---|---|
| `name` | `String(120)` | Display name. Required after profile completion. |
| `profile_image_url` | `String(512)` | Required after profile completion. |
| `linkedin` | `String(512)` | Optional. |
| `description` | `Text` | Optional. Max 350 chars enforced in Pydantic schema. |
| `title` | `String(160)` | Display title (e.g. "Founder, Executive Director", "San Francisco Chapter Lead"). Defaults derived from role + chapter at registration. Superadmin-editable. |
| `is_founder` | `Boolean` | Default `false`. Superadmin-only. Drives "founders" homepage section. |
| `display_order` | `Integer` | Default `0`. Used for homepage ordering. |
| `profile_completed_at` | `DateTime(timezone=True)` | `NULL` means profile flow incomplete; user is gated. |

### TeamMember

Removed. Migration drops the table after backfilling its data into `User` rows. All references in code (`models/team_member.py`, `schemas/team.py`, `schemas/admin.py` team-related schemas, `api/team.py`, `api/admin.py` team endpoints, `core/seed.py`) are deleted or refactored.

## Chapter status semantics

| Status | Public visibility | Invites allowed | Members can log in |
|---|---|---|---|
| `draft` | Hidden from all public endpoints | Yes | Yes |
| `active` | Visible | Yes | Yes |
| `archived` | Hidden | **No** | Yes |

Backend enforcement points:

- `GET /chapters` (public, `api/chapters.py`) filters to `status == "active"`.
- `GET /chapters/{code}` (public) returns 404 if status is not `active`.
- `POST /admin/invites` (`api/admin.py`) returns 400 if the chapter is `archived`.
- `GET /admin/chapters` (admin) returns all chapters regardless of status.

## Homepage filter

Replace the current `TeamMember`-backed `GET /team` with a User-backed implementation.

**Eligibility predicate**:

```
profile_completed_at IS NOT NULL
AND (
  is_founder = true
  OR (role = 'chapter_lead' AND chapter.status = 'active')
)
```

Hosts never appear on the public homepage, regardless of profile completion.

**Sort order**:

1. Founders first (`is_founder = true`), ordered by `display_order ASC`, then `created_at ASC`.
2. Then chapter leads, grouped by chapter name (alphabetical), then `display_order ASC` within a chapter.

**Response schema (`schemas/team.py`)**:

```python
class TeamMemberOut(BaseModel):
    id: UUID
    name: str
    title: str
    description: str | None
    profile_image_url: str
    linkedin: str | None
    is_founder: bool
    chapter_code: str | None
    chapter_name: str | None
```

`chapter_code` and `chapter_name` are populated for chapter leads, `None` for founders without a chapter (rare, but possible).

## Chapter admin UI (`/chapters`)

Changes to `frontend/src/app/(admin)/chapters/page.tsx`:

- **Status filter tabs**: `Draft` / `Active` / `Archived` / `All`. Replaces the current binary indicator. Superadmin-only.
- **"Create Chapter" button** (superadmin only): opens a modal with required fields `code` (slug, unique, lowercase + hyphens validated client-side) and `name`. All other fields (title, tagline, description, etc.) are blank and editable later via the existing edit page. New chapter starts as `draft`.
- **Status select** on each chapter card and on the edit page (`/chapters/edit/[code]`).
- **"Add Person" button** on each chapter card, visible when `status != "archived"`, opens the existing invite-creation flow scoped to that chapter.

Backend endpoints:

- `POST /admin/chapters` (new, superadmin) — body `{ code, name }`, returns the created chapter as `draft`.
- `PATCH /admin/chapters/{code}` (existing) — extend `ChapterUpdate` schema to include `status` with enum validation.

## Profile-completion flow

### Registration

`POST /auth/register` continues to create the User but no longer auto-redirects to `/dashboard`. The frontend post-register handler redirects to `/profile/complete` instead.

### Gating

A NextAuth middleware (or per-page check in admin layout) redirects any authenticated user with `profile_completed_at == NULL` to `/profile/complete`, except when they are already on `/profile/complete` or `/api/auth/*`. The backend mirrors this with a 403 + structured error code (`PROFILE_INCOMPLETE`) on protected endpoints when the JWT user has an incomplete profile, so a stale tab can't bypass the gate.

### Profile page (`/profile/complete`)

Form fields:

| Field | Required | UI |
|---|---|---|
| Name | Yes | Text input |
| Photo | Yes | File picker → crop UI → upload |
| LinkedIn URL | No | Text input, URL validation |
| Description | No | Textarea with live char counter (max 350) |

Submit calls `POST /profile/complete`, which validates, sets `profile_completed_at = now()`, and returns the updated user. Frontend then redirects to `/dashboard`.

### Photo upload with cropping

Library: **`react-easy-crop`** (small, no heavy deps).

Flow:

1. User selects a file. Reject HEIC and other non-jpeg/png types client-side with a clear message.
2. Reject files > 5 MB before opening the cropper.
3. File loads into the cropper: square (1:1) aspect ratio locked, draggable + zoomable.
4. On confirm, a hidden `<canvas>` renders the cropped region to a **512×512 JPEG** via `canvas.toBlob({ type: 'image/jpeg', quality: 0.9 })`.
5. Cropped blob uploads to `POST /profile/photo` (new endpoint) — backend uses existing `services/storage.py:save_upload`, validates magic bytes (jpeg only after crop), size ≤ 5 MB, returns `{ url }`.
6. Client sets the URL on the form's `profile_image_url` field; submitted with the rest of the profile.

The same cropping flow is used by the superadmin "People" page when replacing a person's photo.

## Migration / backfill

A single Alembic migration handles schema and data:

1. **Add columns** to `users`:
   `name`, `profile_image_url`, `linkedin`, `description`, `title`, `is_founder` (default `false`, NOT NULL), `display_order` (default `0`, NOT NULL), `profile_completed_at`.
2. **Add `CheckConstraint`** to `chapters.status` enforcing `IN ('draft', 'active', 'archived')`.
3. **Backfill from `team_members`**:
   - **Founders** (`team_members.is_cofounder = true`): find a matching User by name (e.g. "Ian Eisenberg" matches the seeded `admin` User by special case) or create one. For founders without an existing User, create a User shell (`role = host`, `is_active = false`, `username = slugify(name)`, `email = f"{username}@aisalon.placeholder"`, random password). Copy `name`, `profile_image_url`, `linkedin`, `description`, `display_order` onto the User; set `is_founder = true`, `title = team_member.role`, `profile_completed_at = now()`.
   - **Chapter leads** (TeamMember `role` contains "Chapter Lead" or matches `"{Chapter} Chapter Lead"`): match the seeded chapter_lead User by `username == chapter.code` and the TeamMember by `team_member.chapter_id == user.chapter_id`. If multiple chapter-lead TeamMembers exist for one chapter (e.g. Berlin has two), the first by `display_order` claims the seeded chapter_lead User; subsequent ones get User shells (same shape as founders above) with `role = chapter_lead`. Copy profile fields and set `title = team_member.role`, `profile_completed_at = now()`.
   - **Hosts** (everything else): not migrated. Hosts have never been Users and no longer appear publicly. They can be re-added later via the invite flow.
4. **Drop `team_members` table** at the end of the migration.

Seeded chapter_lead Users that don't match any TeamMember (chapters with no lead in the seed roster) keep `profile_completed_at = NULL` and will go through the profile-completion flow on next login.

The seed module (`core/seed.py`) is rewritten:

- Every seeded chapter is created with `status="active"` explicitly (so the new `draft` default doesn't apply to seeds).
- Founders (Ian, Cecilia) become User seeds: Ian merges into the existing `admin` superadmin User; Cecilia is a new User with `role = host`, `is_founder = true`, `is_active = true`. Both with full profile fields and `profile_completed_at = now()`.
- The chapter_lead User for each chapter (already seeded today by `seed_chapter_leads`) gets profile fields populated (`name`, `title`, `profile_image_url`, `linkedin`, `description`) from the chapter team roster, with `profile_completed_at = now()`.
- Host roster entries are dropped from the seed entirely. The `_CHAPTERS` dict no longer contains host TeamMember dicts.

## Admin "People" page

Replaces `frontend/src/app/(admin)/team/page.tsx`. Path is renamed `/people` (route file moves to `app/(admin)/people/page.tsx`); old `/team` route 404s.

- Lists Users for the superadmin's scope (all chapters for superadmin, their own chapter for chapter leads).
- Columns: photo, name, title, role, chapter, `is_founder`, `display_order`, profile-completion status.
- Superadmin can edit `title`, `is_founder`, `display_order`, and replace photo (uses the same crop flow).
- Chapter leads can view but not edit profile fields (they edit via their own `/profile` page, out of scope here).

## API surface summary

New / changed endpoints:

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/admin/chapters` | superadmin | Create chapter (`code`, `name`); status starts `draft`. |
| `PATCH` | `/admin/chapters/{code}` | superadmin | Extended to accept `status`. |
| `POST` | `/profile/complete` | any authenticated user | Saves profile fields, sets `profile_completed_at`. |
| `POST` | `/profile/photo` | any authenticated user | Accepts cropped JPEG, returns `{ url }`. |
| `GET` | `/team` | public | Now User-backed (founders + active-chapter leads). |
| `GET` | `/chapters` | public | Filters to `status == "active"`. |
| `GET` | `/chapters/{code}` | public | 404 if not `active`. |

Removed:
- `GET /admin/team`, `POST /admin/team`, `PATCH /admin/team/{id}`, `DELETE /admin/team/{id}` — TeamMember CRUD.

## Tests (TDD order)

Backend (`pytest`):

1. `test_chapters.py`: public list excludes `draft` and `archived`; detail returns 404 for non-active.
2. `test_admin_chapters.py`: superadmin can create a chapter (status `draft`); chapter_lead cannot; PATCH accepts valid status, rejects invalid.
3. `test_admin_invites.py` (extend): invites blocked when chapter is `archived`; allowed for `draft` and `active`.
4. `test_profile.py`: register → `profile_completed_at` is NULL → `/profile/complete` succeeds → user appears in `/team` if eligible. Description over 350 chars rejected.
5. `test_team.py` (rewrite): founders + active-chapter leads only; hosts excluded; draft-chapter leads excluded; archived-chapter leads excluded; sort order verified.
6. `test_profile_photo.py`: upload accepts JPEG, rejects oversize and non-image bytes.
7. `test_migration.py` (optional): run the Alembic upgrade against a snapshot of seeded test data and assert User rows have expected fields.

Frontend (manual verification, no unit tests):

- `npm run build` passes.
- Browser walk-through: create chapter modal, status filter tabs, profile-completion gate (try navigating to `/dashboard` with incomplete profile), photo crop UI, homepage shows correct people in correct order.

## Implementation order (high-level)

1. Add `User` columns + `CheckConstraint` migration **without** dropping TeamMember yet. Tests for new model fields.
2. New `/profile/complete` and `/profile/photo` endpoints + frontend page + middleware gate. Profile flow works for newly registered users.
3. New `GET /team` reading from User. Old TeamMember-backed endpoint stays in parallel temporarily.
4. Chapter admin: create-chapter button, status filter tabs, status select, invite gating on archived.
5. Backfill migration + seed rewrite. TeamMember model and endpoints removed. Old `/admin/team` page replaced by `/admin/people`.
6. Public homepage swap to new `/team` shape.
7. Final test pass; merge to `develop`.

## Risk notes

- **Photo storage on Railway**: `UPLOAD_DIR` is local-disk on the backend container; uploads are not durable across redeploys. This is a pre-existing limitation already true for `community_uploads`. Out of scope to fix here, but worth flagging — uploaded profile photos may disappear on container redeploy until a persistent volume or object storage is added.
- **Username collisions**: backfill creates User shells with `username = slugify(name)`. If two TeamMembers happen to share a slug, the second insert fails. The migration appends a numeric suffix on collision.
- **Seeded chapter_lead passwords**: existing seeded chapter_lead accounts (`sf`, `berlin`, etc.) keep `profile_completed_at = NULL` after the migration if they had no matching TeamMember. They will be gated to the profile flow on next login. This is intended.
