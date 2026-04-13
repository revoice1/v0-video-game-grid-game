import { createClient } from '@/lib/supabase/server'
import type { CellGuess, Puzzle } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export interface PuzzleUserState {
  guesses: (CellGuess | null)[]
  guessesRemaining: number
  isComplete: boolean
}

export async function loadPuzzleUserState(
  supabase: SupabaseClient,
  puzzle: Pick<Puzzle, 'id' | 'row_categories' | 'col_categories'>,
  sessionId: string
): Promise<PuzzleUserState> {
  // Intentionally avoid per-guess IGDB enrichment here.
  // Daily/practice only need minimal fields for the board; richer metadata
  // is lazily hydrated on click before opening the modal. Versus mode does
  // not load from this path (it streams fresh state), so inline steal-rating
  // isn't impacted. This keeps load time fast and avoids N×IGDB calls.
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
      .eq('session_id', sessionId),
    supabase
      .from('puzzle_completions')
      .select('score')
      .eq('puzzle_id', puzzle.id)
      .eq('session_id', sessionId)
      .maybeSingle(),
  ])

  if (guessesError) throw guessesError
  if (completionError) throw completionError

  const guesses: (CellGuess | null)[] = Array(9).fill(null)

  for (const row of guessRows ?? []) {
    guesses[row.cell_index] = {
      gameId: row.game_id,
      gameName: row.game_name,
      gameImage: row.game_image ?? null,
      isCorrect: row.is_correct,
      objectionUsed: row.objection_used ?? false,
      objectionVerdict: row.objection_verdict ?? null,
      objectionExplanation: row.objection_explanation ?? null,
      objectionOriginalMatchedRow: row.objection_original_matched_row ?? null,
      objectionOriginalMatchedCol: row.objection_original_matched_col ?? null,
    }
  }

  return {
    guesses,
    guessesRemaining: Math.max(0, 9 - (guessRows?.length ?? 0)),
    isComplete: Boolean(completionRow),
  }
}
