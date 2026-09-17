import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithSession } from '@/test/helpers'
import UsersPage from './page'

// The real cropper needs canvas + object URLs; stand in with a one-click confirm.
vi.mock('@/components/PhotoCropper', () => ({
  default: ({ onConfirm }: { onConfirm: (b: Blob) => void }) => (
    <button type="button" onClick={() => onConfirm(new Blob(['img'], { type: 'image/jpeg' }))}>
      Use photo
    </button>
  ),
}))

type Call = { url: string; init?: RequestInit }

const base = {
  is_active: true, linkedin: null, description: null, last_login_at: null, login_count_30d: 0,
  has_api_key: false, has_uploaded: false, has_article: false,
  has_read_hosting_guide: false, has_read_lead_guide: false,
}
const users = [
  {
    ...base, id: 'u1', email: 'admin@aisalon.xyz', username: 'admin', role: 'superadmin',
    title: 'Co-Founder', name: 'Ian Eisenberg', chapter_id: null, is_founder: true,
    profile_image_url: '/images/people/ian.jpeg', display_order: 90, hide_from_team: false,
  },
  {
    ...base, id: 'u2', email: 'sf@aisalon.xyz', username: 'sf', role: 'chapter_lead',
    title: null, name: null, chapter_id: 'c1', is_founder: false,
    profile_image_url: null, display_order: 0, hide_from_team: true,
  },
]

