import { describe, it, expect } from 'vitest'
import { toast } from './toast'

describe('toast utility', () => {
  it('exports success function', () => {
    expect(typeof toast.success).toBe('function')
  })

  it('exports error function', () => {
    expect(typeof toast.error).toBe('function')
  })

  it('exports info function', () => {
    expect(typeof toast.info).toBe('function')
  })
})
