import { createClient } from '@/lib/supabase/server'
import { generatePuzzleCategories } from '@/lib/igdb'
import { logInfo, logWarn } from '@/lib/logging'
import { computePuzzleCellMetadata, getExistingDailyPuzzle, getTodayDate } from '@/lib/puzzle-api'
import { buildGenerationPlans } from '@/lib/puzzle-generation-plans'
import type { Category, PuzzleCellMetadata } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>
type DailyPuzzleRecord = NonNullable<Awaited<ReturnType<typeof getExistingDailyPuzzle>>>

const MIN_VALID_OPTIONS_PER_CELL = Number(process.env.PUZZLE_MIN_VALID_OPTIONS ?? '3')
const MAX_GENERATION_ATTEMPTS = Number(process.env.PUZZLE_GENERATION_MAX_ATTEMPTS ?? '12')
const VALIDATION_SAMPLE_SIZE = Number(process.env.PUZZLE_VALIDATION_SAMPLE_SIZE ?? '40')

export async function generateValidPuzzle(): Promise<{
  rows: Category[]
  cols: Category[]
  validationStatus: 'validated' | 'relaxed'
  validationMessage: string | null
  cellMetadata: PuzzleCellMetadata[]
}> {
  const plans = buildGenerationPlans(MIN_VALID_OPTIONS_PER_CELL, MAX_GENERATION_ATTEMPTS)
  let lastError: Error | null = null

  for (const plan of plans) {
    try {
      const { rows, cols, rowFamilies, colFamilies, cellMetadata } = await generatePuzzleCategories(
        {
          minValidOptionsPerCell: plan.minValidOptionsPerCell,
          maxAttempts: plan.maxAttempts,
          sampleSize: VALIDATION_SAMPLE_SIZE,
        }
      )

      logInfo(
        `Generated puzzle - rows: ${rows.map((row) => row.name).join(', ')} ` +
          `(${rowFamilies.map((family) => `${family.key}:${family.source}`).join(', ')}), ` +
          `cols: ${cols.map((col) => col.name).join(', ')} ` +
          `(${colFamilies.map((family) => `${family.key}:${family.source}`).join(', ')})`
      )

      if (plan.minValidOptionsPerCell !== MIN_VALID_OPTIONS_PER_CELL) {
        const validationMessage =
          `This puzzle was generated with relaxed validation ` +
          `(${plan.minValidOptionsPerCell}+ valid options per cell instead of ${MIN_VALID_OPTIONS_PER_CELL}+).`
        logWarn(validationMessage)
        return { rows, cols, validationStatus: 'relaxed', validationMessage, cellMetadata }
      }

      return { rows, cols, validationStatus: 'validated', validationMessage: null, cellMetadata }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown puzzle generation error')
      logWarn(
        `Puzzle generation failed at threshold ${plan.minValidOptionsPerCell} after ${plan.maxAttempts} attempts: ${lastError.message}`
      )
    }
  }

  throw lastError ?? new Error('Failed to generate puzzle')
}

async function withBackfilledMetadata(
  supabase: SupabaseClient,
  puzzle: DailyPuzzleRecord
): Promise<DailyPuzzleRecord> {
  if (puzzle.cell_metadata) {
    return puzzle
  }

  logInfo(`Backfilling cell_metadata for puzzle ${puzzle.id}`)
  const cellMetadata = await computePuzzleCellMetadata(
    puzzle.row_categories,
    puzzle.col_categories,
    MIN_VALID_OPTIONS_PER_CELL,
    VALIDATION_SAMPLE_SIZE
  )

  await supabase.from('puzzles').update({ cell_metadata: cellMetadata }).eq('id', puzzle.id)

  return { ...puzzle, cell_metadata: cellMetadata }
}

export async function ensureDailyPuzzle(supabase: SupabaseClient): Promise<{
  targetDate: string
  puzzle: DailyPuzzleRecord
  createdNew: boolean
  validationStatus: 'validated' | 'relaxed' | null
  validationMessage: string | null
}> {
  return ensureDailyPuzzleForDate(supabase, getTodayDate())
}

export async function ensureDailyPuzzleForDate(
  supabase: SupabaseClient,
  targetDate: string
): Promise<{
  targetDate: string
  puzzle: DailyPuzzleRecord
  createdNew: boolean
  validationStatus: 'validated' | 'relaxed' | null
  validationMessage: string | null
}> {
  const existingPuzzle = await getExistingDailyPuzzle(supabase, targetDate)

  if (existingPuzzle) {
    return {
      targetDate,
      puzzle: await withBackfilledMetadata(supabase, existingPuzzle),
      createdNew: false,
      validationStatus: null,
      validationMessage: null,
    }
  }

  const categories = await generateValidPuzzle()
  const { data: newPuzzle, error } = await supabase
    .from('puzzles')
    .insert({
      date: targetDate,
      is_daily: true,
      row_categories: categories.rows,
      col_categories: categories.cols,
      cell_metadata: categories.cellMetadata,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      const concurrentPuzzle = await getExistingDailyPuzzle(supabase, targetDate)
      if (concurrentPuzzle) {
        return {
          targetDate,
          puzzle: await withBackfilledMetadata(supabase, concurrentPuzzle),
          createdNew: false,
          validationStatus: null,
          validationMessage: null,
        }
      }
    }

    throw error
  }

  return {
    targetDate,
    puzzle: newPuzzle,
    createdNew: true,
    validationStatus: categories.validationStatus,
    validationMessage: categories.validationMessage,
  }
}
