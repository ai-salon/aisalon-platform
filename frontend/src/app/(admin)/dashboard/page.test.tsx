import { describe, it, expect, vi, afterEach } from 'vitest'
import DashboardPage from './page'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => ({
    user: { name: 'Berlin Lead', email: 'lead@aisalon.xyz', role: 'chapter_lead', chapterId: 'c2' },
    accessToken: 'test-token',
  })),
}))

vi.mock('./WelcomeDashboard', () => ({
  default: (props: Record<string, unknown>) => <div data-testid="welcome" data-props={JSON.stringify(props)} />,
}))

// A chapter still in draft: hidden from the public endpoint, visible to admin.
const berlin = { id: 'c2', code: 'berlin', name: 'Berlin', tagline: 'Guten Tag', description: 'd', status: 'draft' }

function mockApi() {
  const calls: { url: string; auth?: string }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, auth: (init?.headers as Record<string, string> | undefined)?.Authorization })
      if (url.endsWith('/admin/chapters')) return { ok: true, status: 200, json: async () => [berlin] }
      if (url.endsWith('/admin/me')) return { ok: true, status: 200, json: async () => ({}) }
      // Everything else, including the public /chapters, is empty or missing.
      return { ok: false, status: 404, json: async () => ({}) }
    })
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DashboardPage (server)', () => {
  it("finds a lead's own chapter through the admin endpoint, even while it is a draft", async () => {
    const calls = mockApi()

    const tree = await DashboardPage()

    const chaptersCall = calls.find((c) => c.url.endsWith('/admin/chapters'))
    expect(chaptersCall?.auth).toBe('Bearer test-token')
    expect(calls.some((c) => c.url.endsWith('/chapters') && !c.url.includes('/admin/'))).toBe(false)

    // The lead's chapter was resolved, so the "set up your chapter" onboarding
    // step (index 4 for leads) reads as done.
    const props = (tree as { props: { userChapter?: unknown; completedSteps?: boolean[] } }).props
    expect(props.userChapter).toEqual({ id: 'c2', code: 'berlin', name: 'Berlin' })
    expect(props.completedSteps?.[4]).toBe(true)
  })
})
