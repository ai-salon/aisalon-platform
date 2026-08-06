# Profiles, Contact-a-Chapter, and Meaningful Chapter Editing — Design

**Date:** 2026-08-05
**Status:** Approved (brainstormed interactively; mocks reviewed in visual companion)
**Tracking:** bean `AiSalon-nppz`

## Overview

Three user-facing gaps, one spec:

1. Members can't edit their own profile after onboarding (photo, bio, password, email).
2. Visitors have no way to contact a chapter; there is no email-sending capability at all.
3. Chapter leads can edit their chapter, but blind — no preview — and one field
   (`description`) is editable yet rendered nowhere on the public site.

This spec adds a thin transactional-email foundation (Resend), a self-serve
`/profile` page with verified email change, a public contact-a-chapter form that
forwards to chapter leads, and a chapter editor with a live preview that renders
the real public page component.

**Chosen approach:** "Thin email helper" — one `send_email()` function, no
outbox/queue machinery. Provider-swappable by design (~30 lines to replace).

## Out of scope (future specs)

- Per-chapter newsletters / owned email lists (will reuse the email foundation)
- Events platform integration (Luma/Eventbrite — separate paused brainstorm)
- Multi-source article generation in the platform UI
- Member curation of the chapter people section
- Admin inbox UI for contact messages (messages reach leads' email; rows are in DB)

## 1. Email foundation

New `backend/app/services/email.py`:

```python
async def send_email(
    to: list[str], subject: str, html: str, reply_to: str | None = None
) -> bool
```

- Calls Resend `POST https://api.resend.com/emails` via `httpx`.
- Settings: `RESEND_API_KEY` (secret), `EMAIL_FROM` (e.g. `Ai Salon <noreply@aisalon.xyz>`).
- **Fail-closed:** unset key ⇒ send refused, structlog warning, callers surface
  "email not configured". Never raises into request handlers; returns bool.
- Sends run in FastAPI `BackgroundTasks` so requests don't block.
- Failures logged (structlog + Sentry). No retry queue — the contact-message DB
  row is the safety net for the one flow where loss would matter.
- Tests mock the HTTP transport; CI never sends real email.

**One-time human setup (implementation prerequisite for live sends, not for code):**
Resend free account (3,000/mo, 100/day cap) → API key into Railway env →
two DNS records (DKIM/SPF) for `aisalon.xyz` in Cloudflare.

## 2. My Profile page + verified email change

### Page

`/profile` in the `(admin)` route group, all roles, sidebar entry "My Profile".
The one-time `/profile/complete` onboarding flow is untouched. Three cards:

1. **Photo** — reuses `POST /profile/photo` + existing uploader component.
2. **Public info** — name, title, LinkedIn, bio (description), scheduling URL,
   `hide_from_team` toggle. Saved via new `PATCH /profile/me`. Card carries the
   hint "This is how you appear on aisalon.xyz".
3. **Account** — email change (below) + the change-password form **moved here
   from Settings** (Settings keeps system/app config only).

### Verified email change flow

- `POST /profile/email-change` `{new_email, current_password}` — password
  required to initiate (a hijacked session must not silently steal the account).
  Validates format, uniqueness, and difference from current email. Rate-limited
  like auth endpoints.
- User row gains `pending_email`, `email_change_token_hash` (SHA-256 of a
  single-use random token), `email_change_expires_at` (24 h).
- Verification email goes to the **new** address with link
  `{FRONTEND_URL}/verify-email?token=…`.
- New public page `/verify-email` calls `POST /auth/verify-email-change`
  `{token}`: hash-match + expiry check ⇒ swap email, clear pending fields,
  send courtesy notice to the **old** address. Token is single-use (cleared on
  success). Expired/invalid ⇒ clear error, resend available from `/profile`.
- Login stays on the old email until verified. Sessions survive the swap (JWT
  subject is the user id). Duplicate-email race re-checked at verify time.
- `/profile` shows pending state: "Verification sent to X — Resend · Cancel".
- If email is unconfigured, the form reports email change unavailable; it never
  swaps unverified.

## 3. Contact a chapter

- Public chapter page gets an **inline "Get in Touch" section** at the bottom
  (approved mock: gold `CONTACT` label, section title + gold underbar, cream
  background) with name (optional), email (required), message (required,
  10–5000 chars).
- New public endpoint `POST /chapters/{identifier}/contact` (no auth):
  - Honeypot hidden field (silent accept-and-drop on fill).
  - Per-IP rate limit consistent with existing auth-endpoint pattern.
  - Stores a `contact_messages` row **first**, then emails via `BackgroundTasks`.
- Recipients: all active `chapter_lead` users of the chapter; **fallback** to all
  active superadmins if the chapter has none. `Reply-To` = visitor's email;
  subject `[Ai Salon] New message for {chapter} from {name or email}`.
- Send failure ⇒ row survives, `forwarded_at` stays NULL, warning logged.
- Visitor sees inline confirmation: "Message sent — the chapter leads will get
  back to you."

## 4. Meaningful chapter editing + live preview

- Extract the public chapter page rendering into a shared `ChapterView`
  component (`frontend/src/components/ChapterView.tsx`) taking chapter +
  members + articles props. The public route renders it with fetched data; the
  editor renders it with draft state — the preview is the real page by
  construction and cannot drift.
- `/chapters/edit/[code]` becomes **side-by-side** (approved mock): form left,
  live preview right, debounced updates as the lead types, before saving.
  Collapses to Edit/Preview tabs on narrow screens.
- Every field gets a "where this appears" hint (e.g. "Tagline — appears under
  the page title"). `description` is labeled "Card blurb — homepage chapter card".
- Lead dashboard gains a visible "Edit chapter page" link (existing scoped
  access: lead-or-above + own-chapter check on `PATCH /chapters/{identifier}`).
- **Field audit fixes:**
  - `description` becomes the homepage chapter-card blurb and the chapter
    page's SEO meta description (previously rendered nowhere).
  - `about_blocks` / `events_blocks` columns dropped after confirming nothing
    reads them (grep backend schemas + frontend).

## Data model changes (one combined Alembic migration)

| Table | Change |
|---|---|
| `users` | + `pending_email` (nullable str), `email_change_token_hash` (nullable str), `email_change_expires_at` (nullable tz datetime) |
| `contact_messages` (new) | id (uuid pk), `chapter_id` FK, `name` (nullable), `email`, `message` (text), `forwarded_at` (nullable tz datetime), timestamps |
| `chapters` | drop `about_blocks`, `events_blocks` |

Migration note (per repo guidance): pass real `datetime` objects in raw SQL —
asyncpg rejects ISO strings for `timestamptz`.

## Security

- Fail-closed email config (SECURITY.md), no secrets in code.
- Email change: current-password gate, hashed single-use token, 24 h expiry,
  rate-limited initiation, courtesy notification to old address.
- Contact endpoint: honeypot + per-IP rate limit, message length caps, no CAPTCHA
  unless abuse appears.
- No new PII beyond contact submissions (name/email/message, purpose-bound).

## Testing

- **Backend (pytest, in-memory SQLite):** email helper (mocked transport,
  fail-closed path); email-change lifecycle (initiate wrong-password / duplicate
  / happy path, verify expired / reused / race, courtesy notice); contact
  endpoint (validation, honeypot, rate limit, lead routing, no-lead fallback,
  row-survives-send-failure).
- **Frontend:** `npm run build` + ESLint (repo standard); ChapterView refactor
  verified by the public page rendering unchanged.

## Rollout

Feature branch `feature/profiles-contact-chapter` → tests green → merge
`develop` → push → verify Railway deploy per repo guidance. Email features are
inert (fail-closed, clear "not configured" messaging) until `RESEND_API_KEY` +
`EMAIL_FROM` land in Railway and DNS records are set.
