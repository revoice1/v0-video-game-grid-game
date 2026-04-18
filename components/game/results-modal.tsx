'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import type { CellGuess, Category } from '@/lib/types'
import Image from 'next/image'

interface AnswerStat {
  puzzle_id: string
  cell_index: number
  game_id: number
  game_name: string
  game_image: string | null
  count: number
}

interface CellStatBucket {
  correct: AnswerStat[]
  incorrect: AnswerStat[]
}

interface CellStatsData {
  [key: number]: CellStatBucket
}

interface DailySummary {
  currentStreak: number
  bestStreak: number
  completedCount: number
  perfectCount: number
}

interface ResultsModalProps {
  isOpen: boolean
  onClose: () => void
  guesses: (CellGuess | null)[]
  puzzleId: string
  puzzleDate?: string | null
  rowCategories: Category[]
  colCategories: Category[]
  isDaily: boolean
  onPlayAgain: () => void
}

function getUniquenessClass(score: number): string {
  if (score >= 90) return 'rarity-legendary'
  if (score >= 75) return 'rarity-epic'
  if (score >= 60) return 'rarity-rare'
  if (score >= 40) return 'rarity-uncommon'
  return 'rarity-common'
}

function getUniquenessLabel(score: number): string {
  if (score >= 90) return 'Legendary'
  if (score >= 75) return 'Epic'
  if (score >= 60) return 'Rare'
  if (score >= 40) return 'Uncommon'
  return 'Common'
}

function getShareEmoji(guess: CellGuess | null): string {
  if (!guess) return String.fromCodePoint(0x2b1c)
  if (guess.isCorrect && guess.objectionVerdict === 'sustained') {
    return String.fromCodePoint(0x1f7e7)
  }
  return guess.isCorrect ? String.fromCodePoint(0x1f7e9) : String.fromCodePoint(0x1f7e5)
}

export function buildShareText(
  guesses: (CellGuess | null)[],
  isDaily: boolean,
  puzzleDate?: string | null
): string {
  const score = guesses.filter((guess) => guess?.isCorrect).length
  const label = isDaily
    ? `GameGrid Daily${puzzleDate ? ` ${puzzleDate}` : ''}`
    : 'GameGrid Practice'
  const rows = [0, 1, 2].map((rowIndex) =>
    guesses
      .slice(rowIndex * 3, rowIndex * 3 + 3)
      .map(getShareEmoji)
      .join('')
  )

  return [`${label} | ${score}/9`, ...rows, 'https://www.gamegrid.games/'].join('\n')
}

