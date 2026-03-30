import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/logging'
import {
  applyAnonymousSessionCookie,
  getLegacySessionIdFromRequest,
  resolveAnonymousSession,
} from '@/lib/server-session'
import type { NextRequest } from 'next/server'

export const revalidate = 3600

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const resolvedSession = resolveAnonymousSession(request, getLegacySessionIdFromRequest(request))

  try {
    const { data, error } = await supabase
      .from('puzzles')
      .select('id,date')
      .eq('is_daily', true)
      .not('date', 'is', null)
      .order('date', { ascending: false })
      .limit(60)

    if (error) throw error

    const puzzleIds = (data ?? []).map((entry) => entry.id)
    const [
      { data: completionRows, error: completionError },
      { data: guessRows, error: guessesError },
    ] = await Promise.all([
      supabase
        .from('puzzle_completions')
        .select('puzzle_id')
        .eq('session_id', resolvedSession.sessionId)
        .in('puzzle_id', puzzleIds),
      supabase
        .from('guesses')
        .select('puzzle_id,cell_index')
        .eq('session_id', resolvedSession.sessionId)
        .in('puzzle_id', puzzleIds),
    ])

    if (completionError) throw completionError
    if (guessesError) throw guessesError

    const completedPuzzleIds = new Set((completionRows ?? []).map((row) => row.puzzle_id))
    const guessCountByPuzzleId = new Map<string, number>()
    for (const row of guessRows ?? []) {
      if (!row.puzzle_id) continue
      guessCountByPuzzleId.set(row.puzzle_id, (guessCountByPuzzleId.get(row.puzzle_id) ?? 0) + 1)
    }

    return applyAnonymousSessionCookie(
      NextResponse.json({
        entries: (data ?? []).map((entry) => ({
          id: entry.id,
          date: entry.date,
          is_completed: completedPuzzleIds.has(entry.id),
          guess_count: guessCountByPuzzleId.get(entry.id) ?? 0,
        })),
      }),
      resolvedSession,
      request
    )
  } catch (error) {
    logError('Error loading daily archive:', error)
    return NextResponse.json({ error: 'Failed to load daily archive' }, { status: 500 })
  }
}
