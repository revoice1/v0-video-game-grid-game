import { describe, expect, it } from 'vitest'
import {
  validateOnlineVersusEvent,
  type StoredOnlineVersusEvent,
} from '@/lib/online-versus-event-validation'
import type { CellGuess } from '@/lib/types'
import type { OnlineVersusSnapshot, RoomSettings } from '@/lib/versus-room'

function makeSettings(overrides: Partial<RoomSettings> = {}): RoomSettings {
  return {
    categoryFilters: {},
    stealRule: 'lower',
    timerOption: 'none',
    disableDraws: false,
    objectionRule: 'one',
    ...overrides,
  }
}

function makeGuess(owner: 'x' | 'o', gameId = 1, gameName = 'Test Game'): CellGuess {
  return {
    gameId,
    gameName,
    gameImage: null,
    isCorrect: true,
    owner,
  }
}

function makeSnapshot(overrides: Partial<OnlineVersusSnapshot> = {}): OnlineVersusSnapshot {
  return {
    puzzleId: 'puzzle-1',
    guesses: Array.from({ length: 9 }, () => null),
    guessesRemaining: 9,
    currentPlayer: 'x',
    winner: null,
    stealableCell: null,
    pendingFinalSteal: null,
    objectionsUsed: { x: 0, o: 0 },
    turnDeadlineAt: null,
    turnDurationSeconds: null,
    ...overrides,
  }
}

function makeClaimEvent(
  id: number,
  player: 'x' | 'o',
  cellIndex: number,
  guess: CellGuess = makeGuess(player, id, `${player.toUpperCase()}-${id}`)
): StoredOnlineVersusEvent {
  return {
    id,
    player,
    type: 'claim',
    payload: {
      cellIndex,
      guess,
    },
  }
}

