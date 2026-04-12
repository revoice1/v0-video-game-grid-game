import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { useGameCelebrations, STEAL_SHOWDOWN_DURATION_MS } from '@/hooks/use-game-celebrations'

vi.mock('@/components/game/easter-egg-celebrations', () => ({
  createFallingParticles: vi.fn(() => [
    { delay: '0ms', duration: '1000ms', left: '50%', size: '10px', drift: '0px', rotate: '0deg' },
  ]),
  getEasterEggDefinition: vi.fn((gameId: number) =>
    gameId === 999
      ? { density: 10, pieceKinds: ['dust'], renderPiece: vi.fn(), achievementId: null }
      : null
  ),
  getEasterEggLifetimeMs: vi.fn(() => 3000),
  parseMs: vi.fn((v: string) => Number.parseInt(v)),
  renderRealStinkerPiece: vi.fn(),
  scaleParticleDensity: vi.fn((density: number) => density),
}))

vi.mock('@/hooks/use-timed-overlay-dismiss', () => ({
  useTimedOverlayDismiss: vi.fn(),
}))

const defaultOptions = {
  animationsEnabled: true,
  animationQuality: 'high' as const,
  versusStealRule: 'lower' as const,
}

describe('useGameCelebrations', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with all celebrations null', () => {
    const { result } = renderHook(() => useGameCelebrations(defaultOptions))

    expect(result.current.activeEasterEgg).toBeNull()
    expect(result.current.activePerfectCelebration).toBeNull()
    expect(result.current.activeStealShowdown).toBeNull()
    expect(result.current.activeStealMissSplash).toBeNull()
    expect(result.current.activeDoubleKoSplash).toBeNull()
    expect(result.current.activeJudgmentPending).toBeNull()
    expect(result.current.activeJudgmentVerdict).toBeNull()
  })

  it('triggerEasterEggCelebration sets activeEasterEgg for known game', () => {
    const { result } = renderHook(() => useGameCelebrations(defaultOptions))

    act(() => {
      result.current.triggerEasterEggCelebration(999)
    })

    expect(result.current.activeEasterEgg).not.toBeNull()
    expect(result.current.activeEasterEgg?.durationMs).toBe(3000)
  })

  it('triggerEasterEggCelebration returns false for unknown game', () => {
    const { result } = renderHook(() => useGameCelebrations(defaultOptions))

    let triggered: boolean
    act(() => {
      triggered = result.current.triggerEasterEggCelebration(1)
    })

    expect(triggered!).toBe(false)
    expect(result.current.activeEasterEgg).toBeNull()
  })

  it('triggerPerfectCelebration sets activePerfectCelebration', () => {
    const { result } = renderHook(() => useGameCelebrations(defaultOptions))

    act(() => {
      result.current.triggerPerfectCelebration()
    })

    expect(result.current.activePerfectCelebration).not.toBeNull()
    expect(result.current.activePerfectCelebration?.durationMs).toBe(2800)
  })

  it('triggerStealShowdownPreview sets activeStealShowdown with correct rule', () => {
    const { result } = renderHook(() => useGameCelebrations(defaultOptions))

    act(() => {
      result.current.triggerStealShowdownPreview()
    })

    expect(result.current.activeStealShowdown).not.toBeNull()
    expect(result.current.activeStealShowdown?.rule).toBe('lower')
    expect(result.current.activeStealShowdown?.durationMs).toBe(STEAL_SHOWDOWN_DURATION_MS)
  })

  it('triggerStealMissPreview sets activeStealMissSplash', () => {
    const { result } = renderHook(() => useGameCelebrations(defaultOptions))

    act(() => {
      result.current.triggerStealMissPreview()
    })

    expect(result.current.activeStealMissSplash).not.toBeNull()
    expect(result.current.activeStealMissSplash?.durationMs).toBe(900)
  })

  it('clearAll resets all celebrations', () => {
    const { result } = renderHook(() => useGameCelebrations(defaultOptions))

    act(() => {
      result.current.triggerEasterEggCelebration(999)
      result.current.triggerPerfectCelebration()
    })

    act(() => {
      result.current.clearAll()
    })

    expect(result.current.activeEasterEgg).toBeNull()
    expect(result.current.activePerfectCelebration).toBeNull()
    expect(result.current.activeStealShowdown).toBeNull()
    expect(result.current.activeStealMissSplash).toBeNull()
    expect(result.current.activeDoubleKoSplash).toBeNull()
    expect(result.current.activeJudgmentPending).toBeNull()
    expect(result.current.activeJudgmentVerdict).toBeNull()
  })

  it('does not trigger celebrations when animations disabled', () => {
    const { result } = renderHook(() =>
      useGameCelebrations({ ...defaultOptions, animationsEnabled: false })
    )

    act(() => {
      result.current.triggerEasterEggCelebration(999)
      result.current.triggerPerfectCelebration()
      result.current.triggerStealShowdownPreview()
      result.current.triggerStealMissPreview()
    })

    expect(result.current.activeEasterEgg).toBeNull()
    expect(result.current.activePerfectCelebration).toBeNull()
    expect(result.current.activeStealShowdown).toBeNull()
    expect(result.current.activeStealMissSplash).toBeNull()
  })

  it('clears all state when animationsEnabled switches to false', () => {
    const { result, rerender } = renderHook(
      (opts: Parameters<typeof useGameCelebrations>[0]) => useGameCelebrations(opts),
      { initialProps: defaultOptions }
    )

    act(() => {
      result.current.triggerPerfectCelebration()
    })
    expect(result.current.activePerfectCelebration).not.toBeNull()

    rerender({ ...defaultOptions, animationsEnabled: false })

    expect(result.current.activePerfectCelebration).toBeNull()
    expect(result.current.activeEasterEgg).toBeNull()
  })

  it('auto-dismisses easter egg after its duration', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useGameCelebrations(defaultOptions))

    act(() => {
      result.current.triggerEasterEggCelebration(999)
    })
    expect(result.current.activeEasterEgg).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.activeEasterEgg).toBeNull()
  })

  it('auto-dismisses perfect celebration after its duration', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useGameCelebrations(defaultOptions))

    act(() => {
      result.current.triggerPerfectCelebration()
    })
    expect(result.current.activePerfectCelebration).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(2800)
    })
    expect(result.current.activePerfectCelebration).toBeNull()
  })

  it('setActiveJudgmentPending and setActiveJudgmentVerdict work directly', () => {
    const { result } = renderHook(() => useGameCelebrations(defaultOptions))

    act(() => {
      result.current.setActiveJudgmentPending({ burstId: 1 })
    })
    expect(result.current.activeJudgmentPending).toEqual({ burstId: 1 })

    act(() => {
      result.current.setActiveJudgmentVerdict({
        burstId: 2,
        durationMs: 1500,
        verdict: 'sustained',
      })
    })
    expect(result.current.activeJudgmentVerdict).toEqual({
      burstId: 2,
      durationMs: 1500,
      verdict: 'sustained',
    })
  })
})
