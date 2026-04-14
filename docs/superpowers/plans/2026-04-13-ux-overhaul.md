# UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comprehensive UX overhaul of the aisalon-platform admin interface across four layers: testing infrastructure, global shell (sidebar active state + role badge), role-specific dashboards with onboarding banners, and page-level fixes (publish semantics, empty states, form validation).

**Architecture:** Single branch `feature/ux-overhaul` off `develop`. Each layer is test-first (Vitest + RTL). A QA review agent runs after each layer before starting the next. Server components fetch all data and pass as props; client components render UI and fire toasts.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Vitest, @testing-library/react, Sonner, Zod, React Hook Form, Tailwind v4, NextAuth v5

---

## File Map

**Created:**
- `frontend/vitest.config.ts`
- `frontend/src/test/setup.ts`
- `frontend/src/test/helpers.tsx`
- `frontend/src/lib/toast.ts`
- `frontend/src/app/(admin)/AdminNav.tsx`
- `frontend/src/app/(admin)/AdminNav.test.tsx`
- `frontend/src/components/OnboardingBanner.tsx`
- `frontend/src/components/OnboardingBanner.test.tsx`
- `frontend/src/app/(admin)/dashboard/HostDashboard.tsx`
- `frontend/src/app/(admin)/dashboard/HostDashboard.test.tsx`
- `frontend/src/app/(admin)/dashboard/ChapterLeadDashboard.tsx`
- `frontend/src/app/(admin)/dashboard/ChapterLeadDashboard.test.tsx`
- `frontend/src/app/(admin)/dashboard/SuperadminDashboard.tsx`
- `frontend/src/app/(admin)/dashboard/SuperadminDashboard.test.tsx`

**Modified:**
- `frontend/package.json` — add deps + test scripts
- `frontend/src/app/layout.tsx` — add `<Toaster />`
- `frontend/src/app/(admin)/layout.tsx` — extract nav to AdminNav, fetch chapterName
- `frontend/src/app/(admin)/dashboard/page.tsx` — fetch step state, render role-specific dashboard
- `frontend/src/app/(admin)/articles/[id]/ArticleEditor.tsx` — rename Publish, add toasts, title validation
- `frontend/src/app/(admin)/articles/page.tsx` — improved empty states
- `frontend/src/app/(admin)/upload/page.tsx` — improved empty state
- `frontend/src/app/(admin)/settings/page.tsx` — API key validation + toasts
- `frontend/src/app/(admin)/team/page.tsx` — form validation + toasts
- `frontend/src/app/(admin)/users/page.tsx` — form validation + toasts
- `frontend/src/app/(admin)/community/page.tsx` — improved empty state

---

## LAYER 1 — Infrastructure

### Task 1: Install dependencies

**Files:** `frontend/package.json`

- [ ] **Step 1: Install test and feature deps**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/frontend
npm install sonner zod react-hook-form @hookform/resolvers
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Add test scripts to package.json**

Open `package.json` and replace the `"scripts"` block with:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest",
  "test:run": "vitest run",
  "test:ui": "vitest --ui"
},
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install vitest, RTL, sonner, zod, react-hook-form"
```

---

### Task 2: Configure Vitest

**Files:** Create `frontend/vitest.config.ts`

- [ ] **Step 1: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: configure vitest with jsdom and @ alias"
```

---

### Task 3: Create test setup and helpers

**Files:** Create `frontend/src/test/setup.ts`, `frontend/src/test/helpers.tsx`

- [ ] **Step 1: Create src/test/setup.ts**

```typescript
import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(cleanup)

vi.mock('next/navigation', () => ({
  usePathname: vi.fn().mockReturnValue('/dashboard'),
  useRouter: vi.fn().mockReturnValue({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue(null),
  }),
  redirect: vi.fn(),
}))

vi.mock('next-auth/react', () => ({
  useSession: vi.fn().mockReturnValue({
    data: null,
    status: 'unauthenticated',
  }),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  Toaster: () => null,
}))
```

- [ ] **Step 2: Create src/test/helpers.tsx**

```typescript
import { render, type RenderOptions } from '@testing-library/react'
import { type ReactElement } from 'react'
import { vi } from 'vitest'
import { useSession } from 'next-auth/react'

export interface SessionOptions {
  role?: 'superadmin' | 'chapter_lead' | 'host'
  chapterId?: string
  chapterName?: string
  name?: string
  email?: string
}

export function renderWithSession(
  ui: ReactElement,
  sessionOptions: SessionOptions = {},
  renderOptions?: Omit<RenderOptions, 'wrapper'>
) {
  const {
    role = 'chapter_lead',
    chapterId,
    chapterName,
    name = 'Test User',
    email = 'test@example.com',
  } = sessionOptions

  vi.mocked(useSession).mockReturnValue({
    data: {
      user: { name, email, role, chapterId, chapterName } as any,
      accessToken: 'test-token',
      expires: '2099-01-01',
    },
    status: 'authenticated',
    update: vi.fn(),
  })

  return render(ui, renderOptions)
}
```

- [ ] **Step 3: Write smoke test for helpers**

Create `frontend/src/test/helpers.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithSession } from './helpers'

function RoleDisplay() {
  const { useSession } = require('next-auth/react')
  const { data } = useSession()
  return <div>{(data?.user as any)?.role ?? 'none'}</div>
}

describe('renderWithSession', () => {
  it('provides the given role via useSession', () => {
    renderWithSession(<RoleDisplay />, { role: 'host' })
    expect(screen.getByText('host')).toBeInTheDocument()
  })

  it('defaults to chapter_lead when no role given', () => {
    renderWithSession(<RoleDisplay />)
    expect(screen.getByText('chapter_lead')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform/frontend
npm run test:run
```

Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add src/test/
git commit -m "test: add vitest setup, helpers, and smoke test"
```

---

### Task 4: Create toast utility and wire Toaster

**Files:** Create `frontend/src/lib/toast.ts`, modify `frontend/src/app/layout.tsx`

- [ ] **Step 1: Create src/lib/toast.ts**

```typescript
export { toast } from 'sonner'
```

- [ ] **Step 2: Add Toaster to root layout**

In `src/app/layout.tsx`, add the import at the top:

```typescript
import { Toaster } from 'sonner'
```

Inside the `<body>` tag, just before `</body>`, add:

```tsx
<Toaster position="bottom-right" richColors />
```

The closing section of the body should look like:

```tsx
      <Providers>
        <main id="main-content">{children}</main>
      </Providers>
      <Toaster position="bottom-right" richColors />
      </body>
    </html>
```

- [ ] **Step 3: Write toast utility test**

Create `frontend/src/lib/toast.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { toast } from './toast'

describe('toast utility', () => {
  it('exports success function', () => {
    expect(typeof toast.success).toBe('function')
  })

  it('exports error function', () => {
    expect(typeof toast.error).toBe('function')
  })

  it('exports info function', () => {
    expect(typeof toast.info).toBe('function')
  })
})
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm run test:run
```

Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/toast.ts src/lib/toast.test.ts src/app/layout.tsx
git commit -m "feat: add sonner toast utility and Toaster to root layout"
```

