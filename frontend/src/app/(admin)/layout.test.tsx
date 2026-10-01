import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AdminLayout from './layout'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => ({
    user: { name: 'Berlin Lead', email: 'lead@aisalon.xyz', role: 'chapter_lead', chapterId: 'c2' },
    accessToken: 'test-token',
  })),
}))

vi.mock('./SidebarNav', () => ({
  default: ({ chapterName }: { chapterName?: string }) => <nav data-testid="sidebar">{chapterName ?? 'no chapter'}</nav>,
}))
vi.mock('./SessionGuard', () => ({ default: () => null }))

function mockApi() {
  const calls: { url: string; auth?: string }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, auth: (init?.headers as Record<string, string> | undefined)?.Authorization })
      if (url.endsWith('/admin/chapters')) {
        return { ok: true, status: 200, json: async () => [{ id: 'c2', name: 'Berlin', code: 'berlin', status: 'draft' }] }
      }
      if (url.endsWith('/profile/me')) return { ok: true, status: 200, json: async () => ({ name: 'Berlin Lead' }) }
      return { ok: false, status: 404, json: async () => ({}) }
    })
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AdminLayout (server)', () => {
  it("shows a lead the name of their chapter even while it is still a draft", async () => {
    const calls = mockApi()

    render(await AdminLayout({ children: <p>page</p> }))

    expect(screen.getByTestId('sidebar')).toHaveTextContent('Berlin')
    expect(calls.find((c) => c.url.endsWith('/admin/chapters'))?.auth).toBe('Bearer test-token')
    expect(calls.some((c) => c.url.endsWith('/chapters') && !c.url.includes('/admin/'))).toBe(false)
  })
})
