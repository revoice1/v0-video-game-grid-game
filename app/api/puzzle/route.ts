import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureDailyPuzzle, generateValidPuzzle } from '@/lib/daily-puzzle'
import { logError } from '@/lib/logging'
import { sanitizeCategories } from '@/lib/puzzle-api'

export const revalidate = 3600

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('mode') || 'daily'

  try {
    if (mode === 'daily') {
      const result = await ensureDailyPuzzle(supabase)
      const { puzzle } = result

      return NextResponse.json({
        ...puzzle,
        row_categories: sanitizeCategories(puzzle.row_categories),
        col_categories: sanitizeCategories(puzzle.col_categories),
        validation_status: result.validationStatus,
        validation_message: result.validationMessage,
        cell_metadata: puzzle.cell_metadata,
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