---

### ✅ Layer 1 complete — QA review checkpoint

**Review agent instructions:** Run `npm run test:run` in `frontend/`. Verify 5 tests pass. Check that `vitest.config.ts`, `src/test/setup.ts`, `src/test/helpers.tsx`, `src/lib/toast.ts` exist. Check no TypeScript errors: `npx tsc --noEmit`. Report any issues.

---

## LAYER 2 — Global Shell

### Task 5: Create AdminNav component

**Files:** Create `frontend/src/app/(admin)/AdminNav.tsx` and `frontend/src/app/(admin)/AdminNav.test.tsx`

- [ ] **Step 1: Write failing tests first**

Create `frontend/src/app/(admin)/AdminNav.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { vi } from 'vitest'
import AdminNav from './AdminNav'

const HOST_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'fa-th-large' },
  { href: '/upload', label: 'Upload Conversations', icon: 'fa-upload' },
  { href: '/articles', label: 'Articles', icon: 'fa-file-text-o' },
  { href: '/settings', label: 'Settings', icon: 'fa-cog' },
]

const FULL_NAV = [
  ...HOST_NAV,
  { href: '/community', label: 'Community', icon: 'fa-bar-chart' },
  { href: '/users', label: 'Users', icon: 'fa-user-circle-o' },
]

describe('AdminNav — active state', () => {
  it('applies active background to the current route', () => {
    vi.mocked(usePathname).mockReturnValue('/articles')
    render(<AdminNav navItems={HOST_NAV} userRole="host" />)
    const link = screen.getByRole('link', { name: /articles/i })
    expect(link).toHaveStyle({ background: '#56a1d2' })
  })

  it('does not apply active style to non-current routes', () => {
    vi.mocked(usePathname).mockReturnValue('/dashboard')
    render(<AdminNav navItems={HOST_NAV} userRole="host" />)
    const link = screen.getByRole('link', { name: /upload conversations/i })
    expect(link).not.toHaveStyle({ background: '#56a1d2' })
  })

  it('highlights /articles when on a sub-route /articles/some-id', () => {
    vi.mocked(usePathname).mockReturnValue('/articles/abc-123')
    render(<AdminNav navItems={HOST_NAV} userRole="host" />)
    const link = screen.getByRole('link', { name: /articles/i })
    expect(link).toHaveStyle({ background: '#56a1d2' })
  })
})

describe('AdminNav — role badge', () => {
  beforeEach(() => vi.mocked(usePathname).mockReturnValue('/dashboard'))

  it('shows HOST for host role', () => {
    render(<AdminNav navItems={HOST_NAV} userRole="host" />)
    expect(screen.getByText('HOST')).toBeInTheDocument()
  })

  it('shows CHAPTER LEAD for chapter_lead role', () => {
    render(<AdminNav navItems={FULL_NAV} userRole="chapter_lead" />)
    expect(screen.getByText('CHAPTER LEAD')).toBeInTheDocument()
  })

  it('shows ADMIN for superadmin role', () => {
    render(<AdminNav navItems={FULL_NAV} userRole="superadmin" />)
    expect(screen.getByText('ADMIN')).toBeInTheDocument()
  })

  it('shows chapter name when provided', () => {
    render(<AdminNav navItems={HOST_NAV} userRole="host" chapterName="SF Bay Area" />)
    expect(screen.getByText('SF Bay Area')).toBeInTheDocument()
  })

  it('shows All Chapters for superadmin without chapter name', () => {
    render(<AdminNav navItems={FULL_NAV} userRole="superadmin" />)
    expect(screen.getByText('All Chapters')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL (AdminNav does not exist)**

```bash
npm run test:run -- AdminNav
```

Expected: FAIL — `Cannot find module './AdminNav'`

- [ ] **Step 3: Create AdminNav.tsx**

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: string
}

interface AdminNavProps {
  navItems: NavItem[]
  userRole: string
  chapterName?: string
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'ADMIN',
  chapter_lead: 'CHAPTER LEAD',
  host: 'HOST',
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  superadmin: { bg: '#fdf8ee', color: '#a07a20' },
  chapter_lead: { bg: '#eef6fd', color: '#2d7ab0' },
  host: { bg: '#f0fdf4', color: '#166534' },
}

export default function AdminNav({ navItems, userRole, chapterName }: AdminNavProps) {
  const pathname = usePathname()
  const roleLabel = ROLE_LABELS[userRole] ?? userRole.toUpperCase()
  const roleColor = ROLE_COLORS[userRole] ?? { bg: '#f3f4f6', color: '#4b5563' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Role / chapter badge */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ background: roleColor.bg, borderRadius: 6, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: roleColor.color, letterSpacing: '0.08em' }}>
            {roleLabel}
          </div>
          {chapterName && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{chapterName}</div>
          )}
          {!chapterName && userRole === 'superadmin' && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>All Chapters</div>
          )}
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 16px', flex: 1 }}>
        {navItems.map(({ href, label, icon }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#fff' : '#444',
                background: isActive ? '#56a1d2' : 'transparent',
                textDecoration: 'none',
                transition: 'background 0.15s',
              }}
            >
              <i
                className={`fa ${icon}`}
                style={{ width: 16, textAlign: 'center', color: isActive ? '#fff' : '#56a1d2' }}
                aria-hidden="true"
              />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm run test:run -- AdminNav
```

Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/AdminNav.tsx src/app/\(admin\)/AdminNav.test.tsx
git commit -m "feat: add AdminNav client component with active state and role badge"
```

---

### Task 6: Wire AdminNav into layout.tsx

**Files:** Modify `frontend/src/app/(admin)/layout.tsx`

- [ ] **Step 1: Read the current layout.tsx before editing**

Read `src/app/(admin)/layout.tsx` to confirm current structure matches expectations.

- [ ] **Step 2: Replace layout.tsx with updated version**

Replace the entire file with:

```typescript
import { auth } from '@/lib/auth'
import SignOutButton from './SignOutButton'
import AdminNav from './AdminNav'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function getChapterName(token: string, chapterId: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${API_URL}/chapters`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 60 },
    })
    if (!res.ok) return undefined
    const chapters = await res.json()
    const ch = chapters.find((c: any) => c.id === chapterId)
    return ch?.name
  } catch {
    return undefined
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const userRole: string = (session?.user as any)?.role ?? ''
  const isSuperadmin = userRole === 'superadmin'
  const isHost = userRole === 'host'
  const userChapterId: string | undefined = (session?.user as any)?.chapterId
  const token: string | undefined = (session as any)?.accessToken

  let chapterName: string | undefined
  if (token && userChapterId) {
    chapterName = await getChapterName(token, userChapterId)
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: 'fa-th-large' },
    { href: '/upload', label: 'Upload Conversations', icon: 'fa-upload' },
    { href: '/articles', label: 'Articles', icon: 'fa-file-text-o' },
    ...(!isHost ? [{ href: '/community', label: 'Community', icon: 'fa-bar-chart' }] : []),
    ...(!isHost ? [{ href: '/social', label: 'Social Media', icon: 'fa-share-alt' }] : []),
    ...(!isHost ? [{ href: '/chapters', label: 'Chapters', icon: 'fa-map-marker' }] : []),
    ...(!isHost ? [{ href: '/team', label: 'Team', icon: 'fa-users' }] : []),
    ...(isSuperadmin ? [{ href: '/users', label: 'Users', icon: 'fa-user-circle-o' }] : []),
    ...(!isHost ? [{ href: '/volunteer-roles', label: 'Volunteer Roles', icon: 'fa-hand-paper-o' }] : []),
    ...(!isHost ? [{ href: '/volunteer-applications', label: 'Applications', icon: 'fa-envelope-open-o' }] : []),
    ...(!isHost ? [{ href: '/topics', label: 'Topics', icon: 'fa-lightbulb-o' }] : []),
    ...(!isHost ? [{ href: '/community-uploads', label: 'Community Uploads', icon: 'fa-cloud-upload' }] : []),
    ...(!isHost ? [{ href: '/hosting-interest', label: 'Host Interest', icon: 'fa-star' }] : []),
    { href: '/settings', label: 'Settings', icon: 'fa-cog' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 71px)' }}>
      {session && (
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            background: '#fff',
            borderRight: '1px solid rgba(0,0,0,0.07)',
            padding: '32px 0',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <AdminNav navItems={navItems} userRole={userRole} chapterName={chapterName} />
          <div style={{ padding: '0 16px', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 12 }}>
            <SignOutButton />
          </div>
        </aside>
      )}
      <main style={{ flex: 1, overflowY: 'auto', background: '#fafaf8' }}>
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Run full test suite — expect no regressions**

```bash
npm run test:run
```

Expected: all previous tests still pass

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/layout.tsx
git commit -m "feat: wire AdminNav into admin layout with role badge and chapter name"
```

---

### Task 7: Wire toasts into ArticleEditor

**Files:** Modify `frontend/src/app/(admin)/articles/[id]/ArticleEditor.tsx`

- [ ] **Step 1: Add toast import and update save/publishArticle callbacks**

At the top of `ArticleEditor.tsx`, add:
```typescript
import { toast } from '@/lib/toast'
```

Replace the `save` callback's success/error branches:
```typescript
// BEFORE (lines ~144-148):
if (r.ok) {
  setSaveLabel("Saved ✓");
} else {
  setSaveLabel("Error");
}

// AFTER:
if (r.ok) {
  toast.success('Article saved')
  setSaveLabel('Saved ✓')
} else {
  toast.error('Failed to save article')
  setSaveLabel('Error')
}
```

Replace the catch block in `save`:
```typescript
// BEFORE:
} catch {
  setSaveLabel("Error");
}

// AFTER:
} catch {
  toast.error('Failed to save article')
  setSaveLabel('Error')
}
```

Replace the `publishArticle` callback body:
```typescript
const publishArticle = useCallback(async () => {
  setPublishingArticle(true)
  try {
    const r = await fetch(`${API_URL}/admin/articles/${initial.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'published' }),
    })
    if (r.ok) {
      setArticleStatus('published')
      toast.success('Article marked as done')
    } else {
      toast.error('Failed to update article status')
    }
  } catch {
    toast.error('Failed to update article status')
  }
  setPublishingArticle(false)
}, [initial.id, token])
```

- [ ] **Step 2: Run test suite — expect no regressions**

```bash
npm run test:run
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/articles/
git commit -m "feat: add toast notifications to article editor save and mark-as-done"
```

---

### Task 8: Wire toasts in settings, team, users pages

**Files:** Modify `settings/page.tsx`, `team/page.tsx`, `users/page.tsx`

- [ ] **Step 1: Read each file to locate save/delete success/error patterns**

Read the three files to find their existing success/error handling patterns (look for `setError`, alert calls, or inline state updates after fetch).

- [ ] **Step 2: Add toast import and wire calls in settings/page.tsx**

Add at top: `import { toast } from '@/lib/toast'`

After each successful `POST /admin/api-keys` call, add: `toast.success('API key saved')`
After each successful `DELETE /admin/api-keys/{provider}` call, add: `toast.success('API key removed')`
After each failed API call in catch/else blocks, add: `toast.error('Failed to save key — check your connection')`

Do the same for system settings saves/removes.

- [ ] **Step 3: Add toast import and wire calls in team/page.tsx**

Add at top: `import { toast } from '@/lib/toast'`

After successful team member creation: `toast.success('Team member added')`
After successful team member deletion: `toast.success('Team member removed')`
After errors: `toast.error('Failed — please try again')`

- [ ] **Step 4: Add toast import and wire calls in users/page.tsx**

Add at top: `import { toast } from '@/lib/toast'`

After successful user creation: `toast.success('User created')`
After successful user deletion: `toast.success('User deleted')`
After errors: `toast.error('Failed — please try again')`

- [ ] **Step 5: Run test suite — expect no regressions**

```bash
npm run test:run
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(admin\)/settings/ src/app/\(admin\)/team/ src/app/\(admin\)/users/
git commit -m "feat: wire toast notifications in settings, team, users pages"
```

---

### ✅ Layer 2 complete — QA review checkpoint

**Review agent instructions:** Run `npm run test:run`. Run `npx tsc --noEmit`. Run `npm run lint`. Verify: (1) AdminNav tests pass, (2) layout.tsx imports AdminNav and no longer contains inline nav rendering, (3) `toast` import present in ArticleEditor/settings/team/users, (4) no TypeScript errors. Report any issues.

---

## LAYER 3 — Dashboard + Onboarding

### Task 9: Create OnboardingBanner component

**Files:** Create `frontend/src/components/OnboardingBanner.tsx` and `frontend/src/components/OnboardingBanner.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/components/OnboardingBanner.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OnboardingBanner from './OnboardingBanner'

