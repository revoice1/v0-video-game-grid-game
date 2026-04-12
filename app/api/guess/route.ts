import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateIGDBGameForCell } from '@/lib/igdb'
import { createRequestLogger } from '@/lib/logging'
import { applyAnonymousSessionCookie, resolveAnonymousSession } from '@/lib/server-session'
import type { Category } from '@/lib/types'

function serializeGameDetails(game: Awaited<ReturnType<typeof validateIGDBGameForCell>>['game']) {
  return game
    ? {
        id: game.id,
        name: game.name,
        slug: game.slug,
        url: game.gameUrl,
        background_image: game.background_image,
        released: game.released,
        releaseDates: game.releaseDates ?? [],
        metacritic: game.metacritic,
        stealRating: game.stealRating ?? null,
        stealRatingCount: game.stealRatingCount ?? null,
        genres: game.genres?.map((genre) => genre.name) ?? [],
        platforms: game.platforms?.map((platform) => platform.platform.name) ?? [],
        developers: game.developers?.map((developer) => developer.name) ?? [],
        publishers: game.publishers?.map((publisher) => publisher.name) ?? [],
        tags: game.tags?.map((tag) => tag.name) ?? [],
        gameModes: game.igdb?.game_modes ?? [],
        themes: game.igdb?.themes ?? [],
        perspectives: game.igdb?.player_perspectives ?? [],
        companies: game.igdb?.companies ?? [],
      }
    : null
}

function serializeSelectedGameDetails(
  game: Awaited<ReturnType<typeof validateIGDBGameForCell>>['selectedGame']
) {
  return game
    ? {
        id: game.id,
        name: game.name,
        slug: game.slug ?? null,
        url: game.gameUrl ?? null,
        background_image: game.background_image,
      }
    : null
}

