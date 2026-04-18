# Umami Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate self-hosted Umami analytics to track public website page views and click events, with the dashboard accessible from the admin sidebar and the raw data queryable by Claude via Umami's Postgres.

**Architecture:** Umami runs as a new Railway service with its own dedicated Postgres database (alongside existing services in the same project). A Next.js `<Script>` tag in the public layout auto-tracks page views. Key CTAs get `data-umami-event` attributes for declarative click tracking; the host interest form uses the programmatic `umami.track()` API. The admin sidebar gains an Analytics external link visible to superadmins.

**Tech Stack:** Umami (official Docker image via Railway template), Railway, Next.js `next/script`, `data-umami-event` HTML attributes, `window.umami.track()` JS API.

---

## Pre-work: Prerequisite reading

Before starting any task, read:
- `aisalon-platform/frontend/src/app/(public)/layout.tsx` — where the script tag goes
- `aisalon-platform/frontend/src/app/(admin)/SidebarNav.tsx` — where the Analytics link goes

---

## Task 1: Deploy Umami to Railway

**Files:** No code changes — manual Railway setup only.

- [ ] **Step 1: Add Umami template to your Railway project**

  Go to your Railway project dashboard → click **+ New** → **Template** → search for **Umami**. Railway's template sets up the Umami service + a linked Postgres database automatically.

  Accept the default settings. Railway will:
  - Create a `Umami` service (Docker image: `ghcr.io/umami-software/umami:postgresql-latest`)
  - Create a new Postgres database service called `Umami Database`
  - Wire `DATABASE_URL` from the new Postgres into Umami automatically

- [ ] **Step 2: Set the Umami secret**

  In the Umami service's Variables tab, set:
  ```
  APP_SECRET=<any long random string, e.g. output of: openssl rand -hex 32>
  ```

- [ ] **Step 3: Add a custom domain**

  In the Umami service → Settings → Networking, add the domain:
  ```
  analytics.aisalon.xyz
  ```
  Then add a CNAME record in Cloudflare pointing `analytics` → the Railway-generated domain (shown in the Networking tab). Set the Cloudflare proxy to **DNS only** (grey cloud) initially so Railway can provision the TLS cert.

- [ ] **Step 4: Deploy and open Umami**

  Wait for the deploy to finish, then open `https://analytics.aisalon.xyz`. The default credentials are:
  - Username: `admin`
  - Password: `umami`

  **Immediately change the password** in Settings → Profile.

- [ ] **Step 5: Add your website to Umami**

  In Umami → Settings → Websites → **Add website**:
  - Name: `Ai Salon`
  - Domain: `aisalon.xyz`

  After saving, click the website → **Edit** → copy the **Website ID** (a UUID). You'll need this in Task 2.

- [ ] **Step 6: Note the Umami Postgres connection string**

  In Railway, go to the Umami Database service → Variables → copy `DATABASE_URL`. This is what you'll give Claude for direct SQL queries. Store it somewhere safe (1Password, etc.). Do not commit it to the repo.

---

## Task 2: Configure environment variables

**Files:**
- Modify: `aisalon-platform/frontend/.env.local`
- Railway frontend service Variables tab (no file)

- [ ] **Step 1: Add vars to local `.env.local`**

  Open `aisalon-platform/frontend/.env.local` and append:
  ```
  NEXT_PUBLIC_UMAMI_URL=https://analytics.aisalon.xyz
  NEXT_PUBLIC_UMAMI_WEBSITE_ID=<the UUID from Task 1 Step 5>
  ```

- [ ] **Step 2: Add vars to Railway frontend service**

  In Railway → your frontend service → Variables, add the same two variables with the same values.

- [ ] **Step 3: Verify env vars are set locally**

  ```bash
  cd aisalon-platform/frontend
  grep UMAMI .env.local
  ```
  Expected output (values will differ):
  ```
  NEXT_PUBLIC_UMAMI_URL=https://analytics.aisalon.xyz
  NEXT_PUBLIC_UMAMI_WEBSITE_ID=abc12345-...
  ```

---

## Task 3: Add Umami type declaration

**Files:**
- Create: `aisalon-platform/frontend/src/types/umami.d.ts`

This prevents TypeScript errors when calling `window.umami?.track()` in later tasks.

- [ ] **Step 1: Create the type declaration file**

  Create `aisalon-platform/frontend/src/types/umami.d.ts`:
  ```ts
  declare global {
    interface Window {
      umami?: {
        track: (
          eventName: string,
          eventData?: Record<string, string | number | boolean>
        ) => void
      }
    }
  }

  export {}
  ```

