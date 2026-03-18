'use client'

import { useState, useEffect, useCallback } from 'react'
import { GameHeader } from './game-header'
import { GameGrid } from './game-grid'
import { GameSearch } from './game-search'
import { ResultsModal } from './results-modal'
import { HowToPlayModal } from './how-to-play-modal'
import { getSessionId, saveGameState, loadGameState, clearGameState } from '@/lib/session'
import type { Puzzle, CellGuess, Game, Category } from '@/lib/types'
import { Spinner } from '@/components/ui/spinner'

const MAX_GUESSES = 9

export function GameClient() {
  const [mode, setMode] = useState<'daily' | 'practice'>('daily')
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [guesses, setGuesses] = useState<(CellGuess | null)[]>(Array(9).fill(null))
  const [guessesRemaining, setGuessesRemaining] = useState(MAX_GUESSES)
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showResults, setShowResults] = useState(false)
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const [sessionId, setSessionId] = useState('')

  const score = guesses.filter(g => g?.isCorrect).length
  const isComplete = guessesRemaining === 0 || guesses.every(g => g !== null)

  // Initialize session
  useEffect(() => {
    setSessionId(getSessionId())
  }, [])

  // Load puzzle
  const loadPuzzle = useCallback(async (gameMode: 'daily' | 'practice') => {
    setIsLoading(true)
    setGuesses(Array(9).fill(null))
    setGuessesRemaining(MAX_GUESSES)
    setSelectedCell(null)
    setShowResults(false)

    try {
      // Check for saved state first
      const savedState = loadGameState(gameMode === 'daily')
      
      const response = await fetch(`/api/puzzle?mode=${gameMode}`)
      const puzzleData = await response.json()
      
      if (puzzleData.error) {
        console.error('Puzzle error:', puzzleData.error)
        return
      }
      
      setPuzzle(puzzleData)

      // Restore saved state if it matches current puzzle
      if (savedState && savedState.puzzleId === puzzleData.id) {
        // We'd need to reconstruct full guesses from saved game IDs
        // For now, just restore the game state
        setGuessesRemaining(savedState.guessesRemaining)
        if (savedState.isComplete) {
          setShowResults(true)
        }
      }
    } catch (error) {
      console.error('Failed to load puzzle:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPuzzle(mode)
  }, [mode, loadPuzzle])

  // Handle mode change
  const handleModeChange = (newMode: 'daily' | 'practice') => {
    if (newMode !== mode) {
      setMode(newMode)
    }
  }

  // Handle cell click
  const handleCellClick = (index: number) => {
    if (guesses[index] !== null || isComplete) return
    setSelectedCell(index)
  }

  // Handle game selection
  const handleGameSelect = async (game: Game) => {
    if (selectedCell === null || !puzzle) return

    const rowIndex = Math.floor(selectedCell / 3)
    const colIndex = selectedCell % 3
    const rowCategory = puzzle.row_categories[rowIndex]
    const colCategory = puzzle.col_categories[colIndex]

    try {
      const response = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          puzzleId: puzzle.id,
          cellIndex: selectedCell,
          gameId: game.id,
          gameName: game.name,
          gameImage: game.background_image,
          sessionId,
          rowCategory,
          colCategory,
        }),
      })

      const result = await response.json()
      
      const newGuess: CellGuess = {
        gameId: game.id,
        gameName: game.name,
        gameImage: game.background_image,
        isCorrect: result.valid,
      }

      const newGuesses = [...guesses]
      newGuesses[selectedCell] = newGuess
      setGuesses(newGuesses)
      
      const newGuessesRemaining = guessesRemaining - 1
      setGuessesRemaining(newGuessesRemaining)
      setSelectedCell(null)

      // Save state
      saveGameState({
        puzzleId: puzzle.id,
        guesses: newGuesses.map(g => g?.gameId || null),
        guessesRemaining: newGuessesRemaining,
        isComplete: newGuessesRemaining === 0 || newGuesses.every(g => g !== null),
      }, mode === 'daily')

      // Check if game is complete
      if (newGuessesRemaining === 0 || newGuesses.every(g => g !== null)) {
        // Record completion
        const finalScore = newGuesses.filter(g => g?.isCorrect).length
        await fetch('/api/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            puzzleId: puzzle.id,
            sessionId,
            score: finalScore,
            rarityScore: 0, // Will be calculated on results load
          }),
        })
        
        setTimeout(() => setShowResults(true), 500)
      }
    } catch (error) {
      console.error('Guess error:', error)
    }
  }

  // Handle play again (practice mode only)
  const handlePlayAgain = () => {
    clearGameState(false)
    loadPuzzle('practice')
  }

  // Get categories for selected cell
  const getSelectedCategories = (): { row: Category | null; col: Category | null } => {
    if (selectedCell === null || !puzzle) return { row: null, col: null }
    const rowIndex = Math.floor(selectedCell / 3)
    const colIndex = selectedCell % 3
    return {
      row: puzzle.row_categories[rowIndex],
      col: puzzle.col_categories[colIndex],
    }
  }

  const { row: selectedRowCategory, col: selectedColCategory } = getSelectedCategories()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Spinner className="w-8 h-8 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading puzzle...</p>
        </div>
      </div>
    )
  }

  if (!puzzle) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load puzzle</p>
          <button
            onClick={() => loadPuzzle(mode)}
            className="text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen py-6 px-4">
      <GameHeader
        mode={mode}
        guessesRemaining={guessesRemaining}
        score={score}
        onModeChange={handleModeChange}
        onHowToPlay={() => setShowHowToPlay(true)}
      />

      <GameGrid
        rowCategories={puzzle.row_categories}
        colCategories={puzzle.col_categories}
        guesses={guesses}
        selectedCell={selectedCell}
        isGameOver={isComplete}
        onCellClick={handleCellClick}
      />

      {/* Show results button when complete */}
      {isComplete && !showResults && (
        <div className="max-w-lg mx-auto mt-6 text-center">
          <button
            onClick={() => setShowResults(true)}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            View Results
          </button>
        </div>
      )}

      <GameSearch
        isOpen={selectedCell !== null}
        rowCategory={selectedRowCategory}
        colCategory={selectedColCategory}
        onSelect={handleGameSelect}
        onClose={() => setSelectedCell(null)}
      />

      <ResultsModal
        isOpen={showResults}
        onClose={() => setShowResults(false)}
        guesses={guesses}
        puzzleId={puzzle.id}
        isDaily={mode === 'daily'}
        onPlayAgain={handlePlayAgain}
      />

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
      />

      {/* Footer */}
      <footer className="max-w-lg mx-auto mt-8 text-center text-xs text-muted-foreground">
        <p>
          Game data from{' '}
          <a 
            href="https://rawg.io" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            RAWG.io
          </a>
        </p>
      </footer>
    </main>
  )
}
