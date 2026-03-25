import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logError, logWarn } from '@/lib/logging'
import { applyAnonymousSessionCookie, resolveAnonymousSession } from '@/lib/server-session'

interface GuessStatRow {
  puzzle_id: string
  cell_index: number
  game_id: number
  game_name: string
  game_image: string | null
  count: number
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const searchParams = request.nextUrl.searchParams
  const puzzleId = searchParams.get('puzzleId')

  if (!puzzleId) {
    return NextResponse.json({ error: 'Puzzle ID required' }, { status: 400 })
  }

  try {
    const { data: puzzle, error: puzzleError } = await supabase
      .from('puzzles')
      .select('row_categories,col_categories')
      .eq('id', puzzleId)
      .single()

    if (puzzleError) throw puzzleError

    const { data: completionRows, error: completionError } = await supabase
      .from('puzzle_completions')
      .select('session_id')
      .eq('puzzle_id', puzzleId)

    if (completionError) throw completionError

    const completionCount = completionRows?.length ?? 0
    const completedSessionIds = new Set(
      (completionRows ?? [])
        .map((row) => row.session_id)
        .filter(
          (sessionId): sessionId is string => typeof sessionId === 'string' && sessionId.length > 0
        )
    )

    let guessRows:
      | {
          cell_index: number
          game_id: number
          game_name: string
          game_image: string | null
          is_correct: boolean
          session_id: string | null
        }[]
      | null = null

    const guessResponse = await supabase
      .from('guesses')
      .select('cell_index,game_id,game_name,game_image,is_correct,session_id')
      .eq('puzzle_id', puzzleId)

    if (guessResponse.error) {
      logWarn('Guess stats unavailable:', guessResponse.error.message)
    } else {
      guessRows = guessResponse.data
    }

    const completedGuessRows = (guessRows ?? []).filter((guess) =>
      guess.session_id ? completedSessionIds.has(guess.session_id) : false
    )

    const correctStatsMap = new Map<string, GuessStatRow>()
    const incorrectStatsMap = new Map<string, GuessStatRow>()
    for (const guess of completedGuessRows) {
      const key = `${guess.cell_index}:${guess.game_id}`

      const targetMap = guess.is_correct ? correctStatsMap : incorrectStatsMap
      const existing = targetMap.get(key)

      if (existing) {
        existing.count += 1
      } else {
        targetMap.set(key, {
          puzzle_id: puzzleId,
          cell_index: guess.cell_index,
          game_id: guess.game_id,
          game_name: guess.game_name,
          game_image: guess.game_image,
          count: 1,
        })
      }
    }

    // Organize by cell
    const cellStats: Record<number, { correct: GuessStatRow[]; incorrect: GuessStatRow[] }> = {}
    for (let i = 0; i < 9; i++) {
      cellStats[i] = {
        correct: Array.from(correctStatsMap.values())
          .filter((s) => s.cell_index === i)
          .sort((left, right) => right.count - left.count),
        incorrect: Array.from(incorrectStatsMap.values())
          .filter((s) => s.cell_index === i)
          .sort((left, right) => right.count - left.count),
      }
    }

    return NextResponse.json({
      puzzle,
      cellStats,
      totalCompletions: completionCount || 0,
    })
  } catch (error) {
    logError('Stats error:', error)
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const { puzzleId, sessionId, score, rarityScore } = await request.json()
    const resolvedSession = resolveAnonymousSession(request, sessionId)

    const { data: existingCompletion, error: existingCompletionError } = await supabase
      .from('puzzle_completions')
      .select('session_id')
      .eq('puzzle_id', puzzleId)
      .eq('session_id', resolvedSession.sessionId)
      .maybeSingle()

    if (existingCompletionError) throw existingCompletionError

    const isNewCompletion = !existingCompletion

    const { error } = await supabase.from('puzzle_completions').upsert({
      puzzle_id: puzzleId,
      session_id: resolvedSession.sessionId,
      score,
      rarity_score: rarityScore,
    })

    if (error) throw error

    if (isNewCompletion) {
      const { data: correctGuesses, error: guessesError } = await supabase
        .from('guesses')
        .select('cell_index,game_id,game_name,game_image')
        .eq('puzzle_id', puzzleId)
        .eq('session_id', resolvedSession.sessionId)
        .eq('is_correct', true)

      if (guessesError) throw guessesError

      for (const guess of correctGuesses ?? []) {
        await supabase.rpc('increment_answer_stat', {
          p_puzzle_id: puzzleId,
          p_cell_index: guess.cell_index,
          p_game_id: guess.game_id,
          p_game_name: guess.game_name,
          p_game_image: guess.game_image,
        })
      }
    }

    return applyAnonymousSessionCookie(NextResponse.json({ success: true }), resolvedSession)
  } catch (error) {
    logError('Stats POST error:', error)
    return NextResponse.json({ error: 'Failed to save completion' }, { status: 500 })
  }
}
