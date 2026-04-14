'use client'

import Link from 'next/link'

export interface OnboardingStep {
  title: string
  description: string
  ctaLabel: string
  ctaHref: string
}

interface OnboardingBannerProps {
  steps: OnboardingStep[]
  completedSteps: boolean[]
}

export default function OnboardingBanner({ steps, completedSteps }: OnboardingBannerProps) {
  const currentIndex = completedSteps.findIndex((done) => !done)
  if (currentIndex === -1) return null

  const step = steps[currentIndex]
  const total = steps.length
  const stepNumber = currentIndex + 1

  return (
    <div
      style={{
        borderLeft: '4px solid #56a1d2',
        background: '#eef6fd',
        borderRadius: '0 8px 8px 0',
        padding: '16px 20px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#56a1d2', marginBottom: 4 }}>
          Step {stepNumber} of {total}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 2 }}>
          {step.title}
        </div>
        <div style={{ fontSize: 13, color: '#555' }}>{step.description}</div>
      </div>
      <Link
        href={step.ctaHref}
        style={{
          padding: '8px 18px',
          background: '#56a1d2',
          color: '#fff',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 700,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {step.ctaLabel}
      </Link>
    </div>
  )
}