export function ResultsModal({
  isOpen,
  onClose,
  guesses,
  puzzleId,
  puzzleDate,
  rowCategories,
  colCategories,
  isDaily,
  onPlayAgain,
}: ResultsModalProps) {
  const [stats, setStats] = useState<CellStatsData | null>(null)
  const [totalCompletions, setTotalCompletions] = useState(0)
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'your-results' | 'playerbase'>('your-results')
  const { toast } = useToast()

  const correctGuesses = guesses.filter((g) => g?.isCorrect).length
  const score = correctGuesses

  useEffect(() => {
    if (!isDaily) {
      setStats(null)
      setTotalCompletions(0)
      setDailySummary(null)
      setIsLoading(false)
      setActiveTab('your-results')
      return
    }

    if (isOpen && puzzleId) {
      setIsLoading(true)
      fetch(`/api/stats?puzzleId=${puzzleId}`)
        .then((res) => res.json())
        .then((data) => {
          setStats(data.cellStats || {})
          setTotalCompletions(data.totalCompletions || 0)
          setDailySummary(data.dailySummary ?? null)
        })
        .catch(console.error)
        .finally(() => setIsLoading(false))
    }
  }, [isDaily, isOpen, puzzleId])

  // Calculate uniqueness for each of the player's correct guesses.
  const getCellUniqueness = (cellIndex: number): number | null => {
    const guess = guesses[cellIndex]
    if (!guess?.isCorrect || !stats) return null

    const cellStats = stats[cellIndex]?.correct || []
    const userStat = cellStats.find((s) => s.game_id === guess.gameId)
    if (!userStat) return 100

    return 100 / userStat.count
  }

  // Calculate the overall uniqueness score across all 9 cells.
  // Misses count as zero so the headline score rewards both accuracy and uniqueness.
  const calculateOverallUniqueness = (): number => {
    const total = guesses.reduce((sum, _guess, index) => sum + (getCellUniqueness(index) ?? 0), 0)
    return total / 9
  }

  const calculateAveragePlayerUniqueness = (): number | null => {
    if (!stats || totalCompletions === 0) return null

    const totalUniquenessPoints = Array.from({ length: 9 }, (_, cellIndex) => {
      const distinctCorrectAnswers = stats[cellIndex]?.correct.length ?? 0
      return distinctCorrectAnswers * 100
    }).reduce((sum, points) => sum + points, 0)

    return totalUniquenessPoints / (totalCompletions * 9)
  }

  const overallUniqueness = calculateOverallUniqueness()
  const averagePlayerUniqueness = calculateAveragePlayerUniqueness()
  const getCellLabel = (cellIndex: number) => {
    const rowCategory = rowCategories[Math.floor(cellIndex / 3)]
    const colCategory = colCategories[cellIndex % 3]
    return `${rowCategory?.name ?? 'Row'} x ${colCategory?.name ?? 'Column'}`
  }

  const isPlayersPickForCell = (cellIndex: number, gameId: number) =>
    guesses[cellIndex]?.gameId === gameId

  const handleCopyResults = async () => {
    const shareText = buildShareText(guesses, isDaily, puzzleDate)

    try {
      await navigator.clipboard.writeText(shareText)
      toast({
        title: 'Results copied',
        description: 'Your spoiler-free results are ready to share.',
      })
    } catch (error) {
      console.error('Failed to copy results:', error)
      toast({
        title: 'Copy failed',
        description: 'Could not copy your results to the clipboard.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-center text-2xl font-bold">
            {isDaily ? 'Daily' : 'Practice'} Results
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Review your board, your score, and any playerbase stats that apply to this puzzle.
          </DialogDescription>
        </DialogHeader>

        {isDaily && (
          <div className="flex border-b border-border shrink-0">
            <button
              onClick={() => setActiveTab('your-results')}
              className={cn(
                'flex-1 py-2 text-sm font-medium transition-colors',
                activeTab === 'your-results'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Your Results
            </button>
            <button
              onClick={() => setActiveTab('playerbase')}
              className={cn(
                'flex-1 py-2 text-sm font-medium transition-colors',
                activeTab === 'playerbase'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All Players
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          {activeTab === 'your-results' ? (
            <div className="space-y-6 py-4 px-1">
              {/* Score */}
              <div className="text-center">
                <div className="text-6xl font-bold text-primary mb-2">
                  {score}
                  <span className="text-2xl text-muted-foreground">/9</span>
                </div>
                <p className="text-muted-foreground">
                  {score === 9
                    ? 'Perfect!'
                    : score >= 7
                      ? 'Great job!'
                      : score >= 5
                        ? 'Nice work!'
                        : 'Keep practicing!'}
                </p>
              </div>

              {/* Uniqueness Score */}
              {isDaily && score > 0 && (
                <div className="text-center p-4 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-sm text-muted-foreground mb-1">Uniqueness Score</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-lg border border-border/70 bg-background/30 px-3 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        You
                      </p>
                      {isLoading || !stats ? (
                        <p className="mt-1 text-sm font-medium text-muted-foreground">
                          Calculating...
                        </p>
                      ) : (
                        <>
                          <p
                            className={cn(
                              'mt-1 text-3xl font-bold',
                              getUniquenessClass(overallUniqueness)
                            )}
                          >
                            {overallUniqueness.toFixed(1)}
                          </p>
                          <p
                            className={cn(
                              'text-sm font-medium',
                              getUniquenessClass(overallUniqueness)
                            )}
                          >
                            {getUniquenessLabel(overallUniqueness)}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="rounded-lg border border-border/70 bg-background/30 px-3 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Average Player
                      </p>
                      {isLoading || averagePlayerUniqueness === null ? (
                        <p className="mt-1 text-sm font-medium text-muted-foreground">
                          Calculating...
                        </p>
                      ) : (
                        <>
                          <p
                            className={cn(
                              'mt-1 text-3xl font-bold',
                              getUniquenessClass(averagePlayerUniqueness)
                            )}
                          >
                            {averagePlayerUniqueness.toFixed(1)}
                          </p>
                          <p
                            className={cn(
                              'text-sm font-medium',
                              getUniquenessClass(averagePlayerUniqueness)
                            )}
                          >
                            {getUniquenessLabel(averagePlayerUniqueness)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="underline decoration-dotted underline-offset-2 hover:text-foreground focus:outline-none focus-visible:text-foreground"
                        >
                          How uniqueness works
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-64">
                        Higher = more unique correct answers, with misses counting as zero.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )}

              {isDaily && dailySummary && (
                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Daily Progress
                    </p>
                    <p className="text-[11px] text-muted-foreground">This browser session</p>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-y divide-border/70 overflow-hidden rounded-md border border-border/70 bg-background/30 text-center sm:grid-cols-4 sm:divide-y-0">
                    <div className="px-3 py-2.5">
                      <p className="text-[11px] font-medium text-muted-foreground">Current</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                        {dailySummary.currentStreak}
                      </p>
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-[11px] font-medium text-muted-foreground">Best</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                        {dailySummary.bestStreak}
                      </p>
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-[11px] font-medium text-muted-foreground">Played</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                        {dailySummary.completedCount}
                      </p>
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-[11px] font-medium text-muted-foreground">Perfects</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                        {dailySummary.perfectCount}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Grid overview with rarity */}
              <div className="grid grid-cols-3 gap-2">
                {guesses.map((guess, index) => {
                  const uniqueness = getCellUniqueness(index)
                  const percentage = uniqueness !== null ? uniqueness : null

                  return (
                    <div
                      key={index}
                      className={cn(
                        'aspect-square rounded-lg overflow-hidden relative',
                        'border border-border',
                        guess?.isCorrect ? 'bg-primary/20' : 'bg-secondary/30'
                      )}
                    >
                      {guess && (
                        <>
                          {guess.gameImage ? (
                            <Image
                              src={guess.gameImage}
                              alt={guess.gameName}
                              fill
                              className={cn(
                                'object-cover',
                                !guess.isCorrect && 'opacity-40 grayscale'
                              )}
                              sizes="100px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground p-1 text-center">
                              {guess.gameName}
                            </div>
                          )}
                          {guess.isCorrect && percentage !== null && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                              <p
                                className={cn(
                                  'text-[10px] font-medium text-center',
                                  getUniquenessClass(percentage)
                                )}
                              >
                                {percentage < 1 ? '<1' : percentage.toFixed(0)}%
                              </p>
                            </div>
                          )}
                          {!guess.isCorrect && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <span className="text-destructive text-2xl">X</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Stats footer */}
              {isDaily && (
                <div className="text-center text-xs text-muted-foreground">
                  {totalCompletions} {totalCompletions === 1 ? 'player has' : 'players have'}{' '}
                  completed this puzzle
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 py-4 px-1">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading stats...</div>
              ) : (
                <>
                  {/* Most Popular Answers */}
                  <div className="space-y-4">
                    {Array.from({ length: 9 }, (_, cellIndex) => {
                      const cellBucket = stats?.[cellIndex] ?? { correct: [], incorrect: [] }

                      return (
                        <div
                          key={cellIndex}
                          className="rounded-xl border border-border bg-secondary/20 p-3"
                        >
                          <h4 className="font-semibold text-sm">{getCellLabel(cellIndex)}</h4>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div>
                              <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">
                                Top Correct
                              </p>
                              <div className="space-y-2">
                                {cellBucket.correct.length > 0 ? (
                                  cellBucket.correct.slice(0, 5).map((stat, index) => {
                                    const percentage =
                                      totalCompletions > 0
                                        ? (stat.count / totalCompletions) * 100
                                        : 0
                                    const isPlayersPick = isPlayersPickForCell(
                                      cellIndex,
                                      stat.game_id
                                    )
                                    return (
                                      <div
                                        key={`correct-${cellIndex}-${stat.game_id}`}
                                        className={cn(
                                          'flex items-center gap-2 rounded-lg bg-background/60 p-2',
                                          isPlayersPick &&
                                            'ring-2 ring-primary ring-offset-1 ring-offset-card'
                                        )}
                                        data-selected-by-player={isPlayersPick ? 'true' : 'false'}
                                      >
                                        <span className="w-5 text-xs text-muted-foreground">
                                          #{index + 1}
                                        </span>
                                        {stat.game_image ? (
                                          <Image
                                            src={stat.game_image}
                                            alt={stat.game_name}
                                            width={28}
                                            height={28}
                                            className="rounded object-cover"
                                          />
                                        ) : (
                                          <div className="flex h-7 w-7 items-center justify-center rounded bg-secondary text-xs">
                                            ?
                                          </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-sm">{stat.game_name}</p>
                                          <p className="text-xs text-muted-foreground">
                                            {percentage < 1 ? '<1' : percentage.toFixed(0)}% of
                                            players
                                          </p>
                                        </div>
                                      </div>
                                    )
                                  })
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    No correct answers yet
                                  </p>
                                )}
                              </div>
                            </div>

                            <div>
                              <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-destructive">
                                Top Incorrect
                              </p>
                              <div className="space-y-2">
                                {cellBucket.incorrect.length > 0 ? (
                                  cellBucket.incorrect.slice(0, 5).map((stat, index) => {
                                    const percentage =
                                      totalCompletions > 0
                                        ? (stat.count / totalCompletions) * 100
                                        : 0
                                    const isPlayersPick = isPlayersPickForCell(
                                      cellIndex,
                                      stat.game_id
                                    )
                                    return (
                                      <div
                                        key={`incorrect-${cellIndex}-${stat.game_id}`}
                                        className={cn(
                                          'flex items-center gap-2 rounded-lg bg-background/60 p-2',
                                          isPlayersPick &&
                                            'ring-2 ring-destructive ring-offset-1 ring-offset-card'
                                        )}
                                        data-selected-by-player={isPlayersPick ? 'true' : 'false'}
                                      >
                                        <span className="w-5 text-xs text-muted-foreground">
                                          #{index + 1}
                                        </span>
                                        {stat.game_image ? (
                                          <Image
                                            src={stat.game_image}
                                            alt={stat.game_name}
                                            width={28}
                                            height={28}
                                            className="rounded object-cover"
                                          />
                                        ) : (
                                          <div className="flex h-7 w-7 items-center justify-center rounded bg-secondary text-xs">
                                            ?
                                          </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-sm">{stat.game_name}</p>
                                          <p className="text-xs text-muted-foreground">
                                            {percentage < 1 ? '<1' : percentage.toFixed(0)}% of
                                            players
                                          </p>
                                        </div>
                                      </div>
                                    )
                                  })
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    No common misses yet
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {totalCompletions === 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No answers yet
                      </p>
                    </div>
                  )}

                  {/* Total players */}
                  <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border">
                    Stats from {totalCompletions} completed{' '}
                    {totalCompletions === 1 ? 'game' : 'games'}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Actions - fixed at bottom */}
        <div className="flex gap-3 pt-4 border-t border-border shrink-0">
          {isDaily && (
            <Button variant="outline" onClick={handleCopyResults} className="flex-1">
              Copy Results
            </Button>
          )}
          {!isDaily && (
            <Button onClick={onPlayAgain} className="flex-1">
              New Game
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="flex-1">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
