import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import SidebarNav from './SidebarNav'

function mockSession(role: string) {
  vi.mocked(useSession).mockReturnValue({
    data: {
      user: { role },
      accessToken: 'test-token',
    },
    status: 'authenticated',
  } as never)
}

function mockFetchWithSummary(summary: Record<string, number>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: RequestInfo | URL) => {
      if (String(url).includes('/admin/notifications/summary')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(summary) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ count: 0 }) })
    })
  )
}

describe('SidebarNav — group badge bubbling', () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue('/dashboard')
    mockSession('chapter_lead')
  })

  it('shows the summed child badges on a collapsed group header', async () => {
    mockFetchWithSummary({ hosting_interest: 2, volunteer_applications: 3 })
    render(<SidebarNav />)
    const header = screen.getByRole('button', { name: /team management/i })
    expect(await within(header).findByText('5')).toBeInTheDocument()
  })

  it('hides the header total and shows child badges when the group is expanded', async () => {
    mockFetchWithSummary({ hosting_interest: 2, volunteer_applications: 3 })
    render(<SidebarNav />)
    const header = screen.getByRole('button', { name: /team management/i })
    await within(header).findByText('5')

    await userEvent.click(header)

    expect(within(header).queryByText('5')).not.toBeInTheDocument()
    const hostInterest = screen.getByRole('link', { name: /host interest/i })
    expect(within(hostInterest).getByText('2')).toBeInTheDocument()
    const volunteerApps = screen.getByRole('link', { name: /volunteer applications/i })
    expect(within(volunteerApps).getByText('3')).toBeInTheDocument()
  })

  it('shows no badge on the header when child counts are zero', async () => {
    mockFetchWithSummary({ contact_messages: 4 })
    render(<SidebarNav />)
    // contact messages badge renders, so the summary fetch has resolved
    const contact = screen.getByRole('link', { name: /contact messages/i })
    expect(await within(contact).findByText('4')).toBeInTheDocument()

    const header = screen.getByRole('button', { name: /team management/i })
    expect(within(header).queryByText(/\d/)).not.toBeInTheDocument()
  })
})
