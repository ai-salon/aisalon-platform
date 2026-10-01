import { describe, it, expect, vi, afterEach } from 'vitest'
import ArticleDetailPage from './page'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => ({
    user: { name: 'Admin', email: 'admin@aisalon.xyz', role: 'superadmin' },
    accessToken: 'test-token',
  })),
}))

vi.mock('./ArticleEditor', () => ({
  default: (props: Record<string, unknown>) => <div data-testid="editor" data-props={JSON.stringify(props)} />,
}))

const article = { id: 'a1', title: 'First salon', status: 'draft', chapter_id: 'c2', content_md: '' }

function mockApi() {
  const calls: { url: string; auth?: string }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, auth: (init?.headers as Record<string, string> | undefined)?.Authorization })
      if (url.endsWith('/admin/articles/a1')) return { ok: true, status: 200, json: async () => article }
      if (url.endsWith('/admin/chapters')) {
        return { ok: true, status: 200, json: async () => [{ id: 'c2', name: 'Berlin', code: 'berlin', status: 'draft' }] }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ArticleDetailPage (server)', () => {
  it("names the article's chapter even while that chapter is still a draft", async () => {
    const calls = mockApi()

    const tree = await ArticleDetailPage({ params: Promise.resolve({ id: 'a1' }) })

    // <Suspense><ArticleEditor …/></Suspense>
    const editorProps = (tree as { props: { children: { props: Record<string, unknown> } } }).props.children.props
    expect(editorProps.chapterName).toBe('Berlin')
    expect(calls.find((c) => c.url.endsWith('/admin/chapters'))?.auth).toBe('Bearer test-token')
    expect(calls.some((c) => c.url.endsWith('/chapters') && !c.url.includes('/admin/'))).toBe(false)
  })
})