export async function POST(request: NextRequest) {
  const logger = createRequestLogger()
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  try {
    const body = await request.json()
    const {
      puzzleId,
      cellIndex,
      gameId,
      gameName,
      gameImage,
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
      rowCategory: Category
      colCategory: Category
      isDaily?: boolean
      lookupOnly?: boolean
    }

    const resolvedSession = resolveAnonymousSession(request)

    // Validate the guess
    const { valid, game, selectedGame, matchesRow, matchesCol, explanation } =
      await validateIGDBGameForCell(gameId, rowCategory, colCategory)

    if (lookupOnly) {
      return applyAnonymousSessionCookie(
        NextResponse.json({
          valid,
          duplicate: false,
          matchesRow,
          matchesCol,
          validationExplanation: explanation,
          game: serializeGameDetails(game),
          selectedGame: serializeSelectedGameDetails(selectedGame),
        }),
        resolvedSession,
        request
      )
    }

    if (isDaily) {
      const { data: existingGuess } = await supabase
        .from('guesses')
        .select('id')
        .eq('puzzle_id', puzzleId)
        .eq('session_id', resolvedSession.sessionId)
        .eq('game_id', gameId)
        .maybeSingle()

      if (existingGuess) {
        return applyAnonymousSessionCookie(
          NextResponse.json({
            valid: false,
            duplicate: true,
            matchesRow: false,
            matchesCol: false,
            validationExplanation: null,
            game: null,
            selectedGame: null,
          }),
          resolvedSession,
          request
        )
      }
    }

    if (!valid && game) {
      logger.warn('Rejected guess details:', {
        gameId,
        gameName,
        rowCategory,
        colCategory,
        matchesRow,
        matchesCol,
        genres: game.genres?.map((genre) => `${genre.id}:${genre.name}`) ?? [],
        platforms:
          game.platforms?.map((platform) => `${platform.platform.id}:${platform.platform.name}`) ??
          [],
        developers: game.developers?.map((developer) => `${developer.id}:${developer.name}`) ?? [],
        publishers: game.publishers?.map((publisher) => `${publisher.id}:${publisher.name}`) ?? [],
        keywordCount: game.tags?.length ?? 0,
        igdbGameModes: game.igdb?.game_modes ?? [],
        igdbThemes: game.igdb?.themes ?? [],
        igdbPerspectives: game.igdb?.player_perspectives ?? [],
        igdbCompanies: game.igdb?.companies ?? [],
      })
    }

    if (isDaily) {
      const { error: guessInsertError } = await adminSupabase.from('guesses').insert({
        puzzle_id: puzzleId,
        cell_index: cellIndex,
        game_id: gameId,
        game_name: gameName,
        game_image: gameImage,
        session_id: resolvedSession.sessionId,
        is_correct: valid,
      })

      if (guessInsertError) {
        logger.warn('Guess insert with correctness failed, falling back', {
          message: guessInsertError.message,
        })

        if (valid) {
          const { error: legacyGuessInsertError } = await adminSupabase.from('guesses').insert({
            puzzle_id: puzzleId,
            cell_index: cellIndex,
            game_id: gameId,
            game_name: gameName,
            game_image: gameImage,
            session_id: resolvedSession.sessionId,
          })

          if (legacyGuessInsertError) {
            throw legacyGuessInsertError
          }
        }
      }
    }

    return applyAnonymousSessionCookie(
      NextResponse.json({
        valid,
        duplicate: false,
        matchesRow,
        matchesCol,
        validationExplanation: explanation,
        game: serializeGameDetails(game),
        selectedGame: serializeSelectedGameDetails(selectedGame),
      }),
      resolvedSession,
      request
    )
  } catch (error) {
    logger.error('Guess error', { error })
    return NextResponse.json({ error: 'Failed to process guess', valid: false }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const logger = createRequestLogger()
  const supabase = createAdminClient()

  try {
    const body = await request.json()
    const {
      puzzleId,
      cellIndex,
      gameId,
      verdict,
      explanation,
      isCorrect,
      objectionOriginalMatchedRow,
      objectionOriginalMatchedCol,
    } = body as {
      puzzleId?: string
      cellIndex?: number
      gameId?: number
      verdict?: 'sustained' | 'overruled'
      explanation?: string | null
      isCorrect?: boolean
      objectionOriginalMatchedRow?: boolean | null
      objectionOriginalMatchedCol?: boolean | null
    }

    if (
      !puzzleId ||
      typeof cellIndex !== 'number' ||
      typeof gameId !== 'number' ||
      (verdict !== 'sustained' && verdict !== 'overruled') ||
      typeof isCorrect !== 'boolean'
    ) {
      return NextResponse.json({ error: 'Invalid objection payload' }, { status: 400 })
    }

    const resolvedSession = resolveAnonymousSession(request)
    const updatePayload = {
      is_correct: isCorrect,
      objection_used: true,
      objection_verdict: verdict,
      objection_explanation: explanation ?? null,
      objection_original_matched_row: objectionOriginalMatchedRow ?? null,
      objection_original_matched_col: objectionOriginalMatchedCol ?? null,
    }

    const { data: exactMatch, error: exactMatchError } = await supabase
      .from('guesses')
      .update(updatePayload)
      .eq('puzzle_id', puzzleId)
      .eq('cell_index', cellIndex)
      .eq('game_id', gameId)
      .eq('session_id', resolvedSession.sessionId)
      .select('id')
      .maybeSingle()

    if (exactMatchError) {
      throw exactMatchError
    }

    if (!exactMatch) {
      logger.warn('Guess objection update fell back to puzzle/session/cell match', {
        puzzleId,
        cellIndex,
        gameId,
        sessionId: resolvedSession.sessionId,
      })

      const { data: fallbackMatch, error: fallbackMatchError } = await supabase
        .from('guesses')
        .update(updatePayload)
        .eq('puzzle_id', puzzleId)
        .eq('cell_index', cellIndex)
        .eq('session_id', resolvedSession.sessionId)
        .select('id,game_id')
        .maybeSingle()

      if (fallbackMatchError) {
        throw fallbackMatchError
      }

      if (!fallbackMatch) {
        return NextResponse.json(
          { error: 'No matching guess found for objection persistence' },
          { status: 404 }
        )
      }

      if (fallbackMatch.game_id !== gameId) {
        logger.warn('Guess objection update matched a different game id', {
          puzzleId,
          cellIndex,
          requestedGameId: gameId,
          matchedGameId: fallbackMatch.game_id,
          sessionId: resolvedSession.sessionId,
        })
      }
    }

    return applyAnonymousSessionCookie(NextResponse.json({ ok: true }), resolvedSession, request)
  } catch (error) {
    logger.error('Guess objection update error', { error })
    return NextResponse.json({ error: 'Failed to persist objection result' }, { status: 500 })
  }
}