function mockApi() {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (init?.method === 'PATCH' && url.includes('/admin/users/')) {
        const existing = users.find((u) => u.id === url.split('/').pop())
        return { ok: true, status: 200, json: async () => ({ ...existing, ...JSON.parse(init.body as string) }) }
      }
      if (init?.method === 'POST' && url.endsWith('/profile/photo')) {
        return { ok: true, status: 200, json: async () => ({ url: '/uploads/new/photo.jpg' }) }
      }
      if (init?.method === 'POST' && url.endsWith('/password-reset-link')) {
        return { ok: true, status: 202, json: async () => ({ detail: 'sent' }) }
      }
      if (init?.method === 'POST' && url.endsWith('/admin/users')) {
        const body = JSON.parse(init.body as string)
        return { ok: true, status: 201, json: async () => ({ ...users[1], id: 'u3', ...body }) }
      }
      if (url.endsWith('/admin/users')) return { ok: true, status: 200, json: async () => users }
      if (url.endsWith('/chapters')) return { ok: true, status: 200, json: async () => [{ id: 'c1', name: 'San Francisco', code: 'sf' }] }
      return { ok: false, status: 404, json: async () => ({}) }
    })
  )
  return calls
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

  it('says when to use Add User and points to the Team page for invites', async () => {
    mockApi()
    renderWithSession(<UsersPage />, { role: 'superadmin' })

    await screen.findByText('Ian Eisenberg')
    expect(screen.getByText(/register themselves into a chapter/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Team page' })).toHaveAttribute('href', '/people')
  })

  it('lets the superadmin edit every field of an account, presentation included', async () => {
    const calls = mockApi()
    renderWithSession(<UsersPage />, { role: 'superadmin' })

    fireEvent.click(await screen.findByRole('button', { name: 'Edit sf@aisalon.xyz' }))
    // Prefilled from the account.
    expect(screen.getByLabelText('Email for sf@aisalon.xyz')).toHaveValue('sf@aisalon.xyz')
    expect(screen.getByLabelText('Chapter for sf@aisalon.xyz')).toHaveValue('c1')
    expect(screen.getByLabelText('Founder for sf@aisalon.xyz')).not.toBeChecked()
    expect(screen.getByLabelText('Show sf@aisalon.xyz on the public site')).not.toBeChecked()
    expect(screen.getByLabelText('Display order for sf@aisalon.xyz')).toHaveValue(0)

    fireEvent.change(screen.getByLabelText('Name for sf@aisalon.xyz'), { target: { value: 'SF Ghost' } })
    fireEvent.change(screen.getByLabelText('Username for sf@aisalon.xyz'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('LinkedIn for sf@aisalon.xyz'), { target: { value: 'https://linkedin.com/in/sf' } })
    fireEvent.change(screen.getByLabelText('Bio for sf@aisalon.xyz'), { target: { value: 'System login' } })
    fireEvent.change(screen.getByLabelText('Role for sf@aisalon.xyz'), { target: { value: 'superadmin' } })
    fireEvent.click(screen.getByLabelText('Founder for sf@aisalon.xyz'))
    fireEvent.click(screen.getByLabelText('Show sf@aisalon.xyz on the public site'))
    fireEvent.change(screen.getByLabelText('Display order for sf@aisalon.xyz'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      const patch = calls.find((c) => c.init?.method === 'PATCH')
      expect(patch?.url).toMatch(/\/admin\/users\/u2$/)
      expect(JSON.parse(patch?.init?.body as string)).toEqual({
        name: 'SF Ghost', email: 'sf@aisalon.xyz', username: '', title: '',
        linkedin: 'https://linkedin.com/in/sf', description: 'System login',
        role: 'superadmin', chapter_id: 'c1', is_founder: true,
        profile_image_url: '', display_order: 4, hide_from_team: false,
      })
    })
    // The row reflects the saved name.
    expect(await screen.findByText('SF Ghost')).toBeInTheDocument()
  })

  it('uploads a new photo from the edit row and saves it with the account', async () => {
    const calls = mockApi()
    renderWithSession(<UsersPage />, { role: 'superadmin' })

    fireEvent.click(await screen.findByRole('button', { name: 'Edit sf@aisalon.xyz' }))
    const file = new File(['abc'], 'sf.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Photo file for sf@aisalon.xyz'), { target: { files: [file] } })
    fireEvent.click(await screen.findByRole('button', { name: 'Use photo' }))
    // Uploaded; the picker now offers Change/Remove.
    expect(await screen.findByRole('button', { name: 'Change photo for sf@aisalon.xyz' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      const patch = calls.find((c) => c.init?.method === 'PATCH')
      expect(JSON.parse(patch?.init?.body as string)).toMatchObject({ profile_image_url: '/uploads/new/photo.jpg' })
    })
  })

  it('can remove an existing photo', async () => {
    const calls = mockApi()
    renderWithSession(<UsersPage />, { role: 'superadmin' })

    fireEvent.click(await screen.findByRole('button', { name: 'Edit admin@aisalon.xyz' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo for admin@aisalon.xyz' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      const patch = calls.find((c) => c.init?.method === 'PATCH')
      expect(JSON.parse(patch?.init?.body as string)).toMatchObject({ profile_image_url: '', display_order: 90 })
    })
  })

  it('refuses to save an account without an email', async () => {
    const calls = mockApi()
    renderWithSession(<UsersPage />, { role: 'superadmin' })

    fireEvent.click(await screen.findByRole('button', { name: 'Edit sf@aisalon.xyz' }))
    fireEvent.change(screen.getByLabelText('Email for sf@aisalon.xyz'), { target: { value: '  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(calls.some((c) => c.init?.method === 'PATCH')).toBe(false)
  })

  it('creates a whole person in one place: profile, photo, order, visibility, emailed link', async () => {
    const calls = mockApi()
    renderWithSession(<UsersPage />, { role: 'superadmin' })

    await screen.findByText('Ian Eisenberg')
    fireEvent.click(screen.getByRole('button', { name: /add user/i }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'cecilia@example.com' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Cecilia Callas' } })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Co-Founder, Advisor' } })
    fireEvent.change(screen.getByLabelText('Bio'), { target: { value: 'AI ethicist' } })
    fireEvent.click(screen.getByLabelText('Founder'))
    fireEvent.change(screen.getByLabelText('Display order'), { target: { value: '91' } })
    const file = new File(['abc'], 'cc.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Photo file for the new user'), { target: { files: [file] } })
    fireEvent.click(await screen.findByRole('button', { name: 'Use photo' }))
    await screen.findByRole('button', { name: 'Change photo for the new user' })
    // "Email them a link" is on by default, so no password is needed.
    fireEvent.click(screen.getByRole('button', { name: /create user/i }))

    await waitFor(() => {
      const post = calls.find((c) => c.init?.method === 'POST' && c.url.endsWith('/admin/users'))
      expect(post).toBeDefined()
      expect(JSON.parse(post!.init!.body as string)).toMatchObject({
        email: 'cecilia@example.com', name: 'Cecilia Callas', title: 'Co-Founder, Advisor',
        description: 'AI ethicist', password: null, send_password_link: true, is_founder: true,
        profile_image_url: '/uploads/new/photo.jpg', display_order: 91, hide_from_team: false,
      })
    })
    expect(await screen.findByText('Cecilia Callas')).toBeInTheDocument()
  })

  it('requires a password when the email link is switched off', async () => {
    const calls = mockApi()
    renderWithSession(<UsersPage />, { role: 'superadmin' })

    await screen.findByText('Ian Eisenberg')
    fireEvent.click(screen.getByRole('button', { name: /add user/i }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x@example.com' } })
    fireEvent.click(screen.getByLabelText('Email them a link to set their password'))
    fireEvent.click(screen.getByRole('button', { name: /create user/i }))

    expect(await screen.findByText('Password is required')).toBeInTheDocument()
    expect(calls.some((c) => c.init?.method === 'POST')).toBe(false)
  })

  it('can email an existing account a reset link', async () => {
    const calls = mockApi()
    renderWithSession(<UsersPage />, { role: 'superadmin' })

    await screen.findByText('Ian Eisenberg')
    fireEvent.click(screen.getByRole('button', { name: 'Reset password for admin@aisalon.xyz' }))
    fireEvent.click(screen.getByRole('button', { name: 'Email reset link to admin@aisalon.xyz' }))

    await waitFor(() => {
      expect(calls.some((c) => c.init?.method === 'POST' && c.url.endsWith('/admin/users/u1/password-reset-link'))).toBe(true)
    })
  })
})
