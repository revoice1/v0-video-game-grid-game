import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureDailyPuzzle, generateValidPuzzle } from '@/lib/daily-puzzle'
import { logError } from '@/lib/logging'
import { getExistingDailyPuzzle, sanitizeCategories } from '@/lib/puzzle-api'
import {
  applyAnonymousSessionCookie,
  getLegacySessionIdFromRequest,
  resolveAnonymousSession,
} from '@/lib/server-session'
import { validateIGDBGameForCell } from '@/lib/igdb'
import type { CellGuess } from '@/lib/types'

export const revalidate = 3600

export async function GET(request: NextRequest) {
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

        const [
          { data: guessRows, error: guessesError },
          { data: completionRow, error: completionError },
        ] = await Promise.all([
          supabase
            .from('guesses')
            .select(
              'cell_index,game_id,game_name,game_image,is_correct,objection_used,objection_verdict,objection_explanation,objection_original_matched_row,objection_original_matched_col'
            )
            .eq('puzzle_id', puzzle.id)
            .eq('session_id', resolvedSession.sessionId),
          supabase
            .from('puzzle_completions')
            .select('score')
            .eq('puzzle_id', puzzle.id)
            .eq('session_id', resolvedSession.sessionId)
            .maybeSingle(),
        ])

        if (guessesError) throw guessesError
        if (completionError) throw completionError

        const guesses: (CellGuess | null)[] = Array(9).fill(null)

        await Promise.all(
          (guessRows ?? []).map(async (row) => {
            const rowCategory = puzzle.row_categories[Math.floor(row.cell_index / 3)]
            const colCategory = puzzle.col_categories[row.cell_index % 3]
            const validation = await validateIGDBGameForCell(row.game_id, rowCategory, colCategory)

            guesses[row.cell_index] = {
              gameId: row.game_id,
              gameName: validation.game?.name ?? row.game_name,
              gameSlug: validation.game?.slug ?? null,
              gameUrl: validation.game?.gameUrl ?? null,
              gameImage: validation.game?.background_image ?? row.game_image ?? null,
              isCorrect: row.is_correct,
              released: validation.game?.released ?? null,
              releaseDates: validation.game?.releaseDates ?? [],
              metacritic: validation.game?.metacritic ?? null,
              stealRating: validation.game?.stealRating ?? null,
              genres: validation.game?.genres?.map((genre) => genre.name) ?? [],
              platforms:
                validation.game?.platforms?.map((platform) => platform.platform.name) ?? [],
              developers: validation.game?.developers?.map((developer) => developer.name) ?? [],
              publishers: validation.game?.publishers?.map((publisher) => publisher.name) ?? [],
              tags: validation.game?.tags?.map((tag) => tag.name) ?? [],
              gameModes: validation.game?.igdb?.game_modes ?? [],
              themes: validation.game?.igdb?.themes ?? [],
              perspectives: validation.game?.igdb?.player_perspectives ?? [],
              companies: validation.game?.igdb?.companies ?? [],
              matchedRow: validation.matchesRow,
              matchedCol: validation.matchesCol,
              objectionUsed: row.objection_used ?? false,
              objectionVerdict: row.objection_verdict ?? null,
              objectionExplanation: row.objection_explanation ?? null,
              objectionOriginalMatchedRow: row.objection_original_matched_row ?? null,
              objectionOriginalMatchedCol: row.objection_original_matched_col ?? null,
            }
          })
        )

        return applyAnonymousSessionCookie(
          NextResponse.json({
            ...puzzle,
            row_categories: sanitizeCategories(puzzle.row_categories),
            col_categories: sanitizeCategories(puzzle.col_categories),
            validation_status: puzzle.validation_status ?? 'validated',
            validation_message: puzzle.validation_message ?? null,
            cell_metadata: puzzle.cell_metadata ?? [],
            user_state: {
              guesses,
              guessesRemaining: Math.max(0, 9 - (guessRows?.length ?? 0)),
              isComplete: Boolean(completionRow),
            },
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
    logError('Error in puzzle API:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to get puzzle: ${errorMessage}` }, { status: 500 })
  }
}
