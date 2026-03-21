'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

function AchievementEggIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5c-3.5 0-6.5 3.95-6.5 8.55C5.5 16.5 8.2 20 12 20s6.5-3.5 6.5-7.95C18.5 7.45 15.5 3.5 12 3.5Z"
        fill="hsl(var(--background))"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M12.15 6.2c-.65 1.55-.45 3.2.6 4.9 1.05 1.7 1.15 3.4.25 5.1"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        opacity="0.7"
      />
      <ellipse cx="9.1" cy="9.55" rx="1.85" ry="2.3" fill="currentColor" />
      <ellipse cx="14.75" cy="13.05" rx="1.5" ry="1.95" fill="currentColor" />
      <ellipse cx="10.9" cy="15.75" rx="1.25" ry="1.65" fill="currentColor" />
    </svg>
  )
}

interface GameHeaderProps {
  mode: 'daily' | 'practice' | 'versus'
  guessesRemaining: number
  score: number
  currentPlayer?: 'x' | 'o' | null
  stealTargetLabel?: string | null
  winner?: 'x' | 'o' | null
  turnTimerLabel?: string | null
  versusRecord?: { xWins: number; oWins: number }
  dailyResetLabel?: string | null
  isHowToPlayOpen?: boolean
  isAchievementsOpen?: boolean
  hasActiveCustomSetup?: boolean
  onModeChange: (mode: 'daily' | 'practice' | 'versus') => void
  onHowToPlay: () => void
  onAchievements: () => void
  onNewGame?: () => void
  onCustomizeGame?: () => void
}

export function GameHeader({
  mode,
  guessesRemaining,
  score,
  currentPlayer = null,
  stealTargetLabel = null,
  winner = null,
  turnTimerLabel = null,
  versusRecord = { xWins: 0, oWins: 0 },
  dailyResetLabel,
  isHowToPlayOpen = false,
  isAchievementsOpen = false,
  hasActiveCustomSetup = false,
  onModeChange,
  onHowToPlay,
  onAchievements,
  onNewGame,
  onCustomizeGame,
}: GameHeaderProps) {
  const playerLabel = currentPlayer === 'x' ? 'Player 1' : 'Player 2'
  const winnerLabel = winner === 'x' ? 'Player 1' : 'Player 2'

  return (
    <header className="w-full">
      <div className="max-w-lg mx-auto">
        <div className="relative mb-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-primary">Game</span>
              <span className="text-foreground">Grid</span>
            </h1>
            <p className="mt-1 text-sm text-foreground/75">
              The video game trivia challenge
            </p>
          </div>
          <div className="absolute right-0 top-0 pt-0.5">
            <ThemeToggle />
          </div>
        </div>

        <div className="mb-4 flex justify-center">
          <div className="inline-flex rounded-lg bg-secondary/50 p-1">
            <button
              onClick={() => onModeChange('daily')}
              className={cn(
                'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                mode === 'daily'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Daily
            </button>
            <button
              onClick={() => onModeChange('practice')}
              className={cn(
                'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                mode === 'practice'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Practice
            </button>
            <button
              onClick={() => onModeChange('versus')}
              className={cn(
                'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                mode === 'versus'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Versus
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between px-2">
          {mode === 'versus' ? (
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p
                  className={cn(
                    'text-2xl font-bold uppercase',
                    winner === 'x'
                      ? 'text-primary'
                      : winner === 'o'
                        ? 'text-sky-400'
                        : currentPlayer === 'x'
                          ? 'text-primary'
                          : 'text-sky-400'
                  )}
                >
                  {winner ?? currentPlayer ?? 'x'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {winner ? `${winnerLabel} Wins` : `${playerLabel} Turn`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Session: P1 {versusRecord.xWins} - P2 {versusRecord.oWins}
                </p>
                {turnTimerLabel && (
                  <div className="mt-2 inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                    {turnTimerLabel}
                  </div>
                )}
              </div>
              {stealTargetLabel && (
                <div className="rounded-xl border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-300">
                    Steal Target
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {stealTargetLabel}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{score}</p>
                <p className="text-xs text-muted-foreground">Score</p>
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    'text-2xl font-bold',
                    guessesRemaining <= 3 ? 'text-destructive' : 'text-foreground'
                  )}
                >
                  {guessesRemaining}
                </p>
                <p className="text-xs text-muted-foreground">Guesses Left</p>
              </div>
            </div>
          )}
          <div className="flex flex-col items-end gap-2">
            {mode === 'daily' && dailyResetLabel && (
              <div className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 px-2 py-1 text-[11px] font-medium uppercase text-muted-foreground">
                <span className="shrink-0 tracking-[0.12em]">Next grid:</span>
                <span className="tabular-nums tracking-[0.12em]">{dailyResetLabel}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {(mode === 'practice' || mode === 'versus') && onNewGame && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onNewGame}
                  className="h-auto min-w-[92px] px-3 py-2"
                >
                  <span className="flex flex-col items-start leading-tight">
                    <span>{mode === 'versus' ? 'New Match' : 'New Game'}</span>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {hasActiveCustomSetup ? 'Uses Custom Pool' : 'Standard Pool'}
                    </span>
                  </span>
                </Button>
              )}
              {(mode === 'practice' || mode === 'versus') && onCustomizeGame && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCustomizeGame}
                  className="h-auto min-w-[92px] px-3 py-2"
                >
                  <span className="flex flex-col items-start leading-tight">
                    <span>Customize</span>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {hasActiveCustomSetup ? 'Edit Custom Pool' : 'Set Up Pool'}
                    </span>
                  </span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onAchievements}
                aria-label="Achievements"
                title="Achievements"
                className={cn(
                  'h-9 w-9 border transition-colors',
                  isAchievementsOpen
                    ? 'border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background'
                    : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                )}
              >
                <AchievementEggIcon className="h-[18px] w-[18px]" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onHowToPlay}
                className={cn(
                  'border transition-colors',
                  isHowToPlayOpen
                    ? 'border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background'
                    : 'border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                )}
              >
                <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                How to Play
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
