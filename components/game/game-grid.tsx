'use client'

import { useEffect, useState } from 'react'
import { GridCell } from './grid-cell'
import { CategoryHeaderSimple } from './category-header'
import type { IndexBadgeSlot } from '@/lib/route-index'
import type { Category, CellGuess, PuzzleCellMetadata } from '@/lib/types'
import { cn } from '@/lib/utils'

interface GameGridProps {
  rowCategories: Category[]
  colCategories: Category[]
  guesses: (CellGuess | null)[]
  cellMetadata?: PuzzleCellMetadata[]
  selectedCell: number | null
  isGameOver: boolean
  score?: number
  guessesRemaining?: number
  currentPlayer?: 'x' | 'o' | null
  winner?: 'x' | 'o' | 'draw' | null
  stealTargetLabel?: string | null
  turnTimerLabel?: string | null
  turnTimerSeconds?: number | null
  turnTimerMaxSeconds?: number | null
  versusRecord?: { xWins: number; oWins: number }
  alarmsEnabled?: boolean
  animationsEnabled?: boolean
  stealableCell?: number | null
  lockImpactCell?: number | null
  onCellClick: (index: number) => void
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

const COLUMN_CLUE_SLOTS: IndexBadgeSlot[] = ['col-0', 'col-1', 'col-2']
const ROW_CLUE_SLOTS: IndexBadgeSlot[] = ['row-0', 'row-1', 'row-2']

function getWinningOwner(guesses: (CellGuess | null)[]) {
  for (const [a, b, c] of WINNING_LINES) {
    const owner = guesses[a]?.owner

    if (owner && owner === guesses[b]?.owner && owner === guesses[c]?.owner) {
      return owner
    }
  }

  return null
}

function parseTimerLabel(label: string | null | undefined): number | null {
  if (!label) {
    return null
  }

  const match = label.match(/(\d+):(\d{2})/)
  if (!match) {
    return null
  }

  const minutes = Number(match[1])
  const seconds = Number(match[2])
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return null
  }

  return minutes * 60 + seconds
}

