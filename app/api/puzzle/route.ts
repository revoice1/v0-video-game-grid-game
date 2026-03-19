import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildPuzzleCellMetadata,
  generatePuzzleCategories,
  getValidGameCountForCell,
} from '@/lib/igdb'
import type { Category, PuzzleCellMetadata } from '@/lib/types'

export const revalidate = 3600

const MIN_VALID_OPTIONS_PER_CELL = Number(process.env.PUZZLE_MIN_VALID_OPTIONS ?? '3')
const MAX_GENERATION_ATTEMPTS = Number(process.env.PUZZLE_GENERATION_MAX_ATTEMPTS ?? '12')
const VALIDATION_SAMPLE_SIZE = Number(process.env.PUZZLE_VALIDATION_SAMPLE_SIZE ?? '40')

function getGenerationPlans() {
  const fallbackThresholds = [
    MIN_VALID_OPTIONS_PER_CELL,
    Math.max(6, Math.min(MIN_VALID_OPTIONS_PER_CELL - 2, MIN_VALID_OPTIONS_PER_CELL)),
    3,
  ]
  const uniqueThresholds = fallbackThresholds.filter(
    (threshold, index) => threshold > 0 && fallbackThresholds.indexOf(threshold) === index
  )
  return uniqueThresholds.map((threshold, index) => ({
    minValidOptionsPerCell: threshold,
    maxAttempts:
      index === 0
        ? MAX_GENERATION_ATTEMPTS
        : Math.max(4, Math.ceil(MAX_GENERATION_ATTEMPTS / (index + 1))),
  }))
}

