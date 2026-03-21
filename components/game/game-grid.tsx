'use client'

import { GridCell } from './grid-cell'
import { CategoryHeaderSimple } from './category-header'
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
  winner?: 'x' | 'o' | null
  turnTimerLabel?: string | null
  versusRecord?: { xWins: number; oWins: number }
  stealableCell?: number | null
  lockImpactCell?: number | null
  onCellClick: (index: number) => void
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
  winner = null,
  turnTimerLabel = null,
  versusRecord = { xWins: 0, oWins: 0 },
  stealableCell = null,
  lockImpactCell = null,
  onCellClick,
}: GameGridProps) {
  const playerLabel = currentPlayer === 'x' ? 'Player 1' : 'Player 2'
  const winnerLabel = winner === 'x' ? 'Player 1' : 'Player 2'

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="grid auto-rows-fr grid-cols-[1.12fr_repeat(3,minmax(0,1fr))] gap-2 sm:grid-cols-4 sm:gap-3">
        <div className="aspect-square">
          {currentPlayer ? (
            <div className="flex h-full flex-col justify-center rounded-lg border border-border/40 bg-secondary/20 px-2 py-2 text-center sm:px-3">
              <p
                className={
                  winner === 'x'
                    ? 'text-2xl font-bold uppercase text-primary sm:text-3xl'
                    : winner === 'o'
                      ? 'text-2xl font-bold uppercase text-sky-400 sm:text-3xl'
                      : currentPlayer === 'x'
                        ? 'text-2xl font-bold uppercase text-primary sm:text-3xl'
                        : 'text-2xl font-bold uppercase text-sky-400 sm:text-3xl'
                }
              >
                {winner ?? currentPlayer}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
                {winner ? `${winnerLabel} Wins` : `${playerLabel} Turn`}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
                Session: P1 {versusRecord.xWins} - P2 {versusRecord.oWins}
              </p>
              {turnTimerLabel && (
                <div className="mt-2 inline-flex items-center justify-center self-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary sm:text-[11px]">
                  {turnTimerLabel}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col justify-center rounded-lg border border-border/40 bg-secondary/20 px-2 py-2 text-center sm:px-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground sm:text-3xl">{score}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">Score</p>
                </div>
                <div className="text-center">
                  <p
                    className={cn(
                      'text-2xl font-bold sm:text-3xl',
                      guessesRemaining <= 3 ? 'text-destructive' : 'text-foreground'
                    )}
                  >
                    {guessesRemaining}
                  </p>
                  <p className="mt-1 text-[11px] leading-tight text-muted-foreground sm:text-xs">
                    Guesses
                    <br />
                    Left
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {colCategories.map((cat, i) => (
          <CategoryHeaderSimple
            key={`col-${i}`}
            category={cat}
            orientation="col"
          />
        ))}

        {rowCategories.map((rowCat, rowIndex) => (
          <div key={`row-${rowIndex}`} className="contents">
            <CategoryHeaderSimple
              category={rowCat}
              orientation="row"
            />

            {colCategories.map((_, colIndex) => {
              const cellIndex = rowIndex * 3 + colIndex
              const guess = guesses[cellIndex]
              const isAvailable = !isGameOver && currentPlayer !== null && (guess === null || stealableCell === cellIndex)

              return (
                <GridCell
                  key={`cell-${cellIndex}`}
                  index={cellIndex}
                  guess={guess}
                  metadata={cellMetadata?.find(cell => cell.cellIndex === cellIndex)}
                  isSelected={selectedCell === cellIndex}
                  isAvailable={isAvailable}
                  availableTone={currentPlayer}
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
    </div>
  )
}