describe('validateOnlineVersusEvent', () => {
  it('accepts a normal claim on an empty cell for the current player', () => {
    const result = validateOnlineVersusEvent({
      roomStatus: 'active',
      puzzleId: 'puzzle-1',
      settings: makeSettings(),
      snapshot: makeSnapshot(),
      player: 'x',
      type: 'claim',
      payload: {
        cellIndex: 0,
        guess: makeGuess('x'),
      },
      existingEvents: [],
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        type: 'claim',
      })
    )
  })

  it('rejects claims on the wrong turn', () => {
    const result = validateOnlineVersusEvent({
      roomStatus: 'active',
      puzzleId: 'puzzle-1',
      settings: makeSettings(),
      snapshot: makeSnapshot({ currentPlayer: 'o' }),
      player: 'x',
      type: 'claim',
      payload: {
        cellIndex: 0,
        guess: makeGuess('x'),
      },
      existingEvents: [],
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: 'wrong_turn',
      })
    )
  })

  it('rejects claims on occupied cells', () => {
    const guesses = Array.from({ length: 9 }, () => null) as (CellGuess | null)[]
    guesses[0] = makeGuess('x')

    const result = validateOnlineVersusEvent({
      roomStatus: 'active',
      puzzleId: 'puzzle-1',
      settings: makeSettings(),
      snapshot: makeSnapshot({ guesses }),
      player: 'x',
      type: 'claim',
      payload: {
        cellIndex: 0,
        guess: makeGuess('x', 2),
      },
      existingEvents: [],
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: 'cell_unavailable',
      })
    )
  })

  it('rejects claims that reuse a game already on the board', () => {
    const guesses = Array.from({ length: 9 }, () => null) as (CellGuess | null)[]
    guesses[4] = makeGuess('o', 42, 'Already Used')

    const result = validateOnlineVersusEvent({
      roomStatus: 'active',
      puzzleId: 'puzzle-1',
      settings: makeSettings(),
      snapshot: makeSnapshot({ guesses }),
      player: 'x',
      type: 'claim',
      payload: {
        cellIndex: 0,
        guess: makeGuess('x', 42, 'Already Used'),
      },
      existingEvents: [],
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: 'duplicate_game',
      })
    )
  })

  it('accepts a steal when the event log is ahead of the saved snapshot', () => {
    const result = validateOnlineVersusEvent({
      roomStatus: 'active',
      puzzleId: 'puzzle-1',
      settings: makeSettings(),
      snapshot: makeSnapshot(),
      player: 'o',
      type: 'steal',
      payload: {
        cellIndex: 0,
        attackingGuess: makeGuess('o', 20, 'Counter Pick'),
        successful: true,
      },
      existingEvents: [makeClaimEvent(1, 'x', 0)],
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        type: 'steal',
      })
    )
  })

  it('rejects steals on cells without an opposing claim', () => {
    const result = validateOnlineVersusEvent({
      roomStatus: 'active',
      puzzleId: 'puzzle-1',
      settings: makeSettings(),
      snapshot: makeSnapshot({ currentPlayer: 'o', stealableCell: 4 }),
      player: 'o',
      type: 'steal',
      payload: {
        cellIndex: 4,
        attackingGuess: makeGuess('o', 20, 'Counter Pick'),
        successful: true,
      },
      existingEvents: [],
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: 'steal_not_available',
      })
    )
  })

  it('rejects steals that reuse a game from another cell', () => {
    const guesses = Array.from({ length: 9 }, () => null) as (CellGuess | null)[]
    guesses[0] = makeGuess('x', 10, 'Defender')
    guesses[5] = makeGuess('o', 99, 'Already Used')

    const result = validateOnlineVersusEvent({
      roomStatus: 'active',
      puzzleId: 'puzzle-1',
      settings: makeSettings(),
      snapshot: makeSnapshot({
        guesses,
        currentPlayer: 'o',
        stealableCell: 0,
      }),
      player: 'o',
      type: 'steal',
      payload: {
        cellIndex: 0,
        attackingGuess: makeGuess('o', 99, 'Already Used'),
        successful: false,
        resolutionKind: 'next-player',
        nextPlayer: 'x',
      },
      existingEvents: [],
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: 'duplicate_game',
      })
    )
  })

  it('keeps the defending claim when replaying a failed sustained steal objection', () => {
    const result = validateOnlineVersusEvent({
      roomStatus: 'active',
      puzzleId: 'puzzle-1',
      settings: makeSettings(),
      snapshot: null,
      player: 'x',
      type: 'claim',
      payload: {
        cellIndex: 1,
        guess: makeGuess('x', 30, 'Fresh Pick'),
      },
      existingEvents: [
        makeClaimEvent(1, 'x', 0, makeGuess('x', 10, 'Defender')),
        {
          id: 2,
          player: 'o',
          type: 'objection',
          payload: {
            cellIndex: 0,
            verdict: 'sustained',
            updatedGuess: makeGuess('o', 20, 'Counter Pick'),
            isSteal: true,
            successful: false,
            resolutionKind: 'next-player',
            nextPlayer: 'x',
            hadShowdownScores: true,
            attackingGameName: 'Counter Pick',
            attackingScore: 99,
            defendingGameName: 'Defender',
            defendingScore: 95,
          },
        },
      ],
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        type: 'claim',
        state: expect.objectContaining({
          currentPlayer: 'x',
          guesses: expect.arrayContaining([
            expect.objectContaining({
              gameId: 10,
              owner: 'x',
            }),
          ]),
        }),
      })
    )
  })

  it('rejects objections when the match has objections turned off', () => {
    const result = validateOnlineVersusEvent({
      roomStatus: 'active',
      puzzleId: 'puzzle-1',
      settings: makeSettings({ objectionRule: 'off' }),
      snapshot: makeSnapshot(),
      player: 'x',
      type: 'objection',
      payload: {
        cellIndex: 0,
        verdict: 'sustained',
        updatedGuess: makeGuess('x', 10),
        isSteal: false,
      },
      existingEvents: [],
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: 'objections_unavailable',
      })
    )
  })

  it('rejects objections after the player has used their limit', () => {
    const result = validateOnlineVersusEvent({
      roomStatus: 'active',
      puzzleId: 'puzzle-1',
      settings: makeSettings({ objectionRule: 'one' }),
      snapshot: makeSnapshot({ objectionsUsed: { x: 1, o: 0 } }),
      player: 'x',
      type: 'objection',
      payload: {
        cellIndex: 0,
        verdict: 'sustained',
        updatedGuess: makeGuess('x', 10),
        isSteal: false,
      },
      existingEvents: [],
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: 'objection_limit_reached',
      })
    )
  })

  it('rejects gameplay events after a winner is already present', () => {
    const result = validateOnlineVersusEvent({
      roomStatus: 'active',
      puzzleId: 'puzzle-1',
      settings: makeSettings(),
      snapshot: makeSnapshot({ winner: 'x' }),
      player: 'o',
      type: 'steal',
      payload: {
        cellIndex: 0,
        attackingGuess: makeGuess('o', 22),
        successful: false,
        resolutionKind: 'next-player',
        nextPlayer: 'x',
      },
      existingEvents: [],
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: 'match_finished',
      })
    )
  })

  it('rejects gameplay events before the host has set the puzzle', () => {
    const result = validateOnlineVersusEvent({
      roomStatus: 'active',
      puzzleId: null,
      settings: makeSettings(),
      snapshot: null,
      player: 'x',
      type: 'claim',
      payload: {
        cellIndex: 0,
        guess: makeGuess('x'),
      },
      existingEvents: [],
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: 'puzzle_not_ready',
      })
    )
  })
})
