import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ForgotPasswordPage from './page'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ForgotPasswordPage', () => {
  it('requests a reset link and confirms without revealing whether the account exists', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 202, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ForgotPasswordPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'Someone@Example.com ' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(url).toMatch(/\/auth\/forgot-password$/)
      expect(JSON.parse(init.body as string)).toEqual({ email: 'Someone@Example.com' })
    })
    expect(await screen.findByText(/reset link is on its way/i)).toBeInTheDocument()
  })

  it('shows the server message when email is not configured', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 503, json: async () => ({ detail: 'Email is not configured — contact an administrator' }),
    })))
    render(<ForgotPasswordPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText(/not configured/i)).toBeInTheDocument()
  })
})
