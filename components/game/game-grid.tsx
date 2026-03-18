'use client'

import { GridCell } from './grid-cell'
import { CategoryHeaderSimple } from './category-header'
import type { Category, CellGuess } from '@/lib/types'

interface GameGridProps {
  rowCategories: Category[]
  colCategories: Category[]
  guesses: (CellGuess | null)[]
  selectedCell: number | null
  isGameOver: boolean
  onCellClick: (index: number) => void
}

export function GameGrid({
  rowCategories,
  colCategories,
  guesses,
  selectedCell,
  isGameOver,
  onCellClick,
}: GameGridProps) {
  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Grid layout: 4x4 with headers */}
      <div className="grid grid-cols-4 gap-2">
        {/* Empty corner */}
        <div className="aspect-square" />
        
        {/* Column headers */}
        {colCategories.map((cat, i) => (
          <CategoryHeaderSimple 
            key={`col-${i}`} 
            category={cat} 
            orientation="col" 
          />
        ))}
        
        {/* Rows with row headers and cells */}
        {rowCategories.map((rowCat, rowIndex) => (
          <>
            {/* Row header */}
            <CategoryHeaderSimple 
              key={`row-${rowIndex}`} 
              category={rowCat} 
              orientation="row" 
            />
            
            {/* Cells for this row */}
            {colCategories.map((_, colIndex) => {
              const cellIndex = rowIndex * 3 + colIndex
              return (
                <GridCell
                  key={`cell-${cellIndex}`}
                  index={cellIndex}
                  guess={guesses[cellIndex]}
                  isSelected={selectedCell === cellIndex}
                  isDisabled={isGameOver}
                  onClick={() => onCellClick(cellIndex)}
                />
              )
            })}
          </>
        ))}
      </div>
    </div>
  )
}
