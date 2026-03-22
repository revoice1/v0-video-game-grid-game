'use client'

import { usePulse } from '@/hooks/use-pulse'
import { cn } from '@/lib/utils'
import type { CellGuess, PuzzleCellMetadata } from '@/lib/types'
import Image from 'next/image'

interface GridCellProps {
  index: number
  guess: CellGuess | null
  metadata?: PuzzleCellMetadata
  isSelected: boolean
  isAvailable?: boolean
  availableTone?: 'x' | 'o' | null
  isGamePoint?: boolean
  isStealable?: boolean
  activeAlarmKey?: 'game-point' | 'steal' | null
  animationsEnabled?: boolean
  isLocked?: boolean
  isLockImpact?: boolean
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

const difficultyEmoji: Record<NonNullable<PuzzleCellMetadata['difficulty']>, string> = {
  brutal: '\u{1F480}',
  spicy: '\u{1F525}',
  tricky: '\u{1F9E9}',
  fair: '\u{1F3AF}',
  cozy: '\u{1FACB}',
  feast: '\u{1F3C6}',
}

export function GridCell({
  index,
  guess,
  metadata,
  isSelected,
  isAvailable = false,
  availableTone = null,
  isGamePoint = false,
  isStealable = false,
  activeAlarmKey = null,
  animationsEnabled = true,
  isLocked = false,
  isLockImpact = false,
  isDisabled,
  onClick,
}: GridCellProps) {
  const hasGuess = guess !== null
  const isButtonDisabled = isDisabled && !hasGuess
  const cellAlarmState =
    isGamePoint && isStealable
      ? activeAlarmKey
      : isGamePoint
        ? 'game-point'
        : isStealable
          ? 'steal'
          : null
  const showGamePointState = cellAlarmState === 'game-point'
  const alarmPulseOn = usePulse(
    Boolean(cellAlarmState) && animationsEnabled,
    cellAlarmState === 'game-point' ? 700 : 620
  )
  const possibleLabel = metadata
    ? metadata.validOptionCount >= 1000
      ? `${(metadata.validOptionCount / 1000).toFixed(1)}k`
      : `${metadata.validOptionCount}`
    : null
  const possibleTitle = metadata ? `${metadata.validOptionCount} possible answers` : null
  const difficultyMarker = metadata ? difficultyEmoji[metadata.difficulty] : null
  const alarmStyle =
    cellAlarmState === 'steal'
      ? {
          borderColor:
            animationsEnabled && alarmPulseOn
              ? 'rgba(167, 139, 250, 0.96)'
              : 'rgba(167, 139, 250, 0.8)',
          boxShadow:
            animationsEnabled && alarmPulseOn
              ? '0 0 0 1px rgba(167,139,250,0.44), 0 0 32px rgba(139,92,246,0.3), 0 0 52px rgba(139,92,246,0.2)'
              : '0 0 0 1px rgba(167,139,250,0.28), 0 0 20px rgba(139,92,246,0.18), 0 0 36px rgba(139,92,246,0.1)',
        }
      : cellAlarmState === 'game-point'
        ? {
            borderColor:
              animationsEnabled && alarmPulseOn
                ? 'rgba(252, 211, 77, 0.95)'
                : 'rgba(252, 211, 77, 0.76)',
            boxShadow:
              animationsEnabled && alarmPulseOn
                ? '0 0 0 1px rgba(251,191,36,0.4), 0 0 30px rgba(251,191,36,0.26), 0 0 46px rgba(251,191,36,0.16)'
                : '0 0 0 1px rgba(251,191,36,0.24), 0 0 18px rgba(251,191,36,0.16), 0 0 30px rgba(251,191,36,0.08)',
          }
        : undefined

  return (
    <button
      data-testid={`grid-cell-${index}`}
      onClick={onClick}
      disabled={isButtonDisabled}
      className={cn(
        'game-cell relative aspect-square w-full rounded-lg border-2 border-border',
        'flex items-center justify-center overflow-visible',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
        animationsEnabled && 'transition-colors duration-200',
        isSelected && !hasGuess && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        isAvailable &&
          availableTone === 'x' &&
          (animationsEnabled
            ? 'border-primary/45 shadow-[0_0_0_1px_rgba(34,197,94,0.22),0_0_18px_rgba(34,197,94,0.14)] hover:border-primary/65'
            : 'border-primary/45'),
        isAvailable &&
          availableTone === 'o' &&
          (animationsEnabled
            ? 'border-sky-400/45 shadow-[0_0_0_1px_rgba(56,189,248,0.22),0_0_18px_rgba(56,189,248,0.14)] hover:border-sky-300/65'
            : 'border-sky-400/45'),
        hasGuess && guess.isCorrect && 'correct border-primary/50',
        hasGuess && !guess.isCorrect && 'incorrect border-destructive/50',
        hasGuess && (animationsEnabled ? 'cursor-pointer hover:brightness-110' : 'cursor-pointer'),
        !hasGuess &&
          !isDisabled &&
          !isAvailable &&
          (animationsEnabled ? 'cursor-pointer hover:border-primary/30' : 'cursor-pointer'),
        isDisabled && !hasGuess && 'opacity-50 cursor-not-allowed'
      )}
      style={alarmStyle}
    >
      {hasGuess ? (
        <div className="relative h-full w-full overflow-hidden rounded-[inherit] group">
          {guess.gameImage ? (
            <Image
              src={guess.gameImage}
              alt={guess.gameName}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 30vw, 150px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary">
              <span className="line-clamp-3 px-1 text-center text-xs text-muted-foreground">
                {guess.gameName}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-1.5 pb-1 pt-5">
            <span className="block line-clamp-2 text-[10px] font-medium leading-tight text-white/95 drop-shadow-sm">
              {guess.gameName}
            </span>
          </div>
          {!guess.isCorrect && (
            <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive">
              <svg
                className="h-3 w-3 text-destructive-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          )}
          {guess.isCorrect && (
            <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
              <svg
                className="h-3 w-3 text-primary-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}
          {guess.owner && (
            <div
              className={cn(
                'absolute inset-0 flex items-center justify-center bg-black/35 text-5xl font-black uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]',
                guess.owner === 'x' ? 'text-primary' : 'text-sky-300'
              )}
            >
              {guess.owner}
            </div>
          )}
          {guess.owner && isLocked && (
            <div
              className={cn(
                'absolute left-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-black/35 bg-black/70 text-white shadow-sm animate-in zoom-in-75 fade-in duration-200',
                isLockImpact && animationsEnabled && 'lock-impact'
              )}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V8a4 4 0 10-8 0v3m-1 0h10a1 1 0 011 1v7a1 1 0 01-1 1H7a1 1 0 01-1-1v-7a1 1 0 011-1z"
                />
              </svg>
            </div>
          )}
        </div>
      ) : (
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[inherit]">
          {showGamePointState && (
            <span className="absolute left-1/2 top-1/2 z-10 inline-flex -translate-x-1/2 -translate-y-1/2 items-center rounded-full border border-amber-300/35 bg-amber-400/18 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.16)]">
              Game Point
            </span>
          )}
          <div className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground/30" />
          {metadata && (
            <>
              <span
                className={cn(
                  'absolute left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] shadow-sm',
                  'top-3',
                  difficultyStyles[metadata.difficulty]
                )}
                title={possibleTitle ?? undefined}
              >
                {difficultyMarker && (
                  <span className="text-[11px] leading-none">{difficultyMarker}</span>
                )}
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
      <style jsx>{`
        .lock-impact {
          animation: lock-slam 620ms var(--ease-spring);
        }

        @keyframes lock-slam {
          0% {
            transform: translateY(-18px) scale(0.66) rotate(-10deg);
            opacity: 0;
          }
          48% {
            transform: translateY(4px) scale(1.14) rotate(3deg);
            opacity: 1;
          }
          68% {
            transform: translateY(-2px) scale(0.94) rotate(-2deg);
          }
          84% {
            transform: translateY(1px) scale(1.02) rotate(1deg);
          }
          100% {
            transform: translateY(0) scale(1) rotate(0deg);
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .lock-impact {
            animation: none;
          }
        }
      `}</style>
    </button>
  )
}
