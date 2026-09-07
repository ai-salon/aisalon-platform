import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithSession } from '@/test/helpers'
import InviteCard from './InviteCard'

type Call = { url: string; init?: RequestInit }

function mockApi(chapters: { id: string; name: string; code: string }[] = []) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (url.endsWith('/admin/invites')) {
        return { ok: true, status: 201, json: async () => ({ token: 'tok123' }) }
      }
      if (url.endsWith('/chapters')) {
        return { ok: true, status: 200, json: async () => chapters }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('InviteCard', () => {
  it('lets a chapter lead create a one-time host invite for their chapter and shows the link', async () => {
    const calls = mockApi()
    renderWithSession(<InviteCard />, { role: 'chapter_lead', chapterId: 'c1' })

    fireEvent.click(screen.getByRole('button', { name: /create invite link/i }))

    expect(await screen.findByText(/register\?invite=tok123/)).toBeInTheDocument()
    const post = calls.find((c) => c.url.endsWith('/admin/invites'))
    expect(post?.init?.method).toBe('POST')
    expect(JSON.parse(post?.init?.body as string)).toEqual({ chapter_id: 'c1', role: 'host', max_uses: 1 })
  })

  it('shows chapter and role pickers to a superadmin', async () => {
    mockApi([{ id: 'c1', name: 'San Francisco', code: 'sf' }])
    renderWithSession(<InviteCard />, { role: 'superadmin' })

    expect(await screen.findByRole('option', { name: 'San Francisco' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Chapter Lead' })).toBeInTheDocument()
  })

  it('does not show pickers to a chapter lead', () => {
    mockApi()
    renderWithSession(<InviteCard />, { role: 'chapter_lead', chapterId: 'c1' })

    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
