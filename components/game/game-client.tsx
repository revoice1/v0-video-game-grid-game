'use client'

import { useState, useEffect, useCallback } from 'react'
import { GameHeader } from './game-header'
import { GameGrid } from './game-grid'
import { GameSearch } from './game-search'
import { ResultsModal } from './results-modal'
import { HowToPlayModal } from './how-to-play-modal'
import { GuessDetailsModal } from './guess-details-modal'
import { getSessionId, saveGameState, loadGameState, clearGameState, type CellGuessRecord } from '@/lib/session'
import type { Puzzle, CellGuess, Game, Category } from '@/lib/types'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'

const MAX_GUESSES = 9

function getTimeUntilNextUtcMidnight(now = new Date()) {
  const nextReset = new Date(now)
  nextReset.setUTCHours(24, 0, 0, 0)

  const diffMs = Math.max(0, nextReset.getTime() - now.getTime())
  const totalSeconds = Math.floor(diffMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return {
    hours,
    minutes,
    seconds,
    label: `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`,
  }
}

export function GameClient() {
  const [mode, setMode] = useState<'daily' | 'practice'>('daily')
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [guesses, setGuesses] = useState<(CellGuess | null)[]>(Array(9).fill(null))
  const [guessesRemaining, setGuessesRemaining] = useState(MAX_GUESSES)
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showResults, setShowResults] = useState(false)
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const [detailCell, setDetailCell] = useState<number | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [loadingProgress, setLoadingProgress] = useState(8)
  const [loadingStage, setLoadingStage] = useState('Warming up the puzzle generator...')
  const [dailyResetLabel, setDailyResetLabel] = useState(() => getTimeUntilNextUtcMidnight().label)
  const { toast } = useToast()

  const score = guesses.filter(g => g?.isCorrect).length
  // Game is over when out of guesses OR all cells filled (not necessarily all correct)
  const gridFull = guesses.every(g => g !== null)
  const isComplete = guessesRemaining === 0 || gridFull

  // Initialize session
  useEffect(() => {
    setSessionId(getSessionId())
  }, [])

  useEffect(() => {
    const updateResetCountdown = () => {
      setDailyResetLabel(getTimeUntilNextUtcMidnight().label)
    }

    updateResetCountdown()
    const timer = setInterval(updateResetCountdown, 1000)

    return () => clearInterval(timer)
  }, [])

  // Load puzzle
  const loadPuzzle = useCallback(async (gameMode: 'daily' | 'practice') => {
    setIsLoading(true)
    setLoadingProgress(8)
    setLoadingStage('Warming up the puzzle generator...')
    setGuesses(Array(9).fill(null))
    setGuessesRemaining(MAX_GUESSES)
    setSelectedCell(null)
    setShowResults(false)
    setDetailCell(null)
    let progressTimer: ReturnType<typeof setInterval> | null = null

    const startLoadingProgress = () => {
      progressTimer = setInterval(() => {
        setLoadingProgress(current => {
          const next = Math.min(current + (current < 45 ? 11 : current < 72 ? 7 : 4), 92)

          if (next < 35) {
            setLoadingStage('Picking categories...')
          } else if (next < 68) {
            setLoadingStage('Testing intersections...')
          } else {
            setLoadingStage('Finalizing the board...')
          }

          return next
        })
      }, 700)
    }

    try {
      // Check for saved state first
      const savedState = loadGameState(gameMode === 'daily')

      if (savedState?.puzzle) {
        setLoadingProgress(100)
        setLoadingStage(
          gameMode === 'daily' ? 'Restoring today\'s puzzle...' : 'Restoring your practice puzzle...'
        )
        setPuzzle(savedState.puzzle)

        const restoredGuesses = savedState.guesses.map(g =>
          g ? { gameId: g.gameId, gameName: g.gameName, gameImage: g.gameImage, isCorrect: g.isCorrect } : null
        )
        setGuesses(restoredGuesses)
        setGuessesRemaining(savedState.guessesRemaining)
        if (savedState.isComplete) {
          setShowResults(true)
        }
        return
      }

      startLoadingProgress()
      const response = await fetch(`/api/puzzle?mode=${gameMode}`)
      const puzzleData = await response.json()
      
      if (puzzleData.error) {
        console.error('Puzzle error:', puzzleData.error)
        return
      }

      setLoadingProgress(100)
      setLoadingStage('Board ready.')
      setPuzzle(puzzleData)

      if (gameMode === 'practice' || gameMode === 'daily') {
        saveGameState({
          puzzleId: puzzleData.id,
          puzzle: puzzleData,
          guesses: Array(9).fill(null),
          guessesRemaining: MAX_GUESSES,
          isComplete: false,
        }, false)
      }

      // Restore saved state if it matches current puzzle
      if (savedState && savedState.puzzleId === puzzleData.id) {
        // Reconstruct full CellGuess array from saved state
        const restoredGuesses = savedState.guesses.map(g =>
          g ? { gameId: g.gameId, gameName: g.gameName, gameImage: g.gameImage, isCorrect: g.isCorrect } : null
        )
        setGuesses(restoredGuesses)
        setGuessesRemaining(savedState.guessesRemaining)
        if (savedState.isComplete) {
          setShowResults(true)
        }
      }
    } catch (error) {
      console.error('Failed to load puzzle:', error)
    } finally {
      if (progressTimer) {
        clearInterval(progressTimer)
      }
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

  const hydrateGuessDetails = useCallback(async (cellIndex: number) => {
    if (!puzzle) return

    const guess = guesses[cellIndex]
    if (!guess) return

    const alreadyHydrated =
      guess.released !== undefined ||
      guess.metacritic !== undefined ||
      guess.genres !== undefined ||
      guess.platforms !== undefined ||
      guess.developers !== undefined ||
      guess.publishers !== undefined ||
      guess.tags !== undefined ||
      guess.gameModes !== undefined ||
      guess.themes !== undefined ||
      guess.perspectives !== undefined ||
      guess.companies !== undefined

    if (alreadyHydrated) {
      return
    }

    const rowCategory = puzzle.row_categories[Math.floor(cellIndex / 3)]
    const colCategory = puzzle.col_categories[cellIndex % 3]

    try {
      const response = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: guess.gameId,
          rowCategory,
          colCategory,
          lookupOnly: true,
        }),
      })

      const result = await response.json()
      if (!result.game) {
        return
      }

      setGuesses(current =>
        current.map((existingGuess, index) => {
          if (index !== cellIndex || !existingGuess) {
            return existingGuess
          }

          return {
            ...existingGuess,
            gameSlug: result.game.slug ?? existingGuess.gameSlug ?? null,
            gameUrl: result.game.url ?? existingGuess.gameUrl ?? null,
            released: result.game.released ?? null,
            metacritic: result.game.metacritic ?? null,
            genres: result.game.genres ?? [],
            platforms: result.game.platforms ?? [],
            developers: result.game.developers ?? [],
            publishers: result.game.publishers ?? [],
            tags: result.game.tags ?? [],
            gameModes: result.game.gameModes ?? [],
            themes: result.game.themes ?? [],
            perspectives: result.game.perspectives ?? [],
            companies: result.game.companies ?? [],
            matchedRow: result.matchesRow,
            matchedCol: result.matchesCol,
          }
        })
      )
    } catch (error) {
      console.error('Failed to hydrate guess details:', error)
    }
  }, [guesses, puzzle])

  // Handle cell click
  const handleCellClick = async (index: number) => {
    if (guesses[index] !== null) {
      await hydrateGuessDetails(index)
      setDetailCell(index)
      return
    }
    if (isComplete) return
    setSelectedCell(index)
  }

  // Handle game selection
  const handleGameSelect = async (game: Game) => {
    if (selectedCell === null || !puzzle) return

    if (guesses.some(guess => guess?.gameId === game.id)) {
      toast({
        variant: 'destructive',
        title: 'Game already used',
        description: 'Each game can only be used once per grid.',
      })
      return
    }

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

      if (result.duplicate) {
        toast({
          variant: 'destructive',
          title: 'Game already used',
          description: 'Each game can only be used once per grid.',
        })
        return
      }
      
      const newGuess: CellGuess = {
        gameId: game.id,
        gameName: game.name,
        gameSlug: result.game?.slug ?? game.slug ?? null,
        gameUrl: result.game?.url ?? game.gameUrl ?? null,
        gameImage: game.background_image,
        isCorrect: result.valid,
        released: result.game?.released ?? null,
        metacritic: result.game?.metacritic ?? null,
        genres: result.game?.genres ?? [],
        platforms: result.game?.platforms ?? [],
        developers: result.game?.developers ?? [],
        publishers: result.game?.publishers ?? [],
        tags: result.game?.tags ?? [],
        gameModes: result.game?.gameModes ?? [],
        themes: result.game?.themes ?? [],
        perspectives: result.game?.perspectives ?? [],
        companies: result.game?.companies ?? [],
        matchedRow: result.matchesRow,
        matchedCol: result.matchesCol,
      }

      const newGuesses = [...guesses]
      newGuesses[selectedCell] = newGuess
      setGuesses(newGuesses)
      
      const newGuessesRemaining = guessesRemaining - 1
      setGuessesRemaining(newGuessesRemaining)
      setSelectedCell(null)

      // Save state with full guess objects for proper restoration
      saveGameState({
        puzzleId: puzzle.id,
        puzzle,
        guesses: newGuesses.map(g => g ? { gameId: g.gameId, gameName: g.gameName, gameImage: g.gameImage, isCorrect: g.isCorrect } : null),
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
      toast({
        variant: 'destructive',
        title: 'Guess failed',
        description: 'Something went wrong while checking that game.',
      })
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
  const detailGuess = detailCell !== null ? guesses[detailCell] : null
  const detailRowCategory = detailCell !== null && puzzle
    ? puzzle.row_categories[Math.floor(detailCell / 3)]
    : null
  const detailColCategory = detailCell !== null && puzzle
    ? puzzle.col_categories[detailCell % 3]
    : null
  const minimumCellOptions = puzzle?.cell_metadata?.reduce(
    (lowest, cell) => Math.min(lowest, cell.validOptionCount),
    Number.POSITIVE_INFINITY
  )
  const resolvedMinimumCellOptions = Number.isFinite(minimumCellOptions ?? Number.NaN)
    ? minimumCellOptions
    : null

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card/70 p-6 shadow-xl backdrop-blur-sm">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.24em] text-primary">
            Building Grid
          </p>
          <p className="mt-3 text-center text-lg font-semibold text-foreground">{loadingStage}</p>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {mode === 'daily'
              ? 'Checking today\'s board and validating the trickiest cells.'
              : 'Generating a fresh practice puzzle and sanity-checking each intersection.'}
          </p>
          <div className="mt-6 space-y-2">
            <Progress value={loadingProgress} className="h-3" />
            <p className="text-right text-xs font-medium text-muted-foreground">
              {loadingProgress}% complete
            </p>
          </div>
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
        dailyResetLabel={mode === 'daily' ? dailyResetLabel : null}
        onModeChange={handleModeChange}
        onHowToPlay={() => setShowHowToPlay(true)}
        onNewPracticeGame={mode === 'practice' ? handlePlayAgain : undefined}
      />

      {puzzle.validation_status && puzzle.validation_status !== 'validated' && (
        <div className="max-w-lg mx-auto mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium text-amber-200">Cross-sections are not fully validated</p>
          <p className="mt-1 text-amber-100/90">
            {puzzle.validation_message ?? 'This puzzle may contain weaker or less certain intersections than usual.'}
          </p>
        </div>
      )}

      <GameGrid
        rowCategories={puzzle.row_categories}
        colCategories={puzzle.col_categories}
        guesses={guesses}
        cellMetadata={puzzle.cell_metadata}
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
        rowCategories={puzzle.row_categories}
        colCategories={puzzle.col_categories}
        isDaily={mode === 'daily'}
        onPlayAgain={handlePlayAgain}
      />

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        minimumCellOptions={resolvedMinimumCellOptions}
        validationStatus={puzzle.validation_status}
        dailyResetLabel={dailyResetLabel}
      />

      <GuessDetailsModal
        isOpen={detailCell !== null && detailGuess !== null}
        onClose={() => setDetailCell(null)}
        guess={detailGuess}
        rowCategory={detailRowCategory}
        colCategory={detailColCategory}
      />

      {/* Footer */}
      <footer className="max-w-lg mx-auto mt-8 text-center text-xs text-muted-foreground">
        <p>
          Game data from{' '}
          <a 
            href="https://www.igdb.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            IGDB
          </a>
        </p>
      </footer>
    </main>
  )
}
