import { describe, expect, it } from 'vitest'
import {
  buildStealFailureDescription,
  getClaimCounts,
  getOnlineVersusPlacementResult,
  getNextPlayer,
  getOnlineVersusPlacementStateTransition,
  getOnlineVersusStealShowdownData,
  getPlayerLabel,
  getStealShowdownMetric,
  getVersusFullBoardResolution,
  getVersusInvalidGuessResolution,
  getVersusPlacementResolution,
  getVersusTurnExpiredResolution,
  getWinningPlayer,
} from '@/components/game/game-client-versus-helpers'
import type { CellGuess } from '@/lib/types'

function makeOwnedGuess(owner: 'x' | 'o'): CellGuess {
  return {
    gameId: owner === 'x' ? 1 : 2,
    gameName: owner === 'x' ? 'X Game' : 'O Game',
    gameImage: null,
    isCorrect: true,
    owner,
  }
}

describe('game client versus helpers', () => {
  it('derives the next player and user-facing label', () => {
    expect(getNextPlayer('x')).toBe('o')
    expect(getNextPlayer('o')).toBe('x')
    expect(getPlayerLabel('x')).toBe('X')
    expect(getPlayerLabel('o')).toBe('O')
  })

  it('reads showdown metrics from guess metadata', () => {
    expect(
      getStealShowdownMetric(
        {
          ...makeOwnedGuess('x'),
          stealRating: 81,
          stealRatingCount: 240,
        },
        'lower'
      )
    ).toBe(81)

    expect(
      getStealShowdownMetric(
        {
          ...makeOwnedGuess('x'),
          stealRating: 81,
          stealRatingCount: 240,
        },
        'fewer_reviews'
      )
    ).toBe(240)
  })

  it('prefers payload-provided showdown scores for online steals', () => {
    const showdown = getOnlineVersusStealShowdownData({
      stealPayload: {
        cellIndex: 4,
        attackingGuess: {
          ...makeOwnedGuess('o'),
          gameName: 'Payload Guess',
        },
        successful: false,
        hadShowdownScores: true,
        attackingGameName: 'Payload Guess',
        attackingScore: 72,
        defendingGameName: 'Local Defender',
        defendingScore: 88,
      },
      defendingGuess: {
        ...makeOwnedGuess('x'),
        gameName: 'Stale Defender',
        stealRating: null,
        stealRatingCount: null,
      },
      attackingGuess: {
        ...makeOwnedGuess('o'),
        gameName: 'Stale Attacker',
        stealRating: null,
        stealRatingCount: null,
      },
      rule: 'lower',
    })

    expect(showdown).toEqual({
      hasShowdownScores: true,
      attackingScore: 72,
      defendingScore: 88,
      attackerName: 'Payload Guess',
      defenderName: 'Local Defender',
    })
  })

  it('falls back to local guess metrics when payload scores are absent', () => {
    const showdown = getOnlineVersusStealShowdownData({
      stealPayload: {
        cellIndex: 4,
        attackingGuess: makeOwnedGuess('o'),
        successful: false,
      },
      defendingGuess: {
        ...makeOwnedGuess('x'),
        gameName: 'Defender',
        stealRating: 91,
        stealRatingCount: 400,
      },
      attackingGuess: {
        ...makeOwnedGuess('o'),
        gameName: 'Attacker',
        stealRating: 79,
        stealRatingCount: 250,
      },
      rule: 'lower',
    })

    expect(showdown).toEqual({
      hasShowdownScores: true,
      attackingScore: 79,
      defendingScore: 91,
      attackerName: 'Attacker',
      defenderName: 'Defender',
    })
  })

  it('counts claimed cells by owner', () => {
    expect(
      getClaimCounts([makeOwnedGuess('x'), makeOwnedGuess('o'), null, makeOwnedGuess('x')])
    ).toEqual({ x: 2, o: 1 })
  })

  it('detects a winning line from the board state', () => {
    expect(
      getWinningPlayer([
        makeOwnedGuess('x'),
        makeOwnedGuess('x'),
        makeOwnedGuess('x'),
        null,
        null,
        null,
        null,
        null,
        null,
      ])
    ).toBe('x')
  })

  it('builds the normal failed-steal description with showdown scores', () => {
    expect(
      buildStealFailureDescription({
        pendingFinalSteal: null,
        selectedCell: 2,
        hasShowdownScores: true,
        gameName: 'Attacker',
        attackingScore: 71,
        defendingGameName: 'Defender',
        defendingScore: 82,
        versusStealRule: 'lower',
        currentPlayer: 'o',
      })
    ).toBe('X is up. Attacker (71) had to be lower than Defender (82).')
  })

  it('builds the final-steal failure description without showdown scores', () => {
    expect(
      buildStealFailureDescription({
        pendingFinalSteal: { defender: 'x', cellIndex: 2 },
        selectedCell: 2,
        hasShowdownScores: false,
        gameName: 'Attacker',
        attackingScore: null,
        defendingGameName: 'Defender',
        defendingScore: null,
        versusStealRule: 'higher',
        currentPlayer: 'o',
      })
    ).toBe('X keeps the win because both answers needed a score.')
  })

  it('returns continue when the board is not full yet', () => {
    expect(
      getVersusFullBoardResolution([makeOwnedGuess('x'), null, makeOwnedGuess('o')], false)
    ).toEqual({ kind: 'continue' })
  })

  it('resolves a draw when the board is full and draws are allowed', () => {
    expect(
      getVersusFullBoardResolution(
        [
          makeOwnedGuess('x'),
          makeOwnedGuess('o'),
          makeOwnedGuess('x'),
          makeOwnedGuess('o'),
          makeOwnedGuess('x'),
          makeOwnedGuess('o'),
          makeOwnedGuess('x'),
          makeOwnedGuess('o'),
          makeOwnedGuess('x'),
        ],
        false
      )
    ).toEqual({
      kind: 'draw',
      title: 'Draw game',
      description: 'The board filled up without a three-in-a-row.',
    })
  })

  it('resolves an invalid final steal as a defender win', () => {
    expect(
      getVersusInvalidGuessResolution({
        currentPlayer: 'o',
        pendingFinalSteal: { defender: 'x', cellIndex: 2 },
        selectedCell: 2,
        missReason: "didn't match Horror",
      })
    ).toEqual({
      kind: 'defender-wins',
      defender: 'x',
      title: 'Final steal chance missed',
      description: "didn't match Horror. X keeps the win.",
    })
  })

  it('resolves a normal invalid claim by handing the turn over', () => {
    expect(
      getVersusInvalidGuessResolution({
        currentPlayer: 'x',
        pendingFinalSteal: null,
        selectedCell: 4,
        missReason: "didn't match RPG",
      })
    ).toEqual({
      kind: 'next-player',
      nextPlayer: 'o',
      title: 'Missed claim',
      description: "didn't match RPG. O is up.",
    })
  })

  it('resolves a final steal timeout as a defender win', () => {
    expect(
      getVersusTurnExpiredResolution({
        currentPlayer: 'o',
        pendingFinalSteal: { defender: 'x', cellIndex: 2 },
      })
    ).toEqual({
      kind: 'defender-wins',
      defender: 'x',
      title: 'Final steal chance expired',
      description: 'X keeps the win.',
    })
  })

  it('resolves a normal turn timeout by handing the turn over', () => {
    expect(
      getVersusTurnExpiredResolution({
        currentPlayer: 'x',
        pendingFinalSteal: null,
      })
    ).toEqual({
      kind: 'next-player',
      nextPlayer: 'o',
      title: 'Turn expired',
      description: 'O is up.',
    })
  })

  it('resolves a claims win when draws are disabled', () => {
    expect(
      getVersusFullBoardResolution(
        [
          makeOwnedGuess('x'),
          makeOwnedGuess('o'),
          makeOwnedGuess('x'),
          makeOwnedGuess('o'),
          makeOwnedGuess('x'),
          makeOwnedGuess('o'),
          makeOwnedGuess('x'),
          makeOwnedGuess('o'),
          makeOwnedGuess('x'),
        ],
        true
      )
    ).toEqual({
      kind: 'claims-win',
      winner: 'x',
      title: 'X wins on cells!',
      description: 'X claimed 5 squares to 4.',
    })
  })

  it('resolves a placed X line as a final steal opportunity first', () => {
    expect(
      getVersusPlacementResolution({
        newGuesses: [
          makeOwnedGuess('x'),
          makeOwnedGuess('x'),
          makeOwnedGuess('x'),
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        currentPlayer: 'x',
        selectedCell: 2,
        isVersusSteal: false,
        stealsEnabled: true,
        disableDraws: false,
      })
    ).toEqual({
      kind: 'final-steal',
      defender: 'x',
      cellIndex: 2,
      nextPlayer: 'o',
      title: 'Last chance steal',
      description: 'O gets one chance to answer back on that square.',
    })
  })

  it('resolves a placed O line as an immediate winner', () => {
    expect(
      getVersusPlacementResolution({
        newGuesses: [
          makeOwnedGuess('o'),
          makeOwnedGuess('o'),
          makeOwnedGuess('o'),
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        currentPlayer: 'o',
        selectedCell: 2,
        isVersusSteal: true,
        stealsEnabled: true,
        disableDraws: false,
      })
    ).toEqual({
      kind: 'winner',
      winner: 'o',
      title: 'O wins!',
      description: 'That steal completed the line.',
    })
  })

  it('resolves an X line as an immediate winner when steals are off', () => {
    expect(
      getVersusPlacementResolution({
        newGuesses: [
          makeOwnedGuess('x'),
          makeOwnedGuess('x'),
          makeOwnedGuess('x'),
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        currentPlayer: 'x',
        selectedCell: 2,
        isVersusSteal: false,
        stealsEnabled: false,
        disableDraws: false,
      })
    ).toEqual({
      kind: 'winner',
      winner: 'x',
      title: 'X wins!',
      description: 'Three in a row takes the match.',
    })
  })

  it('resolves an X last-square claims win as a final steal opportunity first', () => {
    expect(
      getVersusPlacementResolution({
        newGuesses: [
          makeOwnedGuess('x'),
          makeOwnedGuess('o'),
          makeOwnedGuess('x'),
          makeOwnedGuess('o'),
          makeOwnedGuess('x'),
          makeOwnedGuess('o'),
          makeOwnedGuess('x'),
          makeOwnedGuess('o'),
          makeOwnedGuess('x'),
        ],
        currentPlayer: 'x',
        selectedCell: 8,
        isVersusSteal: false,
        stealsEnabled: true,
        disableDraws: true,
      })
    ).toEqual({
      kind: 'final-steal',
      defender: 'x',
      cellIndex: 8,
      nextPlayer: 'o',
      title: 'Last chance steal',
      description: 'O gets one chance to answer back on that square.',
    })
  })

  it('keeps the repeated final steal square stealable for the joiner-side remote state', () => {
    const resolution = getVersusPlacementResolution({
      newGuesses: [
        makeOwnedGuess('x'),
        makeOwnedGuess('x'),
        makeOwnedGuess('x'),
        null,
        null,
        null,
        null,
        null,
        null,
      ],
      currentPlayer: 'x',
      selectedCell: 2,
      isVersusSteal: true,
      stealsEnabled: true,
      disableDraws: false,
    })

    expect(
      getOnlineVersusPlacementStateTransition({
        resolution,
        newStealable: 2,
      })
    ).toEqual({
      winner: null,
      pendingFinalSteal: {
        defender: 'x',
        cellIndex: 2,
      },
      stealableCell: 2,
      nextPlayer: 'o',
      shouldClearTurnDeadline: false,
    })
  })

  it('derives the same remote placement result and transition in one helper', () => {
    expect(
      getOnlineVersusPlacementResult({
        newGuesses: [
          makeOwnedGuess('x'),
          makeOwnedGuess('x'),
          makeOwnedGuess('x'),
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        currentPlayer: 'x',
        selectedCell: 2,
        isVersusSteal: true,
        stealsEnabled: true,
        disableDraws: false,
        newStealable: 2,
      })
    ).toEqual({
      resolution: {
        kind: 'final-steal',
        defender: 'x',
        cellIndex: 2,
        nextPlayer: 'o',
        title: 'Last chance steal',
        description: 'O gets one chance to answer back on that square.',
      },
      nextState: {
        winner: null,
        pendingFinalSteal: {
          defender: 'x',
          cellIndex: 2,
        },
        stealableCell: 2,
        nextPlayer: 'o',
        shouldClearTurnDeadline: false,
      },
    })
  })
})
