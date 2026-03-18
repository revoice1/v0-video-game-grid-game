import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generatePuzzleCategories, getValidGamesForCell } from '@/lib/rawg'
import type { Category, Puzzle } from '@/lib/types'

// Get today's date string
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

// Verify a puzzle has valid answers for all cells
async function verifyPuzzleHasValidAnswers(
  rows: Category[],
  cols: Category[]
): Promise<boolean> {
  // Check just a few cells to save API calls
  const cellsToCheck = [
    [0, 0], [1, 1], [2, 2], // diagonal
    [0, 2], [2, 0] // corners
  ]
  
  for (const [r, c] of cellsToCheck) {
    const games = await getValidGamesForCell(rows[r], cols[c])
    if (games.length < 3) { // Need at least 3 valid games
      return false
    }
  }
  
  return true
}

// Generate a valid puzzle with verified answers
async function generateValidPuzzle(maxAttempts = 5): Promise<{ rows: Category[], cols: Category[] } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const { rows, cols } = generatePuzzleCategories()
    const isValid = await verifyPuzzleHasValidAnswers(rows, cols)
    if (isValid) {
      return { rows, cols }
    }
  }
  return null
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('mode') || 'daily'
  
  try {
    if (mode === 'daily') {
      const today = getTodayDate()
      
      // Check for existing daily puzzle
      const { data: existingPuzzle } = await supabase
        .from('puzzles')
        .select('*')
        .eq('date', today)
        .eq('is_daily', true)
        .single()
      
      if (existingPuzzle) {
        return NextResponse.json(existingPuzzle)
      }
      
      // Generate new daily puzzle
      const categories = await generateValidPuzzle()
      if (!categories) {
        return NextResponse.json(
          { error: 'Failed to generate valid puzzle' },
          { status: 500 }
        )
      }
      
      const { data: newPuzzle, error } = await supabase
        .from('puzzles')
        .insert({
          date: today,
          is_daily: true,
          row_categories: categories.rows,
          col_categories: categories.cols,
        })
        .select()
        .single()
      
      if (error) throw error
      return NextResponse.json(newPuzzle)
    } else {
      // Practice mode - generate a new puzzle each time
      const categories = await generateValidPuzzle()
      if (!categories) {
        return NextResponse.json(
          { error: 'Failed to generate valid puzzle' },
          { status: 500 }
        )
      }
      
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
      return NextResponse.json(newPuzzle)
    }
  } catch (error) {
    console.error('Error in puzzle API:', error)
    return NextResponse.json(
      { error: 'Failed to get puzzle' },
      { status: 500 }
    )
  }
}
