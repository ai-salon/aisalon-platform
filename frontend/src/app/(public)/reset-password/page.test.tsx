import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useSearchParams } from 'next/navigation'
import ResetPasswordPage from './page'

afterEach(() => {
  vi.unstubAllGlobals()
})

function withToken(token: string | null) {
  vi.mocked(useSearchParams).mockReturnValue({ get: () => token } as never)
}

describe('ResetPasswordPage', () => {
  it('posts the token and new password, then offers sign in', async () => {
    withToken('tok123')
    const fetchMock = vi.fn(async () => ({ ok: true, status: 204, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ResetPasswordPage />)

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Correct-Horse-42' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Correct-Horse-42' } })
    fireEvent.click(screen.getByRole('button', { name: /set password/i }))

    await waitFor(() => {
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(url).toMatch(/\/auth\/reset-password$/)
      expect(JSON.parse(init.body as string)).toEqual({ token: 'tok123', new_password: 'Correct-Horse-42' })
    })
    expect(await screen.findByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login')
  })

  it('refuses mismatched passwords without calling the API', () => {
    withToken('tok123')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<ResetPasswordPage />)

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Correct-Horse-42' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Different-Horse-42' } })
    fireEvent.click(screen.getByRole('button', { name: /set password/i }))

    expect(screen.getByText(/don't match/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('explains a missing token', () => {
    withToken(null)
    render(<ResetPasswordPage />)
    expect(screen.getByText(/missing its token/i)).toBeInTheDocument()
  })
})
