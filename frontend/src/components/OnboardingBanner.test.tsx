import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OnboardingBanner from './OnboardingBanner'

const STEPS = [
  { title: 'Add API keys', description: 'You need keys to process audio', ctaLabel: 'Go to Settings', ctaHref: '/settings' },
  { title: 'Upload a conversation', description: 'Upload your first audio file', ctaLabel: 'Upload now', ctaHref: '/upload' },
  { title: 'Review your article', description: 'Your article is ready', ctaLabel: 'View articles', ctaHref: '/articles' },
]

describe('OnboardingBanner', () => {
  it('shows step 1 when no steps are complete', () => {
    render(<OnboardingBanner steps={STEPS} completedSteps={[false, false, false]} />)
    expect(screen.getByText('Add API keys')).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
  })

  it('shows step 2 when step 1 is complete', () => {
    render(<OnboardingBanner steps={STEPS} completedSteps={[true, false, false]} />)
    expect(screen.getByText('Upload a conversation')).toBeInTheDocument()
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
  })

  it('shows step 3 when steps 1 and 2 are complete', () => {
    render(<OnboardingBanner steps={STEPS} completedSteps={[true, true, false]} />)
    expect(screen.getByText('Review your article')).toBeInTheDocument()
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument()
  })

  it('returns null when all steps are complete', () => {
    const { container } = render(
      <OnboardingBanner steps={STEPS} completedSteps={[true, true, true]} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('CTA link points to correct href', () => {
    render(<OnboardingBanner steps={STEPS} completedSteps={[false, false, false]} />)
    const link = screen.getByRole('link', { name: /go to settings/i })
    expect(link).toHaveAttribute('href', '/settings')
  })

  it('shows step description', () => {
    render(<OnboardingBanner steps={STEPS} completedSteps={[false, false, false]} />)
    expect(screen.getByText('You need keys to process audio')).toBeInTheDocument()
  })
})
