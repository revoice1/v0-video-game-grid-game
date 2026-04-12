import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useLoadingState } from '@/hooks/use-loading-state'
import * as utils from '@/lib/utils'

vi.mock('@/lib/session', () => ({
  getSessionId: vi.fn(() => 'test-session-id'),
}))

const makeTimeResult = (label: string) => ({ hours: 3, minutes: 22, seconds: 0, label })

vi.mock('@/lib/utils', () => ({
  getTimeUntilNextUtcMidnight: vi.fn(() => makeTimeResult('3h 22m')),
}))

describe('useLoadingState', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes sessionId from getSessionId', () => {
    const { result } = renderHook(() => useLoadingState())
    expect(result.current.sessionId).toBe('test-session-id')
  })

  it('starts with default loadingProgress of 8', () => {
    const { result } = renderHook(() => useLoadingState())
    expect(result.current.loadingProgress).toBe(8)
  })

  it('starts with default loadingStage message', () => {
    const { result } = renderHook(() => useLoadingState())
    expect(result.current.loadingStage).toBe('Warming up the puzzle generator...')
  })

  it('starts with empty loadingAttempts', () => {
    const { result } = renderHook(() => useLoadingState())
    expect(result.current.loadingAttempts).toEqual([])
  })

  it('initializes dailyResetLabel from getTimeUntilNextUtcMidnight', () => {
    const { result } = renderHook(() => useLoadingState())
    expect(result.current.dailyResetLabel).toBe('3h 22m')
  })

  it('updates dailyResetLabel every second', () => {
    const getTimeUntilNextUtcMidnight = vi.mocked(utils.getTimeUntilNextUtcMidnight)
    // The hook calls getTimeUntilNextUtcMidnight twice before the interval fires:
    // once for the useState initializer and once in the effect's updateResetCountdown().
    // The default mock returns '3h 22m' for both of those, then we stage '3h 21m' for the interval tick.
    getTimeUntilNextUtcMidnight.mockReturnValue(makeTimeResult('3h 22m'))

    const { result } = renderHook(() => useLoadingState())
    expect(result.current.dailyResetLabel).toBe('3h 22m')

    getTimeUntilNextUtcMidnight.mockReturnValue(makeTimeResult('3h 21m'))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.dailyResetLabel).toBe('3h 21m')
  })

  it('clears interval on unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = renderHook(() => useLoadingState())

    unmount()

    expect(clearSpy).toHaveBeenCalled()
  })

  it('exposes setters that update state', () => {
    const { result } = renderHook(() => useLoadingState())

    act(() => {
      result.current.setLoadingProgress(50)
      result.current.setLoadingStage('Almost there...')
      result.current.setLoadingAttempts([{ attempt: 1 }] as unknown as never[])
    })

    expect(result.current.loadingProgress).toBe(50)
    expect(result.current.loadingStage).toBe('Almost there...')
    expect(result.current.loadingAttempts).toHaveLength(1)
  })
})
