import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Get all correct-answer stats for this puzzle, grouped by cell
    const { data: correctStats, error } = await supabase
      .from('answer_stats')
      .select('*')
      .eq('puzzle_id', puzzleId)
      .order('count', { ascending: false })
    
    if (error) throw error
    
    // Get completion count
    const { count: completionCount } = await supabase
      .from('puzzle_completions')
      .select('*', { count: 'exact', head: true })
      .eq('puzzle_id', puzzleId)

    let incorrectGuessRows:
      | {
          cell_index: number
          game_id: number
          game_name: string
          game_image: string | null
          is_correct: boolean
        }[]
      | null = null

    const incorrectResponse = await supabase
      .from('guesses')
      .select('cell_index,game_id,game_name,game_image,is_correct')
      .eq('puzzle_id', puzzleId)
      .eq('is_correct', false)

    if (incorrectResponse.error) {
      console.warn('[v0] Incorrect guess stats unavailable:', incorrectResponse.error.message)
    } else {
      incorrectGuessRows = incorrectResponse.data
    }

    const incorrectStatsMap = new Map<string, GuessStatRow>()
    for (const guess of incorrectGuessRows ?? []) {
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
        correct: ((correctStats as GuessStatRow[] | null) ?? []).filter(s => s.cell_index === i),
        incorrect: Array.from(incorrectStatsMap.values())
          .filter(s => s.cell_index === i)
          .sort((left, right) => right.count - left.count),
      }
    }
    
    return NextResponse.json({
      puzzle,
      cellStats,
      totalCompletions: completionCount || 0,
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  try {
    const { puzzleId, sessionId, score, rarityScore } = await request.json()
    
    // Record puzzle completion
    const { error } = await supabase
      .from('puzzle_completions')
      .upsert({
        puzzle_id: puzzleId,
        session_id: sessionId,
        score,
        rarity_score: rarityScore,
      })
    
    if (error) throw error
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Stats POST error:', error)
    return NextResponse.json(
      { error: 'Failed to save completion' },
      { status: 500 }
    )
  }
}
