import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildPuzzleCellMetadata, generatePuzzleCategories, validatePuzzleCategories } from '@/lib/igdb'
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
      const { rows, cols, rowFamilies, colFamilies, validation } = await generatePuzzleCategories({
        minValidOptionsPerCell: plan.minValidOptionsPerCell,
        maxAttempts: plan.maxAttempts,
        sampleSize: VALIDATION_SAMPLE_SIZE,
      })
      const cellMetadata = buildPuzzleCellMetadata(
        validation,
        plan.minValidOptionsPerCell,
        VALIDATION_SAMPLE_SIZE
      )

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
        return {
          rows,
          cols,
          validationStatus: 'relaxed',
          validationMessage,
          cellMetadata,
        }
      }

      return {
        rows,
        cols,
        validationStatus: 'validated',
        validationMessage: null,
        cellMetadata,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown puzzle generation error')
      console.warn(
        `[v0] Puzzle generation failed at threshold ${plan.minValidOptionsPerCell} after ${plan.maxAttempts} attempts: ${lastError.message}`
      )
    }
  }

  throw lastError ?? new Error('Failed to generate puzzle')
}

async function getPuzzleCellMetadata(rows: Category[], cols: Category[]): Promise<PuzzleCellMetadata[]> {
  const validation = await validatePuzzleCategories(rows, cols, {
    minValidOptionsPerCell: MIN_VALID_OPTIONS_PER_CELL,
    sampleSize: VALIDATION_SAMPLE_SIZE,
  })

  return buildPuzzleCellMetadata(validation, MIN_VALID_OPTIONS_PER_CELL, VALIDATION_SAMPLE_SIZE)
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
        const cellMetadata = await getPuzzleCellMetadata(existingPuzzle.row_categories, existingPuzzle.col_categories)
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
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          const concurrentPuzzle = await getExistingDailyPuzzle(supabase, today)
          if (concurrentPuzzle) {
            const cellMetadata = await getPuzzleCellMetadata(
              concurrentPuzzle.row_categories,
              concurrentPuzzle.col_categories
            )

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

    if (error) {
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
  } catch (error) {
    console.error('[v0] Error in puzzle API:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to get puzzle: ${errorMessage}` },
      { status: 500 }
    )
  }
}
