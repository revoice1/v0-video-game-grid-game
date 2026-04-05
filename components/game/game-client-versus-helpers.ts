import type { CellGuess } from '@/lib/types'

export type TicTacToePlayer = 'x' | 'o'
export type VersusStealRule = 'lower' | 'higher' | 'fewer_reviews' | 'more_reviews'

export function getNextPlayer(player: TicTacToePlayer): TicTacToePlayer {
  return player === 'x' ? 'o' : 'x'
}

export function getPlayerLabel(player: TicTacToePlayer): string {
  return player === 'x' ? 'X' : 'O'
}

export function getClaimCounts(guesses: Array<CellGuess | null>) {
  return guesses.reduce(
    (counts, guess) => {
      if (guess?.owner === 'x') {
        counts.x += 1
      } else if (guess?.owner === 'o') {
        counts.o += 1
      }

      return counts
    },
    { x: 0, o: 0 }
  )
}

const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const

export function getWinningPlayer(guesses: (CellGuess | null)[]): TicTacToePlayer | null {
  for (const [a, b, c] of WINNING_LINES) {
    const owner = guesses[a]?.owner

    if (owner && owner === guesses[b]?.owner && owner === guesses[c]?.owner) {
      return owner
    }
  }

  return null
}

export function buildStealFailureDescription(options: {
  pendingFinalSteal: {
    defender: TicTacToePlayer
    cellIndex: number
  } | null
  selectedCell: number
  hasShowdownScores: boolean
  gameName: string
  attackingScore: number | null | undefined
  defendingGameName: string
  defendingScore: number | null | undefined
  versusStealRule: VersusStealRule
  currentPlayer: TicTacToePlayer
}): string {
  const {
    pendingFinalSteal,
    selectedCell,
    hasShowdownScores,
    gameName,
    attackingScore,
    defendingGameName,
    defendingScore,
    versusStealRule,
    currentPlayer,
  } = options
  const ruleDescriptor =
    versusStealRule === 'lower'
      ? 'lower than'
      : versusStealRule === 'higher'
        ? 'higher than'
        : versusStealRule === 'fewer_reviews'
          ? 'fewer reviews than'
          : 'more reviews than'
  const metricLabel =
    versusStealRule === 'fewer_reviews' || versusStealRule === 'more_reviews'
      ? 'review count'
      : 'score'

  if (pendingFinalSteal && pendingFinalSteal.cellIndex === selectedCell) {
    if (!hasShowdownScores) {
      return `${getPlayerLabel(pendingFinalSteal.defender)} keeps the win because both answers needed a ${metricLabel}.`
    }

    return `${gameName} (${attackingScore}) needed to be ${ruleDescriptor} ${defendingGameName} (${defendingScore}). ${getPlayerLabel(pendingFinalSteal.defender)} keeps the win.`
  }

  if (!hasShowdownScores) {
    return `${getPlayerLabel(getNextPlayer(currentPlayer))} is up. Both answers need a ${metricLabel} to settle the steal.`
  }

  return `${getPlayerLabel(getNextPlayer(currentPlayer))} is up. ${gameName} (${attackingScore}) had to be ${ruleDescriptor} ${defendingGameName} (${defendingScore}).`
}

export function getVersusFullBoardResolution(
  guesses: Array<CellGuess | null>,
  disableDraws: boolean
):
  | {
      kind: 'continue'
    }
  | {
      kind: 'claims-win'
      winner: TicTacToePlayer
      title: string
      description: string
    }
  | {
      kind: 'draw'
      title: string
      description: string
    } {
  if (!guesses.every((guess) => guess !== null)) {
    return { kind: 'continue' }
  }

  if (disableDraws) {
    const claimCounts = getClaimCounts(guesses)
    const winner = claimCounts.x > claimCounts.o ? 'x' : 'o'

    return {
      kind: 'claims-win',
      winner,
      title: `${getPlayerLabel(winner)} wins on cells!`,
      description: `${getPlayerLabel(winner)} claimed ${Math.max(claimCounts.x, claimCounts.o)} squares to ${Math.min(claimCounts.x, claimCounts.o)}.`,
    }
  }

  return {
    kind: 'draw',
    title: 'Draw game',
    description: 'The board filled up without a three-in-a-row.',
  }
}