- [ ] **Step 2: Verify TypeScript accepts it**

  ```bash
  cd aisalon-platform/frontend
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/types/umami.d.ts
  git commit -m "feat: add Umami window type declaration"
  ```

---

## Task 4: Add Umami tracking script to public layout

**Files:**
- Modify: `aisalon-platform/frontend/src/app/(public)/layout.tsx`

The public layout wraps all routes in the `(public)/` group. Adding the script here means every public page is tracked automatically.

- [ ] **Step 1: Add the Script import and tag**

  Open `aisalon-platform/frontend/src/app/(public)/layout.tsx`. Add the Script import at the top and a Script element inside the return. The full updated file:

  ```tsx
  import Script from 'next/script'

  export default function PublicLayout({ children }: { children: React.ReactNode }) {
    return (
      <>
        {process.env.NEXT_PUBLIC_UMAMI_URL && process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <Script
            src={`${process.env.NEXT_PUBLIC_UMAMI_URL}/script.js`}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
            strategy="afterInteractive"
          />
        )}
        {children}
        <footer className="footer-public" id="public-footer">
          {/* rest of footer unchanged */}
  ```

  The conditional guard silently omits the script if env vars are missing — no console errors in local dev without them set.

- [ ] **Step 2: Verify the build passes**

  ```bash
  cd aisalon-platform/frontend
  npm run build
  ```
  Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/\(public\)/layout.tsx
  git commit -m "feat: add Umami analytics script to public layout"
  ```

---

## Task 5: Add click tracking to homepage CTAs

**Files:**
- Modify: `aisalon-platform/frontend/src/app/(public)/page.tsx`

The homepage is a `'use client'` component. Add `data-umami-event` attributes to static CTAs and `onClick` handlers to dynamic elements (chapter cards).

- [ ] **Step 1: Add attributes to hero CTAs**

  Find the hero section buttons (around line 119–135). Update both anchor tags:

  ```tsx
  <a
    href="https://lu.ma/Ai-salon"
    target="_blank"
    rel="noopener noreferrer"
    className="btn btn-outline"
    data-umami-event="hero-join-event"
  >
    JOIN AN EVENT
  </a>
  <a
    href="https://aisalon.substack.com"
    target="_blank"
    rel="noopener noreferrer"
    className="btn btn-outline"
    data-umami-event="hero-explore-insights"
  >
    EXPLORE OUR INSIGHTS
  </a>
  ```

- [ ] **Step 2: Add attributes to chapters section CTAs**

  Find the two "Start a Chapter" / "Become a Host" links (around line 235–241):

  ```tsx
  <Link href="/host" className="chapter-button" data-umami-event="chapters-start-chapter">
    <i className="fa fa-plus-circle" aria-hidden="true" /> Start a Chapter
  </Link>
  <Link href="/host" className="chapter-button" data-umami-event="chapters-become-host">
    <i className="fa fa-plus-circle" aria-hidden="true" /> Become a Host in an Existing Chapter
  </Link>
  ```

- [ ] **Step 3: Add programmatic tracking to chapter cards**

  Chapter cards are rendered from `chapters` state, so use `onClick` to include the chapter code as event data. Find the chapter card Link (around line 259–266):

  ```tsx
  {chapters.map((ch) => (
    <Link
      key={ch.id}
      href={`/chapters/${ch.code}`}
      className="chapter-card"
      onClick={() => window.umami?.track('chapter-card-click', { chapter: ch.code })}
    >
      <i className="fa fa-map-marker" aria-hidden="true" />
      <span>{ch.name}</span>
    </Link>
  ))}
  ```

- [ ] **Step 4: Add attribute to "View All Events" button**

  Find the events section CTA (around line 343–350):

  ```tsx
  <a
    href="https://lu.ma/Ai-salon"
    target="_blank"
    rel="noopener noreferrer"
    className="btn-primary"
    style={{ display: "inline-block" }}
    data-umami-event="events-view-all"
  >
    View All Events
  </a>
  ```

- [ ] **Step 5: Add attributes to newsletter CTAs**

  Find the Subscribe button (around line 373–381):

  ```tsx
  <a
    href="https://aisalon.substack.com/subscribe"
    target="_blank"
    rel="noopener noreferrer"
    className="btn-primary"
    style={{ display: "inline-block" }}
    data-umami-event="newsletter-subscribe"
  >
    SUBSCRIBE
  </a>
  ```

  And the "Read on Substack" link (around line 406–412):

  ```tsx
  <a
    href="https://aisalon.substack.com"
    target="_blank"
    rel="noopener noreferrer"
    className="btn-primary"
    style={{ display: "inline-block" }}
    data-umami-event="newsletter-read-substack"
  >
    Read on Substack
  </a>
  ```

- [ ] **Step 6: Verify build passes**

  ```bash
  cd aisalon-platform/frontend
  npm run build
  ```
  Expected: build succeeds.

- [ ] **Step 7: Commit**

  ```bash
  git add src/app/\(public\)/page.tsx
  git commit -m "feat: add Umami click tracking to homepage CTAs"
  ```

---

## Task 6: Add click tracking to /insights page

**Files:**
- Modify: `aisalon-platform/frontend/src/app/(public)/insights/page.tsx`

This is a **server component** (no `'use client'`). Use declarative `data-umami-event` and `data-umami-event-*` attributes — Umami's script picks them up automatically in the browser.

- [ ] **Step 1: Add tracking to article cards**

  Find the article card `<a>` tag (around line 74). Add the event name and article title as event data:

  ```tsx
  <a
    key={a.id}
    href={a.substack_url ?? "#"}
    target="_blank"
    rel="noopener noreferrer"
    style={{ textDecoration: "none" }}
    data-umami-event="article-card-click"
    data-umami-event-title={a.title}
  >
  ```

  This records `article-card-click` with `{ title: "<article title>" }` as the payload, letting you see which articles get the most clicks.

- [ ] **Step 2: Add tracking to the Substack fallback CTA**

  Find the empty-state anchor (around line 61):

  ```tsx
  <a
    href="https://aisalon.substack.com"
    target="_blank"
    rel="noopener noreferrer"
    className="btn-primary"
    style={{ display: "inline-block" }}
    data-umami-event="insights-visit-archive"
  >
    Visit The Ai Salon Archive
  </a>
  ```

- [ ] **Step 3: Verify build passes**

  ```bash
  cd aisalon-platform/frontend
  npm run build
  ```
  Expected: build succeeds.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/\(public\)/insights/page.tsx
  git commit -m "feat: add Umami click tracking to /insights page"
  ```

