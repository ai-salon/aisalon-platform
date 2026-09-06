# Notifications: Badges, Handled State, and Weekly Digests — Design

**Date:** 2026-09-06
**Status:** Approved (brainstormed interactively)
**Tracking:** bean `AiSalon-30l5`

## Overview

The platform accumulates inbound requests (contact messages, hosting interest,
volunteer applications, community uploads, new member registrations) with no
consistent way to notice them. This spec adds: role-scoped sidebar badges fed
by one aggregated endpoint, a team-wide handled state where none exists, a
weekly email digest via the existing Resend foundation, and a synthesis script
so the whole system can be exercised on the develop environment on demand.

**Chosen approach:** computed on demand, no notification/event table. Badges
and digests query the source tables directly; handled state lives on source
rows. Weekly send is triggered by a Railway cron service running a script,
guarded against double-sends.

## Routing decisions (approved)

- **Chapter leads** see people-facing events scoped to their chapter:
  contact messages, hosting interest (host_existing), pending volunteer
  applications (their chapter's roles), members joined in the last 7 days.
- **Superadmins** see everything: the above globally, plus start-chapter
  requests, pending community uploads; digests also append counts of draft
  articles awaiting publish and failed jobs.
- Draft articles and failed jobs are NOT lead-facing in this system. The
  existing per-chapter Articles draft pill in the sidebar is untouched.
- Badge clearing is **team-wide**: one person marking an item handled clears
  it for everyone. New-member counts need no clearing (rolling 7-day window).

## 1. Data model (one combined Alembic migration)

| Table | Change |
|---|---|
| `contact_messages` | + `status` String(16) NOT NULL default `'new'` (`new`\|`handled`), `handled_by` (users FK, nullable), `handled_at` (tz datetime, nullable). Backfill: existing rows stay `'new'`. |
| `hosting_interest` | + same `status`/`handled_by`/`handled_at` trio; + `chapter_id` (chapters FK, nullable, indexed). Backfill: `host_existing` rows matched by `existing_chapter` name → `Chapter.name` (case-insensitive trim); unmatched and `start_chapter` rows stay NULL. |
| `users` | + `digest_opt_out` Boolean NOT NULL default false. |
| `digest_runs` (new) | `id` (uuid pk), `period_start` (Date, **unique**), `period_end` (Date), `recipients_count` (Integer), TimestampMixin. Idempotency guard for weekly sends. |

`POST /hosting-interest` (public) resolves `existing_chapter` → `chapter_id`
at insert time going forward (same case-insensitive match; NULL when no match).

## 2. Badge summary endpoint + sidebar

`GET /admin/notifications/summary` (auth required) returns counts already
scoped to the caller via the existing `_chapter_filter` pattern:

```json
{
  "contact_messages": 3,        // status='new', chapter-scoped for leads
  "hosting_interest": 1,        // status='new': leads → host_existing for their chapter_id; admins → all incl. start_chapter
  "volunteer_applications": 2,  // status='pending'; leads → their chapter's roles only (global-role apps are admin-only)
  "new_members": 1,             // users created_at >= now-7d, chapter-scoped for leads; admins global
  "community_uploads": 4        // status='pending'; admins only (0 for leads)
}
```

Hosts receive all zeros (they have no action queues) — the endpoint still
works for them so the sidebar code stays role-agnostic.

**Sidebar** (`SidebarNav.tsx`): one fetch of the summary on mount + a 60s
`setInterval` refresh (cleaned up on unmount), replacing nothing — the
existing draft-count fetch stays as is. Badge pills (existing gold-pill
style) attach to: **Contact Messages** (new nav entry, `fa-envelope-o`,
visible to leads + admins), Host Interest, Volunteer Applications,
Community Uploads (admin), and Team (new-member count). Volunteer-apps badge
for leads counts only their chapter's roles, matching what their list page
shows.

## 3. Handled controls

- **New page `/contact-messages`** (leads + admins; leads chapter-scoped):
  table of date, sender name/email, message (expandable), chapter (admins
  only), status chip, "Mark handled" button. Backend:
  `GET /admin/contact-messages` (scoped list, newest first) and
  `PATCH /admin/contact-messages/{id}` `{status}` setting
  `handled_by`/`handled_at` (lead-or-above + own-chapter check). Route map +
  sidebar entry added.
- **Hosting Interest page**: status chip + "Mark handled" button via
  `PATCH /admin/hosting-interest/{id}` `{status}`. Access opens to chapter
  leads, list scoped to `chapter_id == lead's chapter` and
  `interest_type == host_existing`; superadmins see everything (unchanged
  view + new controls). Sidebar visibility for the entry follows.
- Volunteer applications and community uploads keep their existing review
  flows — reaching `reviewed/accepted/rejected` (or `reviewed/rejected` for
  uploads) is what clears those badges. No changes.

## 4. Weekly digest

- **Recipients:** active `chapter_lead` and `superadmin` users with
  `digest_opt_out == false`. Leads get their chapter's people-facing items;
  superadmins get the global digest (all categories + draft-articles-awaiting
  and failed-jobs counts for the week).
- **Window:** the previous full week, Monday 00:00 UTC → Monday 00:00 UTC.
  Items = rows *created* in the window (regardless of current handled state),
  so the digest is a true weekly summary; badges remain the live view.
- **Skip empty:** a recipient with zero items in every category gets no email.
- **Content:** single HTML email, hand-built like existing emails
  (`html.escape` on all user content), salon-blue/gold accents, one section
  per category with item lines (sender/name, chapter where relevant, date)
  and a link into the matching admin page. Subject:
  `[Ai Salon] Weekly digest — {n} new item(s) for {chapter.name}` (leads) /
  `[Ai Salon] Weekly digest — {n} new items across Ai Salon` (admins).
- **Trigger:** `backend/scripts/send_digests.py` — resolves the window,
  refuses to run if a `digest_runs` row exists for that `period_start`
  (unless `--force`), sends via `services/email.send_email`, records the run.
  Flags: `--window-days N` (override window to trailing N days, for tests),
  `--force` (ignore the run guard), `--only-email X` (send just to one
  recipient). Exit non-zero on config/DB failure so cron surfaces it.
- **Schedule:** a second Railway service on the same Docker image with
  `cronSchedule = "30 9 * * 1"` (Mon 09:30 UTC) and start command
  `poetry run python scripts/send_digests.py`. Because the Railway CLI is
  currently logged out, creating this service is a **documented manual step**
  (dashboard: New Service → same repo/Dockerfile → cron schedule → attach
  development/production env vars). The system is fully testable without it
  via the endpoint below.
- **Test/trigger endpoint:** `POST /admin/digests/run-test` (superadmin only)
  `{window_days: int = 7, only_me: bool = true}` — runs the same digest logic
  over the trailing window and sends (to just the caller by default),
  bypassing the run guard and never writing `digest_runs`. This is the
  "see a digest right now" button for develop testing.
- **Opt-out:** My Profile → Account gains a "Weekly digest email" toggle
  (checked by default) → `PATCH /profile/me` with the new `digest_opt_out`
  field (same null-rejecting validator pattern as `hide_from_team`).

## 5. Synthesis script (develop testing)

`backend/scripts/synthesize_test_events.py` — generates realistic test events
against a **running deployment** through its real HTTP API (so rate limits,
validation, emails, and badges are exercised end-to-end):

- Args: `--api-url` (required), `--admin-email`/`--admin-password` (or env
  `SYNTH_ADMIN_EMAIL`/`SYNTH_ADMIN_PASSWORD`), `--chapter <code>` (default
  `sf`), `--count N` (default 2 per category), `--include-member` (default
  on), `--contact-email <addr>` (the address used as the fake visitor so
  replies/notifications are observable).
- Creates, clearly marked as synthetic (names prefixed `[TEST]`):
  1. contact messages → public `POST /chapters/{code}/contact`
  2. hosting interest (one `host_existing` for the chapter, one
     `start_chapter`) → public `POST /hosting-interest`
  3. volunteer application → public apply endpoint against the first active
     role (creates a `[TEST]` role via admin API if none exists)
  4. community upload → public `POST /community/upload` (small generated
     text/audio stub within validation rules)
  5. new member → admin login → create invite → `POST /auth/register` a
     `[TEST]` user for the chapter
- Prints a summary of what was created and where to look (badge locations,
  `/contact-messages`, etc.), then reminds how to trigger a digest:
  `POST /admin/digests/run-test`.
- **Warning printed up front:** contact messages email the chapter's real
  leads immediately — run against develop, not production, unless that's
  intended.
- Cleanup: `--cleanup` flag deletes/deactivates the `[TEST]`-prefixed rows it
  created where delete endpoints exist, and marks the rest handled.

## Security

- Summary/list/patch endpoints follow existing RBAC helpers
  (`_require_lead_or_above`, `_chapter_filter`, own-chapter checks).
- `run-test` endpoint is superadmin-only; digest script sends only to
  platform users; all interpolated user content HTML-escaped.
- Synthesis script keeps credentials out of argv where possible (env vars),
  never stores them.

## Testing

- Backend pytest: summary counts per role (lead vs admin vs host), handled
  PATCH endpoints (RBAC, own-chapter, handled_by/at set), hosting-interest
  chapter resolution at insert + backfill, digest logic (recipient selection,
  opt-out respected, window math, skip-empty, run-guard idempotency,
  `only_me`) with mocked email transport; migration up/down.
- Frontend: build + lint; badge rendering logic kept simple enough to verify
  by review.
- Deploy verification: **probe the develop URLs directly** (Railway CLI is
  logged out): backend `/health`, then `GET /admin/notifications/summary`
  with a dev login, then run the synthesis script + `run-test` digest against
  develop as the acceptance pass.

## Out of scope

- In-app notification feed/inbox (statuses added here make it buildable later)
- Per-category notification preferences (single digest toggle only)
- Real-time push/websockets; immediate per-event emails beyond the existing
  contact forwarding
- Chapter scoping for community uploads (no reliable chapter data)
