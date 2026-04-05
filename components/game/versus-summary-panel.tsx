'use client'

import {
  getClaimCounts,
  getPlayerLabel,
  getWinningPlayer,
  type TicTacToePlayer,
} from './game-client-versus-helpers'
import type { CellGuess } from '@/lib/types'
import { buildVersusEventSummary, type VersusEventRecord } from '@/lib/versus-events'
import type {
  VersusObjectionRule,
  VersusStealRule,
  VersusTurnTimerOption,
} from './versus-setup-modal'

interface VersusSummaryPanelProps {
  guesses: Array<CellGuess | null>
  eventLog: VersusEventRecord[]
  winner: TicTacToePlayer | 'draw'
  stealRule: VersusStealRule
  timerOption: VersusTurnTimerOption
  disableDraws: boolean
  objectionRule: VersusObjectionRule
  objectionsUsed: { x: number; o: number }
}

const WINNING_LINES = [
  { indices: [0, 1, 2] as const, label: 'Top row' },
  { indices: [3, 4, 5] as const, label: 'Middle row' },
  { indices: [6, 7, 8] as const, label: 'Bottom row' },
  { indices: [0, 3, 6] as const, label: 'Left column' },
  { indices: [1, 4, 7] as const, label: 'Middle column' },
  { indices: [2, 5, 8] as const, label: 'Right column' },
  { indices: [0, 4, 8] as const, label: 'Main diagonal' },
  { indices: [2, 4, 6] as const, label: 'Counter diagonal' },
]

function getWinningLineLabel(guesses: Array<CellGuess | null>): string | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line.indices
    const owner = guesses[a]?.owner
    if (owner && owner === guesses[b]?.owner && owner === guesses[c]?.owner) {
      return line.label
    }
  }

  return null
}

function getTimerLabel(timerOption: VersusTurnTimerOption): string {
  if (timerOption === 'none') return 'Off'
  if (timerOption === 20) return '20 sec'
  if (timerOption === 60) return '1 min'
  if (timerOption === 120) return '2 min'
  return '5 min'
}

function getObjectionLimit(rule: VersusObjectionRule): number {
  if (rule === 'three') return 3
  if (rule === 'one') return 1
  return 0
}

function getStealRuleLabel(rule: VersusStealRule): string {
  if (rule === 'off') return 'Off'
  if (rule === 'lower') return 'Lower score'
  if (rule === 'higher') return 'Higher score'
  if (rule === 'fewer_reviews') return 'Fewer reviews'
  return 'More reviews'
}

function buildResultDetail(
  guesses: Array<CellGuess | null>,
  winner: TicTacToePlayer | 'draw',
  disableDraws: boolean
): string {
  const winningLine = getWinningLineLabel(guesses)

  if (winner === 'draw') {
    return disableDraws
      ? 'Board filled without a line before claim-count tiebreak could apply.'
      : 'Board filled without a line.'
  }

  if (winningLine) {
    return `${getPlayerLabel(winner)} closed out ${winningLine.toLowerCase()}.`
  }

  const claimCounts = getClaimCounts(guesses)
  return `${getPlayerLabel(winner)} won on claimed cells, ${claimCounts[winner]} to ${claimCounts[winner === 'x' ? 'o' : 'x']}.`
}