---

## Task 7: Add click tracking to /host page

**Files:**
- Modify: `aisalon-platform/frontend/src/app/(public)/host/page.tsx`

Track the interest-type toggle buttons and successful form submission.

- [ ] **Step 1: Add attributes to interest type toggle buttons**

  Find the toggle buttons (around line 186–215). The two buttons are rendered via `.map()`. Add an `event` key to each object and use it as `data-umami-event`:

  ```tsx
  {[
    { value: "start_chapter", label: "Start a Chapter", icon: "fa-plus-circle", event: "host-toggle-start-chapter" },
    { value: "host_existing", label: "Host in an Existing Chapter", icon: "fa-users", event: "host-toggle-host-existing" },
  ].map(({ value, label, icon, event }) => {
    const active = interestType === value;
    return (
      <button
        key={value}
        type="button"
        onClick={() => setInterestType(value as any)}
        data-umami-event={event}
        style={{
          flex: "1 1 200px",
          padding: "14px 20px",
          borderRadius: 8,
          border: `2px solid ${active ? "#56a1d2" : "#e1e1e1"}`,
          background: active ? "#eff6ff" : "#fff",
          color: active ? "#1d4ed8" : "#696969",
          fontWeight: 600,
          fontSize: 14,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "inherit",
          transition: "all 0.2s",
        }}
      >
        <i className={`fa ${icon}`} />
        {label}
      </button>
    );
  })}
  ```

- [ ] **Step 2: Track successful form submission**

  Find `setSubmitted(true)` inside the try block of `handleSubmit` (around line 103). Add the tracking call immediately after it:

  ```tsx
  setSubmitted(true);
  window.umami?.track('host-interest-submitted', { type: interestType });
  ```

