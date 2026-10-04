import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithSession } from '@/test/helpers'
import { OnboardingChecksProvider } from './OnboardingChecks'
import { CheckItem } from './primitives'

type Call = { url: string; init?: RequestInit }

function mockApi(ok = true) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return { ok, status: ok ? 200 : 500, json: async () => ({}) }
    })
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('saved Getting Started checks', () => {
  it('starts checked from the saved state and saves an uncheck for this user', async () => {
    const calls = mockApi()
    renderWithSession(
      <OnboardingChecksProvider initial={{ 'host-website': true }}>
        <CheckItem checkId="host-website">Read the website</CheckItem>
      </OnboardingChecksProvider>,
      { role: 'host' }
    )

    const box = screen.getByRole('checkbox', { name: /read the website/i })
    expect(box).toBeChecked()

    fireEvent.click(box)

    expect(box).not.toBeChecked()
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].url).toMatch(/\/admin\/me\/onboarding-checks$/)
    expect(calls[0].init?.method).toBe('PUT')
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({ key: 'host-website', done: false })
  })

  it('rolls the box back when the save fails', async () => {
    mockApi(false)
    renderWithSession(
      <OnboardingChecksProvider initial={{}}>
        <CheckItem checkId="host-first-upload">Upload your first recording</CheckItem>
      </OnboardingChecksProvider>,
      { role: 'host' }
    )

    const box = screen.getByRole('checkbox', { name: /upload your first recording/i })
    fireEvent.click(box)
    expect(box).toBeChecked()
    await waitFor(() => expect(box).not.toBeChecked())
  })

  it('keeps unsaved items (no checkId) local and silent', () => {
    const calls = mockApi()
    renderWithSession(
      <OnboardingChecksProvider initial={{}}>
        <CheckItem>Secure a space</CheckItem>
      </OnboardingChecksProvider>
    )
    const box = screen.getByRole('checkbox', { name: /secure a space/i })
    fireEvent.click(box)
    expect(box).toBeChecked()
    expect(calls).toHaveLength(0)
  })
})
