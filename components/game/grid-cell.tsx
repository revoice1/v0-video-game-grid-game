'use client'

import { cn } from '@/lib/utils'
import type { CellGuess } from '@/lib/types'
import Image from 'next/image'

interface GridCellProps {
  index: number
  guess: CellGuess | null
  isSelected: boolean
  isDisabled: boolean
  onClick: () => void
}

export function GridCell({ guess, isSelected, isDisabled, onClick }: GridCellProps) {
  const hasGuess = guess !== null
  
  return (
    <button
      onClick={onClick}
      disabled={isDisabled || hasGuess}
      className={cn(
        'game-cell aspect-square w-full rounded-lg border-2 border-border',
        'flex items-center justify-center overflow-hidden',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
        'transition-all duration-200',
        isSelected && !hasGuess && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        hasGuess && guess.isCorrect && 'correct border-primary/50',
        hasGuess && !guess.isCorrect && 'incorrect border-destructive/50',
        !hasGuess && !isDisabled && 'cursor-pointer hover:border-primary/30',
        isDisabled && !hasGuess && 'opacity-50 cursor-not-allowed'
      )}
    >
      {hasGuess ? (
        <div className="relative w-full h-full group">
          {guess.gameImage ? (
            <Image
              src={guess.gameImage}
              alt={guess.gameName}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 30vw, 150px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-secondary">
              <span className="text-xs text-muted-foreground text-center px-1 line-clamp-3">
                {guess.gameName}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="absolute bottom-1 left-1 right-1 text-[10px] text-white font-medium truncate">
              {guess.gameName}
            </span>
          </div>
          {!guess.isCorrect && (
            <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center">
              <svg className="w-3 h-3 text-destructive-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
          {guess.isCorrect && (
            <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
      ) : (
        <div className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/30" />
      )}
    </button>
  )
}
