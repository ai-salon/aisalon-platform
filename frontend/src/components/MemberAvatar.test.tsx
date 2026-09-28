import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MemberAvatar, { LOGO_PLACEHOLDER_SRC } from './MemberAvatar'

describe('MemberAvatar', () => {
  it('shows the Ai Salon logo when the member has no photo', () => {
    render(<MemberAvatar url={null} name="Ian Test" size={195} />)

    const logo = screen.getByTestId('avatar-logo-placeholder')
    expect(logo).toHaveAttribute('src', LOGO_PLACEHOLDER_SRC)
    expect(screen.queryByRole('img', { name: 'Ian Test' })).not.toBeInTheDocument()
  })

  it('shows the member photo when one is set, prefixing uploads with the API URL', () => {
    render(<MemberAvatar url="/uploads/people/ian.jpg" name="Ian Test" size={40} />)

    const photo = screen.getByRole('img', { name: 'Ian Test' })
    expect(photo.getAttribute('src')).toMatch(/\/uploads\/people\/ian\.jpg$/)
    expect(photo.getAttribute('src')).not.toBe('/uploads/people/ian.jpg')
    expect(screen.queryByTestId('avatar-logo-placeholder')).not.toBeInTheDocument()
  })

  it('leaves absolute photo URLs untouched', () => {
    render(<MemberAvatar url="https://example.com/me.png" name="Ian Test" size={40} />)

    expect(screen.getByRole('img', { name: 'Ian Test' })).toHaveAttribute('src', 'https://example.com/me.png')
  })

  it('falls back to the logo when the photo fails to load', () => {
    render(<MemberAvatar url="https://example.com/missing.png" name="Ian Test" size={40} />)

    fireEvent.error(screen.getByRole('img', { name: 'Ian Test' }))

    expect(screen.getByTestId('avatar-logo-placeholder')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Ian Test' })).not.toBeInTheDocument()
  })
})