function sanitizeCategories(categories: Category[]): Omit<Category, 'developerId' | 'publisherId'>[] {
  return categories.map(({ developerId: _developerId, publisherId: _publisherId, ...safe }) => safe)
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

async function getExistingDailyPuzzle(supabase: Awaited<ReturnType<typeof createClient>>, today: string) {
  const { data } = await supabase
    .from('puzzles')
    .select('*')
    .eq('date', today)
    .eq('is_daily', true)
    .single()
  return data
}

async function computePuzzleCellMetadata(
  rows: Category[],
  cols: Category[],
  minValidOptionsPerCell = MIN_VALID_OPTIONS_PER_CELL
): Promise<PuzzleCellMetadata[]> {
  const exactCellResults = await Promise.all(
    rows.flatMap((rowCategory, rowIndex) =>
      cols.map(async (colCategory, colIndex) => ({
        cellIndex: rowIndex * 3 + colIndex,
        rowCategory,
        colCategory,
        validOptionCount: await getValidGameCountForCell(rowCategory, colCategory),
      }))
    )
  )
  const validation = {
    valid: exactCellResults.every(cell => cell.validOptionCount >= minValidOptionsPerCell),
    minValidOptionCount: exactCellResults.reduce(
      (lowest, cell) => Math.min(lowest, cell.validOptionCount),
      Number.POSITIVE_INFINITY
    ),
    cellResults: exactCellResults,
    failedCells: exactCellResults.filter(cell => cell.validOptionCount < minValidOptionsPerCell),
  }
  return buildPuzzleCellMetadata(validation, minValidOptionsPerCell, VALIDATION_SAMPLE_SIZE, false)
}

async function generateValidPuzzle(): Promise<{
  rows: Category[]
  cols: Category[]
  validationStatus: 'validated' | 'relaxed'
  validationMessage: string | null
  cellMetadata: PuzzleCellMetadata[]
}> {
  const plans = getGenerationPlans()
  let lastError: Error | null = null

  for (const plan of plans) {
    try {
      const { rows, cols, rowFamilies, colFamilies } = await generatePuzzleCategories({
        minValidOptionsPerCell: plan.minValidOptionsPerCell,
        maxAttempts: plan.maxAttempts,
        sampleSize: VALIDATION_SAMPLE_SIZE,
      })
      const cellMetadata = await computePuzzleCellMetadata(rows, cols, plan.minValidOptionsPerCell)

      console.log(
        `[v0] Generated puzzle - rows: ${rows.map(row => row.name).join(', ')} ` +
          `(${rowFamilies.map(family => `${family.key}:${family.source}`).join(', ')}), ` +
          `cols: ${cols.map(col => col.name).join(', ')} ` +
          `(${colFamilies.map(family => `${family.key}:${family.source}`).join(', ')})`
      )

      if (plan.minValidOptionsPerCell !== MIN_VALID_OPTIONS_PER_CELL) {
        const validationMessage =
          `This puzzle was generated with relaxed validation ` +
          `(${plan.minValidOptionsPerCell}+ valid options per cell instead of ${MIN_VALID_OPTIONS_PER_CELL}+).`
        console.warn(`[v0] ${validationMessage}`)
        return { rows, cols, validationStatus: 'relaxed', validationMessage, cellMetadata }
      }

      return { rows, cols, validationStatus: 'validated', validationMessage: null, cellMetadata }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown puzzle generation error')
      console.warn(
        `[v0] Puzzle generation failed at threshold ${plan.minValidOptionsPerCell} after ${plan.maxAttempts} attempts: ${lastError.message}`
      )
    }
  }

  throw lastError ?? new Error('Failed to generate puzzle')
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('mode') || 'daily'

  try {
    if (mode === 'daily') {
      const today = getTodayDate()
      const existingPuzzle = await getExistingDailyPuzzle(supabase, today)

      if (existingPuzzle) {
        let cellMetadata: PuzzleCellMetadata[] = existingPuzzle.cell_metadata

        if (!cellMetadata) {
          console.log(`[v0] Backfilling cell_metadata for puzzle ${existingPuzzle.id}`)
          cellMetadata = await computePuzzleCellMetadata(
            existingPuzzle.row_categories,
            existingPuzzle.col_categories
          )
          await supabase
            .from('puzzles')
            .update({ cell_metadata: cellMetadata })
            .eq('id', existingPuzzle.id)
        }

        return NextResponse.json({
          ...existingPuzzle,
          row_categories: sanitizeCategories(existingPuzzle.row_categories),
          col_categories: sanitizeCategories(existingPuzzle.col_categories),
          cell_metadata: cellMetadata,
        })
      }

      const categories = await generateValidPuzzle()

      const { data: newPuzzle, error } = await supabase
        .from('puzzles')
        .insert({
          date: today,
          is_daily: true,
          row_categories: categories.rows,
          col_categories: categories.cols,
          cell_metadata: categories.cellMetadata,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          const concurrentPuzzle = await getExistingDailyPuzzle(supabase, today)
          if (concurrentPuzzle) {
            const cellMetadata: PuzzleCellMetadata[] =
              concurrentPuzzle.cell_metadata ??
              (await computePuzzleCellMetadata(
                concurrentPuzzle.row_categories,
                concurrentPuzzle.col_categories
              ))
            return NextResponse.json({
              ...concurrentPuzzle,
              row_categories: sanitizeCategories(concurrentPuzzle.row_categories),
              col_categories: sanitizeCategories(concurrentPuzzle.col_categories),
              cell_metadata: cellMetadata,
            })
          }
        }
        throw error
      }

      return NextResponse.json({
        ...newPuzzle,
        row_categories: sanitizeCategories(newPuzzle.row_categories),
        col_categories: sanitizeCategories(newPuzzle.col_categories),
        validation_status: categories.validationStatus,
        validation_message: categories.validationMessage,
        cell_metadata: categories.cellMetadata,
      })
    }

    // Practice mode
    const categories = await generateValidPuzzle()

    const { data: newPuzzle, error } = await supabase
      .from('puzzles')
      .insert({
        date: null,
        is_daily: false,
        row_categories: categories.rows,
        col_categories: categories.cols,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      ...newPuzzle,
      row_categories: sanitizeCategories(newPuzzle.row_categories),
      col_categories: sanitizeCategories(newPuzzle.col_categories),
      validation_status: categories.validationStatus,
      validation_message: categories.validationMessage,
      cell_metadata: categories.cellMetadata,
    })
  } catch (error) {
    console.error('[v0] Error in puzzle API:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to get puzzle: ${errorMessage}` },
      { status: 500 }
    )
  }
}