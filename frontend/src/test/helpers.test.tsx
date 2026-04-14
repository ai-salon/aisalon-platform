import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { renderWithSession } from './helpers'

function RoleDisplay() {
  const { data } = useSession()
  return <div>{(data?.user as any)?.role ?? 'none'}</div>
}

describe('renderWithSession', () => {
  it('provides the given role via useSession', () => {
    renderWithSession(<RoleDisplay />, { role: 'host' })
    expect(screen.getByText('host')).toBeInTheDocument()
  })

  it('defaults to chapter_lead when no role given', () => {
    renderWithSession(<RoleDisplay />)
    expect(screen.getByText('chapter_lead')).toBeInTheDocument()
  })
})
