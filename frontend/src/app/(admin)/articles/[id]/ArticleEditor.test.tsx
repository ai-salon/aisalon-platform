import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ArticleEditor from './ArticleEditor'

const BASE_ARTICLE = {
  id: 'art-1',
  title: 'Test Article',
  content_md: '# Hello',
  anonymized_transcript: null,
  substack_url: null,
  status: 'draft' as const,
  chapter_id: 'ch-1',
  job_id: null,
  created_at: '2026-04-13T10:00:00Z',
}

describe('ArticleEditor — publish semantics', () => {
  it('shows "Mark as Done" button, not "Publish"', () => {
    render(<ArticleEditor article={BASE_ARTICLE} token="tok" />)
    expect(screen.getByRole('button', { name: /mark as done/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^publish$/i })).not.toBeInTheDocument()
  })

  it('shows helper text explaining what Mark as Done does', () => {
    render(<ArticleEditor article={BASE_ARTICLE} token="tok" />)
    expect(screen.getByText(/marks this article as finished/i)).toBeInTheDocument()
  })

  it('shows updated Substack URL placeholder', () => {
    render(<ArticleEditor article={BASE_ARTICLE} token="tok" />)
    expect(screen.getByPlaceholderText(/after publishing on substack/i)).toBeInTheDocument()
  })

  it('does not show Mark as Done when article is already published', () => {
    render(<ArticleEditor article={{ ...BASE_ARTICLE, status: 'published' }} token="tok" />)
    expect(screen.queryByRole('button', { name: /mark as done/i })).not.toBeInTheDocument()
  })

  it('blocks save when title is empty and shows error', async () => {
    render(<ArticleEditor article={{ ...BASE_ARTICLE, title: '' }} token="tok" />)
    const saveBtn = screen.getByRole('button', { name: /^save$/i })
    await userEvent.click(saveBtn)
    expect(screen.getByText(/title is required/i)).toBeInTheDocument()
  })
})
