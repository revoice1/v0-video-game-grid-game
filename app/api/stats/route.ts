import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const searchParams = request.nextUrl.searchParams
  const puzzleId = searchParams.get('puzzleId')
  
  if (!puzzleId) {
    return NextResponse.json({ error: 'Puzzle ID required' }, { status: 400 })
  }
  
  try {
    // Get all stats for this puzzle, grouped by cell
    const { data: stats, error } = await supabase
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
    
    // Organize by cell
    const cellStats: Record<number, typeof stats> = {}
    for (let i = 0; i < 9; i++) {
      cellStats[i] = stats?.filter(s => s.cell_index === i) || []
    }
    
    return NextResponse.json({
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
