import { NextRequest, NextResponse } from 'next/server'
import { searchGames } from '@/lib/rawg'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] })
  }
  
  try {
    const games = await searchGames(query)
    // Only return display fields — never expose validation metadata
    // (genres, platforms, tags, developers, publishers) which would let
    // players verify answers before submitting via the network tab.
    const safeResults = games.map(g => ({
      id: g.id,
      name: g.name,
      background_image: g.background_image,
      released: g.released ? g.released.split('-')[0] : null,
    }))
    return NextResponse.json({ results: safeResults })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ results: [] })
  }
}
