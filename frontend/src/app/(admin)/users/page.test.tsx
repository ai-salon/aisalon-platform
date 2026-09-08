import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithSession } from '@/test/helpers'
import UsersPage from './page'

const users = [
  {
    id: 'u1', email: 'admin@aisalon.xyz', username: 'admin', role: 'superadmin',
    title: 'Co-Founder', name: 'Ian Eisenberg', chapter_id: null, is_active: true,
    last_login_at: null, login_count_30d: 0, has_api_key: false, has_uploaded: false,
    has_article: false, has_read_hosting_guide: false, has_read_lead_guide: false,
  },
  {
    id: 'u2', email: 'sf@aisalon.xyz', username: 'sf', role: 'chapter_lead',
    title: null, name: null, chapter_id: 'c1', is_active: true,
    last_login_at: null, login_count_30d: 0, has_api_key: false, has_uploaded: false,
    has_article: false, has_read_hosting_guide: false, has_read_lead_guide: false,
  },
]

function mockApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/admin/users')) return { ok: true, status: 200, json: async () => users }
      if (url.endsWith('/chapters')) return { ok: true, status: 200, json: async () => [{ id: 'c1', name: 'San Francisco', code: 'sf' }] }
      return { ok: false, status: 404, json: async () => ({}) }
    })
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('UsersPage', () => {
  it("shows each account's display name so people are recognisable", async () => {
    mockApi()
    renderWithSession(<UsersPage />, { role: 'superadmin' })

    expect(await screen.findByText('Ian Eisenberg')).toBeInTheDocument()
    expect(screen.getByText('admin@aisalon.xyz')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
    // Nameless ghost logins show a dash rather than nothing.
    const ghostRow = screen.getByText('sf@aisalon.xyz').closest('tr')
    expect(ghostRow).not.toBeNull()
    expect(ghostRow!.querySelector('td')?.textContent).toBe('—')
  })
})
