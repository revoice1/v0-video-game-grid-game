import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useVersusTurnTimer } from '@/hooks/use-versus-turn-timer'

describe('useVersusTurnTimer', () => {
  it('starts a fresh timer when a versus board becomes ready', () => {
    const activeTurnTimerKeyRef = { current: null as string | null }
    const setTurnTimeLeft = vi.fn()
    const setTurnDeadlineAt = vi.fn()

    renderHook(() =>
      useVersusTurnTimer({
        isVersusMode: true,
        isLoading: false,
        loadedPuzzleMode: 'versus',
        puzzleId: 'versus-puzzle',
        currentPlayer: 'x',
        winner: null,
        versusTimerOption: 20,
        turnTimeLeft: null,
        turnDeadlineAt: null,
        pendingFinalSteal: null,
        animationsEnabled: true,
        audioEnabled: true,
        activeTurnTimerKeyRef,
        setTurnTimeLeft,
        setTurnDeadlineAt,
        onTurnExpired: vi.fn(),
      })
    )

    expect(activeTurnTimerKeyRef.current).toBe('versus-puzzle:x')
    expect(setTurnTimeLeft).toHaveBeenCalledWith(20)
  })

  it('resets the timer after loading a new versus board even when puzzle key repeats', () => {
    const activeTurnTimerKeyRef = { current: null as string | null }
    const setTurnTimeLeft = vi.fn()
    const setTurnDeadlineAt = vi.fn()

    const { rerender } = renderHook(
      ({ isLoading, turnTimeLeft }: { isLoading: boolean; turnTimeLeft: number | null }) =>
        useVersusTurnTimer({
          isVersusMode: true,
          isLoading,
          loadedPuzzleMode: 'versus',
          puzzleId: 'versus-puzzle',
          currentPlayer: 'x',
          winner: null,
          versusTimerOption: 20,
          turnTimeLeft,
          turnDeadlineAt: null,
          pendingFinalSteal: null,
          animationsEnabled: true,
          audioEnabled: true,
          activeTurnTimerKeyRef,
          setTurnTimeLeft,
          setTurnDeadlineAt,
          onTurnExpired: vi.fn(),
        }),
      {
        initialProps: {
          isLoading: false,
          turnTimeLeft: null as number | null,
        },
      }
    )

    setTurnTimeLeft.mockClear()

    rerender({
      isLoading: true,
      turnTimeLeft: 3,
    })

    rerender({
      isLoading: false,
      turnTimeLeft: null,
    })

    expect(setTurnTimeLeft).toHaveBeenCalledWith(20)
  })

  it('starts a visible online timer immediately when a board becomes ready', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-29T20:00:00.000Z'))

    try {
      const activeTurnTimerKeyRef = { current: null as string | null }
      const setTurnTimeLeft = vi.fn()
      const setTurnDeadlineAt = vi.fn()

      renderHook(() =>
        useVersusTurnTimer({
          isVersusMode: true,
          isOnlineMatch: true,
          isLoading: false,
          loadedPuzzleMode: 'versus',
          puzzleId: 'versus-puzzle',
          currentPlayer: 'x',
          winner: null,
          versusTimerOption: 20,
          turnTimeLeft: null,
          turnDeadlineAt: null,
          pendingFinalSteal: null,
          animationsEnabled: true,
          audioEnabled: true,
          activeTurnTimerKeyRef,
          setTurnTimeLeft,
          setTurnDeadlineAt,
          onTurnExpired: vi.fn(),
        })
      )

      expect(activeTurnTimerKeyRef.current).toBe('versus-puzzle:x')
      expect(setTurnDeadlineAt).toHaveBeenCalledWith('2026-03-29T20:00:20.000Z')
      expect(setTurnTimeLeft).toHaveBeenCalledWith(20)
    } finally {
      vi.useRealTimers()
    }
  })

  it('notifies when the turn timer has already expired', () => {
    const activeTurnTimerKeyRef = { current: 'versus-puzzle:x' as string | null }
    const onTurnExpired = vi.fn()
    const setTurnDeadlineAt = vi.fn()

    renderHook(() =>
      useVersusTurnTimer({
        isVersusMode: true,
        isLoading: false,
        loadedPuzzleMode: 'versus',
        puzzleId: 'versus-puzzle',
        currentPlayer: 'x',
        winner: null,
        versusTimerOption: 20,
        turnTimeLeft: 0,
        turnDeadlineAt: null,
        pendingFinalSteal: null,
        animationsEnabled: true,
        audioEnabled: true,
        activeTurnTimerKeyRef,
        setTurnTimeLeft: vi.fn(),
        setTurnDeadlineAt,
        onTurnExpired,
      })
    )

    expect(onTurnExpired).toHaveBeenCalledWith('o')
  })

  it('fires turn expiration once per turn key even if state lingers at zero', () => {
    const activeTurnTimerKeyRef = { current: 'versus-puzzle:x' as string | null }
    const onTurnExpired = vi.fn()
    const setTurnDeadlineAt = vi.fn()

    const { rerender } = renderHook(
      ({ currentPlayer }: { currentPlayer: 'x' | 'o' }) =>
        useVersusTurnTimer({
          isVersusMode: true,
          isLoading: false,
          loadedPuzzleMode: 'versus',
          puzzleId: 'versus-puzzle',
          currentPlayer,
          winner: null,
          versusTimerOption: 20,
          turnTimeLeft: 0,
          turnDeadlineAt: null,
          pendingFinalSteal: null,
          animationsEnabled: true,
          audioEnabled: true,
          activeTurnTimerKeyRef,
          setTurnTimeLeft: vi.fn(),
          setTurnDeadlineAt,
          onTurnExpired,
        }),
      {
        initialProps: { currentPlayer: 'x' as 'x' | 'o' },
      }
    )

    rerender({ currentPlayer: 'x' as 'x' | 'o' })
    expect(onTurnExpired).toHaveBeenCalledTimes(1)

    rerender({ currentPlayer: 'o' as 'x' | 'o' })
    expect(onTurnExpired).toHaveBeenCalledTimes(2)
    expect(onTurnExpired).toHaveBeenLastCalledWith('x')
  })

  it('keeps counting down across rerenders with a new onTurnExpired callback identity', () => {
    vi.useFakeTimers()

    try {
      const activeTurnTimerKeyRef = { current: 'versus-puzzle:x' as string | null }
      const setTurnTimeLeft = vi.fn()
      const setTurnDeadlineAt = vi.fn()
      const firstOnTurnExpired = vi.fn()
      const secondOnTurnExpired = vi.fn()

      const { rerender } = renderHook(
        ({
          turnTimeLeft,
          onTurnExpired,
        }: {
          turnTimeLeft: number | null
          onTurnExpired: (nextPlayer: 'x' | 'o') => void
        }) =>
          useVersusTurnTimer({
            isVersusMode: true,
            isLoading: false,
            loadedPuzzleMode: 'versus',
            puzzleId: 'versus-puzzle',
            currentPlayer: 'x',
            winner: null,
            versusTimerOption: 20,
            turnTimeLeft,
            turnDeadlineAt: null,
            pendingFinalSteal: null,
            animationsEnabled: true,
            audioEnabled: true,
            activeTurnTimerKeyRef,
            setTurnTimeLeft,
            setTurnDeadlineAt,
            onTurnExpired,
          }),
        {
          initialProps: {
            turnTimeLeft: 20,
            onTurnExpired: firstOnTurnExpired,
          },
        }
      )

      act(() => {
        vi.advanceTimersByTime(500)
      })

      rerender({
        turnTimeLeft: 20,
        onTurnExpired: secondOnTurnExpired,
      })

      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(firstOnTurnExpired).not.toHaveBeenCalled()
      expect(secondOnTurnExpired).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('still counts down when parent rerenders with unrelated state changes', () => {
    vi.useFakeTimers()

    try {
      const activeTurnTimerKeyRef = { current: 'versus-puzzle:x' as string | null }
      const setTurnTimeLeft = vi.fn()
      const setTurnDeadlineAt = vi.fn()

      const { rerender } = renderHook(
        ({ tick }: { tick: number }) => {
          void tick

          return useVersusTurnTimer({
            isVersusMode: true,
            isLoading: false,
            loadedPuzzleMode: 'versus',
            puzzleId: 'versus-puzzle',
            currentPlayer: 'x',
            winner: null,
            versusTimerOption: 20,
            turnTimeLeft: 20,
            turnDeadlineAt: null,
            pendingFinalSteal: null,
            animationsEnabled: true,
            audioEnabled: true,
            activeTurnTimerKeyRef,
            setTurnTimeLeft,
            setTurnDeadlineAt,
            onTurnExpired: vi.fn(),
          })
        },
        {
          initialProps: {
            tick: 0,
          },
        }
      )

      act(() => {
        vi.advanceTimersByTime(400)
      })

      rerender({ tick: 1 })

      act(() => {
        vi.advanceTimersByTime(400)
      })

      rerender({ tick: 2 })

      act(() => {
        vi.advanceTimersByTime(250)
      })

      expect(setTurnTimeLeft).toHaveBeenCalledWith(expect.any(Function))
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not reset the local timer when leaving versus mode and returning', () => {
    const activeTurnTimerKeyRef = { current: null as string | null }
    const setTurnTimeLeft = vi.fn()
    const setTurnDeadlineAt = vi.fn()

    const { rerender } = renderHook(
      ({ isVersusMode }: { isVersusMode: boolean }) =>
        useVersusTurnTimer({
          isVersusMode,
          isLoading: false,
          loadedPuzzleMode: 'versus',
          puzzleId: 'versus-puzzle',
          currentPlayer: 'x',
          winner: null,
          versusTimerOption: 20,
          turnTimeLeft: 14,
          turnDeadlineAt: null,
          pendingFinalSteal: null,
          animationsEnabled: true,
          audioEnabled: true,
          activeTurnTimerKeyRef,
          setTurnTimeLeft,
          setTurnDeadlineAt,
          onTurnExpired: vi.fn(),
        }),
      {
        initialProps: {
          isVersusMode: true,
        },
      }
    )

    rerender({ isVersusMode: false })
    rerender({ isVersusMode: true })

    expect(setTurnTimeLeft).not.toHaveBeenCalledWith(20)
  })

  it('derives remaining time from an online deadline', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-29T20:00:00.000Z'))

    try {
      const activeTurnTimerKeyRef = { current: 'versus-puzzle:x' as string | null }
      const setTurnTimeLeft = vi.fn()
      const setTurnDeadlineAt = vi.fn()

      renderHook(() =>
        useVersusTurnTimer({
          isVersusMode: true,
          isOnlineMatch: true,
          isLoading: false,
          loadedPuzzleMode: 'versus',
          puzzleId: 'versus-puzzle',
          currentPlayer: 'x',
          winner: null,
          versusTimerOption: 20,
          turnTimeLeft: null,
          turnDeadlineAt: '2026-03-29T20:00:12.000Z',
          pendingFinalSteal: null,
          animationsEnabled: true,
          audioEnabled: true,
          activeTurnTimerKeyRef,
          setTurnTimeLeft,
          setTurnDeadlineAt,
          onTurnExpired: vi.fn(),
        })
      )

      expect(setTurnTimeLeft).toHaveBeenCalledWith(12)
      expect(setTurnDeadlineAt).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('starts a new online deadline even if the shared timer ref was pre-set during hydration', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-29T20:00:00.000Z'))

    try {
      const activeTurnTimerKeyRef = { current: 'versus-puzzle:x' as string | null }
      const setTurnTimeLeft = vi.fn()
      const setTurnDeadlineAt = vi.fn()

      const { rerender } = renderHook(
        ({
          currentPlayer,
          turnDeadlineAt,
        }: {
          currentPlayer: 'x' | 'o'
          turnDeadlineAt: string | null
        }) =>
          useVersusTurnTimer({
            isVersusMode: true,
            isOnlineMatch: true,
            isLoading: false,
            loadedPuzzleMode: 'versus',
            puzzleId: 'versus-puzzle',
            currentPlayer,
            winner: null,
            versusTimerOption: 20,
            turnTimeLeft: null,
            turnDeadlineAt,
            pendingFinalSteal: null,
            animationsEnabled: true,
            audioEnabled: true,
            activeTurnTimerKeyRef,
            setTurnTimeLeft,
            setTurnDeadlineAt,
            onTurnExpired: vi.fn(),
          }),
        {
          initialProps: {
            currentPlayer: 'x' as 'x' | 'o',
            turnDeadlineAt: '2026-03-29T20:00:20.000Z' as string | null,
          },
        }
      )

      setTurnDeadlineAt.mockClear()
      setTurnTimeLeft.mockClear()

      activeTurnTimerKeyRef.current = 'versus-puzzle:o'

      rerender({
        currentPlayer: 'o' as 'x' | 'o',
        turnDeadlineAt: null as string | null,
      })

      expect(setTurnDeadlineAt).toHaveBeenCalledWith('2026-03-29T20:00:20.000Z')
      expect(setTurnTimeLeft).toHaveBeenCalledWith(20)
    } finally {
      vi.useRealTimers()
    }
  })

  it('resets the online deadline when the turn changes instead of carrying the old turn clock forward', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-29T20:00:00.000Z'))

    try {
      const activeTurnTimerKeyRef = { current: 'versus-puzzle:x' as string | null }
      const setTurnTimeLeft = vi.fn()
      const setTurnDeadlineAt = vi.fn()

      const { rerender } = renderHook(
        ({
          currentPlayer,
          turnDeadlineAt,
        }: {
          currentPlayer: 'x' | 'o'
          turnDeadlineAt: string | null
        }) =>
          useVersusTurnTimer({
            isVersusMode: true,
            isOnlineMatch: true,
            isLoading: false,
            loadedPuzzleMode: 'versus',
            puzzleId: 'versus-puzzle',
            currentPlayer,
            winner: null,
            versusTimerOption: 20,
            turnTimeLeft: 12,
            turnDeadlineAt,
            pendingFinalSteal: null,
            animationsEnabled: true,
            audioEnabled: true,
            activeTurnTimerKeyRef,
            setTurnTimeLeft,
            setTurnDeadlineAt,
            onTurnExpired: vi.fn(),
          }),
        {
          initialProps: {
            currentPlayer: 'x' as 'x' | 'o',
            turnDeadlineAt: '2026-03-29T20:00:12.000Z' as string | null,
          },
        }
      )

      setTurnDeadlineAt.mockClear()
      setTurnTimeLeft.mockClear()

      rerender({
        currentPlayer: 'o' as 'x' | 'o',
        turnDeadlineAt: '2026-03-29T20:00:12.000Z' as string | null,
      })

      expect(setTurnDeadlineAt).toHaveBeenCalledWith('2026-03-29T20:00:20.000Z')
      expect(setTurnTimeLeft).toHaveBeenCalledWith(20)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps polling an online deadline even before the displayed second changes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-29T20:00:00.000Z'))

    try {
      const activeTurnTimerKeyRef = { current: 'versus-puzzle:x' as string | null }
      const setTurnTimeLeft = vi.fn()
      const setTurnDeadlineAt = vi.fn()

      renderHook(() =>
        useVersusTurnTimer({
          isVersusMode: true,
          isOnlineMatch: true,
          isLoading: false,
          loadedPuzzleMode: 'versus',
          puzzleId: 'versus-puzzle',
          currentPlayer: 'x',
          winner: null,
          versusTimerOption: 20,
          turnTimeLeft: 12,
          turnDeadlineAt: '2026-03-29T20:00:12.000Z',
          pendingFinalSteal: null,
          animationsEnabled: true,
          audioEnabled: true,
          activeTurnTimerKeyRef,
          setTurnTimeLeft,
          setTurnDeadlineAt,
          onTurnExpired: vi.fn(),
        })
      )

      setTurnTimeLeft.mockClear()

      act(() => {
        vi.advanceTimersByTime(1200)
      })

      expect(setTurnTimeLeft.mock.calls.length).toBeGreaterThan(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
