import { describe, it, expect } from 'vitest'
import { validateApiKey, validateTeamMember, validateUser } from './validation'

describe('validateApiKey', () => {
  it('returns error for empty key', () => {
    expect(validateApiKey('')).toBe('Key is required')
  })

  it('returns error for whitespace-only key', () => {
    expect(validateApiKey('   ')).toBe('Key is required')
  })

  it('returns error for short key', () => {
    expect(validateApiKey('short')).toBe('Key seems too short — check you copied it completely')
  })

  it('returns null for valid 10+ character key', () => {
    expect(validateApiKey('abcdefghij')).toBeNull()
    expect(validateApiKey('a'.repeat(40))).toBeNull()
  })
})

describe('validateTeamMember', () => {
  it('returns name error when name is empty', () => {
    const e = validateTeamMember({ name: '', email: 'a@b.com', role: 'Host' })
    expect(e.name).toBe('Name is required')
  })

  it('returns email error when email is invalid format', () => {
    const e = validateTeamMember({ name: 'Ian', email: 'notanemail', role: 'Host' })
    expect(e.email).toBe('Enter a valid email address')
  })

  it('allows empty email (optional field)', () => {
    const e = validateTeamMember({ name: 'Ian', email: '', role: 'Host' })
    expect(e.email).toBeUndefined()
  })

  it('returns role error when role is empty', () => {
    const e = validateTeamMember({ name: 'Ian', email: 'a@b.com', role: '' })
    expect(e.role).toBe('Role is required')
  })

  it('returns no errors for valid data', () => {
    const e = validateTeamMember({ name: 'Ian', email: 'ian@example.com', role: 'Host' })
    expect(Object.keys(e)).toHaveLength(0)
  })
})

describe('validateUser', () => {
  it('returns email error for invalid format', () => {
    const e = validateUser({ email: 'bad', password: 'password123', role: 'host' })
    expect(e.email).toBe('Enter a valid email address')
  })

  it('returns email error when empty', () => {
    const e = validateUser({ email: '', password: 'password123', role: 'host' })
    expect(e.email).toBe('Email is required')
  })

  it('returns password error when fewer than 8 characters', () => {
    const e = validateUser({ email: 'a@b.com', password: 'short', role: 'host' })
    expect(e.password).toBe('Password must be at least 8 characters')
  })

  it('returns role error when role is empty', () => {
    const e = validateUser({ email: 'a@b.com', password: 'password123', role: '' })
    expect(e.role).toBe('Role is required')
  })

  it('returns no errors for valid data', () => {
    const e = validateUser({ email: 'a@b.com', password: 'password123', role: 'host' })
    expect(Object.keys(e)).toHaveLength(0)
  })
})
