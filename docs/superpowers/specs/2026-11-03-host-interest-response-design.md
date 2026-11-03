# Host Interest Responses — Design

**Date:** 2026-11-03 · **Bean:** AiSalon-twml · **Status:** awaiting approval

## Intent

Chapter leads currently see hosting-interest inquiries on `/hosting-interest` with
only a bare `mailto:` link and a "Mark handled" toggle. Nothing records whether or
what anyone replied, and replying means leaving the platform. Ian wants leads to
send a response from the platform itself — personal in voice, carrying the
chapter's event link, answerable directly to the lead's own inbox — and wants
that response tracked. (Chosen in brainstorm as "option 2": platform-sent email
with Reply-To, over a mailto handoff, a pure auto-responder, or a hybrid.)

## Goals

- A chapter lead (or superadmin) can send a prefilled, editable email response to
  a hosting-interest inquiry without leaving `/hosting-interest`.
- Replies from the applicant land in the responding lead's personal inbox.
- The platform records who responded, when, and the exact text sent — visible on
  the inquiry.
- Sending a response clears the inquiry from the "new" badge count.

## Non-goals

- No automatic acknowledgment on form submission (option 3/4 from the brainstorm;
  possible later addition as a per-chapter toggle).
- No per-chapter saved/custom templates — the default template is code, edited
  per send.
- No change to the weekly digest.
- No chapter email aliases (e.g. berlin@aisalon.xyz) as senders.

## Anti-goals

- Must not appear to send *from* the lead's personal address (SPF/DKIM forgery).
  Resend only sends from the verified aisalon.xyz domain; the lead's address
  appears exclusively as Reply-To.
- Must not silently drop a response: if the email cannot be sent, nothing is
  recorded and the lead sees an error.

## Constraints

- Email goes through the existing `services/email.py` `send_email()` (Resend,
  fail-closed, already supports `reply_to`). From stays `settings.EMAIL_FROM`.
- RBAC must mirror the existing hosting-interest endpoints exactly: leads act
  only on `host_existing` inquiries of their own chapter (`_chapter_filter`),
  superadmins on everything including `start_chapter` (`_require_lead_or_above`).
- Backend red-green TDD; frontend `npm run build` + vitest; Alembic migration
  must be Postgres-safe (asyncpg type strictness).

## Decided design

### Data

New table `hosting_interest_responses` (model `HostingInterestResponse`,
UUID PK + `TimestampMixin` like every other model):

- `hosting_interest_id` → FK `hosting_interest.id`, indexed
- `sent_by` → FK `users.id`
- `sent_at` → tz-aware datetime
- `subject` → String(256)
- `body_text` → Text (the plain text as sent)
- `reply_to` → String(256) (snapshot of the lead's email at send time)

A table rather than columns on `HostingInterest` so multiple responses per
inquiry are possible and the history is ordered.

### Backend

`POST /admin/hosting-interest/{id}/respond` — body `{subject, message}` (plain
text). Flow:

1. `_require_lead_or_above` + the same chapter-scope 404 check as
   `patch_hosting_interest`.
2. Render minimal HTML from the plain text (escape, split paragraphs on blank
   lines, `<br>` within). Links left as plain URLs is acceptable; auto-linking
   is builder's choice.
3. `send_email(to=[inquiry.email], subject=…, html=…, reply_to=current_user.email)`.
   If it returns False → 503 `"Email is not configured or sending failed"`,
   nothing stored.
4. On success: insert `HostingInterestResponse`; if inquiry status is `new`,
   set `handled` + `handled_by`/`handled_at` to the sender (sending *is*
   handling — the badge clears). Status model stays binary new | handled.
5. Response payload: the updated inquiry including its responses, so the UI can
   refresh in place.

`GET /admin/hosting-interest` (and the PATCH response) gain a `responses` list
(sender name, sent_at, subject, body_text) on each item — same scoping as today.

### Default template (my call — editable before every send)

Prefill is computed client-side so the lead sees exactly what goes out.
For `host_existing` with a resolved chapter (fields: applicant `name`,
`Chapter.name`, `Chapter.event_link`, sender's `name`):

> **Subject:** Your interest in hosting with AI Salon {chapter}
>
> Hi {first name},
>
> Thanks for raising your hand to host with AI Salon {chapter}. The best next
> step is to come to an upcoming salon so we can meet: {event_link}
>
> Reply to this email and it will reach me directly — happy to answer any
> questions about what hosting involves.
>
> {sender name}
> AI Salon {chapter}

For `start_chapter` (superadmin-only, no chapter): same shape, but thanks them
for their interest in starting a chapter in {city}, no event link, signed
"{sender name} — AI Salon".

### Frontend (`/hosting-interest`)

In the expanded inquiry detail: a **Send response** button. It opens an inline
panel (not a route) with subject input + textarea, prefilled from the template,
plus Send / Cancel. Send calls the endpoint, shows a success/error toast,
collapses the editor, and the detail now shows a **Responses** section: one
entry per response — sender, date, subject, body. Inquiries with at least one
response show a small "responded" indicator in the list row. "Mark handled"
stays as-is for inquiries dealt with outside the platform.

## Left to the builder

- Exact HTML email styling (keep it plain; no template engine needed).
- Auto-linking URLs in the rendered email.
- Where the "responded" indicator sits in the row and its styling (use existing
  list conventions; salon-gold/salon-blue tokens).
- Schema/naming details of the Pydantic response models.
- Test specifics: backend endpoint tests must cover lead scoping (404 cross-
  chapter), auto-handling, fail-closed on unconfigured email (monkeypatch
  `send_email`), and response persistence; frontend tests cover prefill and
  send.

## My calls (flagging for Ian)

- From header stays the global `Ai Salon <noreply@aisalon.xyz>`; the lead's
  identity lives in the body signature and Reply-To. (Per-send From display
  names are a possible later nicety.)
- Sending a response auto-marks the inquiry handled.
- Template wording above.
- Response history is append-only; no editing or deleting sent responses.
