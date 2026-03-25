import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generatePuzzleCategories } from '@/lib/igdb'
import { logError, logInfo, logWarn } from '@/lib/logging'
import {
  computePuzzleCellMetadata,
  getExistingDailyPuzzle,
  getTodayDate,
  sanitizeCategories,
} from '@/lib/puzzle-api'
import { buildGenerationPlans } from '@/lib/puzzle-generation-plans'
import type { Category, PuzzleCellMetadata } from '@/lib/types'

export const revalidate = 3600

const MIN_VALID_OPTIONS_PER_CELL = Number(process.env.PUZZLE_MIN_VALID_OPTIONS ?? '3')
const MAX_GENERATION_ATTEMPTS = Number(process.env.PUZZLE_GENERATION_MAX_ATTEMPTS ?? '12')
const VALIDATION_SAMPLE_SIZE = Number(process.env.PUZZLE_VALIDATION_SAMPLE_SIZE ?? '40')

async function generateValidPuzzle(): Promise<{
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
          logInfo(`Backfilling cell_metadata for puzzle ${existingPuzzle.id}`)
          cellMetadata = await computePuzzleCellMetadata(
            existingPuzzle.row_categories,
            existingPuzzle.col_categories,
            MIN_VALID_OPTIONS_PER_CELL,
            VALIDATION_SAMPLE_SIZE
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
                concurrentPuzzle.col_categories,
                MIN_VALID_OPTIONS_PER_CELL,
                VALIDATION_SAMPLE_SIZE
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
    logError('Error in puzzle API:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to get puzzle: ${errorMessage}` }, { status: 500 })
  }
}
