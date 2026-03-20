'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

interface GameHeaderProps {
  mode: 'daily' | 'practice'
  guessesRemaining: number
  score: number
  dailyResetLabel?: string | null
  isHowToPlayOpen?: boolean
  onModeChange: (mode: 'daily' | 'practice') => void
  onHowToPlay: () => void
  onNewPracticeGame?: () => void
}

export function GameHeader({ 
  mode, 
  guessesRemaining, 
  score, 
  dailyResetLabel,
  isHowToPlayOpen = false,
  onModeChange,
  onHowToPlay,
  onNewPracticeGame,
}: GameHeaderProps) {
  return (
    <header className="w-full">
      <div className="max-w-lg mx-auto">
        {/* Title */}
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

        {/* Mode tabs */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex rounded-lg bg-secondary/50 p-1">
            <button
              onClick={() => onModeChange('daily')}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
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
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                mode === 'practice'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Practice
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-between px-2 mb-4">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{score}</p>
              <p className="text-xs text-muted-foreground">Score</p>
            </div>
            <div className="text-center">
              <p className={cn(
                'text-2xl font-bold',
                guessesRemaining <= 3 ? 'text-destructive' : 'text-foreground'
              )}>
                {guessesRemaining}
              </p>
              <p className="text-xs text-muted-foreground">Guesses Left</p>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            {mode === 'daily' && dailyResetLabel && (
              <div className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 px-2 py-1 text-[11px] font-medium uppercase text-muted-foreground">
                <span className="shrink-0 tracking-[0.12em]">Next grid:</span>
                <span className="tabular-nums tracking-[0.12em]">{dailyResetLabel}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {mode === 'practice' && onNewPracticeGame && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onNewPracticeGame}
                >
                  New Game
                </Button>
              )}
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
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
