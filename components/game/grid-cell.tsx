'use client'

import { cn } from '@/lib/utils'
import type { CellGuess, PuzzleCellMetadata } from '@/lib/types'
import Image from 'next/image'

interface GridCellProps {
  index: number
  guess: CellGuess | null
  metadata?: PuzzleCellMetadata
  isSelected: boolean
  isDisabled: boolean
  onClick: () => void
}

const difficultyStyles: Record<NonNullable<PuzzleCellMetadata['difficulty']>, string> = {
  brutal: 'bg-rose-500/85 text-white',
  spicy: 'bg-orange-500/85 text-white',
  tricky: 'bg-amber-500/85 text-black',
  fair: 'bg-sky-500/85 text-white',
  cozy: 'bg-emerald-500/85 text-white',
  feast: 'bg-violet-500/80 text-white',
}

const difficultyEmoji: Record<
  NonNullable<PuzzleCellMetadata['difficulty']>,
  string
> = {
  brutal: '💀',
  spicy: '🔥',
  tricky: '🧩',
  fair: '🎯',
  cozy: '🛋️',
  feast: '🏆',
}

export function GridCell({ guess, metadata, isSelected, isDisabled, onClick }: GridCellProps) {
  const hasGuess = guess !== null
  const isButtonDisabled = isDisabled && !hasGuess
  const possibleLabel = metadata
    ? metadata.validOptionCount >= 1000
      ? `${(metadata.validOptionCount / 1000).toFixed(1)}k`
      : `${metadata.validOptionCount}`
    : null
  const possibleTitle = metadata
    ? `${metadata.validOptionCount} possible answers`
    : null
  const difficultyMarker = metadata ? difficultyEmoji[metadata.difficulty] : null
  
  return (
    <button
      onClick={onClick}
      disabled={isButtonDisabled}
      className={cn(
        'game-cell aspect-square w-full rounded-lg border-2 border-border',
        'flex items-center justify-center overflow-hidden',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
        'transition-all duration-200',
        isSelected && !hasGuess && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        hasGuess && guess.isCorrect && 'correct border-primary/50',
        hasGuess && !guess.isCorrect && 'incorrect border-destructive/50',
        hasGuess && 'cursor-pointer hover:brightness-110',
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
        <div className="relative flex h-full w-full items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/30" />
          {metadata && (
            <>
              <span
                className={cn(
                  'absolute top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] shadow-sm',
                  difficultyStyles[metadata.difficulty]
                )}
                title={possibleTitle ?? undefined}
              >
                {difficultyMarker && <span className="text-[11px] leading-none">{difficultyMarker}</span>}
                {metadata.difficultyLabel}
              </span>
              <span
                className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white/90 shadow-sm"
                title={possibleTitle ?? undefined}
              >
                {possibleLabel}
              </span>
            </>
          )}
        </div>
      )}
    </button>
  )
}