- [ ] **Step 3: Verify build passes**

  ```bash
  cd aisalon-platform/frontend
  npm run build
  ```
  Expected: build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/\(public\)/host/page.tsx
  git commit -m "feat: add Umami click tracking to /host page"
  ```

---

## Task 8: Add Analytics link to admin sidebar

**Files:**
- Modify: `aisalon-platform/frontend/src/app/(admin)/SidebarNav.tsx`

Add a "Web Analytics" entry to the Admin nav group that opens Umami in a new tab. Extend `NavItem` with an optional `external` flag so the group renderer can emit an `<a>` instead of a `<Link>`.

- [ ] **Step 1: Extend the NavItem type**

  Find the `NavItem` interface at the top of `SidebarNav.tsx` (around line 9). Add `external`:

  ```tsx
  interface NavItem {
    href: string
    label: string
    icon: string
    external?: boolean
  }
  ```

- [ ] **Step 2: Add Web Analytics to adminChildren**

  Find `adminChildren` in `buildNav` (around line 47). Append the new entry:

  ```tsx
  const adminChildren: NavItem[] = [
    { href: '/community', label: 'Community Analytics', icon: 'fa-bar-chart' },
    { href: '/users', label: 'Users', icon: 'fa-user-circle-o' },
    { href: '/community-uploads', label: 'Community Uploads', icon: 'fa-cloud-upload' },
    {
      href: process.env.NEXT_PUBLIC_UMAMI_URL ?? 'https://analytics.aisalon.xyz',
      label: 'Web Analytics',
      icon: 'fa-line-chart',
      external: true,
    },
  ]
  ```

- [ ] **Step 3: Update NavGroupItem to render external links as `<a>`**

  Find the `.map()` inside `NavGroupItem` that renders child links (around line 108). Replace it with a version that branches on `external`:

  ```tsx
  {items.map(({ href, label: childLabel, icon: childIcon, external }) => {
    const isActive = !external && (pathname === href || pathname.startsWith(href))
    const sharedStyle = {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 14px',
      borderRadius: 6,
      fontSize: 13,
      fontWeight: isActive ? 600 : 400,
      color: isActive ? '#fff' : '#555',
      background: isActive ? '#56a1d2' : 'transparent',
      textDecoration: 'none',
      transition: 'background 0.15s',
    }
    const iconStyle = {
      width: 14,
      textAlign: 'center' as const,
      color: isActive ? '#fff' : '#56a1d2',
      fontSize: 12,
    }

    if (external) {
      return (
        <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={sharedStyle}>
          <i className={`fa ${childIcon}`} style={iconStyle} aria-hidden="true" />
          {childLabel}
          <i className="fa fa-external-link" style={{ fontSize: 10, marginLeft: 'auto', color: '#9ca3af' }} aria-hidden="true" />
        </a>
      )
    }

    return (
      <Link key={href} href={href} style={sharedStyle}>
        <i className={`fa ${childIcon}`} style={iconStyle} aria-hidden="true" />
        {childLabel}
      </Link>
    )
  })}
  ```

- [ ] **Step 4: Verify build passes**

  ```bash
  cd aisalon-platform/frontend
  npm run build
  ```
  Expected: build succeeds.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/\(admin\)/SidebarNav.tsx
  git commit -m "feat: add Web Analytics link to admin sidebar"
  ```

---

## Task 9: Deploy and verify

- [ ] **Step 1: Merge to develop and push**

  ```bash
  git checkout develop
  git merge --no-ff feature/umami-analytics
  git push origin develop
  ```

- [ ] **Step 2: Verify Railway deploy succeeds**

  In Railway → Deployments, confirm the frontend service deploys green. Check deploy logs for any build errors.

- [ ] **Step 3: Verify page view tracking**

  Open `https://aisalon.xyz` in an incognito window. Navigate to a few pages (`/`, `/insights`, `/host`). Then open `https://analytics.aisalon.xyz` → Realtime view and confirm page views appear with the correct URLs.

- [ ] **Step 4: Verify click event tracking**

  Still in the incognito window:
  - Click "JOIN AN EVENT" on the homepage
  - Click "Start a Chapter" on the homepage
  - Submit the host interest form on `/host`

  In Umami → your website → Events, confirm these appear:
  - `hero-join-event`
  - `chapters-start-chapter`
  - `host-interest-submitted` with property `type: start_chapter`

- [ ] **Step 5: Verify admin sidebar link**

  Log in to `https://admin.aisalon.xyz` as a superadmin. Confirm the **Admin** group in the sidebar shows **Web Analytics** with an external-link icon. Clicking it opens `https://analytics.aisalon.xyz` in a new tab.

- [ ] **Step 6: Delete feature branch**

  ```bash
  git branch -d feature/umami-analytics
  git push origin --delete feature/umami-analytics
  ```
