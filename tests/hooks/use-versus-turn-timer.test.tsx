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
})
