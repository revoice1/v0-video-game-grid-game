import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateGameForCell } from '@/lib/rawg'
import type { Category } from '@/lib/types'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  try {
    const body = await request.json()
    const {
      puzzleId,
      cellIndex,
      gameId,
      gameName,
      gameImage,
      sessionId,
      rowCategory,
      colCategory,
    } = body as {
      puzzleId: string
      cellIndex: number
      gameId: number
      gameName: string
      gameImage: string | null
      sessionId: string
      rowCategory: Category
      colCategory: Category
    }
    
    // Validate the guess
    const { valid, game } = await validateGameForCell(gameId, rowCategory, colCategory)
    
    if (valid) {
      // Record the guess
      await supabase.from('guesses').insert({
        puzzle_id: puzzleId,
        cell_index: cellIndex,
        game_id: gameId,
        game_name: gameName,
        game_image: gameImage,
        session_id: sessionId,
      })
      
      // Update answer stats using upsert
      const { data: existingStat } = await supabase
        .from('answer_stats')
        .select('count')
        .eq('puzzle_id', puzzleId)
        .eq('cell_index', cellIndex)
        .eq('game_id', gameId)
        .single()
      
      if (existingStat) {
        await supabase
          .from('answer_stats')
          .update({ count: existingStat.count + 1 })
          .eq('puzzle_id', puzzleId)
          .eq('cell_index', cellIndex)
          .eq('game_id', gameId)
      } else {
        await supabase.from('answer_stats').insert({
          puzzle_id: puzzleId,
          cell_index: cellIndex,
          game_id: gameId,
          game_name: gameName,
          game_image: gameImage,
          count: 1,
        })
      }
    }
    
    return NextResponse.json({
      valid,
      game: valid ? {
        id: game?.id,
        name: game?.name,
        background_image: game?.background_image,
      } : null,
    })
  } catch (error) {
    console.error('Guess error:', error)
    return NextResponse.json(
      { error: 'Failed to process guess', valid: false },
      { status: 500 }
    )
  }
}
