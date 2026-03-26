import { createClient } from '@/lib/supabase/server'
import { buildPuzzleCellMetadata, getValidGameCountForCell } from '@/lib/igdb'
import type { Category, PuzzleCellMetadata } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export function sanitizeCategories(categories: Category[]): Category[] {
  return categories.map((category) => ({ ...category }))
}

export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

export function getUtcDateOffset(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().split('T')[0]
}

export async function getExistingDailyPuzzle(supabase: SupabaseClient, today: string) {
  const { data } = await supabase
    .from('puzzles')
    .select('*')
    .eq('date', today)
    .eq('is_daily', true)
    .single()

  return data
}

export async function computePuzzleCellMetadata(
  rows: Category[],
  cols: Category[],
  minValidOptionsPerCell: number,
  sampleSize: number,
  onCell?: (cellIndex: number, total: number) => void
): Promise<PuzzleCellMetadata[]> {
  const total = rows.length * cols.length
  const exactCellResults = await Promise.all(
    rows.flatMap((rowCategory, rowIndex) =>
      cols.map(async (colCategory, colIndex) => {
        const cellIndex = rowIndex * 3 + colIndex
        const validOptionCount = await getValidGameCountForCell(rowCategory, colCategory)
        onCell?.(cellIndex, total)
        return { cellIndex, rowCategory, colCategory, validOptionCount }
      })
    )
  )

  const validation = {
    valid: exactCellResults.every((cell) => cell.validOptionCount >= minValidOptionsPerCell),
    minValidOptionCount: exactCellResults.reduce(
      (lowest, cell) => Math.min(lowest, cell.validOptionCount),
      Number.POSITIVE_INFINITY
    ),
    cellResults: exactCellResults,
    failedCells: exactCellResults.filter((cell) => cell.validOptionCount < minValidOptionsPerCell),
  }

  return buildPuzzleCellMetadata(validation, minValidOptionsPerCell, sampleSize, false)
}
