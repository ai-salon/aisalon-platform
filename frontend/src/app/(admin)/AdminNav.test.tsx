import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import AdminNav from './AdminNav'

const HOST_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'fa-th-large' },
  { href: '/upload', label: 'Upload Conversations', icon: 'fa-upload' },
  { href: '/articles', label: 'Articles', icon: 'fa-file-text-o' },
  { href: '/settings', label: 'Settings', icon: 'fa-cog' },
]

const FULL_NAV = [
  ...HOST_NAV,
  { href: '/community', label: 'Community', icon: 'fa-bar-chart' },
  { href: '/users', label: 'Users', icon: 'fa-user-circle-o' },
]

describe('AdminNav — active state', () => {
  it('applies active background to the current route', () => {
    vi.mocked(usePathname).mockReturnValue('/articles')
    render(<AdminNav navItems={HOST_NAV} userRole="host" />)
    const link = screen.getByRole('link', { name: /articles/i })
    expect(link).toHaveStyle({ background: 'rgb(86, 161, 210)' })
  })

  it('does not apply active style to non-current routes', () => {
    vi.mocked(usePathname).mockReturnValue('/dashboard')
    render(<AdminNav navItems={HOST_NAV} userRole="host" />)
    const link = screen.getByRole('link', { name: /upload conversations/i })
    expect(link).not.toHaveStyle({ background: 'rgb(86, 161, 210)' })
  })

  it('highlights /articles when on a sub-route /articles/some-id', () => {
    vi.mocked(usePathname).mockReturnValue('/articles/abc-123')
    render(<AdminNav navItems={HOST_NAV} userRole="host" />)
    const link = screen.getByRole('link', { name: /articles/i })
    expect(link).toHaveStyle({ background: 'rgb(86, 161, 210)' })
  })
})

describe('AdminNav — role badge', () => {
  beforeEach(() => vi.mocked(usePathname).mockReturnValue('/dashboard'))

  it('shows HOST for host role', () => {
    render(<AdminNav navItems={HOST_NAV} userRole="host" />)
    expect(screen.getByText('HOST')).toBeInTheDocument()
  })

  it('shows CHAPTER LEAD for chapter_lead role', () => {
    render(<AdminNav navItems={FULL_NAV} userRole="chapter_lead" />)
    expect(screen.getByText('CHAPTER LEAD')).toBeInTheDocument()
  })

  it('shows ADMIN for superadmin role', () => {
    render(<AdminNav navItems={FULL_NAV} userRole="superadmin" />)
    expect(screen.getByText('ADMIN')).toBeInTheDocument()
  })

  it('shows chapter name when provided', () => {
    render(<AdminNav navItems={HOST_NAV} userRole="host" chapterName="SF Bay Area" />)
    expect(screen.getByText('SF Bay Area')).toBeInTheDocument()
  })

  it('shows All Chapters for superadmin without chapter name', () => {
    render(<AdminNav navItems={FULL_NAV} userRole="superadmin" />)
    expect(screen.getByText('All Chapters')).toBeInTheDocument()
  })
})
