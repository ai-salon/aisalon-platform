# Community Upload Public Form — Design Spec

**Date:** 2026-04-18  
**Status:** Approved

## Overview

Add a public `/community_upload` page where anyone can submit an audio recording of an Ai Salon conversation. Submissions land in the existing admin review queue (pending → reviewed/rejected). Nothing auto-publishes. The page is linked from `/start` and from the print facilitation guide.

---

## Backend Changes

### 1. Model + Migration

Add two columns to `community_uploads`:

- `city` (VARCHAR, NOT NULL) — migration sets `DEFAULT ''` on existing rows, then drops the default
- `topic_text` (VARCHAR, NULLABLE) — freeform topic string for when no curated topics exist; `topic_id` FK remains nullable

At least one of `topic_id` or `topic_text` must be present; enforced at the API layer, not the DB.

### 2. Endpoint: `POST /community/upload`

**Rate limiting:** 5 uploads per hour per IP using `slowapi` (in-memory). Returns HTTP 429 on breach. No Redis required at current scale.

**Honeypot:** Accept an optional `website` form field. If non-empty, return a fake HTTP 200 success response (silent rejection — bots don't learn they're blocked).

**Required fields:** `city`, audio file, and either `topic_id` (UUID) or `topic_text` (freeform string). Return HTTP 422 if none of the topic fields are provided.

**Optional fields:** `name`, `email`, `notes`.

**File validation (existing, kept):** Magic bytes check for WAV, MP3, FLAC, OGG, M4A.

**Max file size:** Reduced from 500 MB → 150 MB.

**Response:** Minimal — just `id`, `status`, `created_at`. No file paths or internal details.

### 3. Schemas

- `CommunityUploadCreate`: add `city: str` (required); `topic_id: Optional[UUID]` stays optional; add `topic_text: Optional[str]`. Endpoint validates that at least one topic field is present.
- `CommunityUploadResponse`: add `city: str`, `topic_text: Optional[str]`

### 4. Admin UI

Add `city` and `topic_text` (shown when `topic_id` is null) to the upload card display in `/admin/community-uploads/page.tsx`.

---

## Frontend Changes

### 1. New page: `/community_upload`

**Route:** `frontend/src/app/(public)/community_upload/page.tsx`  
**Auth:** None — fully public  
**Style:** Matches site aesthetic (cream/blue tokens, no hero banner)

**Page header:**  
- Title: "Share a Recording"  
- Subtitle: "Record your Ai Salon conversation and contribute it to our community knowledge base."

**Form fields (in order):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Topic | Dropdown | Yes | Populated from `GET /topics`; fallback to freeform text if topics list is empty |
| City | Text | Yes | Freeform |
| Audio file | File picker | Yes | Accepts `.mp3 .wav .m4a .flac .ogg`; "Max 150 MB" note shown |
| Name | Text | No | |
| Email | Email | No | |
| Notes | Textarea | No | "Anything you'd like us to know about this recording" |
| `website` | Hidden (CSS `display:none`, not `type="hidden"`) | — | Honeypot — silently rejected server-side if filled |

**States:**
- **Default:** Form visible
- **Submitting:** Button shows "Uploading…" with spinner; form inputs disabled
- **Success:** Form replaced entirely with: "Thanks for contributing to the Ai Salon's broader community knowledge base!"
- **Error:** Inline error message below form: generic "Something went wrong — please try again" for 5xx; "Too many uploads — please try again later" for 429

### 2. Recording note on `/start` page

Add a brief section just above the footer CTA:

> "Want to capture what was said? Record your conversation and [submit it to our community archive →](/community_upload)"

Styled as a subdued inline note (muted text + blue link), not a separate CTA section.

### 3. Recording note on print guide (`/start/print`)

Add one line to the footer alongside the QR code:

> "Record your conversation? Submit it at aisalon.xyz/community_upload"

Small text (11px), same footer row as the existing QR code block.

---

## Security Model Summary

| Threat | Mitigation |
|--------|-----------|
| Spam bots | Honeypot field (silent rejection) |
| Automated flooding | 5/hour/IP rate limit via slowapi |
| Large file DoS | 150 MB hard cap |
| Malicious file disguised as audio | Magic bytes validation (existing) |
| Auto-publishing harmful content | Manual review queue — nothing goes live without human approval |
| Sensitive info in response | Response returns only id, status, created_at |

---

## Out of Scope

- Email confirmation to submitter
- City autocomplete / geocoding
- Automatic processing of community uploads (transcription pipeline)
- CAPTCHA (review queue makes it unnecessary)
- Per-chapter upload routing
