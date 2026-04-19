# Volunteer & Host Page Simplification

**Date:** 2026-04-18  
**Status:** Approved

## Overview

Three areas of change: (1) simplify the individual volunteer role page hero, (2) improve the volunteer application form's professional links section, (3) several UX improvements to the `/host` page.

---

## 1. Volunteer Role Page — Hero Simplification

**File:** `frontend/src/app/(public)/volunteer/[slug]/page.tsx`

### Changes

- Remove `<div className="banner-image" />` from the hero `<section id="banner">`. This eliminates the large "ai salon" wordmark/network graphic currently displayed top-right.
- Center the role title (`h1`) only — add `textAlign: "center"` to the h1. The back link, gold bars, and badge row stay left-aligned.

---

## 2. Volunteer Application — Professional Links

**File:** `frontend/src/app/(public)/volunteer/[slug]/page.tsx`

### Changes

Replace the single optional LinkedIn URL field with three separate optional URL fields, all in the 2-column grid:

| Field | Type | State var | Submitted as |
|---|---|---|---|
| LinkedIn URL | `url` | `linkedinUrl` | `linkedin_url` |
| Resume URL | `url` | `resumeUrl` | `resume_url` |
| Personal Website | `url` | `websiteUrl` | `website_url` |

All three are optional. The existing `linkedin_url` key in the POST body remains; `resume_url` and `website_url` are added as new nullable fields. The backend currently ignores unknown fields in the JSON body, so no backend schema change is required for the form to submit — but a backend schema/model update should be noted as a follow-on if the fields need to be stored.

> **Note:** Check whether the backend `VolunteerApplication` schema and model need `resume_url` and `website_url` columns added, or whether the current schema accepts and stores extra fields. If not, add them.

---

## 3. Host Page — Four Changes

**File:** `frontend/src/app/(public)/host/page.tsx`

### 3a. City → Smart Chapter Messaging

The host page already fetches the chapters list on mount. When the city field has a value, do a client-side lookup: compare the city input (trimmed, case-insensitive) against chapter names. Show a hint line directly below the city field:

- **Match found:** *"Host with the [Chapter Name] chapter"* (shown in salon-blue)
- **No match:** *"Start the [City] chapter"* (shown in salon-muted)
- **Empty city:** no hint shown

No additional API call needed. The lookup runs as a derived value from `city` and `chapters` state.

### 3b. Themes Field — Expandable Textarea

Change the `themes_interested` field from a single-line `<input>` to a `<textarea>` (4 rows, `resize: "vertical"`). Add a hint line below the label:

> *"Share as many as you'd like — they don't need to be fully formed ideas."*

### 3c. Start a Chapter — Conditional Extra Fields

When `interestType === "start_chapter"`, render two additional textarea fields after the themes field:

**Field 1 — Leadership experience**
- Label: *"What's your experience organizing or leading groups?"*
- Hint: *"Could be anything from a book club to a professional meetup."*
- Required for `start_chapter`; textarea, 3 rows.
- State: `leadershipExperience`, submitted as `leadership_experience`.

**Field 2 — Support network**
- Label: *"Do you have people in mind who could help you get started?"*
- Hint: *"Co-hosts, a venue contact, or just enthusiastic friends — anything helps."*
- Optional; textarea, 3 rows.
- State: `supportNetwork`, submitted as `support_network`.

Both fields are hidden (and state cleared) when `interestType === "host_existing"`.

> **Note:** Same backend caveat as above — `leadership_experience` and `support_network` should be added to the `HostingInterest` schema/model if they need to be stored.

### 3d. Space to Host — Hint Text Update

Update the existing hint paragraph for the "Do you have a space to host?" section to append:

> *"…or local businesses like restaurants, bars, and cafés."*

Full updated hint:  
*"Having a space is the most important thing to make this easy. Hosts have used their own apartments, public spaces like libraries, co-working or social areas, or local businesses like restaurants, bars, and cafés."*

---

## Backend Notes

Two potential schema/model additions (low priority — verify if fields are stored or discarded):

1. `volunteer_applications` table: add `resume_url` (nullable string), `website_url` (nullable string)
2. `hosting_interest` table: add `leadership_experience` (nullable text), `support_network` (nullable text)

If the backend silently drops unknown fields, these can be deferred. If they need to be stored immediately, add Pydantic schema fields + Alembic migration.
