import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithSession } from '@/test/helpers'
import PeoplePage from './page'

// The real cropper needs canvas + object URLs; stand in with a one-click confirm.
vi.mock('@/components/PhotoCropper', () => ({
  default: ({ onConfirm }: { onConfirm: (b: Blob) => void }) => (
    <button type="button" onClick={() => onConfirm(new Blob(['img'], { type: 'image/jpeg' }))}>
      Use photo
    </button>
  ),
}))

type Call = { url: string; init?: RequestInit }

const host = {
  id: 'h1', username: 'hana', email: 'hana@example.com', role: 'host', name: 'Hana Host',
  title: 'Host', is_founder: false, display_order: 1, profile_image_url: null,
  profile_completed_at: '2026-01-01T00:00:00Z', hide_from_team: false,
  chapter_code: 'sf', chapter_name: 'San Francisco',
}
const founder = { ...host, id: 'f1', username: 'fay', name: 'Fay Founder', title: 'Co-Founder', is_founder: true }
const superadmin = { ...host, id: 's1', username: 'sam', name: 'Sam Super', title: 'Admin', role: 'superadmin' }
const hidden = { ...host, id: 'x1', username: 'hal', name: 'Hidden Hal', hide_from_team: true }

function mockApi({
  people = [host],
  summary = { hosting_interest: 0 },
  chapters = [] as unknown[],
}: { people?: unknown[]; summary?: Record<string, number>; chapters?: unknown[] } = {}) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (url.endsWith('/admin/people')) return { ok: true, status: 200, json: async () => people }
      if (url.endsWith('/admin/notifications/summary')) return { ok: true, status: 200, json: async () => summary }
      if (url.includes('/admin/people/')) return { ok: true, status: 200, json: async () => ({ ok: true }) }
      if (url.endsWith('/profile/photo')) return { ok: true, status: 200, json: async () => ({ url: '/uploads/new/photo.jpg' }) }
      if (url.endsWith('/admin/invites')) return { ok: true, status: 201, json: async () => ({ token: 'tok123' }) }
      if (url.endsWith('/chapters')) return { ok: true, status: 200, json: async () => chapters }
      return { ok: false, status: 404, json: async () => ({}) }
    })
  )
  return calls
}

function patchCalls(calls: Call[]) {
  return calls
    .filter((c) => c.init?.method === 'PATCH')
    .map((c) => ({ url: c.url, body: JSON.parse(c.init?.body as string) }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PeoplePage for a chapter lead', () => {
  it('lets the lead edit a host title inline', async () => {
    const calls = mockApi()
    renderWithSession(<PeoplePage />, { role: 'chapter_lead', chapterId: 'c1' })

    const input = await screen.findByLabelText('Title for Hana Host')
    fireEvent.change(input, { target: { value: 'Lead Host' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(patchCalls(calls)).toContainEqual({
        url: expect.stringMatching(/\/admin\/people\/h1$/),
        body: { title: 'Lead Host' },
      })
    })
  })

  it('lets the lead toggle whether a host is shown publicly', async () => {
    const calls = mockApi()
    renderWithSession(<PeoplePage />, { role: 'chapter_lead', chapterId: 'c1' })

    const checkbox = await screen.findByLabelText('Show Hana Host publicly')
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox)

    await waitFor(() => {
      expect(patchCalls(calls)).toContainEqual({
        url: expect.stringMatching(/\/admin\/people\/h1$/),
        body: { hide_from_team: true },
      })
    })
  })

  it('shows no edit controls on founder or superadmin rows', async () => {
    mockApi({ people: [founder, superadmin] })
    renderWithSession(<PeoplePage />, { role: 'chapter_lead', chapterId: 'c1' })

    expect(await screen.findByText('Fay Founder')).toBeInTheDocument()
    expect(screen.getByText('Sam Super')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByLabelText(/publicly$/)).toBeNull()
  })

  it('labels the visibility column "Public" with an explanation', async () => {
    mockApi()
    renderWithSession(<PeoplePage />, { role: 'chapter_lead', chapterId: 'c1' })

    await screen.findByText('Hana Host')
    const header = screen.getByRole('columnheader', { name: 'Public' })
    expect(header).toHaveAttribute('title', expect.stringMatching(/aisalon\.xyz/))
    expect(screen.queryByRole('columnheader', { name: /on site/i })).toBeNull()
  })

  it('never shows the founder toggle to a lead', async () => {
    mockApi()
    renderWithSession(<PeoplePage />, { role: 'chapter_lead', chapterId: 'c1' })

    await screen.findByText('Hana Host')
    expect(screen.queryByLabelText('Founder: Hana Host')).toBeNull()
  })

  it('offers no photo editing to a lead', async () => {
    mockApi()
    renderWithSession(<PeoplePage />, { role: 'chapter_lead', chapterId: 'c1' })

    await screen.findByText('Hana Host')
    expect(screen.queryByRole('button', { name: /change photo/i })).toBeNull()
    expect(screen.queryByLabelText('New photo file')).toBeNull()
  })

  it('marks hidden members with a Hidden pill', async () => {
    mockApi({ people: [hidden] })
    renderWithSession(<PeoplePage />, { role: 'chapter_lead', chapterId: 'c1' })

    expect(await screen.findByText('Hidden Hal')).toBeInTheDocument()
    expect(screen.getByText('Hidden')).toBeInTheDocument()
  })

  it('shows an outstanding hosting-interest notice linking to the Host Interest page', async () => {
    mockApi({ summary: { hosting_interest: 2 } })
    renderWithSession(<PeoplePage />, { role: 'chapter_lead', chapterId: 'c1' })

    expect(await screen.findByText(/2 new hosting requests/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /review/i })).toHaveAttribute('href', '/hosting-interest')
  })

  it('hides the hosting-interest notice when nothing is outstanding', async () => {
    mockApi({ summary: { hosting_interest: 0 } })
    renderWithSession(<PeoplePage />, { role: 'chapter_lead', chapterId: 'c1' })

    await screen.findByText('Hana Host')
    expect(screen.queryByText(/hosting request/i)).toBeNull()
  })

  it('shows the invite card on load with no separate toggle button', async () => {
    mockApi()
    renderWithSession(<PeoplePage />, { role: 'chapter_lead', chapterId: 'c1' })

    await screen.findByText('Hana Host')
    expect(screen.getByText('Invite a Member')).toBeInTheDocument()
    // Only the card's own button exists — no page-level "Create invite link" / "Close" toggle.
    expect(screen.getAllByRole('button', { name: /create invite link/i })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /^close$/i })).toBeNull()
  })
})

