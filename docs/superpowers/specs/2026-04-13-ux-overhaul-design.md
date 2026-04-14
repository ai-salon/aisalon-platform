# UX Overhaul Design Spec

**Date:** 2026-04-13  
**Branch:** `feature/ux-overhaul` (off `develop`)  
**Approach:** Layer-by-layer on a single branch, TDD (red → green) + review agent at each layer boundary

---

## Problem Summary

A UX audit across three roles (superadmin, chapter_lead, host) identified systemic issues:

- No sidebar active state — users can't tell which page they're on
- No role/chapter identity shown anywhere — hosts don't know their role or chapter
- Dashboard is wrong for all roles — everyone sees the same generic hosting guide
- Hosts have no onboarding — must discover API keys → upload → articles workflow alone
- "Publish" button marks DB status only, publishes nothing — deeply misleading label
- Empty states are generic with no next-step guidance
- Form validation is entirely manual with no library, inconsistent across pages
- No toast system — inline-only errors, inconsistent feedback

---

## Scope

Four layers, delivered in order on one branch. Each layer is test-first (Vitest + RTL), reviewed by a QA agent before the next layer begins.

---

## Layer 1 — Infrastructure

### Testing (Vitest + React Testing Library)

**Files to create:**
- `vitest.config.ts` — jsdom environment, path aliases from `tsconfig.json`, setup file reference
- `src/test/setup.ts` — RTL `afterEach(cleanup)`, mock `next/navigation` module (`usePathname`, `useRouter`, `useSearchParams`), mock `next-auth/react` (`useSession`)
- `src/test/helpers.tsx` — `renderWithSession(ui, options)` helper:
  ```ts
  interface SessionOptions {
    role: 'superadmin' | 'chapter_lead' | 'host'
    chapterId?: string
    chapterCode?: string
    name?: string
    email?: string
  }
  ```
  Returns RTL `render` result with a mocked NextAuth session in context.

**Test convention:** test files live beside the component they test (`Foo.test.tsx` next to `Foo.tsx`).

**package.json scripts to add:**
```json
"test": "vitest",
"test:run": "vitest run",
"test:ui": "vitest --ui"
```

### Toast System (Sonner)

- Install `sonner`
- Add `<Toaster position="bottom-right" richColors />` to `src/app/layout.tsx`
- Create `src/lib/toast.ts`:
  ```ts
  export { toast } from 'sonner'
  ```
  Thin re-export — stable import path if we swap libraries later.

### Form Validation (Zod + React Hook Form)

- Install `zod`, `react-hook-form`, `@hookform/resolvers`
- No components created in this layer — installed and available for Layer 4.

### Tests for Layer 1

- `src/lib/toast.test.ts` — imports succeed, `toast.success` and `toast.error` are callable functions
- `src/test/helpers.test.tsx` — `renderWithSession` renders children, session values accessible via `useSession()`

---

## Layer 2 — Global Shell

### Sidebar Active State

**File:** `src/app/(admin)/layout.tsx`

- Import `usePathname` from `next/navigation` (layout is a server component — extract nav into a new `"use client"` component `AdminNav`)
- Active detection: `pathname.startsWith(item.href)` for all items — handles sub-routes (e.g. `/articles/[id]` correctly highlights the Articles nav item). Exception: `/` is not in the nav so no risk of over-matching.
- Active style: salon-blue background (`#56a1d2`), white text, slightly bolder weight — using existing CSS token `--color-salon-blue`

**New file:** `src/app/(admin)/AdminNav.tsx` (extracted client component)
- Receives `navItems`, `userRole`, `chapterId`, `userName` as props from the server layout
- Handles `usePathname()` internally

### Role/Chapter Badge

**In `AdminNav.tsx`**, above the nav items:

```
┌─────────────────────┐
│ HOST                │  ← role pill, muted salon-blue bg
│ SF Bay Area         │  ← chapter name, smaller grey text
└─────────────────────┘
```

- Role labels: `HOST` / `CHAPTER LEAD` / `ADMIN`
- Superadmin with no chapter scope: shows `ADMIN` + `All Chapters`
- Always visible, not dismissible

