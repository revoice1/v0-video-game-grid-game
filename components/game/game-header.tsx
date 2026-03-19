'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface GameHeaderProps {
  mode: 'daily' | 'practice'
  guessesRemaining: number
  score: number
  onModeChange: (mode: 'daily' | 'practice') => void
  onHowToPlay: () => void
  onNewPracticeGame?: () => void
}

export function GameHeader({ 
  mode, 
  guessesRemaining, 
  score, 
  onModeChange,
  onHowToPlay,
  onNewPracticeGame,
}: GameHeaderProps) {
  return (
    <header className="w-full">
      <div className="max-w-lg mx-auto">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-primary">Game</span>
            <span className="text-foreground">Grid</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            The video game trivia challenge
          </p>
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
              className="text-muted-foreground hover:text-foreground"
            >
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              How to Play
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
