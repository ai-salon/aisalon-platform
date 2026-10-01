import { describe, it, expect } from 'vitest'
import { chapterOptionLabel } from './chapters'

describe('chapterOptionLabel', () => {
  it('shows just the name for a live chapter', () => {
    expect(chapterOptionLabel({ name: 'Berlin', status: 'active' })).toBe('Berlin')
  })

  it('flags a draft chapter so admins know it is not public yet', () => {
    expect(chapterOptionLabel({ name: 'Berlin', status: 'draft' })).toBe('Berlin (draft)')
  })

  it('flags an archived chapter', () => {
    expect(chapterOptionLabel({ name: 'Berlin', status: 'archived' })).toBe('Berlin (archived)')
  })

  it('treats a missing status as live', () => {
    expect(chapterOptionLabel({ name: 'Berlin' })).toBe('Berlin')
  })
})
