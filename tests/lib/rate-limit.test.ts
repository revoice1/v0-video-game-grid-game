import { describe, expect, it, vi, beforeEach } from 'vitest'
import { checkRateLimit } from '@/lib/rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows the first request', () => {
    expect(checkRateLimit('test-key-1', { limit: 3, windowMs: 1000 })).toBe(true)
  })

  it('allows requests up to the limit', () => {
    const opts = { limit: 3, windowMs: 1000 }
    expect(checkRateLimit('test-key-2', opts)).toBe(true)
    expect(checkRateLimit('test-key-2', opts)).toBe(true)
    expect(checkRateLimit('test-key-2', opts)).toBe(true)
  })

  it('rejects requests beyond the limit within the window', () => {
    const opts = { limit: 2, windowMs: 1000 }
    checkRateLimit('test-key-3', opts)
    checkRateLimit('test-key-3', opts)
    expect(checkRateLimit('test-key-3', opts)).toBe(false)
  })

  it('resets the counter after the window expires', () => {
    const opts = { limit: 1, windowMs: 1000 }
    expect(checkRateLimit('test-key-4', opts)).toBe(true)
    expect(checkRateLimit('test-key-4', opts)).toBe(false)

    vi.advanceTimersByTime(1000)

    expect(checkRateLimit('test-key-4', opts)).toBe(true)
  })

  it('tracks different keys independently', () => {
    const opts = { limit: 1, windowMs: 1000 }
    checkRateLimit('key-a', opts)
    expect(checkRateLimit('key-a', opts)).toBe(false)
    expect(checkRateLimit('key-b', opts)).toBe(true)
  })
})
