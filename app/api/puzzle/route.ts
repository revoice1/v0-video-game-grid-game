import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generatePuzzleCategories } from '@/lib/rawg'
import type { Category } from '@/lib/types'

// Cache the daily puzzle at the edge — it's the same for everyone all day
export const revalidate = 3600

// Strip internal RAWG IDs that could be used to pre-query the API
function sanitizeCategories(categories: Category[]): Omit<Category, 'developerId' | 'publisherId'>[] {
  return categories.map(({ developerId: _d, publisherId: _p, ...safe }) => safe)
}

// Get today's date string
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

// Generate puzzle categories (no verification needed - categories are pre-curated)
function generateValidPuzzle(): { rows: Category[], cols: Category[] } {
  const { rows, cols } = generatePuzzleCategories()
  console.log(`[v0] Generated puzzle - rows: ${rows.map(r => r.name).join(', ')}, cols: ${cols.map(c => c.name).join(', ')}`)
  return { rows, cols }
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
        return NextResponse.json({
          ...existingPuzzle,
          row_categories: sanitizeCategories(existingPuzzle.row_categories),
          col_categories: sanitizeCategories(existingPuzzle.col_categories),
        })
      }
      
      // Generate new daily puzzle
      const categories = await generateValidPuzzle()
      
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
      return NextResponse.json({
        ...newPuzzle,
        row_categories: sanitizeCategories(newPuzzle.row_categories),
        col_categories: sanitizeCategories(newPuzzle.col_categories),
      })
    } else {
      // Practice mode - generate a new puzzle each time
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
      })
    }
  } catch (error) {
    console.error('[v0] Error in puzzle API:', error)
    // Return the error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to get puzzle: ${errorMessage}` },
      { status: 500 }
    )
  }
}
