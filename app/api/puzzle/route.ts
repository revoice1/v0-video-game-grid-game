import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureDailyPuzzle, generateValidPuzzle } from '@/lib/daily-puzzle'
import { createRequestLogger } from '@/lib/logging'
import { getExistingDailyPuzzle, sanitizeCategories } from '@/lib/puzzle-api'
import { loadPuzzleUserState } from '@/lib/puzzle-user-state'
import {
  applyAnonymousSessionCookie,
  getLegacySessionIdFromRequest,
  resolveAnonymousSession,
} from '@/lib/server-session'

export const revalidate = 3600

export async function GET(request: NextRequest) {
  const logger = createRequestLogger()
  const supabase = await createClient()
  const resolvedSession = resolveAnonymousSession(request, getLegacySessionIdFromRequest(request))
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('mode') || 'daily'
  const requestedDate = searchParams.get('date')

  try {
    if (mode === 'daily') {
      if (requestedDate) {
        const puzzle = await getExistingDailyPuzzle(supabase, requestedDate)

        if (!puzzle) {
          return NextResponse.json({ error: 'Daily puzzle not found' }, { status: 404 })
        }

        const userState = await loadPuzzleUserState(supabase, puzzle, resolvedSession.sessionId)

        return applyAnonymousSessionCookie(
          NextResponse.json({
            ...puzzle,
            row_categories: sanitizeCategories(puzzle.row_categories),
            col_categories: sanitizeCategories(puzzle.col_categories),
            validation_status: puzzle.validation_status ?? 'validated',
            validation_message: puzzle.validation_message ?? null,
            cell_metadata: puzzle.cell_metadata ?? [],
            user_state: userState,
          }),
          resolvedSession,
          request
        )
      }

      const result = await ensureDailyPuzzle(supabase)
      const { puzzle } = result

      return applyAnonymousSessionCookie(
        NextResponse.json({
          ...puzzle,
          row_categories: sanitizeCategories(puzzle.row_categories),
          col_categories: sanitizeCategories(puzzle.col_categories),
          validation_status: result.validationStatus,
          validation_message: result.validationMessage,
          cell_metadata: puzzle.cell_metadata,
        }),
        resolvedSession,
        request
      )
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
    logger.error('Error in puzzle API', { error })
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to get puzzle: ${errorMessage}` }, { status: 500 })
  }
}
