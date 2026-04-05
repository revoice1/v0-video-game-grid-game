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

    expect(loadGameState('versus')).toEqual({
      ...savedState,
      version: 2,
    })
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
      version: 2,
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

  it('sanitizes legacy/corrupt saved values instead of crashing consumers', () => {
    localStorage.setItem(
      'gamegrid_versus_state',
      JSON.stringify({
        puzzleId: 'versus-puzzle',
        guesses: Array(12).fill({ gameId: 1 }),
        guessesRemaining: 7,
        isComplete: false,
        versusStealRule: 'legacy_rule',
        versusTimerOption: 15,
        versusObjectionRule: 'legacy',
        practiceMinimumValidOptions: 'bad',
        versusMinimumValidOptions: 4.5,
      })
    )

    const restored = loadGameState('versus')

    expect(restored).not.toBeNull()
    expect(restored?.version).toBe(2)
    expect(restored?.guesses).toHaveLength(9)
    expect(restored?.guessesRemaining).toBe(7)
    expect(restored?.isComplete).toBe(false)
    expect(restored?.versusStealRule).toBeUndefined()
    expect(restored?.versusTimerOption).toBeUndefined()
    expect(restored?.versusObjectionRule).toBeUndefined()
    expect(restored?.practiceMinimumValidOptions).toBeNull()
    expect(restored?.versusMinimumValidOptions).toBeNull()
  })

  it('drops legacy puzzle snapshots that are structurally incompatible', () => {
    localStorage.setItem(
      'gamegrid_versus_state',
      JSON.stringify({
        puzzleId: 'versus-puzzle',
        guesses: Array(9).fill({ gameId: 1 }),
        guessesRemaining: 4,
        isComplete: true,
        puzzle: { id: 'bad', row_categories: [], col_categories: [] },
      })
    )

    const restored = loadGameState('versus')

    expect(restored).not.toBeNull()
    expect(restored?.puzzle).toBeUndefined()
    expect(restored?.guessesRemaining).toBe(9)
    expect(restored?.isComplete).toBe(false)
  })
})
