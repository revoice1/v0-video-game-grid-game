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

interface PuzzleStreamMessage {
  type: 'progress' | 'puzzle' | 'error'
  pct?: number
  message?: string
  puzzle?: Puzzle
  stage?: 'families' | 'attempt' | 'cell' | 'metadata' | 'rejected' | 'done'
  attempt?: number
  rows?: string[]
  cols?: string[]
  cellIndex?: number
  rowCategory?: string
  colCategory?: string
  validOptionCount?: number
  passed?: boolean
}

interface LoadingIntersection {
  label: string
  status: 'pending' | 'passed' | 'failed'
  validOptionCount?: number
}

interface LoadingAttempt {
  attempt: number
  rows: string[]
  cols: string[]
  intersections: LoadingIntersection[]
  rejectedMessage?: string
}

function buildAttemptIntersections(rows: string[], cols: string[]): LoadingIntersection[] {
  return rows.flatMap(row => cols.map(col => ({
    label: `${row} x ${col}`,
    status: 'pending' as const,
  })))
}

function getIntersectionLabelClass(label: string): string {
  if (label.length > 42) {
    return 'text-[10px]'
  }

  if (label.length > 30) {
    return 'text-[11px]'
  }

  return 'text-xs'
}

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
  const [loadingAttempts, setLoadingAttempts] = useState<LoadingAttempt[]>([])
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
    const savedState = loadGameState(gameMode === 'daily')

    if (savedState?.puzzle) {
      setPuzzle(savedState.puzzle)
      setGuesses(
        savedState.guesses.map(g =>
          g ? { gameId: g.gameId, gameName: g.gameName, gameImage: g.gameImage, isCorrect: g.isCorrect } : null
        )
      )
      setGuessesRemaining(savedState.guessesRemaining)
      setSelectedCell(null)
      setShowResults(savedState.isComplete)
      setDetailCell(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setGuesses(Array(9).fill(null))
    setGuessesRemaining(MAX_GUESSES)
    setSelectedCell(null)
    setShowResults(false)
    setDetailCell(null)

    setLoadingProgress(8)
    setLoadingStage(gameMode === 'daily' ? "Loading today's board..." : 'Warming up the puzzle generator...')
    setLoadingAttempts([])

    try {
      let puzzleData: Puzzle | null = null

      if (gameMode === 'practice') {
        const response = await fetch(`/api/puzzle-stream?mode=${gameMode}`)
        if (!response.ok || !response.body) {
          throw new Error('Failed to open puzzle stream')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split('\n\n')
          buffer = events.pop() ?? ''

          for (const eventChunk of events) {
            const dataLine = eventChunk
              .split('\n')
              .find(line => line.startsWith('data: '))

            if (!dataLine) {
              continue
            }

            const event = JSON.parse(dataLine.slice(6)) as PuzzleStreamMessage

            if (event.type === 'progress') {
              if (typeof event.pct === 'number') {
                setLoadingProgress(current => Math.max(current, event.pct!))
              }
              if (event.message) {
                setLoadingStage(event.message)
              }
              if (event.stage === 'attempt' && event.attempt && event.rows && event.cols) {
                setLoadingAttempts(current => {
                  const nextAttempt: LoadingAttempt = {
                    attempt: event.attempt!,
                    rows: event.rows!,
                    cols: event.cols!,
                    intersections: buildAttemptIntersections(event.rows!, event.cols!),
                  }
                  const filtered = current.filter(entry => entry.attempt !== event.attempt)
                  return [...filtered, nextAttempt].slice(-4)
                })
              }
              if (event.stage === 'cell' && typeof event.attempt === 'number' && typeof event.cellIndex === 'number') {
                setLoadingAttempts(current =>
                  current.map(entry => {
                    if (entry.attempt !== event.attempt) {
                      return entry
                    }

                    const intersections = entry.intersections.map((intersection, index) =>
                      index === event.cellIndex
                        ? {
                            ...intersection,
                            status: (event.passed ? 'passed' : 'failed') as LoadingIntersection['status'],
                            validOptionCount: event.validOptionCount,
                          }
                        : intersection
                    )

                    return { ...entry, intersections }
                  })
                )
              }
              if (event.stage === 'rejected' && typeof event.attempt === 'number') {
                setLoadingAttempts(current =>
                  current.map(entry =>
                    entry.attempt === event.attempt
                      ? { ...entry, rejectedMessage: event.message ?? 'Rejected' }
                      : entry
                  )
                )
              }
            } else if (event.type === 'puzzle' && event.puzzle) {
              puzzleData = event.puzzle
            } else if (event.type === 'error') {
              throw new Error(event.message ?? 'Failed to generate puzzle')
            }
          }
        }

        if (!puzzleData) {
          throw new Error('Puzzle stream completed without a puzzle')
        }
      } else {
        const response = await fetch(`/api/puzzle?mode=${gameMode}`)
        const data = await response.json()
        if (data.error) {
          console.error('Puzzle error:', data.error)
          return
        }
        puzzleData = data as Puzzle
      }

      setLoadingProgress(100)
      setLoadingStage('Board ready.')
      setPuzzle(puzzleData)

      saveGameState({
        puzzleId: puzzleData.id,
        puzzle: puzzleData,
        guesses: Array(9).fill(null),
        guessesRemaining: MAX_GUESSES,
        isComplete: false,
      }, gameMode === 'daily')

      if (savedState && savedState.puzzleId === puzzleData.id) {
        const restoredGuesses = savedState.guesses.map(g =>
          g ? { gameId: g.gameId, gameName: g.gameName, gameImage: g.gameImage, isCorrect: g.isCorrect } : null
        )
        setGuesses(restoredGuesses)
        setGuessesRemaining(savedState.guessesRemaining)
        if (savedState.isComplete) setShowResults(true)
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
    const activeAttempt = loadingAttempts[loadingAttempts.length - 1] ?? null
    const pastAttempts = loadingAttempts.slice(0, -1).reverse()

    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-5xl md:flex md:items-start md:justify-center md:gap-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card/70 p-6 shadow-xl backdrop-blur-sm">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.24em] text-primary">
            {mode === 'daily' ? 'Daily Puzzle' : 'Building Grid'}
          </p>
          <p className="mt-3 whitespace-pre-line text-center text-lg font-semibold text-foreground">{loadingStage}</p>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {mode === 'daily'
              ? loadingProgress < 10
                ? 'Checking for today\'s puzzle...'
                : loadingProgress < 75
                  ? 'Generating today\'s puzzle and validating intersections.'
                  : 'Almost done!'
              : 'Generating a fresh practice puzzle and sanity-checking each intersection.'}
          </p>
          {mode === 'practice' && (
            <div className="mt-6 space-y-2">
              <Progress value={loadingProgress} className="h-3" />
              <p className="text-right text-xs font-medium text-muted-foreground">
                {loadingProgress}% complete
              </p>
            </div>
          )}
        </div>
          {mode === 'practice' && (
            <aside className="mt-4 w-full rounded-2xl border border-border bg-card/70 p-4 shadow-xl backdrop-blur-sm md:mt-0 md:max-w-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Attempt Notes</p>
              {!activeAttempt && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Waiting for the generator to pick a board...
                </p>
              )}
              {activeAttempt && (
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl border border-border/80 bg-secondary/30 p-3">
                    <p className="text-sm font-semibold text-foreground">Attempt {activeAttempt.attempt}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Rows: {activeAttempt.rows.join(', ')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cols: {activeAttempt.cols.join(', ')}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {activeAttempt.intersections.map((intersection) => (
                      <div
                        key={`${activeAttempt.attempt}-${intersection.label}`}
                        className="flex items-center justify-between rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-xs"
                      >
                        <span className={`pr-3 text-foreground/90 whitespace-nowrap ${getIntersectionLabelClass(intersection.label)}`}>
                          {intersection.label}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {intersection.status === 'passed' && 'OK'}
                          {intersection.status === 'failed' && `X${typeof intersection.validOptionCount === 'number' ? ` ${intersection.validOptionCount}` : ''}`}
                          {intersection.status === 'pending' && '...'}
                        </span>
                      </div>
                    ))}
                  </div>
                  {activeAttempt.rejectedMessage && (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                      {activeAttempt.rejectedMessage}
                    </p>
                  )}
                  {pastAttempts.length > 0 && (
                    <div className="border-t border-border/70 pt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Recent Tries
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {pastAttempts.map((attempt) => (
                          <div
                            key={`history-${attempt.attempt}`}
                            className="rounded-lg border border-border/60 bg-background/30 px-3 py-2 text-xs text-muted-foreground"
                          >
                            <p className="font-medium text-foreground/80">Attempt {attempt.attempt}</p>
                            <p className="mt-1 truncate">{attempt.rejectedMessage ?? 'Moved on to a new board.'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </aside>
          )}
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
        puzzleId={puzzle.id}
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
