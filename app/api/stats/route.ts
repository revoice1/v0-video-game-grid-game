import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRequestLogger } from '@/lib/logging'
import { applyAnonymousSessionCookie, resolveAnonymousSession } from '@/lib/server-session'
import { buildDailyStreakSummary } from '@/lib/daily-streaks'

interface GuessStatRow {
  puzzle_id: string
  cell_index: number
  game_id: number
  game_name: string
  game_image: string | null
  count: number
}

export async function GET(request: NextRequest) {
  const logger = createRequestLogger()
  const supabase = await createClient()
  const searchParams = request.nextUrl.searchParams
  const puzzleId = searchParams.get('puzzleId')

  if (!puzzleId) {
    return NextResponse.json({ error: 'Puzzle ID required' }, { status: 400 })
  }

  try {
    const resolvedSession = resolveAnonymousSession(request)
    const { data: puzzle, error: puzzleError } = await supabase
      .from('puzzles')
      .select('row_categories,col_categories,is_daily')
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

    // answer_stats is a pre-aggregated table updated by a DB trigger on insert to guesses.
    // Correct counts here are only as fresh as that trigger; incorrect counts below come
    // from guesses directly and are always live.
    const { data: correctAnswerRows, error: correctAnswerError } = await supabase
      .from('answer_stats')
      .select('puzzle_id,cell_index,game_id,game_name,game_image,count')
      .eq('puzzle_id', puzzleId)

    if (correctAnswerError) {
      logger.warn('Answer stats unavailable', { message: correctAnswerError.message })
    }

    let incorrectGuessRows:
      | {
          cell_index: number
          game_id: number
          game_name: string
          game_image: string | null
          is_correct: boolean
          session_id: string | null
        }[]
      | null = null

    const incorrectGuessResponse = await supabase
      .from('guesses')
      .select('cell_index,game_id,game_name,game_image,is_correct,session_id')
      .eq('puzzle_id', puzzleId)
      .eq('is_correct', false)

    if (incorrectGuessResponse.error) {
      logger.warn('Incorrect guess stats unavailable', {
        message: incorrectGuessResponse.error.message,
      })
    } else {
      incorrectGuessRows = incorrectGuessResponse.data
    }

    const completedIncorrectGuessRows = (incorrectGuessRows ?? []).filter((guess) =>
      guess.session_id ? completedSessionIds.has(guess.session_id) : false
    )

    const correctStatsMap = new Map<number, GuessStatRow[]>()
    const incorrectStatsMap = new Map<string, GuessStatRow>()
    for (const stat of correctAnswerRows ?? []) {
      const current = correctStatsMap.get(stat.cell_index) ?? []
      current.push(stat)
      correctStatsMap.set(stat.cell_index, current)
    }
    for (const guess of completedIncorrectGuessRows) {
      const key = `${guess.cell_index}:${guess.game_id}`

      const existing = incorrectStatsMap.get(key)

      if (existing) {
        existing.count += 1
      } else {
        incorrectStatsMap.set(key, {
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
        correct: [...(correctStatsMap.get(i) ?? [])].sort(
          (left, right) => right.count - left.count
        ),
        incorrect: Array.from(incorrectStatsMap.values())
          .filter((s) => s.cell_index === i)
          .sort((left, right) => right.count - left.count),
      }
    }

    let dailySummary = null

    if (puzzle?.is_daily) {
      const { data: userCompletionRows, error: userCompletionError } = await supabase
        .from('puzzle_completions')
        .select('puzzle_id,score')
        .eq('session_id', resolvedSession.sessionId)

      if (userCompletionError) {
        throw userCompletionError
      }

      const userPuzzleIds = (userCompletionRows ?? [])
        .map((row) => row.puzzle_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)

      if (userPuzzleIds.length > 0) {
        const { data: userPuzzleRows, error: userPuzzleError } = await supabase
          .from('puzzles')
          .select('id,date')
          .eq('is_daily', true)
          .not('date', 'is', null)
          .in('id', userPuzzleIds)

        if (userPuzzleError) {
          throw userPuzzleError
        }

        const puzzleDateById = new Map(
          (userPuzzleRows ?? [])
            .filter(
              (row): row is { id: string; date: string } =>
                typeof row.id === 'string' && typeof row.date === 'string'
            )
            .map((row) => [row.id, row.date])
        )

        dailySummary = buildDailyStreakSummary(
          (userCompletionRows ?? [])
            .map((row) => {
              const date = puzzleDateById.get(row.puzzle_id)
              if (!date) return null
              return {
                date,
                score: typeof row.score === 'number' ? row.score : null,
              }
            })
            .filter((row): row is { date: string; score: number | null } => row !== null)
        )
      } else {
        dailySummary = buildDailyStreakSummary([])
      }
    }

    return applyAnonymousSessionCookie(
      NextResponse.json({
        puzzle,
        cellStats,
        totalCompletions: completionCount || 0,
        dailySummary,
      }),
      resolvedSession,
      request
    )
  } catch (error) {
    logger.error('Stats error', { error })
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const logger = createRequestLogger()
  const supabase = await createClient()

  try {
    const { puzzleId, score, rarityScore } = await request.json()
    const resolvedSession = resolveAnonymousSession(request)

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

    return applyAnonymousSessionCookie(
      NextResponse.json({ success: true }),
      resolvedSession,
      request
    )
  } catch (error) {
    logger.error('Stats POST error', { error })
    return NextResponse.json({ error: 'Failed to save completion' }, { status: 500 })
  }
}
