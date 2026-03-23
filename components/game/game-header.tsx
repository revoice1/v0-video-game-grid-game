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
  winner?: 'x' | 'o' | 'draw' | null
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
  void guessesRemaining
  void score
  void versusRecord

  const poolLabel = hasActiveCustomSetup ? 'Custom' : 'Standard'
  const versusTurnLabel = winner === 'draw' ? 'Result' : winner ? 'Winner' : 'Turn'
  const versusTurnValue = winner === 'draw' ? 'Tie' : (winner ?? currentPlayer ?? 'x').toUpperCase()
  const utilityButtons = (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={onAchievements}
        aria-label="Achievements"
        title="Achievements"
        className={cn(
          'h-10 w-10 rounded-xl border transition-colors',
          isAchievementsOpen
            ? 'border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background'
            : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
        )}
      >
        <AchievementEggIcon className="h-[18px] w-[18px]" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onHowToPlay}
        aria-label="How to Play"
        title="How to Play"
        className={cn(
          'h-10 w-10 rounded-xl border transition-colors',
          isHowToPlayOpen
            ? 'border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background'
            : 'border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
        )}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </Button>
      <ThemeToggle showVersusAlarms={mode === 'versus'} />
    </div>
  )

  const dailyResetPill = dailyResetLabel ? (
    <div className="inline-flex flex-col items-start justify-center rounded-2xl border border-border bg-secondary/35 px-4 py-2 text-[10px] font-medium uppercase leading-none text-muted-foreground">
      <span className="shrink-0 tracking-[0.16em]">Next grid</span>
      <span className="mt-1 tabular-nums text-[11px] tracking-[0.14em] text-foreground">
        {dailyResetLabel}
      </span>
    </div>
  ) : null

  const dailyMobileStats = (
    <>
      <div className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-secondary/35 px-3 text-[10px] font-medium uppercase text-muted-foreground">
        <span className="tracking-[0.12em]">Score</span>
        <span className="text-sm font-black leading-none tracking-normal text-foreground">
          {score}
        </span>
      </div>
      <div className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-secondary/35 px-3 text-[10px] font-medium uppercase text-muted-foreground">
        <span className="tracking-[0.12em]">Guesses</span>
        <span className="text-sm font-black leading-none tracking-normal text-foreground">
          {guessesRemaining}
        </span>
      </div>
    </>
  )

  return (
    <header className="w-full">
      <div className="w-full">
        <div className="mb-3 flex justify-end sm:hidden">{utilityButtons}</div>

        <div className="relative mb-4">
          <div className="px-3 text-center sm:px-24">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              <span className="text-primary">Game</span>
              <span className="text-foreground">Grid</span>
            </h1>
            <p className="mt-1 text-sm text-foreground/75 sm:text-base">
              The video game trivia challenge
            </p>
          </div>

          <div className="absolute right-0 top-0 hidden flex-col items-end gap-2 pt-0.5 sm:flex">
            {utilityButtons}
          </div>
        </div>

        <div className="relative mb-3 flex flex-col items-center gap-2 sm:flex sm:justify-center">
          <div className="grid w-full max-w-[22rem] grid-cols-3 rounded-lg bg-secondary/50 p-1 sm:inline-flex sm:w-auto sm:max-w-none">
            <button
              onClick={() => onModeChange('daily')}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors sm:px-4',
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
                'rounded-md px-3 py-2 text-sm font-medium transition-colors sm:px-4',
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
                'rounded-md px-3 py-2 text-sm font-medium transition-colors sm:px-4',
                mode === 'versus'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Versus
            </button>
          </div>

          {mode === 'daily' && dailyResetPill && (
            <>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:hidden">
                {dailyMobileStats}
                {dailyResetPill}
              </div>
              <div className="absolute right-0 top-1/2 hidden -translate-y-1/2 sm:block">
                {dailyResetPill}
              </div>
            </>
          )}
        </div>

        {(mode === 'practice' || mode === 'versus') && (
          <div className="mb-2 text-center">
            <div className="grid w-full max-w-[22rem] grid-cols-2 gap-1.5 px-1 sm:inline-flex sm:w-auto sm:max-w-full sm:flex-wrap sm:items-center sm:justify-center sm:gap-2">
              {mode === 'versus' && (
                <div className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-secondary/35 px-2.5 text-[10px] font-medium uppercase text-muted-foreground sm:h-9 sm:gap-2 sm:px-3 sm:text-[11px]">
                  <span className="tracking-[0.12em]">{versusTurnLabel}</span>
                  <span
                    className={cn(
                      'text-sm font-black leading-none',
                      winner === 'draw'
                        ? 'text-foreground'
                        : winner === 'x'
                          ? 'text-primary'
                          : winner === 'o'
                            ? 'text-sky-400'
                            : currentPlayer === 'x'
                              ? 'text-primary'
                              : 'text-sky-400'
                    )}
                  >
                    {versusTurnValue}
                  </span>
                  {turnTimerLabel && (
                    <span className="rounded-full border border-border/70 bg-background/65 px-1.5 py-0.5 text-[9px] tracking-[0.1em] text-foreground sm:px-2 sm:text-[10px] sm:tracking-[0.12em]">
                      {turnTimerLabel.replace(/^Turn:\s*/, '')}
                    </span>
                  )}
                </div>
              )}

              <div className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-secondary/35 px-2.5 text-[10px] font-medium uppercase text-muted-foreground sm:h-9 sm:gap-2 sm:px-3 sm:text-[11px]">
                <span className="tracking-[0.12em]">Pool</span>
                <span className="tracking-[0.12em] text-foreground">{poolLabel}</span>
              </div>

              {onCustomizeGame && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCustomizeGame}
                  className="h-8 w-full px-2.5 text-xs sm:h-9 sm:w-auto sm:px-3 sm:text-sm"
                >
                  {hasActiveCustomSetup ? 'Edit Setup' : 'Customize'}
                </Button>
              )}
              {onNewGame && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onNewGame}
                  className="h-8 w-full px-2.5 text-xs sm:h-9 sm:w-auto sm:px-3 sm:text-sm"
                >
                  {mode === 'versus' ? 'New Match' : 'New Game'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
