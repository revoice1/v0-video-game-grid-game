import { describe, expect, it, vi } from 'vitest'
import { getTodayDate, getUtcDateOffset } from '@/lib/puzzle-api'

describe('puzzle-api date helpers', () => {
  it('returns the current UTC date for today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-25T23:55:00.000Z'))

    expect(getTodayDate()).toBe('2026-03-25')

    vi.useRealTimers()
  })

  it('returns a shifted UTC date for future warming', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-25T23:55:00.000Z'))

    expect(getUtcDateOffset(1)).toBe('2026-03-26')
    expect(getUtcDateOffset(-1)).toBe('2026-03-24')

    vi.useRealTimers()
  })
})