describe('PeoplePage for a superadmin', () => {
  it('shows Founder as a read-only badge, never a toggle', async () => {
    mockApi({ people: [host, founder] })
    renderWithSession(<PeoplePage />, { role: 'superadmin' })

    expect(await screen.findByText('Fay Founder')).toBeInTheDocument()
    expect(screen.getByText('Founder')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Founder' })).toBeNull()
    expect(screen.queryByLabelText(/^Founder:/)).toBeNull()
    expect(screen.getByLabelText('Title for Hana Host')).toBeInTheDocument()
  })

  it('marks a profile complete as soon as it has a name', async () => {
    mockApi({ people: [{ ...host, profile_completed_at: null }, { ...host, id: 'n1', name: null, username: 'nameless' }] })
    renderWithSession(<PeoplePage />, { role: 'superadmin' })

    await screen.findByText('Hana Host')
    expect(screen.getAllByText('Complete')).toHaveLength(1)
    expect(screen.getAllByText('Incomplete')).toHaveLength(1)
  })

  it('can preview the page as a chapter lead and exit again', async () => {
    const berlinHost = { ...host, id: 'b1', username: 'bea', name: 'Bea Berlin', chapter_code: 'berlin', chapter_name: 'Berlin' }
    mockApi({
      people: [host, berlinHost],
      chapters: [{ id: 'c1', code: 'sf', name: 'San Francisco' }, { id: 'c2', code: 'berlin', name: 'Berlin' }],
    })
    renderWithSession(<PeoplePage />, { role: 'superadmin' })

    await screen.findByText('Bea Berlin')
    fireEvent.change(await screen.findByLabelText('View as chapter'), { target: { value: 'sf' } })

    // Only SF members, lead-level controls only.
    expect(screen.queryByText('Bea Berlin')).toBeNull()
    expect(screen.getByText('Hana Host')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/San Francisco/)
    expect(screen.queryByRole('button', { name: /change photo/i })).toBeNull()
    expect(screen.getByLabelText('Title for Hana Host')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Exit preview' }))
    expect(await screen.findByText('Bea Berlin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change photo for Hana Host' })).toBeInTheDocument()
  })

  it('lets the superadmin replace a member photo from the row', async () => {
    const calls = mockApi()
    renderWithSession(<PeoplePage />, { role: 'superadmin' })

    fireEvent.click(await screen.findByRole('button', { name: 'Change photo for Hana Host' }))
    const file = new File(['abc'], 'hana.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('New photo file'), { target: { files: [file] } })
    fireEvent.click(await screen.findByRole('button', { name: 'Use photo' }))

    await waitFor(() => {
      const upload = calls.find((c) => c.url.endsWith('/profile/photo'))
      expect(upload?.init?.method).toBe('POST')
      expect(upload?.init?.body).toBeInstanceOf(FormData)
      expect(patchCalls(calls)).toContainEqual({
        url: expect.stringMatching(/\/admin\/people\/h1$/),
        body: { profile_image_url: '/uploads/new/photo.jpg' },
      })
    })
  })

  it('rejects non-image files before uploading anything', async () => {
    const calls = mockApi()
    renderWithSession(<PeoplePage />, { role: 'superadmin' })

    fireEvent.click(await screen.findByRole('button', { name: 'Change photo for Hana Host' }))
    const file = new File(['abc'], 'notes.txt', { type: 'text/plain' })
    fireEvent.change(screen.getByLabelText('New photo file'), { target: { files: [file] } })

    expect(screen.queryByRole('button', { name: 'Use photo' })).toBeNull()
    expect(calls.some((c) => c.url.endsWith('/profile/photo'))).toBe(false)
  })
})

describe('PeoplePage for a host', () => {
  it('is read-only with no invite card or notice', async () => {
    mockApi({ summary: { hosting_interest: 3 } })
    renderWithSession(<PeoplePage />, { role: 'host', chapterId: 'c1' })

    expect(await screen.findByText('Hana Host')).toBeInTheDocument()
    expect(screen.getByText('Host')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button', { name: /create invite link/i })).toBeNull()
    expect(screen.queryByText(/hosting request/i)).toBeNull()
  })
})