### Toast Integration

Replace inline save-state strings with `toast` calls in:
- `ArticleEditor.tsx` — save success/error, mark-as-done success
- `src/app/(admin)/settings/page.tsx` — API key save/remove success/error
- `src/app/(admin)/team/page.tsx` — add/delete member success/error
- `src/app/(admin)/users/page.tsx` — create/delete user success/error

Inline button loading states (`"Saving…"`) are kept — toasts supplement, not replace.

### Tests for Layer 2

**`src/app/(admin)/AdminNav.test.tsx`:**
- Active link has active class/style for current `pathname`
- Non-active links do not have active style
- Role badge renders `HOST` for host role, `CHAPTER LEAD` for chapter_lead, `ADMIN` for superadmin
- Chapter name renders when `chapterId` provided
- `All Chapters` renders for superadmin without chapter scope
- Host sees only: Dashboard, Upload, Articles, Settings
- Chapter lead sees community/social/team items
- Superadmin sees Users item

---

## Layer 3 — Dashboard + Onboarding

### OnboardingBanner Component

**File:** `src/components/OnboardingBanner.tsx` (`"use client"`)

**Props:**
```ts
interface OnboardingBannerProps {
  steps: OnboardingStep[]
  completedSteps: boolean[]
}

interface OnboardingStep {
  title: string
  description: string
  ctaLabel: string
  ctaHref: string
}
```

**Behavior:**
- Finds first incomplete step (`completedSteps.findIndex(v => !v)`)
- Renders that step's title, description, and CTA link
- Shows `Step N of M` progress indicator
- Returns `null` when all steps complete — banner disappears entirely
- No dismiss button — auto-resolves only

**Visual:** Full-width banner, salon-blue left border, light background. Step counter in muted text. CTA as a salon-blue button linking to `ctaHref`.

### Step Definitions

**Host steps** (3 total):
| # | Title | Description | CTA | Condition |
|---|---|---|---|---|
| 1 | Add your API keys | You need AssemblyAI and Google AI keys to process conversations | Go to Settings | `hasAssemblyAiKey === true` |
| 2 | Upload your first conversation | Record or import an audio file from your last Ai Salon event | Upload now | `jobCount > 0` |
| 3 | Review your generated article | Your conversation has been transcribed and turned into a draft article | View articles | `articleCount > 0` |

**Chapter lead steps** (4 total):
| # | Title | Description | CTA | Condition |
|---|---|---|---|---|
| 1 | Add your API keys | You need AssemblyAI and Google AI keys to process conversations | Go to Settings | `hasAssemblyAiKey === true` |
| 2 | Upload your first conversation | Record or import audio from your last event | Upload now | `jobCount > 0` |
| 3 | Complete your chapter profile | Add a tagline and description so members can find you | Edit profile | `chapter.tagline && chapter.description` |
| 4 | Add your team | Add co-founders and team members to your chapter page | Manage team | `teamCount > 0` |

**Superadmin:** No onboarding banner — not needed.

### Role-Specific Dashboard Content

**Host dashboard:**
- `OnboardingBanner` (if incomplete)
- Upload CTA card (prominent, always visible)
- Recent jobs widget: last 3 jobs with filename, date, status badge — empty state: "No conversations uploaded yet"

**Chapter lead dashboard:**
- `OnboardingBanner` (if incomplete)  
- Stats row: Articles Published · Drafts · Team Members (3 stat cards)
- Recent articles list: last 3 articles with title, status, date — links to editor
- Upload CTA card

**Superadmin dashboard:**
- Platform health row: Total Chapters · Total Users · Jobs (last 7 days)
- All chapters list with article counts and team sizes
- No onboarding banner

### Data Fetching

Dashboard page (server component) fetches in `Promise.all`:
- API key status (`GET /admin/api-keys`)
- Job count for user's chapter
- Article count for user's chapter  
- Team member count
- Chapter completeness (tagline + description non-empty)

Passes all as props to client components — no client-side fetching for banner.

### Tests for Layer 3

