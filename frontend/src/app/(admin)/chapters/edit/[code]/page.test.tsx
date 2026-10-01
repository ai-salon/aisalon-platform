import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { useParams } from 'next/navigation'
import { renderWithSession } from '@/test/helpers'
import ChapterEditPage from './page'

// A chapter that is still being built up: hidden from the public site, but
// its lead needs to edit it and a superadmin needs to be able to publish it.
const berlin = {
  id: 'c2', code: 'berlin', name: 'Berlin', title: 'Ai Salon Berlin', description: '',
  tagline: '', about: '', event_link: '', calendar_embed: '', events_description: '',
  status: 'draft', chapter_guide: null,
}

function mockApi() {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url)
      if (url.endsWith('/admin/chapters/berlin')) {
        return { ok: true, status: 200, json: async () => berlin }
      }
      // The public endpoint 404s on drafts — the page must not depend on it.
      return { ok: false, status: 404, json: async () => ({ detail: 'Chapter not found' }) }
    })
  )
  return calls
}

beforeEach(() => {
  vi.mocked(useParams).mockReturnValue({ code: 'berlin' })
  // Narrow layout: only the edit pane renders, keeping the live preview
  // (canvas-backed) out of jsdom.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ChapterEditPage', () => {
  it('loads a draft chapter through the admin endpoint so it can be edited before launch', async () => {
    const calls = mockApi()
    renderWithSession(<ChapterEditPage />, { role: 'chapter_lead', chapterId: 'c2' })

    expect(await screen.findByDisplayValue('Ai Salon Berlin')).toBeInTheDocument()
    expect(calls.some((u) => u.endsWith('/admin/chapters/berlin'))).toBe(true)
    expect(calls.some((u) => u.endsWith('/chapters/berlin') && !u.includes('/admin/'))).toBe(false)
  })

  it('lets a superadmin change the status', async () => {
    mockApi()
    renderWithSession(<ChapterEditPage />, { role: 'superadmin' })

    await screen.findByDisplayValue('Ai Salon Berlin')
    expect(screen.getByLabelText('Status')).toHaveValue('draft')
  })

  it('hides the status control from chapter leads — showing a chapter is not their call', async () => {
    mockApi()
    renderWithSession(<ChapterEditPage />, { role: 'chapter_lead', chapterId: 'c2' })

    await screen.findByDisplayValue('Ai Salon Berlin')
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
  })
})