export function VersusSummaryPanel({
  guesses,
  eventLog,
  winner,
  stealRule,
  timerOption,
  disableDraws,
  objectionRule,
  objectionsUsed,
}: VersusSummaryPanelProps) {
  const claimCounts = getClaimCounts(guesses)
  const winningPlayer = getWinningPlayer(guesses)
  const winningLineLabel = getWinningLineLabel(guesses)
  const objectionLimit = getObjectionLimit(objectionRule)
  const eventSummary = buildVersusEventSummary(eventLog)
  const hasEventLog = eventLog.length > 0
  const reviewedSquares = hasEventLog
    ? eventSummary.objections
    : guesses.filter((guess) => guess?.objectionUsed).length
  const sustainedReviews = hasEventLog
    ? eventSummary.sustainedObjections
    : guesses.filter((guess) => guess?.objectionVerdict === 'sustained').length
  const overruledReviews = hasEventLog
    ? eventSummary.overruledObjections
    : guesses.filter((guess) => guess?.objectionVerdict === 'overruled').length
  const showdownReveals = hasEventLog
    ? eventSummary.showdownReveals
    : guesses.filter((guess) => guess?.showdownScoreRevealed).length
  const resultLabel = winner === 'draw' ? 'Draw game' : `${getPlayerLabel(winner)} wins`
  const placedGuesses = guesses
    .map((guess, index) => ({ guess, index }))
    .filter((entry): entry is { guess: CellGuess; index: number } => entry.guess !== null)

  return (
    <div className="mt-4 space-y-4 text-left">
      <div className="rounded-xl border border-border bg-secondary/25 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          Match Summary
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Result</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{resultLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {buildResultDetail(guesses, winner, disableDraws)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Rules</p>
            <div className="mt-1 space-y-1 text-xs text-muted-foreground">
              <p>Steals: {getStealRuleLabel(stealRule)}</p>
              <p>
                Objections:{' '}
                {objectionRule === 'off' ? 'Off' : objectionRule === 'one' ? '1 each' : '3 each'}
              </p>
              <p>Draws: {disableDraws ? 'Disabled' : 'Enabled'}</p>
              <p>Timer: {getTimerLabel(timerOption)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-background/55 p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Board Control
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.12em] text-primary">X cells</p>
              <p className="mt-1 text-2xl font-bold text-primary">{claimCounts.x}</p>
            </div>
            <div className="flex-1 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.12em] text-sky-400">O cells</p>
              <p className="mt-1 text-2xl font-bold text-sky-400">{claimCounts.o}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {winningPlayer && winningLineLabel
              ? `${getPlayerLabel(winningPlayer)} completed ${winningLineLabel.toLowerCase()}.`
              : disableDraws && winner !== 'draw'
                ? 'No line was completed, so claimed cells decided the match.'
                : 'No winning line on the final board.'}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background/55 p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Judge And Showdown
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Reviewed
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">{reviewedSquares}</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/20 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Score Reveals
              </p>
              <p className="mt-1 text-xl font-bold text-foreground">{showdownReveals}</p>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p>Steal attempts: {eventSummary.stealAttempts}</p>
            <p>Successful steals: {eventSummary.successfulSteals}</p>
            <p>Failed steals: {eventSummary.failedSteals}</p>
            <p>Sustained: {sustainedReviews}</p>
            <p>Overruled: {overruledReviews}</p>
            <p>
              X objections used: {Math.min(objectionLimit, objectionsUsed.x)} / {objectionLimit}
            </p>
            <p>
              O objections used: {Math.min(objectionLimit, objectionsUsed.o)} / {objectionLimit}
            </p>
            {eventSummary.finalStealAttempts > 0 ? (
              <p>Final steal attempts: {eventSummary.finalStealAttempts}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background/55 p-4">
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">All Picks</p>
        <div className="mt-3 grid gap-2">
          {placedGuesses.map(({ guess, index }) => {
            const owner = guess.owner ?? 'x'
            const showdownMetricLabel =
              stealRule === 'fewer_reviews' || stealRule === 'more_reviews' ? 'Reviews' : 'Score'
            const showdownMetricValue =
              stealRule === 'fewer_reviews' || stealRule === 'more_reviews'
                ? guess.stealRatingCount
                : guess.stealRating
            const scoreLabel =
              showdownMetricValue !== null && showdownMetricValue !== undefined
                ? String(showdownMetricValue)
                : `No ${showdownMetricLabel.toLowerCase()}`
            const reviewLabel =
              guess.objectionVerdict === 'sustained'
                ? 'Sustained'
                : guess.objectionVerdict === 'overruled'
                  ? 'Overruled'
                  : null

            return (
              <div
                key={`${guess.gameId}-${index}`}
                className="flex items-center gap-3 rounded-lg border border-border/70 bg-secondary/15 px-3 py-2"
              >
                <div
                  className={
                    owner === 'x'
                      ? 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-sm font-black text-primary'
                      : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-400/30 bg-sky-400/10 text-sm font-black text-sky-400'
                  }
                >
                  {owner.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{guess.gameName}</p>
                  <p className="text-xs text-muted-foreground">
                    Cell {index + 1} · {showdownMetricLabel} {scoreLabel}
                    {reviewLabel ? ` · ${reviewLabel}` : ''}
                    {guess.showdownScoreRevealed ? ' · Revealed' : ''}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