**`src/components/OnboardingBanner.test.tsx`:**
- Shows step 1 when no steps complete
- Shows step 2 when step 1 complete
- Returns null when all steps complete
- CTA links to correct `ctaHref`
- Step counter shows correct `N of M`

**`src/app/(admin)/dashboard/HostDashboard.test.tsx`:**
- Renders banner with correct host steps
- Renders upload CTA
- Renders recent jobs (or empty state when none)

**`src/app/(admin)/dashboard/ChapterLeadDashboard.test.tsx`:**
- Renders banner with correct chapter lead steps
- Renders stat cards with correct values
- Renders recent articles list

**`src/app/(admin)/dashboard/SuperadminDashboard.test.tsx`:**
- No banner rendered
- Platform health stats present
- Chapter list present

---

## Layer 4 — Page-Level Fixes

### Publish Semantics

**File:** `src/app/(admin)/articles/[id]/ArticleEditor.tsx`

- Rename "Publish" button → **"Mark as Done"**
- Add helper text below button: *"Marks this article as finished. To share externally, publish to Substack using the button below."*
- Update Substack URL field placeholder: *"After publishing on Substack, paste the URL here to enable social sharing"*
- No logic changes — only labels and copy

### Empty States

Updated copy with actionable CTAs (using Next.js `Link` for linked CTAs):

| Location | Component/File | New copy |
|---|---|---|
| Upload — no jobs | `upload/page.tsx` | "No conversations uploaded yet. Select an audio file above to get started — transcription takes ~5 minutes." |
| Articles — no articles | `articles/page.tsx` | "No articles yet." + `[Upload a conversation →]` link to `/upload` |
| Articles — no transcripts | `articles/page.tsx` | "Transcripts appear here after a conversation is processed." + `[Go to Upload →]` link |
| Community — no data | `community/page.tsx` | "No community data yet. Stats appear once you've published articles and built your team." |

### Form Validation (Zod + React Hook Form)

**Targeted to forms with real user impact:**

**Settings — API key inputs** (`settings/page.tsx`):
- Schema: `z.string().min(10, "Key seems too short — check you copied it completely")`
- Error shown inline below input before submit

**Article editor — title** (`ArticleEditor.tsx`):
- Schema: `z.string().min(1, "Title is required")`
- Error shown on save attempt if empty

**Team member form** (`team/page.tsx`):
- Schema: name required, email `z.string().email("Enter a valid email address")`, role required
- Inline field errors

**User creation form** (`users/page.tsx`):
- Schema: email format, password `z.string().min(8, "Password must be at least 8 characters")`, role required, chapter required for non-superadmin roles
- Inline field errors

**Other forms** (chapter edit, topics): add `required` attributes and `*` markers — full RHF migration disproportionate for simple 2-field forms.

### Tests for Layer 4

**`src/app/(admin)/articles/[id]/ArticleEditor.test.tsx`:**
- "Mark as Done" label present (not "Publish")
- Helper text present
- Substack URL placeholder updated
- Save blocked when title empty, error message shown

**`src/app/(admin)/settings/settings.test.tsx`:**
- Short API key (< 10 chars) shows validation error
- Empty submit blocked

**`src/app/(admin)/team/TeamForm.test.tsx`:**
- Invalid email shows error
- Missing name shows error

**`src/app/(admin)/users/UserForm.test.tsx`:**
- Password < 8 chars shows error
- Missing role shows error

---

## Agent Structure

Each layer runs with this agent pattern:

1. **Implementation agent** — writes failing tests first, then implements until green
2. **QA/review agent** — reads all changes in the layer, checks tests pass, flags issues before layer N+1 begins

The review agent checks:
- All tests in the layer pass (`vitest run`)
- No TypeScript errors (`tsc --noEmit`)  
- No ESLint errors (`eslint src/`)
- Implementation matches this spec
- No regressions in adjacent code

---

## Non-Goals

- Responsive/mobile layout fixes (separate effort)
- Playwright e2e tests (layer this in later)
- Accessibility audit (separate effort)
- Substack auto-publish automation
- shadcn/ui or component library migration
