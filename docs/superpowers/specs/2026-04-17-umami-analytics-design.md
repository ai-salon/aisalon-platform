# Umami Analytics — Design Spec

**Date:** 2026-04-17
**Status:** Approved

## Goal

Track how visitors navigate the public-facing website (`aisalon.xyz`) — which pages they visit, which buttons they click, and how sessions flow — so that Claude can query the data directly and surface insights about user behavior.

## Infrastructure

Add two new services to the existing Railway project (alongside backend, frontend, and existing Postgres):

- **Umami service** — deployed from Railway's official Umami template (Docker image). Accessible at `analytics.aisalon.xyz`.
- **Umami Postgres** — a dedicated PostgreSQL database for Umami's data, separate from the platform's main DB.

After deployment:
1. Create one Umami admin account.
2. Add `aisalon.xyz` as a tracked website — Umami generates a `data-website-id` used in the tracking script.

## Tracking on the Public Site

### Page views (automatic)

Add Umami's script tag to `frontend/src/app/(public)/layout.tsx`:

```html
<script
  defer
  src="https://analytics.aisalon.xyz/script.js"
  data-website-id="<UMAMI_WEBSITE_ID>"
/>
```

All public route navigations are tracked automatically with no further code.

### Click events (declarative)

Add `data-umami-event="<descriptive name>"` attributes to key interactive elements across public pages. No JS handlers needed. Target elements include:

- "Join a Chapter" / "Find a Chapter" CTAs on the homepage
- Individual chapter cards on `/chapters`
- "Start a Chapter" / "Host an Event" CTAs on `/host`
- "Apply to Host" form submission on `/host/[code]`
- Article cards on `/insights`
- Navigation links in the public header/footer

For cases requiring richer metadata (e.g., which chapter was clicked), use the programmatic API:

```js
umami.track('chapter-card-click', { chapter: 'san-francisco' })
```

### Scope

Only the public routes (`(public)/` group) are instrumented. The admin area is excluded.

### Privacy

- No PII collected — no IP addresses stored (Umami anonymizes by default).
- A random session ID cookie is set per visitor, enabling journey reconstruction without identification.
- No cookie consent banner required (Umami is cookie-less by default in its tracking method; the session cookie is first-party and not used for cross-site tracking).

## Admin Area Integration

Add an **Analytics** entry to the admin sidebar (`SidebarNav.tsx`) that opens `analytics.aisalon.xyz` in a new tab. No iframe embedding — Umami's own dashboard is the view layer.

The sidebar link is visible to superadmins only (consistent with other platform-wide visibility controls).

## Claude Access

Umami's Postgres connection string is shared with Claude directly. The two key tables:

| Table | Contents |
|-------|----------|
| `website_event` | Every page view and click event: session ID, URL path, referrer, event name, browser, OS, country, timestamp |
| `session` | One row per session: device type, browser, OS, country, screen size |

Example queries Claude can answer:
- "What are the top 5 pages by unique visitors this month?"
- "What's the most common page before someone clicks 'Start a Chapter'?"
- "How many sessions visited more than 3 pages?"
- "What % of visitors come from mobile?"

## Out of Scope

- Heatmaps or session recordings
- Tracking logged-in admin users
- Embedding Umami UI inside the admin area (link is sufficient)
- Syncing Umami data into the main platform Postgres