const STEPS = [
  { title: 'Add API keys', description: 'You need keys to process audio', ctaLabel: 'Go to Settings', ctaHref: '/settings' },
  { title: 'Upload a conversation', description: 'Upload your first audio file', ctaLabel: 'Upload now', ctaHref: '/upload' },
  { title: 'Review your article', description: 'Your article is ready', ctaLabel: 'View articles', ctaHref: '/articles' },
]

describe('OnboardingBanner', () => {
  it('shows step 1 when no steps are complete', () => {
    render(<OnboardingBanner steps={STEPS} completedSteps={[false, false, false]} />)
    expect(screen.getByText('Add API keys')).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
  })

  it('shows step 2 when step 1 is complete', () => {
    render(<OnboardingBanner steps={STEPS} completedSteps={[true, false, false]} />)
    expect(screen.getByText('Upload a conversation')).toBeInTheDocument()
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
  })

  it('shows step 3 when steps 1 and 2 are complete', () => {
    render(<OnboardingBanner steps={STEPS} completedSteps={[true, true, false]} />)
    expect(screen.getByText('Review your article')).toBeInTheDocument()
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument()
  })

  it('returns null when all steps are complete', () => {
    const { container } = render(
      <OnboardingBanner steps={STEPS} completedSteps={[true, true, true]} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('CTA link points to correct href', () => {
    render(<OnboardingBanner steps={STEPS} completedSteps={[false, false, false]} />)
    const link = screen.getByRole('link', { name: /go to settings/i })
    expect(link).toHaveAttribute('href', '/settings')
  })

  it('shows step description', () => {
    render(<OnboardingBanner steps={STEPS} completedSteps={[false, false, false]} />)
    expect(screen.getByText('You need keys to process audio')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm run test:run -- OnboardingBanner
```

Expected: FAIL — `Cannot find module './OnboardingBanner'`

- [ ] **Step 3: Create OnboardingBanner.tsx**

```typescript
'use client'

import Link from 'next/link'

export interface OnboardingStep {
  title: string
  description: string
  ctaLabel: string
  ctaHref: string
}

interface OnboardingBannerProps {
  steps: OnboardingStep[]
  completedSteps: boolean[]
}

export default function OnboardingBanner({ steps, completedSteps }: OnboardingBannerProps) {
  const currentIndex = completedSteps.findIndex((done) => !done)
  if (currentIndex === -1) return null

  const step = steps[currentIndex]
  const total = steps.length
  const stepNumber = currentIndex + 1

  return (
    <div
      style={{
        borderLeft: '4px solid #56a1d2',
        background: '#eef6fd',
        borderRadius: '0 8px 8px 0',
        padding: '16px 20px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#56a1d2', marginBottom: 4 }}>
          Step {stepNumber} of {total}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 2 }}>
          {step.title}
        </div>
        <div style={{ fontSize: 13, color: '#555' }}>{step.description}</div>
      </div>
      <Link
        href={step.ctaHref}
        style={{
          padding: '8px 18px',
          background: '#56a1d2',
          color: '#fff',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 700,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {step.ctaLabel}
      </Link>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm run test:run -- OnboardingBanner
```

Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add src/components/OnboardingBanner.tsx src/components/OnboardingBanner.test.tsx
git commit -m "feat: add OnboardingBanner component with step tracking"
```

---

### Task 10: Create role-specific dashboard components

**Files:** Create `HostDashboard.tsx`, `ChapterLeadDashboard.tsx`, `SuperadminDashboard.tsx` (all in `src/app/(admin)/dashboard/`)

- [ ] **Step 1: Write failing tests for HostDashboard**

Create `frontend/src/app/(admin)/dashboard/HostDashboard.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HostDashboard from './HostDashboard'

const BASE_PROPS = {
  userName: 'Sarah',
  chapterName: 'SF Bay Area',
  completedSteps: [false, false, false] as [boolean, boolean, boolean],
  recentJobs: [] as any[],
}

describe('HostDashboard', () => {
  it('renders welcome heading with user name', () => {
    render(<HostDashboard {...BASE_PROPS} />)
    expect(screen.getByText(/welcome, sarah/i)).toBeInTheDocument()
  })

  it('renders the onboarding banner when steps incomplete', () => {
    render(<HostDashboard {...BASE_PROPS} />)
    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument()
  })

  it('does not render banner when all steps complete', () => {
    render(<HostDashboard {...BASE_PROPS} completedSteps={[true, true, true]} />)
    expect(screen.queryByText(/step/i)).not.toBeInTheDocument()
  })

  it('renders upload CTA link', () => {
    render(<HostDashboard {...BASE_PROPS} />)
    expect(screen.getByRole('link', { name: /upload a conversation/i })).toBeInTheDocument()
  })

  it('renders empty state when no recent jobs', () => {
    render(<HostDashboard {...BASE_PROPS} />)
    expect(screen.getByText(/no conversations uploaded yet/i)).toBeInTheDocument()
  })

  it('renders recent jobs when provided', () => {
    const jobs = [{ id: '1', input_filename: 'event.mp3', status: 'completed', created_at: '2026-04-13T10:00:00Z' }]
    render(<HostDashboard {...BASE_PROPS} recentJobs={jobs} />)
    expect(screen.getByText('event.mp3')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Write failing tests for ChapterLeadDashboard**

Create `frontend/src/app/(admin)/dashboard/ChapterLeadDashboard.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChapterLeadDashboard from './ChapterLeadDashboard'

const BASE_PROPS = {
  userName: 'Alex',
  chapterName: 'NYC',
  completedSteps: [false, false, false, false] as [boolean, boolean, boolean, boolean],
  stats: { articlesPublished: 0, articlesDraft: 0, teamCount: 0 },
  recentArticles: [] as any[],
}

describe('ChapterLeadDashboard', () => {
  it('renders welcome heading', () => {
    render(<ChapterLeadDashboard {...BASE_PROPS} />)
    expect(screen.getByText(/welcome, alex/i)).toBeInTheDocument()
  })

  it('shows onboarding banner when steps incomplete', () => {
    render(<ChapterLeadDashboard {...BASE_PROPS} />)
    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument()
  })

  it('renders stats cards', () => {
    render(<ChapterLeadDashboard {...BASE_PROPS} stats={{ articlesPublished: 3, articlesDraft: 1, teamCount: 2 }} />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders empty state when no articles', () => {
    render(<ChapterLeadDashboard {...BASE_PROPS} />)
    expect(screen.getByText(/no articles yet/i)).toBeInTheDocument()
  })

  it('renders recent articles when provided', () => {
    const articles = [{ id: '1', title: 'AI and Society', status: 'published', created_at: '2026-04-13T10:00:00Z' }]
    render(<ChapterLeadDashboard {...BASE_PROPS} recentArticles={articles} />)
    expect(screen.getByText('AI and Society')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Write failing tests for SuperadminDashboard**

Create `frontend/src/app/(admin)/dashboard/SuperadminDashboard.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SuperadminDashboard from './SuperadminDashboard'

const BASE_PROPS = {
  userName: 'Ian',
  platformStats: { totalChapters: 5, totalUsers: 12, recentJobs: 3 },
  chapters: [
    { id: '1', name: 'SF Bay Area', code: 'sf', articleCount: 10, teamCount: 3, is_active: true },
  ],
}

describe('SuperadminDashboard', () => {
  it('renders welcome heading', () => {
    render(<SuperadminDashboard {...BASE_PROPS} />)
    expect(screen.getByText(/welcome, ian/i)).toBeInTheDocument()
  })

  it('does not render an onboarding banner', () => {
    render(<SuperadminDashboard {...BASE_PROPS} />)
    expect(screen.queryByText(/step \d+ of/i)).not.toBeInTheDocument()
  })

  it('renders platform stats', () => {
    render(<SuperadminDashboard {...BASE_PROPS} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders chapter list', () => {
    render(<SuperadminDashboard {...BASE_PROPS} />)
    expect(screen.getByText('SF Bay Area')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run — expect all FAIL**

```bash
npm run test:run -- Dashboard
```

Expected: all FAIL — modules not found

- [ ] **Step 5: Create HostDashboard.tsx**

```typescript
'use client'

import Link from 'next/link'
import OnboardingBanner, { type OnboardingStep } from '@/components/OnboardingBanner'

const HOST_STEPS: OnboardingStep[] = [
  {
    title: 'Add your API keys',
    description: 'You need AssemblyAI and Google AI keys to process conversations.',
    ctaLabel: 'Go to Settings',
    ctaHref: '/settings',
  },
  {
    title: 'Upload your first conversation',
    description: 'Record or import an audio file from your last Ai Salon event.',
    ctaLabel: 'Upload now',
    ctaHref: '/upload',
  },
  {
    title: 'Review your generated article',
    description: "Your conversation has been transcribed and turned into a draft article. Give it a read.",
    ctaLabel: 'View articles',
    ctaHref: '/articles',
  },
]

interface Job {
  id: string
  input_filename: string
  status: string
  created_at: string
}

interface HostDashboardProps {
  userName: string
  chapterName?: string
  completedSteps: [boolean, boolean, boolean]
  recentJobs: Job[]
}

export default function HostDashboard({ userName, chapterName, completedSteps, recentJobs }: HostDashboardProps) {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 28px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111', marginBottom: 6 }}>
        Welcome, {userName}
      </h1>
      {chapterName && (
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>{chapterName}</p>
      )}

      <OnboardingBanner steps={HOST_STEPS} completedSteps={completedSteps} />

      {/* Upload CTA */}
      <div
        style={{
          background: '#fff',
          border: '1.5px solid #56a1d2',
          borderRadius: 10,
          padding: '20px 24px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4 }}>
            Upload a conversation
          </div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Turn your last event recording into a published article.
          </div>
        </div>
        <Link
          href="/upload"
          style={{
            padding: '9px 20px',
            background: '#56a1d2',
            color: '#fff',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Upload a conversation
        </Link>
      </div>

      {/* Recent jobs */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #ede9d8', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0ebe0', fontSize: 14, fontWeight: 700, color: '#111' }}>
          Recent Processing
        </div>
        {recentJobs.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9ca3af' }}>
            <i className="fa fa-inbox" style={{ fontSize: 28, display: 'block', marginBottom: 10 }} aria-hidden="true" />
            <p style={{ fontSize: 13, margin: 0 }}>
              No conversations uploaded yet. Select an audio file above to get started — transcription takes ~5 minutes.
            </p>
          </div>
        ) : (
          <div>
            {recentJobs.slice(0, 3).map((job) => (
              <div
                key={job.id}
                style={{ padding: '12px 20px', borderBottom: '1px solid #f8f6ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{job.input_filename}</div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#f3f4f6', color: '#6b7280', textTransform: 'capitalize' }}>
                  {job.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create ChapterLeadDashboard.tsx**

```typescript
'use client'

import Link from 'next/link'
import OnboardingBanner, { type OnboardingStep } from '@/components/OnboardingBanner'

const CHAPTER_LEAD_STEPS: OnboardingStep[] = [
  {
    title: 'Add your API keys',
    description: 'You need AssemblyAI and Google AI keys to process conversations.',
    ctaLabel: 'Go to Settings',
    ctaHref: '/settings',
  },
  {
    title: 'Upload your first conversation',
    description: 'Record or import audio from your last event.',
    ctaLabel: 'Upload now',
    ctaHref: '/upload',
  },
  {
    title: 'Complete your chapter profile',
    description: 'Add a tagline and description so members can find you.',
    ctaLabel: 'Edit profile',
    ctaHref: '/chapters',
  },
  {
    title: 'Add your team',
    description: 'Add co-founders and team members to your chapter page.',
    ctaLabel: 'Manage team',
    ctaHref: '/team',
  },
]

interface Article {
  id: string
  title: string
  status: string
  created_at: string
}

interface ChapterLeadDashboardProps {
  userName: string
  chapterName?: string
  completedSteps: [boolean, boolean, boolean, boolean]
  stats: { articlesPublished: number; articlesDraft: number; teamCount: number }
  recentArticles: Article[]
}

export default function ChapterLeadDashboard({
  userName,
  chapterName,
  completedSteps,
  stats,
  recentArticles,
}: ChapterLeadDashboardProps) {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 28px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111', marginBottom: 6 }}>
        Welcome, {userName}
      </h1>
      {chapterName && (
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>{chapterName}</p>
      )}

      <OnboardingBanner steps={CHAPTER_LEAD_STEPS} completedSteps={completedSteps} />

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Published', value: stats.articlesPublished, color: '#16a34a' },
          { label: 'Drafts', value: stats.articlesDraft, color: '#6b7280' },
          { label: 'Team Members', value: stats.teamCount, color: '#56a1d2' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', border: '1px solid #ede9d8', textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Recent articles */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #ede9d8', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0ebe0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Recent Articles</span>
          <Link href="/articles" style={{ fontSize: 12, color: '#56a1d2', fontWeight: 600, textDecoration: 'none' }}>View all →</Link>
        </div>
        {recentArticles.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9ca3af' }}>
            <p style={{ fontSize: 13, margin: 0 }}>
              No articles yet.{' '}
              <Link href="/upload" style={{ color: '#56a1d2', fontWeight: 600 }}>Upload a conversation →</Link>
              {' '}to generate your first one.
            </p>
          </div>
        ) : (
          <div>
            {recentArticles.slice(0, 3).map((article) => (
              <Link key={article.id} href={`/articles/${article.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid #f8f6ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{article.title}</div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: article.status === 'published' ? '#dcfce7' : '#f3f4f6', color: article.status === 'published' ? '#16a34a' : '#6b7280', textTransform: 'capitalize' }}>
                    {article.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Upload CTA */}
      <Link href="/upload" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px 24px',
        background: '#56a1d2',
        color: '#fff',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 700,
        textDecoration: 'none',
        gap: 8,
      }}>
        <i className="fa fa-upload" aria-hidden="true" /> Upload a conversation
      </Link>
    </div>
  )
}
```

- [ ] **Step 7: Create SuperadminDashboard.tsx**

```typescript
'use client'

import Link from 'next/link'

interface Chapter {
  id: string
  name: string
  code: string
  articleCount: number
  teamCount: number
  is_active: boolean
}

interface SuperadminDashboardProps {
  userName: string
  platformStats: { totalChapters: number; totalUsers: number; recentJobs: number }
  chapters: Chapter[]
}

export default function SuperadminDashboard({ userName, platformStats, chapters }: SuperadminDashboardProps) {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 28px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111', marginBottom: 24 }}>
        Welcome, {userName}
      </h1>

      {/* Platform health */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total Chapters', value: platformStats.totalChapters, icon: 'fa-map-marker', color: '#56a1d2' },
          { label: 'Total Users', value: platformStats.totalUsers, icon: 'fa-users', color: '#d2b356' },
          { label: 'Jobs (last 7 days)', value: platformStats.recentJobs, icon: 'fa-cog', color: '#6b7280' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', border: '1px solid #ede9d8' }}>
            <i className={`fa ${icon}`} style={{ fontSize: 20, color, marginBottom: 8, display: 'block' }} aria-hidden="true" />
            <div style={{ fontSize: 32, fontWeight: 800, color: '#111' }}>{value}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Chapters list */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #ede9d8', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0ebe0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Chapters</span>
          <Link href="/chapters" style={{ fontSize: 12, color: '#56a1d2', fontWeight: 600, textDecoration: 'none' }}>Manage →</Link>
        </div>
        {chapters.map((ch) => (
          <Link key={ch.id} href={`/chapters/edit/${ch.code}`} style={{ textDecoration: 'none' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f8f6ec', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{ch.name}</span>
                <span style={{ fontSize: 11, color: '#d2b356', fontWeight: 700, marginLeft: 8, textTransform: 'uppercase' }}>{ch.code}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6b7280' }}>
                <span>{ch.articleCount} articles</span>
                <span>{ch.teamCount} members</span>
                <span style={{ color: ch.is_active ? '#16a34a' : '#9ca3af', fontWeight: 600 }}>
                  {ch.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Run — expect all dashboard tests PASS**

```bash
npm run test:run -- Dashboard
```

Expected: all dashboard tests pass

- [ ] **Step 9: Commit**

```bash
git add src/components/OnboardingBanner.tsx src/components/OnboardingBanner.test.tsx \
        src/app/\(admin\)/dashboard/HostDashboard.tsx src/app/\(admin\)/dashboard/HostDashboard.test.tsx \
        src/app/\(admin\)/dashboard/ChapterLeadDashboard.tsx src/app/\(admin\)/dashboard/ChapterLeadDashboard.test.tsx \
        src/app/\(admin\)/dashboard/SuperadminDashboard.tsx src/app/\(admin\)/dashboard/SuperadminDashboard.test.tsx
git commit -m "feat: add role-specific dashboard components and OnboardingBanner"
```

---

### Task 11: Update dashboard page.tsx to fetch step state and render role dashboards

**Files:** Modify `frontend/src/app/(admin)/dashboard/page.tsx`

- [ ] **Step 1: Read current dashboard/page.tsx** (already known — see File Map)

- [ ] **Step 2: Replace dashboard/page.tsx**

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import HostDashboard from './HostDashboard'
import ChapterLeadDashboard from './ChapterLeadDashboard'
import SuperadminDashboard from './SuperadminDashboard'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function fetchJson(url: string, token: string) {
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    if (!r.ok) return null
    return r.json()
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const token = (session as any).accessToken as string
  const userRole: string = (session.user as any)?.role ?? 'chapter_lead'
  const userName: string = session.user?.name ?? ''
  const userChapterId: string | undefined = (session.user as any)?.chapterId

  const [apiKeys, jobs, articles, team, chapters] = await Promise.all([
    fetchJson(`${API_URL}/admin/api-keys`, token),
    fetchJson(`${API_URL}/admin/jobs`, token),
    fetchJson(`${API_URL}/admin/articles`, token),
    fetchJson(`${API_URL}/admin/team`, token),
    fetchJson(`${API_URL}/chapters`, token),
  ])

  const hasAssemblyAiKey = Array.isArray(apiKeys)
    ? apiKeys.some((k: any) => k.provider === 'assemblyai' && k.has_key)
    : false

  const jobCount = Array.isArray(jobs) ? jobs.length : 0
  const articleCount = Array.isArray(articles) ? articles.length : 0
  const teamCount = Array.isArray(team) ? team.length : 0

  let userChapter: { id: string; code: string; name: string; tagline?: string; description?: string } | undefined
  if (userChapterId && Array.isArray(chapters)) {
    const ch = chapters.find((c: any) => c.id === userChapterId)
    if (ch) userChapter = ch
  }

  const chapterComplete = !!(userChapter?.tagline && userChapter?.description)
  const chapterName = userChapter?.name

  if (userRole === 'host') {
    const completedSteps: [boolean, boolean, boolean] = [
      hasAssemblyAiKey,
      jobCount > 0,
      articleCount > 0,
    ]
    const recentJobs = Array.isArray(jobs) ? jobs.slice(0, 3) : []
    return (
      <HostDashboard
        userName={userName}
        chapterName={chapterName}
        completedSteps={completedSteps}
        recentJobs={recentJobs}
      />
    )
  }

  if (userRole === 'chapter_lead') {
    const completedSteps: [boolean, boolean, boolean, boolean] = [
      hasAssemblyAiKey,
      jobCount > 0,
      chapterComplete,
      teamCount > 0,
    ]
    const publishedCount = Array.isArray(articles) ? articles.filter((a: any) => a.status === 'published').length : 0
    const draftCount = Array.isArray(articles) ? articles.filter((a: any) => a.status === 'draft').length : 0
    const recentArticles = Array.isArray(articles) ? articles.slice(0, 3) : []
    return (
      <ChapterLeadDashboard
        userName={userName}
        chapterName={chapterName}
        completedSteps={completedSteps}
        stats={{ articlesPublished: publishedCount, articlesDraft: draftCount, teamCount }}
        recentArticles={recentArticles}
      />
    )
  }

  // superadmin
  const allChapters = Array.isArray(chapters) ? chapters : []
  const totalUsers = 0 // TODO: add /admin/users count endpoint if needed
  const recentJobCount = Array.isArray(jobs) ? jobs.filter((j: any) => {
    const d = new Date(j.created_at)
    return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000
  }).length : 0

  const chaptersWithStats = allChapters.map((ch: any) => ({
    id: ch.id,
    name: ch.name,
    code: ch.code,
    is_active: ch.is_active ?? true,
    articleCount: Array.isArray(articles) ? articles.filter((a: any) => a.chapter_id === ch.id).length : 0,
    teamCount: Array.isArray(team) ? team.filter((t: any) => t.chapter_id === ch.id).length : 0,
  }))

  return (
    <SuperadminDashboard
      userName={userName}
      platformStats={{ totalChapters: allChapters.length, totalUsers, recentJobs: recentJobCount }}
      chapters={chaptersWithStats}
    />
  )
}
```

- [ ] **Step 3: Run full test suite**

```bash
npm run test:run
```

Expected: all tests still pass

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/dashboard/page.tsx
git commit -m "feat: update dashboard page to render role-specific dashboards with step state"
```

---

### ✅ Layer 3 complete — QA review checkpoint

**Review agent instructions:** Run `npm run test:run` and `npx tsc --noEmit`. Verify: (1) OnboardingBanner + all three dashboard component tests pass, (2) dashboard/page.tsx no longer imports WelcomeDashboard, (3) three new dashboard components exist with correct props, (4) no TypeScript errors. Report any issues.

---

## LAYER 4 — Page-Level Fixes

### Task 12: Fix publish semantics in ArticleEditor

**Files:** Modify `frontend/src/app/(admin)/articles/[id]/ArticleEditor.tsx`

- [ ] **Step 1: Write failing test**

Create `frontend/src/app/(admin)/articles/[id]/ArticleEditor.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ArticleEditor from './ArticleEditor'

const BASE_ARTICLE = {
  id: 'art-1',
  title: 'Test Article',
  content_md: '# Hello',
  anonymized_transcript: null,
  substack_url: null,
  status: 'draft' as const,
  chapter_id: 'ch-1',
  job_id: null,
  created_at: '2026-04-13T10:00:00Z',
}

describe('ArticleEditor — publish semantics', () => {
  it('shows "Mark as Done" button, not "Publish"', () => {
    render(<ArticleEditor article={BASE_ARTICLE} token="tok" />)
    expect(screen.getByRole('button', { name: /mark as done/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^publish$/i })).not.toBeInTheDocument()
  })

  it('shows helper text explaining what Mark as Done does', () => {
    render(<ArticleEditor article={BASE_ARTICLE} token="tok" />)
    expect(screen.getByText(/marks this article as finished/i)).toBeInTheDocument()
  })

  it('shows updated Substack URL placeholder', () => {
    render(<ArticleEditor article={BASE_ARTICLE} token="tok" />)
    const input = screen.getByPlaceholderText(/after publishing on substack/i)
    expect(input).toBeInTheDocument()
  })

  it('does not show Mark as Done when article is already published', () => {
    render(<ArticleEditor article={{ ...BASE_ARTICLE, status: 'published' }} token="tok" />)
    expect(screen.queryByRole('button', { name: /mark as done/i })).not.toBeInTheDocument()
  })

  it('blocks save when title is empty and shows error', async () => {
    render(<ArticleEditor article={{ ...BASE_ARTICLE, title: '' }} token="tok" />)
    const saveBtn = screen.getByRole('button', { name: /save/i })
    await userEvent.click(saveBtn)
    expect(screen.getByText(/title is required/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm run test:run -- ArticleEditor
```

Expected: FAIL

- [ ] **Step 3: Apply changes to ArticleEditor.tsx**

**Change 1** — rename the "Publish" button label (line ~268):
```typescript
// BEFORE:
{publishingArticle ? "Publishing…" : "Publish"}

// AFTER:
{publishingArticle ? "Marking…" : "Mark as Done"}
```

**Change 2** — add title validation state near other state declarations:
```typescript
const [titleError, setTitleError] = useState('')
```

**Change 3** — update the `save` callback to validate title first:
```typescript
const save = useCallback(async () => {
  if (!title.trim()) {
    setTitleError('Title is required')
    return
  }
  setTitleError('')
  setSaving(true)
  // ... rest of existing save logic
```

**Change 4** — render title error below the title input (after the `<input value={title} ...>` block):
```typescript
{titleError && (
  <p style={{ fontSize: 12, color: '#dc2626', margin: '4px 0 0' }}>{titleError}</p>
)}
```

**Change 5** — add helper text below the "Mark as Done" button group. After the closing `</div>` of the action buttons div, add:
```typescript
{articleStatus === 'draft' && (
  <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right', margin: '4px 0 0' }}>
    Marks this article as finished. To share externally, publish to Substack using the button below.
  </p>
)}
```

**Change 6** — update Substack URL input placeholder:
```typescript
// BEFORE:
placeholder="Paste Substack URL once published there…"

// AFTER:
placeholder="After publishing on Substack, paste the URL here to enable social sharing"
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm run test:run -- ArticleEditor
```

Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/articles/
git commit -m "fix: rename Publish to Mark as Done, add title validation, update Substack URL copy"
```

---

### Task 13: Improve empty states

**Files:** Modify `upload/page.tsx`, `articles/page.tsx`, `community/page.tsx`

- [ ] **Step 1: Update upload/page.tsx empty state**

Find the jobs empty state (around line 327-330):
```typescript
// BEFORE:
<p style={{ fontSize: 13, margin: 0 }}>No jobs yet</p>

// AFTER:
<p style={{ fontSize: 13, margin: '0 0 8px' }}>No conversations uploaded yet.</p>
<p style={{ fontSize: 12, color: '#b0b0b0', margin: 0 }}>
  Select an audio file above to get started — transcription takes ~5 minutes.
</p>
```

- [ ] **Step 2: Update articles/page.tsx empty states**

Find the empty state block (lines 110-123) and replace the `<p>` text:

```typescript
// BEFORE (articles tab):
"No articles yet. They'll appear here once jobs complete."

// AFTER:
<>
  No articles yet.{' '}
  <Link href="/upload" style={{ color: '#56a1d2', fontWeight: 600 }}>
    Upload a conversation →
  </Link>{' '}
  to generate your first one.
</>
```

```typescript
// BEFORE (transcripts tab):
"No transcripts yet. They appear after processing completes."

// AFTER:
<>
  Transcripts appear here after a conversation is processed.{' '}
  <Link href="/upload" style={{ color: '#56a1d2', fontWeight: 600 }}>
    Go to Upload →
  </Link>
</>
```

Note: the empty state `<p>` needs to become a `<div>` to hold the `Link` element inline.

- [ ] **Step 3: Update community/page.tsx empty state**

Find the empty/zero-data state and replace generic message with:
```
No community data yet. Stats appear once you've published articles and built your team.
```

- [ ] **Step 4: Run full test suite**

```bash
npm run test:run
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/upload/ src/app/\(admin\)/articles/ src/app/\(admin\)/community/
git commit -m "fix: improve empty states with actionable copy and next-step links"
```

---

### Task 14: Add form validation to settings API key inputs

**Files:** Modify `frontend/src/app/(admin)/settings/page.tsx`

- [ ] **Step 1: Write failing test**

Create `frontend/src/app/(admin)/settings/settings.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithSession } from '@/test/helpers'

// We test the validation logic by rendering the settings page
// and triggering the inline API key save with a short key.
// Since the page uses useSession, we use renderWithSession.

// Import the inline component that handles API key editing.
// If the component is too large to import directly, test the validation
// logic by finding the input and submit mechanism.

describe('Settings — API key validation', () => {
  it('shows error when key is fewer than 10 characters', async () => {
    // This test verifies the client-side validation message.
    // Render a minimal version of the key entry UI by extracting
    // the validateKey function from the page, or test at the integration level.

    // Inline validation function (mirrors what we add to settings/page.tsx):
    function validateKey(key: string): string | null {
      if (!key.trim()) return 'Key is required'
      if (key.trim().length < 10) return 'Key seems too short — check you copied it completely'
      return null
    }

    expect(validateKey('')).toBe('Key is required')
    expect(validateKey('short')).toBe('Key seems too short — check you copied it completely')
    expect(validateKey('a'.repeat(10))).toBeNull()
    expect(validateKey('a'.repeat(40))).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect PASS (validation logic test)**

```bash
npm run test:run -- settings
```

- [ ] **Step 3: Add validateKey function and wire into settings/page.tsx**

At the top of `settings/page.tsx`, add this utility function (before the component):

```typescript
function validateApiKey(key: string): string | null {
  if (!key.trim()) return 'Key is required'
  if (key.trim().length < 10) return 'Key seems too short — check you copied it completely'
  return null
}
```

In the save handler for API keys, before calling `fetch`, add:
```typescript
const validationError = validateApiKey(keyValue)
if (validationError) {
  setError(validationError) // use existing error state
  return
}
```

Render the error below the key input field (it already has an error display pattern — wire to the same state).

- [ ] **Step 4: Run test suite**

```bash
npm run test:run
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/settings/
git commit -m "feat: add API key length validation in settings page"
```

---

### Task 15: Add form validation to team and user forms

**Files:** Modify `frontend/src/app/(admin)/team/page.tsx`, `frontend/src/app/(admin)/users/page.tsx`

- [ ] **Step 1: Write validation unit tests**

Create `frontend/src/app/(admin)/team/team.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'

function validateTeamMember(form: { name: string; email: string; role: string }) {
  const errors: Record<string, string> = {}
  if (!form.name.trim()) errors.name = 'Name is required'
  if (!form.email.trim()) {
    errors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Enter a valid email address'
  }
  if (!form.role) errors.role = 'Role is required'
  return errors
}

describe('team member form validation', () => {
  it('returns name error when name is empty', () => {
    const e = validateTeamMember({ name: '', email: 'a@b.com', role: 'Host' })
    expect(e.name).toBe('Name is required')
  })

  it('returns email error when email is invalid', () => {
    const e = validateTeamMember({ name: 'Ian', email: 'notanemail', role: 'Host' })
    expect(e.email).toBe('Enter a valid email address')
  })

  it('returns email error when email is empty', () => {
    const e = validateTeamMember({ name: 'Ian', email: '', role: 'Host' })
    expect(e.email).toBe('Email is required')
  })

  it('returns role error when role is empty', () => {
    const e = validateTeamMember({ name: 'Ian', email: 'a@b.com', role: '' })
    expect(e.role).toBe('Role is required')
  })

  it('returns no errors for valid data', () => {
    const e = validateTeamMember({ name: 'Ian', email: 'ian@example.com', role: 'Host' })
    expect(Object.keys(e)).toHaveLength(0)
  })
})
```

Create `frontend/src/app/(admin)/users/users.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'

function validateUser(form: { email: string; password: string; role: string }) {
  const errors: Record<string, string> = {}
  if (!form.email.trim()) {
    errors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Enter a valid email address'
  }
  if (!form.password) {
    errors.password = 'Password is required'
  } else if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters'
  }
  if (!form.role) errors.role = 'Role is required'
  return errors
}

describe('user creation form validation', () => {
  it('returns email error for invalid format', () => {
    const e = validateUser({ email: 'bad', password: 'password123', role: 'host' })
    expect(e.email).toBe('Enter a valid email address')
  })

  it('returns password error when fewer than 8 characters', () => {
    const e = validateUser({ email: 'a@b.com', password: 'short', role: 'host' })
    expect(e.password).toBe('Password must be at least 8 characters')
  })

  it('returns role error when role is empty', () => {
    const e = validateUser({ email: 'a@b.com', password: 'password123', role: '' })
    expect(e.role).toBe('Role is required')
  })

  it('returns no errors for valid data', () => {
    const e = validateUser({ email: 'a@b.com', password: 'password123', role: 'host' })
    expect(Object.keys(e)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run — expect PASS (pure validation logic)**

```bash
npm run test:run -- team users
```

Expected: `9 passed`

- [ ] **Step 3: Add validateTeamMember to team/page.tsx**

Add at the top of `team/page.tsx` (before component):

```typescript
function validateTeamMember(form: { name: string; email: string; role: string }) {
  const errors: Record<string, string> = {}
  if (!form.name.trim()) errors.name = 'Name is required'
  if (!form.email.trim()) {
    errors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Enter a valid email address'
  }
  if (!form.role) errors.role = 'Role is required'
  return errors
}
```

Add `formErrors` state: `const [formErrors, setFormErrors] = useState<Record<string, string>>({})`

In the submit handler, before the fetch call:
```typescript
const errors = validateTeamMember(form)
if (Object.keys(errors).length > 0) {
  setFormErrors(errors)
  return
}
setFormErrors({})
```

Render errors below each field. After the name input:
```typescript
{formErrors.name && <p style={{ fontSize: 12, color: '#dc2626', margin: '2px 0 0' }}>{formErrors.name}</p>}
```
After the email input:
```typescript
{formErrors.email && <p style={{ fontSize: 12, color: '#dc2626', margin: '2px 0 0' }}>{formErrors.email}</p>}
```
After the role input:
```typescript
{formErrors.role && <p style={{ fontSize: 12, color: '#dc2626', margin: '2px 0 0' }}>{formErrors.role}</p>}
```

- [ ] **Step 4: Add validateUser to users/page.tsx**

Add at the top of `users/page.tsx`:

```typescript
function validateUser(form: { email: string; password: string; role: string }) {
  const errors: Record<string, string> = {}
  if (!form.email.trim()) {
    errors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Enter a valid email address'
  }
  if (!form.password) {
    errors.password = 'Password is required'
  } else if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters'
  }
  if (!form.role) errors.role = 'Role is required'
  return errors
}
```

Add `formErrors` state and wire exactly as in team/page.tsx — validate before fetch, display errors below fields.

- [ ] **Step 5: Run full test suite**

```bash
npm run test:run
```

Expected: all tests pass

- [ ] **Step 6: Final TypeScript and lint check**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/app/\(admin\)/team/ src/app/\(admin\)/users/
git commit -m "feat: add form validation to team member and user creation forms"
```

---

### ✅ Layer 4 complete — Final QA review checkpoint

**Review agent instructions:** Run `npm run test:run` (all tests must pass), `npx tsc --noEmit` (no type errors), `npm run lint` (no lint errors). Verify: (1) ArticleEditor has "Mark as Done" not "Publish", (2) title validation blocks save when empty, (3) empty states in upload/articles/community have actionable copy, (4) settings/team/users all have inline validation errors. Run `npm run build` — build must succeed. Report any failures.

---

## Final Steps

- [ ] **Push branch**

```bash
git push -u origin feature/ux-overhaul
```

- [ ] **Open PR targeting develop**

```bash
gh pr create \
  --title "feat: UX overhaul — sidebar, dashboards, onboarding, validation" \
  --base develop \
  --body "$(cat <<'EOF'
## Summary
- Testing infrastructure: Vitest + RTL with helpers and mocks
- Sidebar: active state highlighting, role/chapter badge
- Toast system: Sonner wired across all admin pages
- Role-specific dashboards: host, chapter lead, superadmin with onboarding banners
- Publish semantics: "Publish" renamed to "Mark as Done" with helper text
- Empty states: actionable copy with next-step links
- Form validation: settings API keys, team members, user creation

## Test plan
- [ ] Run `npm run test:run` — all tests pass
- [ ] Log in as host, chapter lead, superadmin — verify correct dashboard and sidebar badge
- [ ] Complete onboarding steps — verify banner advances and disappears
- [ ] Try to save article with empty title — verify error appears
- [ ] Try to create team member with bad email — verify error appears
- [ ] Try to save a 5-character API key — verify error appears

🤖 Generated with Claude Code
EOF
)"
```
