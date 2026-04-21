# Topics: Markdown Content Field

**Date:** 2026-04-21
**Status:** Approved

## Overview

Replace the structured topic fields (`description`, `opening_question`, `prompts[]`) with a single `content` markdown field. Topics become `title` + freeform markdown, rendered with `react-markdown` on the frontend. Topics are also made visible to all user roles (including hosts) in the admin sidebar.

## Data Model

**Migration:** One Alembic migration drops three columns and adds one.

| Dropped | Added |
|---------|-------|
| `description` (Text) | `content` (Text, not null) |
| `opening_question` (Text) | |
| `prompts` (JSON) | |

Retained: `id`, `title`, `is_active`, `display_order`, `created_at`, `updated_at`.

For existing rows, the migration sets `content = ''` as a placeholder. Seed data is rewritten with full markdown content.

## Markdown Template

Each topic's `content` follows this structure (no events section):

```markdown
## Description

...

**Conversation Topics**

- ...

**Evocative Questions**

- ...

## Links

**Ai Salon Archive Substacks**

- [Title](url)
```

Links to previous Substack articles are included where available; placeholder text otherwise. Content is editable via the admin UI after deployment.

## API

All existing routes are unchanged. Only request/response schemas update:

**`TopicPublic`** (public `GET /topics`):
```
id, title, content, display_order
```

**`TopicCreate`** (admin `POST /admin/topics`):
```
title, content, is_active=True, display_order=0
```

**`TopicUpdate`** (admin `PUT /admin/topics/{id}`):
```
title, content, is_active (optional), display_order (optional)
```

**`TopicResponse`** (admin endpoints):
```
id, title, content, is_active, display_order
```

## Frontend Changes

### `SidebarNav.tsx`
Remove the `!isHost` guard on the Topics nav item. Topics is visible to all roles: superadmin, chapter_lead, host.

### `/start/page.tsx`
- `Topic` interface: remove `description`, `opening_question`, `prompts`; add `content: string`
- Collapsed card: title only (no description preview)
- Expanded card: render `content` with `<ReactMarkdown remarkPlugins={[remarkGfm]}>`
- Existing expand/collapse toggle behavior unchanged

### `/start/print/page.tsx`
- `Topic` interface: same update as above
- Show first 3 topics only (by `display_order` ascending — already sorted by API)
- Each topic: title + rendered markdown at small print font size

### `/admin/topics/page.tsx`
- `Topic` interface: remove `description`, `opening_question`, `prompts`; add `content: string`
- Form: remove three separate fields; add single `content` markdown textarea (rows=16)
- Table preview: show first 80 characters of `content` (strips markdown for readability)
- Superadmin CRUD (Create / Edit / Deactivate / Activate) unchanged

### `/community_upload/page.tsx`
- `Topic` interface update only — this page uses only `id` and `title`

## Seed Data

Rewrite all 6 existing seed topics (`seed.py`) in markdown format:
1. AI and the Future of Work
2. AI Ethics and Governance
3. AI in Creative Arts
4. AI and Personal Privacy
5. AI and Education
6. AI and Health

Each topic gets a description, conversation topics, evocative questions, and Substack article links where available.

## Tests

- Update `test_topics.py`: remove assertions on `description`/`opening_question`/`prompts`; add assertions on `content`
- Update `test_seed_topics.py`: verify seed topics have non-empty `content`, remove prompt-count assertions
- All existing route coverage (CRUD, auth, ordering) is preserved

## Out of Scope

- Topic search/filter
- Topic categories or tags
- Per-chapter topic assignment
- Any changes to community upload topic linking (still uses `topic_id` + `topic_text`)
