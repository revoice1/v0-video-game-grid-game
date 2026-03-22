import { useState } from 'react'
import type { CellGuess, Puzzle } from '@/lib/types'

type TicTacToePlayer = 'x' | 'o'

type PuzzleStateOptions = {
  cellCount: number
  maxGuesses: number
}

export function usePuzzleState({ cellCount, maxGuesses }: PuzzleStateOptions) {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [guesses, setGuesses] = useState<(CellGuess | null)[]>(
    Array.from({ length: cellCount }, () => null)
  )
  const [guessesRemaining, setGuessesRemaining] = useState(maxGuesses)
  const [currentPlayer, setCurrentPlayer] = useState<TicTacToePlayer>('x')
  const [stealableCell, setStealableCell] = useState<number | null>(null)
  const [winner, setWinner] = useState<TicTacToePlayer | null>(null)
  const [selectedCell, setSelectedCell] = useState<number | null>(null)

  return {
    puzzle,
    setPuzzle,
    guesses,
    setGuesses,
    guessesRemaining,
    setGuessesRemaining,
    currentPlayer,
    setCurrentPlayer,
    stealableCell,
    setStealableCell,
    winner,
    setWinner,
    selectedCell,
    setSelectedCell,
  }
}
