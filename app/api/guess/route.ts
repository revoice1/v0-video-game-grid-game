import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateIGDBGameForCell } from '@/lib/igdb'
import type { Category } from '@/lib/types'

function serializeGameDetails(game: Awaited<ReturnType<typeof validateIGDBGameForCell>>['game']) {
  return game ? {
    id: game.id,
    name: game.name,
    slug: game.slug,
    url: game.gameUrl,
    background_image: game.background_image,
    released: game.released,
    metacritic: game.metacritic,
    stealRating: game.stealRating ?? null,
    genres: game.genres?.map(genre => genre.name) ?? [],
    platforms: game.platforms?.map(platform => platform.platform.name) ?? [],
    developers: game.developers?.map(developer => developer.name) ?? [],
    publishers: game.publishers?.map(publisher => publisher.name) ?? [],
    tags: game.tags?.map(tag => tag.name) ?? [],
    gameModes: game.igdb?.game_modes ?? [],
    themes: game.igdb?.themes ?? [],
    perspectives: game.igdb?.player_perspectives ?? [],
    companies: game.igdb?.companies ?? [],
  } : null
}

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
      isDaily = true,
      lookupOnly,
    } = body as {
      puzzleId?: string
      cellIndex?: number
      gameId: number
      gameName?: string
      gameImage?: string | null
      sessionId?: string
      rowCategory: Category
      colCategory: Category
      isDaily?: boolean
      lookupOnly?: boolean
    }

    // Validate the guess
    const { valid, game, matchesRow, matchesCol } = await validateIGDBGameForCell(gameId, rowCategory, colCategory)

    if (lookupOnly) {
      return NextResponse.json({
        valid,
        duplicate: false,
        matchesRow,
        matchesCol,
        game: serializeGameDetails(game),
      })
    }

    if (isDaily) {
      const { data: existingGuess } = await supabase
        .from('guesses')
        .select('id')
        .eq('puzzle_id', puzzleId)
        .eq('session_id', sessionId)
        .eq('game_id', gameId)
        .maybeSingle()

      if (existingGuess) {
        return NextResponse.json({
          valid: false,
          duplicate: true,
          matchesRow: false,
          matchesCol: false,
          game: null,
        })
      }
    }

    if (!valid && game) {
      console.warn('[v0] Rejected guess details:', {
        gameId,
        gameName,
        rowCategory,
        colCategory,
        matchesRow,
        matchesCol,
        genres: game.genres?.map(genre => `${genre.id}:${genre.name}`) ?? [],
        platforms: game.platforms?.map(platform => `${platform.platform.id}:${platform.platform.name}`) ?? [],
        developers: game.developers?.map(developer => `${developer.id}:${developer.name}`) ?? [],
        publishers: game.publishers?.map(publisher => `${publisher.id}:${publisher.name}`) ?? [],
        keywords: game.tags?.map(tag => `${tag.id}:${tag.name}`) ?? [],
        igdbGameModes: game.igdb?.game_modes ?? [],
        igdbThemes: game.igdb?.themes ?? [],
        igdbPerspectives: game.igdb?.player_perspectives ?? [],
        igdbCompanies: game.igdb?.companies ?? [],
      })
    }
    
    if (isDaily) {
      const { error: guessInsertError } = await supabase.from('guesses').insert({
        puzzle_id: puzzleId,
        cell_index: cellIndex,
        game_id: gameId,
        game_name: gameName,
        game_image: gameImage,
        session_id: sessionId,
        is_correct: valid,
      })

      if (guessInsertError) {
        console.warn('[v0] Guess insert with correctness failed, falling back:', guessInsertError.message)

        if (valid) {
          const { error: legacyGuessInsertError } = await supabase.from('guesses').insert({
            puzzle_id: puzzleId,
            cell_index: cellIndex,
            game_id: gameId,
            game_name: gameName,
            game_image: gameImage,
            session_id: sessionId,
          })

          if (legacyGuessInsertError) {
            throw legacyGuessInsertError
          }
        }
      }
    }

    return NextResponse.json({
      valid,
      duplicate: false,
      matchesRow,
      matchesCol,
      game: serializeGameDetails(game),
    })
  } catch (error) {
    console.error('Guess error:', error)
    return NextResponse.json(
      { error: 'Failed to process guess', valid: false },
      { status: 500 }
    )
  }
}
