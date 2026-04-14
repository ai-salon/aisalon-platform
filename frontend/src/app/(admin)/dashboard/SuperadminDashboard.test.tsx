import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SuperadminDashboard from './SuperadminDashboard'

const BASE_PROPS = {
  userName: 'Ian',
  platformStats: { totalChapters: 5, totalUsers: 12, recentJobs: 3 },
  chapters: [
    {
      id: '1',
      name: 'SF Bay Area',
      code: 'sf',
      articleCount: 10,
      teamCount: 3,
      is_active: true,
    },
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

  it('renders platform stat values', () => {
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
