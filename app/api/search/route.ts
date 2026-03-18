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
    return NextResponse.json({ results: games })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ results: [] })
  }
}
