# Link Existing Article — Design Spec

**Date:** 2026-04-16  
**Status:** Approved

## Problem

Articles are currently only created by the SocraticAI processing pipeline (audio upload → job → article). There is no way to manually register a Substack post that already exists, making it impossible to track externally-published content in the platform.

## Goal

Allow chapter leads and superadmins to manually link an existing Substack post so it appears in the articles list and counts toward chapter stats.

## Out of Scope

- Event association (events are not yet in the database)
- Pasting full article content (URL-only linking is sufficient for now)

---

## Backend

### New schema: `ArticleCreate`

Added to `app/schemas/admin.py`:

```python
class ArticleCreate(BaseModel):
    title: str
    substack_url: str
    published_date: date | None = None   # stored in scheduled_publish_date column
    chapter_id: str | None = None        # superadmin only; auto-assigned for others
```

### New endpoint: `POST /admin/articles`

- **Auth:** any authenticated user (host, chapter_lead, superadmin)
- **RBAC:**
  - Chapter leads and hosts: `chapter_id` is ignored in the body; the user's own `chapter_id` is always used
  - Superadmins: `chapter_id` is required in the body
- **Creates** an `Article` with:
  - `title`, `substack_url` from body
  - `scheduled_publish_date` ← `published_date` from body
  - `status = published`
  - `job_id = null`
  - `chapter_id` per RBAC rule above
- **Returns** `ArticleResponse` (201)

No new database columns or migrations needed — all fields map to existing columns.

---

## Frontend

### Articles page (`/articles`)

**Header change:** Add a "Link Article" button to the right of the "Articles" heading.

**Modal fields:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Title | text input | yes | |
| Substack URL | url input | yes | |
| Publish date | date input | no | |
| Chapter | dropdown | superadmin only | populated from existing chapters list |

**Behavior:**
- Submit POSTs to `POST /admin/articles`
- On success: close modal, refresh article list
- On error: show inline error message on the submit button area
- Submit button shows loading state while in-flight

No new pages or routes are added.

---

## Testing

**Backend:**
- `POST /admin/articles` as chapter lead → article created with lead's chapter, status=published, job_id=null
- `POST /admin/articles` as superadmin with explicit chapter_id → article created for that chapter
- `POST /admin/articles` as superadmin without chapter_id → 422
- Missing required fields (title, substack_url) → 422

**Frontend:**
- Build passes (`npm run build`)
- Modal opens/closes correctly
- Chapter dropdown hidden for non-superadmin users