export function GameGrid({
  rowCategories,
  colCategories,
  guesses,
  cellMetadata,
  selectedCell,
  isGameOver,
  score = 0,
  guessesRemaining = 0,
  currentPlayer = null,
  stealTargetLabel = null,
  turnTimerLabel = null,
  turnTimerSeconds = null,
  turnTimerMaxSeconds = null,
  alarmsEnabled = true,
  animationsEnabled = true,
  stealableCell = null,
  lockImpactCell = null,
  onCellClick,
}: GameGridProps) {
  const isStealPossible = alarmsEnabled && !isGameOver && stealableCell !== null

  const gamePointCells =
    currentPlayer === null || isGameOver
      ? new Set<number>()
      : new Set(
          guesses.flatMap((guess, index) => {
            const isPlayable = guess === null || stealableCell === index

            if (!isPlayable) {
              return []
            }

            const nextGuesses = [...guesses]
            nextGuesses[index] = {
              ...(guess ?? {
                gameId: -1,
                gameName: '',
                gameImage: null,
                isCorrect: true,
              }),
              owner: currentPlayer,
            }

            return getWinningOwner(nextGuesses) === currentPlayer ? [index] : []
          })
        )
  const hasGamePoint = gamePointCells.size > 0
  const [alarmIndex, setAlarmIndex] = useState(0)
  const timerDangerThreshold =
    turnTimerMaxSeconds !== null
      ? Math.min(30, Math.max(10, Math.round(turnTimerMaxSeconds * 0.3)))
      : 10
  const parsedTimerSeconds = turnTimerSeconds ?? parseTimerLabel(turnTimerLabel)
  const isTimerDanger =
    alarmsEnabled && parsedTimerSeconds !== null && parsedTimerSeconds <= timerDangerThreshold
  const timerDangerProgress =
    parsedTimerSeconds !== null && parsedTimerSeconds <= timerDangerThreshold
      ? Math.min(1, Math.max(0, (timerDangerThreshold - parsedTimerSeconds) / timerDangerThreshold))
      : 0
  const timerDangerStyle =
    isTimerDanger && animationsEnabled
      ? {
          ['--timer-danger-duration' as string]: `${Math.max(0.36, 0.96 - timerDangerProgress * 0.5)}s`,
          ['--timer-danger-rest-opacity' as string]: `${0.9 - timerDangerProgress * 0.08}`,
          ['--timer-danger-rest-bg' as string]: `rgba(244,63,94,${0.1 + timerDangerProgress * 0.08})`,
          ['--timer-danger-peak-bg' as string]: `rgba(244,63,94,${0.18 + timerDangerProgress * 0.14})`,
          ['--timer-danger-rest-border' as string]: `rgba(251,113,133,${0.28 + timerDangerProgress * 0.14})`,
          ['--timer-danger-peak-border' as string]: `rgba(251,113,133,${0.44 + timerDangerProgress * 0.22})`,
          ['--timer-danger-rest-shadow' as string]: `0 0 ${14 + timerDangerProgress * 10}px rgba(244,63,94,${0.14 + timerDangerProgress * 0.12})`,
          ['--timer-danger-peak-shadow' as string]: `0 0 ${24 + timerDangerProgress * 18}px rgba(244,63,94,${0.24 + timerDangerProgress * 0.18})`,
        }
      : undefined
  const activeAlarms = [
    ...(hasGamePoint ? ([{ label: 'Game Point', tone: 'amber' as const }] as const) : []),
    ...(isStealPossible ? ([{ label: 'Steal Active', tone: 'violet' as const }] as const) : []),
    ...(isTimerDanger ? ([{ label: 'Timer', tone: 'rose' as const }] as const) : []),
  ]

  useEffect(() => {
    setAlarmIndex(0)

    if (activeAlarms.length <= 1) {
      return
    }

    const interval = window.setInterval(() => {
      setAlarmIndex((current) => (current + 1) % activeAlarms.length)
    }, 1150)

    return () => window.clearInterval(interval)
  }, [activeAlarms.length, hasGamePoint, isStealPossible, isTimerDanger])

  const currentAlarm = activeAlarms[alarmIndex] ?? null
  const alarmLabel = !alarmsEnabled ? 'OFF' : (currentAlarm?.label ?? 'No Alarm')
  const isGamePointAlarm = currentAlarm?.tone === 'amber'
  const isStealAlarm = currentAlarm?.tone === 'violet'
  const isRoseAlarm = currentAlarm?.tone === 'rose'
  const cellAlarmKey =
    currentAlarm?.label === 'Game Point'
      ? 'game-point'
      : currentAlarm?.label === 'Steal Active'
        ? 'steal'
        : null

  return (
    <div className="w-full">
      <div className="grid auto-rows-fr grid-cols-[minmax(0,0.96fr)_repeat(3,minmax(0,1fr))] gap-1.5 sm:grid-cols-4 sm:gap-3">
        <div className="aspect-square">
          {currentPlayer ? (
            <div className="flex h-full flex-col justify-center rounded-lg border border-border/40 bg-secondary/20 px-1 py-1 text-center sm:px-3 sm:py-2">
              <div
                title={
                  !alarmsEnabled
                    ? 'Versus alarms are disabled in settings'
                    : activeAlarms.length > 1
                      ? activeAlarms.map((alarm) => alarm.label).join(' | ')
                      : isStealPossible
                        ? (stealTargetLabel ?? undefined)
                        : hasGamePoint
                          ? 'A winning move is available right now'
                          : isTimerDanger
                            ? 'The turn timer is in its warning window'
                            : undefined
                }
                className={cn(
                  'mt-1 inline-flex max-w-full items-center justify-center self-center rounded-full border px-2 py-0.75 text-[8px] font-semibold uppercase tracking-[0.08em] leading-none sm:mt-1.5 sm:px-3 sm:py-1.5 sm:text-[10px] sm:tracking-[0.1em]',
                  isGamePointAlarm
                    ? animationsEnabled
                      ? 'alarm-pill-amber border-amber-300/55 bg-amber-400/12 text-amber-950 dark:text-amber-100'
                      : 'border-amber-300/55 bg-amber-400/12 text-amber-950 dark:text-amber-100'
                    : isStealAlarm
                      ? animationsEnabled
                        ? 'steal-pill-pulse border-violet-400/70 bg-violet-500/14 text-violet-950 dark:text-violet-50'
                        : 'border-violet-400/70 bg-violet-500/14 text-violet-950 dark:text-violet-50'
                      : isRoseAlarm
                        ? animationsEnabled
                          ? 'timer-danger-pulse border-rose-400/40 bg-rose-500/12 text-rose-950 dark:text-rose-50'
                          : 'border-rose-400/40 bg-rose-500/12 text-rose-950 dark:text-rose-50'
                        : 'border-border/40 bg-secondary/30 text-muted-foreground'
                )}
                style={isRoseAlarm ? timerDangerStyle : undefined}
              >
                {alarmLabel}
              </div>
              <div
                className={cn(
                  'mt-1 inline-flex min-w-0 max-w-full items-center justify-center self-center rounded-full border px-2 py-0.75 text-center text-[8px] font-semibold uppercase tracking-[0.08em] tabular-nums sm:mt-1.5 sm:min-w-[96px] sm:px-2.5 sm:py-1 sm:text-[11px] sm:tracking-[0.14em]',
                  turnTimerLabel
                    ? isTimerDanger && animationsEnabled
                      ? 'timer-danger-pulse border-rose-400/40 bg-rose-500/12 text-rose-50'
                      : isTimerDanger
                        ? 'border-rose-400/40 bg-rose-500/12 text-rose-950 dark:text-rose-50'
                        : 'border-primary/25 bg-primary/10 text-primary'
                    : 'border-border/40 bg-secondary/30 text-muted-foreground'
                )}
                style={animationsEnabled ? timerDangerStyle : undefined}
              >
                {turnTimerLabel ?? 'OFF'}
              </div>
              <div className="mt-1 hidden sm:block" aria-hidden="true" />
            </div>
          ) : (
            <div className="flex h-full flex-col justify-center rounded-lg border border-border/40 bg-secondary/20 px-1.5 py-2 text-center sm:px-3">
              <div className="grid hidden grid-cols-2 gap-1.5 sm:grid sm:gap-2">
                <div className="text-center">
                  <p className="text-[1.7rem] font-bold text-foreground sm:text-3xl">{score}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground sm:text-xs sm:normal-case sm:tracking-normal">
                    Score
                  </p>
                </div>
                <div className="text-center">
                  <p
                    className={cn(
                      'text-[1.7rem] font-bold sm:text-3xl',
                      guessesRemaining <= 3 ? 'text-destructive' : 'text-foreground'
                    )}
                  >
                    {guessesRemaining}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.08em] leading-tight text-muted-foreground sm:text-xs sm:normal-case sm:tracking-normal">
                    <span className="block sm:hidden">Guesses</span>
                    <span className="hidden sm:inline">
                      Guesses
                      <br />
                      Left
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex h-full items-center justify-center sm:hidden">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                  Daily
                </span>
              </div>
            </div>
          )}
        </div>

        {colCategories.map((cat, i) => (
          <CategoryHeaderSimple
            key={`col-${i}`}
            category={cat}
            orientation="col"
            clueSlot={COLUMN_CLUE_SLOTS[i]}
          />
        ))}

        {rowCategories.map((rowCat, rowIndex) => (
          <div key={`row-${rowIndex}`} className="contents">
            <CategoryHeaderSimple
              category={rowCat}
              orientation="row"
              clueSlot={ROW_CLUE_SLOTS[rowIndex]}
            />

            {colCategories.map((_, colIndex) => {
              const cellIndex = rowIndex * 3 + colIndex
              const guess = guesses[cellIndex]
              const isAvailable =
                !isGameOver &&
                currentPlayer !== null &&
                (guess === null || stealableCell === cellIndex)

              return (
                <GridCell
                  key={`cell-${cellIndex}`}
                  index={cellIndex}
                  guess={guess}
                  metadata={cellMetadata?.find((cell) => cell.cellIndex === cellIndex)}
                  isSelected={selectedCell === cellIndex}
                  isAvailable={isAvailable}
                  availableTone={currentPlayer}
                  isGamePoint={gamePointCells.has(cellIndex)}
                  activeAlarmKey={cellAlarmKey}
                  animationsEnabled={animationsEnabled}
                  isStealable={stealableCell === cellIndex}
                  isLocked={Boolean(guess?.owner) && stealableCell !== cellIndex && !isGameOver}
                  isLockImpact={lockImpactCell === cellIndex}
                  isDisabled={isGameOver}
                  onClick={() => onCellClick(cellIndex)}
                />
              )
            })}
          </div>
        ))}
      </div>
      <style jsx>{`
        .steal-pill-pulse {
          animation: steal-pill-pulse 1.05s ease-in-out infinite;
          box-shadow:
            0 0 0 1px rgba(167, 139, 250, 0.24),
            0 0 20px rgba(139, 92, 246, 0.18),
            0 0 34px rgba(139, 92, 246, 0.1);
          will-change: opacity, box-shadow;
        }

        @keyframes steal-pill-pulse {
          0%,
          100% {
            opacity: 0.94;
            box-shadow:
              0 0 0 1px rgba(167, 139, 250, 0.24),
              0 0 16px rgba(139, 92, 246, 0.14),
              0 0 30px rgba(139, 92, 246, 0.08);
          }
          50% {
            opacity: 1;
            box-shadow:
              0 0 0 1px rgba(167, 139, 250, 0.38),
              0 0 28px rgba(139, 92, 246, 0.24),
              0 0 44px rgba(139, 92, 246, 0.16);
          }
        }

        .alarm-pill-amber {
          animation: alarm-pill-amber 1.2s ease-in-out infinite;
          will-change: opacity, box-shadow;
          box-shadow:
            0 0 0 1px rgba(252, 211, 77, 0.18),
            0 0 14px rgba(251, 191, 36, 0.12),
            0 0 24px rgba(251, 191, 36, 0.06);
        }

        @keyframes alarm-pill-amber {
          0%,
          100% {
            opacity: 0.94;
            box-shadow:
              0 0 0 1px rgba(252, 211, 77, 0.18),
              0 0 14px rgba(251, 191, 36, 0.12),
              0 0 24px rgba(251, 191, 36, 0.06);
          }
          50% {
            opacity: 1;
            box-shadow:
              0 0 0 1px rgba(252, 211, 77, 0.3),
              0 0 22px rgba(251, 191, 36, 0.2),
              0 0 38px rgba(251, 191, 36, 0.12);
          }
        }

        .timer-danger-pulse {
          animation: timer-danger-pulse var(--timer-danger-duration, 0.96s) ease-in-out infinite;
          will-change: opacity, box-shadow, background-color, border-color;
        }

        @keyframes timer-danger-pulse {
          0%,
          100% {
            opacity: var(--timer-danger-rest-opacity, 0.9);
            background: var(--timer-danger-rest-bg, rgba(244, 63, 94, 0.1));
            border-color: var(--timer-danger-rest-border, rgba(251, 113, 133, 0.28));
            box-shadow: var(--timer-danger-rest-shadow, 0 0 14px rgba(244, 63, 94, 0.14));
          }
          50% {
            opacity: 1;
            background: var(--timer-danger-peak-bg, rgba(244, 63, 94, 0.18));
            border-color: var(--timer-danger-peak-border, rgba(251, 113, 133, 0.44));
            box-shadow: var(--timer-danger-peak-shadow, 0 0 24px rgba(244, 63, 94, 0.24));
          }
        }
      `}</style>
    </div>
  )
}
