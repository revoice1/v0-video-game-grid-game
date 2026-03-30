import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearGameState, loadGameState, saveGameState, type SavedGameState } from '@/lib/session'

describe('session game-state persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-29T12:00:00.000Z'))
  })

  it('round-trips versus search state fields', () => {
    const savedState: SavedGameState = {
      puzzleId: 'versus-puzzle',
      guesses: Array(9).fill(null),
      guessesRemaining: 7,
      isComplete: false,
      selectedCell: 4,
      searchQuery: 'mass',
      currentPlayer: 'o',
      stealableCell: 4,
      winner: null,
      pendingFinalSteal: null,
      versusCategoryFilters: { genre: ['rpg'] },
      versusStealRule: 'lower',
      versusTimerOption: 300,
      versusDisableDraws: true,
      versusObjectionRule: 'one',
      versusObjectionsUsed: { x: 1, o: 0 },
      turnTimeLeft: 287,
      turnDeadlineAt: '2026-03-29T12:04:47.000Z',
    }

    saveGameState(savedState, 'versus')

    expect(loadGameState('versus')).toEqual(savedState)
  })

  it('keys daily saves by date and expires mismatched dates', () => {
    const todayState: SavedGameState = {
      puzzleId: 'daily-puzzle',
      guesses: Array(9).fill(null),
      guessesRemaining: 9,
      isComplete: false,
      date: '2026-03-29',
    }

    saveGameState(todayState, 'daily')

    expect(loadGameState('daily', '2026-03-29')).toEqual({
      ...todayState,
      date: '2026-03-29',
    })
    expect(loadGameState('daily', '2026-03-28')).toBeNull()
  })

  it('clears saved state for a mode', () => {
    saveGameState(
      {
        puzzleId: 'practice-puzzle',
        guesses: Array(9).fill(null),
        guessesRemaining: 9,
        isComplete: false,
      },
      'practice'
    )

    expect(loadGameState('practice')).not.toBeNull()

    clearGameState('practice')

    expect(loadGameState('practice')).toBeNull()
  })
})
