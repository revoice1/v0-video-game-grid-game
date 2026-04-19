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
        objectionPending: false,
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
          objectionPending: false,
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
          objectionPending: false,
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
        objectionPending: false,
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

  it('does not immediately expire the next local turn while the old zero lingers during handoff', () => {
    const activeTurnTimerKeyRef = { current: 'versus-puzzle:x' as string | null }
    const onTurnExpired = vi.fn()
    const setTurnTimeLeft = vi.fn()
    const setTurnDeadlineAt = vi.fn()

    const { rerender } = renderHook(
      ({ currentPlayer }: { currentPlayer: 'x' | 'o' }) =>
        useVersusTurnTimer({
          isVersusMode: true,
          objectionPending: false,
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
          setTurnTimeLeft,
          setTurnDeadlineAt,
          onTurnExpired,
        }),
      {
        initialProps: { currentPlayer: 'x' as 'x' | 'o' },
      }
    )

    rerender({ currentPlayer: 'x' as 'x' | 'o' })
    expect(onTurnExpired).toHaveBeenCalledTimes(1)
    expect(onTurnExpired).toHaveBeenLastCalledWith('o')

    rerender({ currentPlayer: 'o' as 'x' | 'o' })
    expect(onTurnExpired).toHaveBeenCalledTimes(1)
    expect(setTurnTimeLeft).toHaveBeenCalledWith(20)
  })

  it('starts counting down once the reset value lands after a zero-value handoff', () => {
    vi.useFakeTimers()

    try {
      const activeTurnTimerKeyRef = { current: 'versus-puzzle:x' as string | null }
      const onTurnExpired = vi.fn()
      const setTurnTimeLeft = vi.fn()
      const setTurnDeadlineAt = vi.fn()

      const { rerender } = renderHook(
        ({
          currentPlayer,
          turnTimeLeft,
        }: {
          currentPlayer: 'x' | 'o'
          turnTimeLeft: number | null
        }) =>
          useVersusTurnTimer({
            isVersusMode: true,
            objectionPending: false,
            isLoading: false,
            loadedPuzzleMode: 'versus',
            puzzleId: 'versus-puzzle',
            currentPlayer,
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
            currentPlayer: 'x' as 'x' | 'o',
            turnTimeLeft: 0 as number | null,
          },
        }
      )

      rerender({
        currentPlayer: 'o' as 'x' | 'o',
        turnTimeLeft: 0 as number | null,
      })

      expect(onTurnExpired).toHaveBeenCalledTimes(1)
      expect(onTurnExpired).toHaveBeenLastCalledWith('o')
      expect(setTurnTimeLeft).toHaveBeenCalledWith(20)

      setTurnTimeLeft.mockClear()

      rerender({
        currentPlayer: 'o' as 'x' | 'o',
        turnTimeLeft: 20 as number | null,
      })

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(setTurnTimeLeft).toHaveBeenCalledWith(expect.any(Function))
    } finally {
      vi.useRealTimers()
    }
  })

  it('resets a new local turn even when the previous turn left a non-zero time behind', () => {
    const activeTurnTimerKeyRef = { current: 'versus-puzzle:x' as string | null }
    const onTurnExpired = vi.fn()
    const setTurnTimeLeft = vi.fn()
    const setTurnDeadlineAt = vi.fn()

    const { rerender } = renderHook(
      ({
        currentPlayer,
        turnTimeLeft,
      }: {
        currentPlayer: 'x' | 'o'
        turnTimeLeft: number | null
      }) =>
        useVersusTurnTimer({
          isVersusMode: true,
          objectionPending: false,
          isLoading: false,
          loadedPuzzleMode: 'versus',
          puzzleId: 'versus-puzzle',
          currentPlayer,
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
          currentPlayer: 'x' as 'x' | 'o',
          turnTimeLeft: 7 as number | null,
        },
      }
    )

    setTurnTimeLeft.mockClear()

    rerender({
      currentPlayer: 'o' as 'x' | 'o',
      turnTimeLeft: 7 as number | null,
    })

    expect(onTurnExpired).not.toHaveBeenCalled()
    expect(setTurnTimeLeft).toHaveBeenCalledWith(20)
  })

  it('clears the local handoff guard once the reset turn time is visible and resumes countdown', () => {
    vi.useFakeTimers()

    try {
      const activeTurnTimerKeyRef = { current: 'versus-puzzle:x' as string | null }
      const onTurnExpired = vi.fn()
      const setTurnTimeLeft = vi.fn()
      const setTurnDeadlineAt = vi.fn()

      const { rerender } = renderHook(
        ({
          currentPlayer,
          turnTimeLeft,
        }: {
          currentPlayer: 'x' | 'o'
          turnTimeLeft: number | null
        }) =>
          useVersusTurnTimer({
            isVersusMode: true,
            objectionPending: false,
            isLoading: false,
            loadedPuzzleMode: 'versus',
            puzzleId: 'versus-puzzle',
            currentPlayer,
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
            currentPlayer: 'x' as 'x' | 'o',
            turnTimeLeft: 7 as number | null,
          },
        }
      )

      setTurnTimeLeft.mockClear()

      rerender({
        currentPlayer: 'o' as 'x' | 'o',
        turnTimeLeft: 7 as number | null,
      })

      expect(setTurnTimeLeft).toHaveBeenCalledWith(20)
      expect(onTurnExpired).not.toHaveBeenCalled()

      setTurnTimeLeft.mockClear()

      rerender({
        currentPlayer: 'o' as 'x' | 'o',
        turnTimeLeft: 20 as number | null,
      })

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(setTurnTimeLeft).toHaveBeenCalledWith(expect.any(Function))
      expect(onTurnExpired).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
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
            objectionPending: false,
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
          objectionPending: false,
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

      // Simulate hydration having already switched the shared timer ref to the
      // incoming player before this render receives the new deadline payload.
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

  it('resets the local turn timer when a guess submission ends the turn', () => {
    const activeTurnTimerKeyRef = { current: 'versus-puzzle:x' as string | null }
    const setTurnTimeLeft = vi.fn()
    const setTurnDeadlineAt = vi.fn()

    const { rerender } = renderHook(
      ({
        currentPlayer,
        turnTimeLeft,
      }: {
        currentPlayer: 'x' | 'o'
        turnTimeLeft: number | null
      }) =>
        useVersusTurnTimer({
          isVersusMode: true,
          isLoading: false,
          loadedPuzzleMode: 'versus',
          puzzleId: 'versus-puzzle',
          currentPlayer,
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
          currentPlayer: 'x' as 'x' | 'o',
          turnTimeLeft: 11 as number | null,
        },
      }
    )

    setTurnTimeLeft.mockClear()

    rerender({
      currentPlayer: 'o' as 'x' | 'o',
      turnTimeLeft: 11 as number | null,
    })

    expect(setTurnTimeLeft).toHaveBeenCalledWith(20)
    expect(setTurnDeadlineAt).toHaveBeenCalledWith(null)
  })

  it('resets the local turn timer even if the shared timer ref was pre-set before rerender', () => {
    const activeTurnTimerKeyRef = { current: 'versus-puzzle:x' as string | null }
    const setTurnTimeLeft = vi.fn()
    const setTurnDeadlineAt = vi.fn()

    const { rerender } = renderHook(
      ({
        currentPlayer,
        turnTimeLeft,
      }: {
        currentPlayer: 'x' | 'o'
        turnTimeLeft: number | null
      }) =>
        useVersusTurnTimer({
          isVersusMode: true,
          isLoading: false,
          loadedPuzzleMode: 'versus',
          puzzleId: 'versus-puzzle',
          currentPlayer,
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
          currentPlayer: 'x' as 'x' | 'o',
          turnTimeLeft: 11 as number | null,
        },
      }
    )

    setTurnTimeLeft.mockClear()
    activeTurnTimerKeyRef.current = 'versus-puzzle:o'

    rerender({
      currentPlayer: 'o' as 'x' | 'o',
      turnTimeLeft: 11 as number | null,
    })

    expect(setTurnTimeLeft).toHaveBeenCalledWith(20)
    expect(setTurnDeadlineAt).toHaveBeenCalledWith(null)
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

  it('pauses online turn expiry while an objection review is pending', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-29T20:00:00.000Z'))

    try {
      const activeTurnTimerKeyRef = { current: 'versus-puzzle:x' as string | null }
      const onTurnExpired = vi.fn()
      const setTurnTimeLeft = vi.fn()
      const setTurnDeadlineAt = vi.fn()

      const { rerender } = renderHook(
        ({ objectionPending }: { objectionPending: boolean }) =>
          useVersusTurnTimer({
            isVersusMode: true,
            isOnlineMatch: true,
            objectionPending,
            isLoading: false,
            loadedPuzzleMode: 'versus',
            puzzleId: 'versus-puzzle',
            currentPlayer: 'x',
            winner: null,
            versusTimerOption: 20,
            turnTimeLeft: 2,
            turnDeadlineAt: '2026-03-29T20:00:02.000Z',
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
            objectionPending: true,
          },
        }
      )

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(onTurnExpired).not.toHaveBeenCalled()

      rerender({ objectionPending: false })

      expect(setTurnTimeLeft).toHaveBeenCalledWith(20)
      expect(setTurnDeadlineAt).toHaveBeenCalledWith('2026-03-29T20:00:23.000Z')
    } finally {
      vi.useRealTimers()
    }
  })
})
