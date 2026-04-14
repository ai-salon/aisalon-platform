import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChapterLeadDashboard from './ChapterLeadDashboard'

const BASE_PROPS = {
  userName: 'Alex',
  chapterName: 'NYC',
  completedSteps: [false, false, false, false] as [boolean, boolean, boolean, boolean],
  stats: { articlesPublished: 0, articlesDraft: 0, teamCount: 0 },
  recentArticles: [] as { id: string; title: string; status: string; created_at: string }[],
}

describe('ChapterLeadDashboard', () => {
  it('renders welcome heading', () => {
    render(<ChapterLeadDashboard {...BASE_PROPS} />)
    expect(screen.getByText(/welcome, alex/i)).toBeInTheDocument()
  })

  it('shows onboarding banner when steps incomplete', () => {
    render(<ChapterLeadDashboard {...BASE_PROPS} />)
    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument()
  })

  it('renders stat values', () => {
    render(
      <ChapterLeadDashboard
        {...BASE_PROPS}
        stats={{ articlesPublished: 3, articlesDraft: 1, teamCount: 2 }}
      />
    )
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders empty state when no articles', () => {
    render(<ChapterLeadDashboard {...BASE_PROPS} />)
    expect(screen.getByText(/no articles yet/i)).toBeInTheDocument()
  })

  it('renders recent articles when provided', () => {
    const articles = [
      { id: '1', title: 'AI and Society', status: 'published', created_at: '2026-04-13T10:00:00Z' },
    ]
    render(<ChapterLeadDashboard {...BASE_PROPS} recentArticles={articles} />)
    expect(screen.getByText('AI and Society')).toBeInTheDocument()
  })
})
