import { describe, expect, it } from 'vitest'
import { resolveStealOutcome } from '@/hooks/use-versus-steal'
import type { CellGuess } from '@/lib/types'

const baseContext = {
  currentPlayer: 'o' as const,
  pendingFinalSteal: null,
  selectedCell: 2,
}

function makeGuess(stealRating: number | null): CellGuess {
  return {
    gameId: 1,
    gameName: 'Test Game',
    gameImage: null,
    isCorrect: true,
    stealRating,
  }
}

describe('resolveStealOutcome', () => {
  it('succeeds when the attacker wins a lower-is-better showdown', () => {
    const outcome = resolveStealOutcome({
      ...baseContext,
      rule: 'lower',
      defendingGuess: makeGuess(82),
      attackingGuess: makeGuess(71),
    })

    expect(outcome.successful).toBe(true)
    expect(outcome.hasShowdownScores).toBe(true)
    expect(outcome.actions).toEqual([{ kind: 'clearPendingSteal' }, { kind: 'clearStealable' }])
  })

  it('hands the turn over on a normal failed steal', () => {
    const outcome = resolveStealOutcome({
      ...baseContext,
      rule: 'lower',
      defendingGuess: makeGuess(71),
      attackingGuess: makeGuess(82),
    })

    expect(outcome.successful).toBe(false)
    expect(outcome.actions).toContainEqual({ kind: 'clearSelection' })
    expect(outcome.actions).toContainEqual({ kind: 'clearStealable' })
    expect(outcome.actions).toContainEqual({ kind: 'setLockImpact', cell: 2 })
    expect(outcome.actions).toContainEqual({ kind: 'setNextPlayer', player: 'x' })
  })

  it('gives the defender the win when a final steal fails', () => {
    const outcome = resolveStealOutcome({
      ...baseContext,
      rule: 'higher',
      defendingGuess: makeGuess(91),
      attackingGuess: makeGuess(77),
      pendingFinalSteal: { defender: 'x', cellIndex: 2 },
    })

    expect(outcome.successful).toBe(false)
    expect(outcome.actions).toContainEqual({ kind: 'setWinner', player: 'x' })
    expect(outcome.actions).toContainEqual({ kind: 'clearPendingSteal' })
  })

  it('treats tied showdown scores as a failed steal', () => {
    const outcome = resolveStealOutcome({
      ...baseContext,
      rule: 'higher',
      defendingGuess: makeGuess(77),
      attackingGuess: makeGuess(77),
    })

    expect(outcome.successful).toBe(false)
    expect(outcome.hasShowdownScores).toBe(true)
    expect(outcome.actions).toContainEqual({ kind: 'setNextPlayer', player: 'x' })
    expect(outcome.actions).not.toContainEqual({ kind: 'setWinner', player: 'x' })
  })

  it('does not award a defender win when the pending final steal is for another cell', () => {
    const outcome = resolveStealOutcome({
      ...baseContext,
      rule: 'higher',
      defendingGuess: makeGuess(91),
      attackingGuess: makeGuess(77),
      pendingFinalSteal: { defender: 'x', cellIndex: 1 },
    })

    expect(outcome.successful).toBe(false)
    expect(outcome.actions).toContainEqual({ kind: 'setNextPlayer', player: 'x' })
    expect(outcome.actions).not.toContainEqual({ kind: 'setWinner', player: 'x' })
    expect(outcome.actions).not.toContainEqual({ kind: 'clearPendingSteal' })
  })

  it('treats missing scores as a failed steal without a showdown', () => {
    const outcome = resolveStealOutcome({
      ...baseContext,
      rule: 'lower',
      defendingGuess: makeGuess(null),
      attackingGuess: makeGuess(null),
    })

    expect(outcome.successful).toBe(false)
    expect(outcome.hasShowdownScores).toBe(false)
  })
})
