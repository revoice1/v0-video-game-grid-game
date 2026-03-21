'use client'

import { GridCell } from './grid-cell'
import { CategoryHeaderSimple } from './category-header'
import type { Category, CellGuess, PuzzleCellMetadata } from '@/lib/types'

interface GameGridProps {
  rowCategories: Category[]
  colCategories: Category[]
  guesses: (CellGuess | null)[]
  cellMetadata?: PuzzleCellMetadata[]
  selectedCell: number | null
  isGameOver: boolean
  onCellClick: (index: number) => void
}

export function GameGrid({
  rowCategories,
  colCategories,
  guesses,
  cellMetadata,
  selectedCell,
  isGameOver,
  onCellClick,
}: GameGridProps) {
  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="grid auto-rows-fr grid-cols-[1.12fr_repeat(3,minmax(0,1fr))] gap-2 sm:grid-cols-4 sm:gap-3">
        <div className="aspect-square" />

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
              return (
                <GridCell
                  key={`cell-${cellIndex}`}
                  index={cellIndex}
                  guess={guesses[cellIndex]}
                  metadata={cellMetadata?.find(cell => cell.cellIndex === cellIndex)}
                  isSelected={selectedCell === cellIndex}
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
