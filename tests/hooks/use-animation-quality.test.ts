import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useAnimationQuality, type AnimationQuality } from '@/hooks/use-animation-quality'

type MediaQueryListener = (event: { matches: boolean }) => void

function makeMatchMedia(matches: boolean) {
  const listeners: MediaQueryListener[] = []
  const mq = {
    matches,
    addEventListener: vi.fn((_: string, cb: MediaQueryListener) => {
      listeners.push(cb)
    }),
    removeEventListener: vi.fn((_: string, cb: MediaQueryListener) => {
      const idx = listeners.indexOf(cb)
      if (idx !== -1) listeners.splice(idx, 1)
    }),
    fire(nextMatches: boolean) {
      for (const cb of listeners) cb({ matches: nextMatches })
    },
  }
  return mq
}

describe('useAnimationQuality', () => {
  let mq: ReturnType<typeof makeMatchMedia>

  beforeEach(() => {
    mq = makeMatchMedia(false)
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => mq),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls detect on mount and returns the result', () => {
    const detect = vi.fn(() => 'low' as const)
    const { result } = renderHook(() => useAnimationQuality(detect))

    expect(detect).toHaveBeenCalledOnce()
    expect(result.current).toBe('low')
  })

  it('defaults to high before effect runs (SSR-safe initial value)', () => {
    // detect is called synchronously in the effect, not during render init
    const detect = vi.fn(() => 'low' as const)
    const { result } = renderHook(() => useAnimationQuality(detect))
    // After mount effect runs, quality is updated
    expect(result.current).toBe('low')
  })

  it('calls detect again when media query fires', () => {
    let callCount = 0
    const detect = vi.fn(() => {
      callCount++
      return callCount === 1 ? 'high' : ('low' as const)
    })

    const { result } = renderHook(() => useAnimationQuality(detect))
    expect(result.current).toBe('high')

    act(() => {
      mq.fire(true)
    })

    expect(detect).toHaveBeenCalledTimes(2)
    expect(result.current).toBe('low')
  })

  it('registers change listener on matchMedia', () => {
    const detect = vi.fn(() => 'high' as const)
    renderHook(() => useAnimationQuality(detect))

    expect(mq.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('removes change listener on unmount', () => {
    const detect = vi.fn(() => 'high' as const)
    const { unmount } = renderHook(() => useAnimationQuality(detect))

    unmount()

    expect(mq.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('re-runs effect and re-registers listener when detect reference changes', () => {
    const detect1: () => AnimationQuality = vi.fn(() => 'high' as AnimationQuality)
    const detect2: () => AnimationQuality = vi.fn(() => 'medium' as AnimationQuality)

    const { result, rerender } = renderHook(
      ({ detect }: { detect: () => AnimationQuality }) => useAnimationQuality(detect),
      { initialProps: { detect: detect1 } }
    )

    expect(result.current).toBe('high')

    rerender({ detect: detect2 })

    expect(detect2).toHaveBeenCalled()
    expect(result.current).toBe('medium')
  })
})
