import { NextRequest, NextResponse } from 'next/server'
import { searchIGDBGames } from '@/lib/igdb'
import { createClient } from '@/lib/supabase/server'
import type { Category } from '@/lib/types'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const puzzleId = searchParams.get('puzzleId')
  
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] })
  }

  try {
    const supabase = await createClient()
    let categoryTypes = new Set<Category['type']>()

    if (puzzleId) {
      const { data: puzzle } = await supabase
        .from('puzzles')
        .select('row_categories,col_categories')
        .eq('id', puzzleId)
        .maybeSingle()

      if (puzzle) {
        categoryTypes = new Set<Category['type']>([
          ...(puzzle.row_categories ?? []).map((category: Category) => category.type),
          ...(puzzle.col_categories ?? []).map((category: Category) => category.type),
        ])
      }
    }

    const games = await searchIGDBGames(query)
    // Return lightweight display metadata, scrubbing any families that
    // overlap with active puzzle categories for this search session.
    const safeResults = games.map(g => ({
      id: g.id,
      name: g.name,
      background_image: g.background_image,
      metacritic: g.metacritic,
      released: puzzleId && categoryTypes.has('decade') ? null : g.released,
      genres: puzzleId && categoryTypes.has('genre') ? [] : g.genres,
      platforms: puzzleId && categoryTypes.has('platform') ? [] : g.platforms,
    }))
    return NextResponse.json({ results: safeResults })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ results: [] })
  }
}
