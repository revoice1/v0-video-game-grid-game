import { NextRequest, NextResponse } from 'next/server'
import { searchIGDBGames } from '@/lib/igdb'
import { createClient } from '@/lib/supabase/server'
import type { Category } from '@/lib/types'

function parseCategoryTypes(rawValue: string | null): Set<Category['type']> {
  if (!rawValue) {
    return new Set<Category['type']>()
  }

  return new Set(
    rawValue
      .split(',')
      .map((value) => value.trim())
      .filter((value): value is Category['type'] => value.length > 0)
  )
}

async function getPuzzleCategoryTypes(puzzleId: string | null): Promise<Set<Category['type']>> {
  if (!puzzleId) {
    return new Set<Category['type']>()
  }

  const supabase = await createClient()
  const { data: puzzle } = await supabase
    .from('puzzles')
    .select('row_categories,col_categories')
    .eq('id', puzzleId)
    .maybeSingle()

  if (!puzzle) {
    return new Set<Category['type']>()
  }

  return new Set<Category['type']>([
    ...(puzzle.row_categories ?? []).map((category: Category) => category.type),
    ...(puzzle.col_categories ?? []).map((category: Category) => category.type),
  ])
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  const puzzleId = searchParams.get('puzzleId')
  const categoryTypesParam = searchParams.get('categoryTypes')

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] })
  }

  try {
    const explicitCategoryTypes = parseCategoryTypes(categoryTypesParam)
    const categoryTypes = explicitCategoryTypes.size > 0
      ? explicitCategoryTypes
      : await getPuzzleCategoryTypes(puzzleId)
    const games = await searchIGDBGames(query)
    const shouldScrub = (type: Category['type']) => categoryTypes.has(type)

    // Return lightweight display metadata, scrubbing any families that overlap
    // with active puzzle categories for this search session.
    const safeResults = games.map(g => ({
      id: g.id,
      name: g.name,
      background_image: g.background_image,
      metacritic: g.metacritic,
      gameTypeLabel: g.gameTypeLabel ?? null,
      originalPlatformName: shouldScrub('platform') ? null : g.originalPlatformName ?? null,
      released: shouldScrub('decade') ? null : g.released,
      genres: shouldScrub('genre') ? [] : g.genres,
      platforms: shouldScrub('platform') ? [] : g.platforms,
    }))

    return NextResponse.json({ results: safeResults })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ results: [] })
  }
}
