import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HostDashboard from './HostDashboard'

const BASE_PROPS = {
  userName: 'Sarah',
  chapterName: 'SF Bay Area',
  completedSteps: [false, false, false] as [boolean, boolean, boolean],
  recentJobs: [] as { id: string; input_filename: string; status: string; created_at: string }[],
}

describe('HostDashboard', () => {
  it('renders welcome heading with user name', () => {
    render(<HostDashboard {...BASE_PROPS} />)
    expect(screen.getByText(/welcome, sarah/i)).toBeInTheDocument()
  })

  it('renders the onboarding banner when steps incomplete', () => {
    render(<HostDashboard {...BASE_PROPS} />)
    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument()
  })

  it('does not render banner when all steps complete', () => {
    render(<HostDashboard {...BASE_PROPS} completedSteps={[true, true, true]} />)
    expect(screen.queryByText(/^step \d+ of 3$/i)).not.toBeInTheDocument()
  })

  it('renders upload CTA link', () => {
    render(<HostDashboard {...BASE_PROPS} />)
    const links = screen.getAllByRole('link', { name: /upload a conversation/i })
    expect(links.length).toBeGreaterThan(0)
  })

  it('renders empty state when no recent jobs', () => {
    render(<HostDashboard {...BASE_PROPS} />)
    expect(screen.getByText(/no conversations uploaded yet/i)).toBeInTheDocument()
  })

  it('renders recent jobs when provided', () => {
    const jobs = [
      { id: '1', input_filename: 'event.mp3', status: 'completed', created_at: '2026-04-13T10:00:00Z' },
    ]
    render(<HostDashboard {...BASE_PROPS} recentJobs={jobs} />)
    expect(screen.getByText('event.mp3')).toBeInTheDocument()
  })
})
