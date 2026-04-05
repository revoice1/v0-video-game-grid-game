import type { CellGuess } from '@/lib/types'
import type { VersusStealRule } from '@/components/game/versus-setup-modal'

type Player = 'x' | 'o'

export interface PendingVersusSteal {
  defender: Player
  cellIndex: number
}

interface StealContext {
  currentPlayer: Player
  defendingGuess: CellGuess
  attackingGuess: CellGuess
  rule: VersusStealRule
  pendingFinalSteal: PendingVersusSteal | null
  selectedCell: number
}

export type StealAction =
  | { kind: 'clearSelection' }
  | { kind: 'clearStealable' }
  | { kind: 'clearPendingSteal' }
  | { kind: 'setLockImpact'; cell: number }
  | { kind: 'setNextPlayer'; player: Player }
  | { kind: 'setWinner'; player: Player }

export interface StealOutcome {
  hasShowdownScores: boolean
  successful: boolean
  actions: StealAction[]
}

function getNextPlayer(player: Player): Player {
  return player === 'x' ? 'o' : 'x'
}

export function resolveStealOutcome({
  currentPlayer,
  defendingGuess,
  attackingGuess,
  rule,
  pendingFinalSteal,
  selectedCell,
}: StealContext): StealOutcome {
  const usesReviewCountRule = rule === 'fewer_reviews' || rule === 'more_reviews'
  const defendingScore = usesReviewCountRule
    ? defendingGuess.stealRatingCount
    : defendingGuess.stealRating
  const attackingScore = usesReviewCountRule
    ? attackingGuess.stealRatingCount
    : attackingGuess.stealRating
  const hasShowdownScores =
    defendingScore !== null &&
    defendingScore !== undefined &&
    attackingScore !== null &&
    attackingScore !== undefined

  const successful =
    hasShowdownScores &&
    (rule === 'lower' || rule === 'fewer_reviews'
      ? attackingScore < defendingScore
      : attackingScore > defendingScore)

  if (successful) {
    return {
      hasShowdownScores,
      successful,
      actions: [{ kind: 'clearPendingSteal' }, { kind: 'clearStealable' }],
    }
  }

  const baseFailureActions: StealAction[] = [
    { kind: 'clearSelection' },
    { kind: 'clearStealable' },
    { kind: 'setLockImpact', cell: selectedCell },
  ]

  if (pendingFinalSteal && pendingFinalSteal.cellIndex === selectedCell) {
    return {
      hasShowdownScores,
      successful: false,
      actions: [
        ...baseFailureActions,
        { kind: 'setWinner', player: pendingFinalSteal.defender },
        { kind: 'clearPendingSteal' },
      ],
    }
  }

  return {
    hasShowdownScores,
    successful: false,
    actions: [
      ...baseFailureActions,
      { kind: 'setNextPlayer', player: getNextPlayer(currentPlayer) },
    ],
  }
}