export function getVersusInvalidGuessResolution(options: {
  currentPlayer: TicTacToePlayer
  pendingFinalSteal: {
    defender: TicTacToePlayer
    cellIndex: number
  } | null
  selectedCell: number
  missReason: string
}):
  | {
      kind: 'defender-wins'
      defender: TicTacToePlayer
      title: string
      description: string
    }
  | {
      kind: 'next-player'
      nextPlayer: TicTacToePlayer
      title: string
      description: string
    } {
  const { currentPlayer, pendingFinalSteal, selectedCell, missReason } = options

  if (pendingFinalSteal && pendingFinalSteal.cellIndex === selectedCell) {
    return {
      kind: 'defender-wins',
      defender: pendingFinalSteal.defender,
      title: 'Final steal chance missed',
      description: `${missReason}. ${getPlayerLabel(pendingFinalSteal.defender)} keeps the win.`,
    }
  }

  const nextPlayer = getNextPlayer(currentPlayer)
  return {
    kind: 'next-player',
    nextPlayer,
    title: 'Missed claim',
    description: `${missReason}. ${getPlayerLabel(nextPlayer)} is up.`,
  }
}

export function getVersusTurnExpiredResolution(options: {
  currentPlayer: TicTacToePlayer
  pendingFinalSteal: {
    defender: TicTacToePlayer
    cellIndex: number
  } | null
}):
  | {
      kind: 'defender-wins'
      defender: TicTacToePlayer
      title: string
      description: string
    }
  | {
      kind: 'next-player'
      nextPlayer: TicTacToePlayer
      title: string
      description: string
    } {
  const { currentPlayer, pendingFinalSteal } = options

  if (pendingFinalSteal) {
    return {
      kind: 'defender-wins',
      defender: pendingFinalSteal.defender,
      title: 'Final steal chance expired',
      description: `${getPlayerLabel(pendingFinalSteal.defender)} keeps the win.`,
    }
  }

  const nextPlayer = getNextPlayer(currentPlayer)
  return {
    kind: 'next-player',
    nextPlayer,
    title: 'Turn expired',
    description: `${getPlayerLabel(nextPlayer)} is up.`,
  }
}

export function getVersusPlacementResolution(options: {
  newGuesses: Array<CellGuess | null>
  currentPlayer: TicTacToePlayer
  selectedCell: number
  isVersusSteal: boolean
  stealsEnabled: boolean
  disableDraws: boolean
}):
  | {
      kind: 'final-steal'
      defender: TicTacToePlayer
      cellIndex: number
      nextPlayer: TicTacToePlayer
      title: string
      description: string
    }
  | {
      kind: 'winner'
      winner: TicTacToePlayer
      title: string
      description: string
    }
  | {
      kind: 'claims-win'
      winner: TicTacToePlayer
      title: string
      description: string
    }
  | {
      kind: 'draw'
      title: string
      description: string
    }
  | {
      kind: 'next-player'
      nextPlayer: TicTacToePlayer
      title: string
      description: string
    } {
  const { newGuesses, currentPlayer, selectedCell, isVersusSteal, stealsEnabled, disableDraws } =
    options
  const winningPlayer = getWinningPlayer(newGuesses)
  const nextPlayer = getNextPlayer(currentPlayer)

  if (stealsEnabled && currentPlayer === 'x' && winningPlayer === 'x') {
    return {
      kind: 'final-steal',
      defender: winningPlayer,
      cellIndex: selectedCell,
      nextPlayer,
      title: 'Last chance steal',
      description: 'O gets one chance to answer back on that square.',
    }
  }

  if (winningPlayer) {
    return {
      kind: 'winner',
      winner: winningPlayer,
      title: `${getPlayerLabel(winningPlayer)} wins!`,
      description: isVersusSteal
        ? 'That steal completed the line.'
        : 'Three in a row takes the match.',
    }
  }

  const fullBoardResolution = getVersusFullBoardResolution(newGuesses, disableDraws)
  if (fullBoardResolution.kind === 'claims-win') {
    if (stealsEnabled && currentPlayer === 'x' && fullBoardResolution.winner === 'x') {
      return {
        kind: 'final-steal',
        defender: 'x',
        cellIndex: selectedCell,
        nextPlayer,
        title: 'Last chance steal',
        description: 'O gets one chance to answer back on that square.',
      }
    }

    return fullBoardResolution
  }

  if (fullBoardResolution.kind === 'draw') {
    return fullBoardResolution
  }

  return {
    kind: 'next-player',
    nextPlayer,
    title: isVersusSteal ? 'Stolen square' : 'Claim locked in',
    description: `${getPlayerLabel(nextPlayer)} is up.`,
  }
}
