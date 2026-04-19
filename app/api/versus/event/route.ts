import { NextRequest, NextResponse } from 'next/server'
import { getNextPlayer, getStealShowdownMetric } from '@/components/game/game-client-versus-helpers'
import { getResolvedIGDBGameDetails, validateIGDBGameForCell } from '@/lib/igdb'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  type ClaimPayload,
  type ObjectionPayload,
  type StealPayload,
  type ValidatedOnlineVersusRuntimeState,
  validateOnlineVersusEvent,
  type StoredOnlineVersusEvent,
} from '@/lib/online-versus-event-validation'
import { resolveAnonymousSession } from '@/lib/server-session'
import { createRequestLogger } from '@/lib/logging'
import type { Category, CellGuess, Puzzle } from '@/lib/types'
import { verifyObjectionProof } from '@/lib/objection-proof'
import {
  getOnlineVersusRoleAssignments,
  isOnlineVersusSnapshot,
  type OnlineVersusEventType,
  type RoomPlayer,
} from '@/lib/versus-room'
import { resolveStealOutcome } from '@/hooks/use-versus-steal'

const MAX_CLIENT_EVENT_ID_LENGTH = 100
const MAX_OBJECTION_EXPLANATION_LENGTH = 2_000

function serializeGameDetails(game: Awaited<ReturnType<typeof validateIGDBGameForCell>>['game']) {
  return game
    ? {
        slug: game.slug ?? null,
        url: game.gameUrl ?? null,
        released: game.released ?? null,
        metacritic: game.metacritic ?? null,
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

function getClientEventId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const clientEventId = (payload as Record<string, unknown>).clientEventId
  if (typeof clientEventId !== 'string') {
    return null
  }

  const normalizedClientEventId = clientEventId.trim()
  if (
    normalizedClientEventId.length === 0 ||
    normalizedClientEventId.length > MAX_CLIENT_EVENT_ID_LENGTH
  ) {
    return null
  }

  return normalizedClientEventId
}

function normalizeObjectionExplanation(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = [...value]
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)
    })
    .join('')
    .trim()

  if (!normalized) {
    return null
  }

  return normalized.slice(0, MAX_OBJECTION_EXPLANATION_LENGTH)
}

function normalizeObjectionOriginalMatch(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function getAuthoritativeMissLikeResolution(options: {
  currentPlayer: RoomPlayer
  pendingFinalSteal: ValidatedOnlineVersusRuntimeState['pendingFinalSteal']
  cellIndex: number
}) {
  if (options.pendingFinalSteal && options.pendingFinalSteal.cellIndex === options.cellIndex) {
    return {
      resolutionKind: 'defender-wins' as const,
      defender: options.pendingFinalSteal.defender,
      nextPlayer: undefined,
    }
  }

  return {
    resolutionKind: 'next-player' as const,
    defender: undefined,
    nextPlayer: getNextPlayer(options.currentPlayer),
  }
}

function getPuzzleCategoriesForCell(
  puzzle: Puzzle | null,
  cellIndex: number
): {
  rowCategory: Category | null
  colCategory: Category | null
} {
  if (!puzzle) {
    return { rowCategory: null, colCategory: null }
  }

  return {
    rowCategory: puzzle.row_categories[Math.floor(cellIndex / 3)] ?? null,
    colCategory: puzzle.col_categories[cellIndex % 3] ?? null,
  }
}

function buildGuessFromResolvedDetails(options: {
  player: RoomPlayer
  resolvedGame: NonNullable<Awaited<ReturnType<typeof getResolvedIGDBGameDetails>>>['game']
  selectedGame: NonNullable<Awaited<ReturnType<typeof getResolvedIGDBGameDetails>>>['selectedGame']
  matchedRow: boolean
  matchedCol: boolean
  validationExplanation: CellGuess['validationExplanation']
}): CellGuess {
  const resolvedMetadata = serializeGameDetails(options.resolvedGame)

  return {
    gameId: options.selectedGame.id,
    gameName: options.selectedGame.name,
    owner: options.player,
    gameSlug: resolvedMetadata?.slug ?? null,
    gameUrl: resolvedMetadata?.url ?? null,
    gameImage: options.selectedGame.background_image,
    isCorrect: true,
    released: resolvedMetadata?.released ?? null,
    metacritic: resolvedMetadata?.metacritic ?? null,
    stealRating: resolvedMetadata?.stealRating ?? null,
    stealRatingCount: resolvedMetadata?.stealRatingCount ?? null,
    genres: resolvedMetadata?.genres ?? [],
    platforms: resolvedMetadata?.platforms ?? [],
    developers: resolvedMetadata?.developers ?? [],
    publishers: resolvedMetadata?.publishers ?? [],
    tags: resolvedMetadata?.tags ?? [],
    gameModes: resolvedMetadata?.gameModes ?? [],
    themes: resolvedMetadata?.themes ?? [],
    perspectives: resolvedMetadata?.perspectives ?? [],
    companies: resolvedMetadata?.companies ?? [],
    matchedRow: options.matchedRow,
    matchedCol: options.matchedCol,
    validationExplanation: options.validationExplanation,
    objectionUsed: false,
    objectionVerdict: null,
    objectionExplanation: null,
    objectionOriginalMatchedRow: null,
    objectionOriginalMatchedCol: null,
  }
}

async function buildAuthoritativeGuess(options: {
  puzzle: Puzzle | null
  cellIndex: number
  gameId: number
  player: RoomPlayer
}): Promise<
  | {
      ok: true
      guess: CellGuess
    }
  | {
      ok: false
      error: string
      code: string
      status: number
    }
> {
  const { rowCategory, colCategory } = getPuzzleCategoriesForCell(options.puzzle, options.cellIndex)

  if (!rowCategory || !colCategory) {
    return {
      ok: false,
      error: 'The room puzzle is missing category data for that cell.',
      code: 'state_mismatch',
      status: 409,
    }
  }

  const validation = await validateIGDBGameForCell(options.gameId, rowCategory, colCategory)

  if (!validation.valid || !validation.game || !validation.selectedGame) {
    return {
      ok: false,
      error: 'The submitted game does not satisfy that cell on the server.',
      code: 'invalid_guess',
      status: 409,
    }
  }

  return {
    ok: true,
    guess: buildGuessFromResolvedDetails({
      player: options.player,
      resolvedGame: validation.game,
      selectedGame: validation.selectedGame,
      matchedRow: validation.matchesRow,
      matchedCol: validation.matchesCol,
      validationExplanation: validation.explanation ?? null,
    }),
  }
}

function getAuthoritativeStealOutcome(options: {
  rule: 'off' | 'lower' | 'higher' | 'fewer_reviews' | 'more_reviews'
  defendingGuess: CellGuess
  attackingGuess: CellGuess
}) {
  if (options.rule === 'off') {
    return {
      successful: false,
      hadShowdownScores: false,
      attackingScore: null,
      defendingScore: null,
    }
  }

  const defendingScore = getStealShowdownMetric(options.defendingGuess, options.rule)
  const attackingScore = getStealShowdownMetric(options.attackingGuess, options.rule)
  const hasShowdownScores = typeof defendingScore === 'number' && typeof attackingScore === 'number'
  const successful =
    hasShowdownScores &&
    (options.rule === 'lower' || options.rule === 'fewer_reviews'
      ? attackingScore < defendingScore
      : attackingScore > defendingScore)

  return {
    successful,
    hadShowdownScores: hasShowdownScores,
    attackingScore: attackingScore ?? null,
    defendingScore: defendingScore ?? null,
  }
}

function getAuthoritativeStealResolutionPayload(options: {
  rule: 'off' | 'lower' | 'higher' | 'fewer_reviews' | 'more_reviews'
  currentPlayer: RoomPlayer
  pendingFinalSteal: ValidatedOnlineVersusRuntimeState['pendingFinalSteal']
  cellIndex: number
  defendingGuess: CellGuess
  attackingGuess: CellGuess
}) {
  if (options.rule === 'off') {
    const missResolution = getAuthoritativeMissLikeResolution({
      currentPlayer: options.currentPlayer,
      pendingFinalSteal: options.pendingFinalSteal,
      cellIndex: options.cellIndex,
    })

    return {
      successful: false,
      hadShowdownScores: false,
      attackingGameName: options.attackingGuess.gameName,
      attackingScore: null,
      defendingGameName: options.defendingGuess.gameName,
      defendingScore: null,
      resolutionKind: missResolution.resolutionKind,
      defender: missResolution.defender,
      nextPlayer: missResolution.nextPlayer,
    }
  }

  const effectiveRule = options.rule
  const outcome = resolveStealOutcome({
    currentPlayer: options.currentPlayer,
    defendingGuess: options.defendingGuess,
    attackingGuess: options.attackingGuess,
    rule: effectiveRule,
    pendingFinalSteal: options.pendingFinalSteal,
    selectedCell: options.cellIndex,
  })
  const defendingScore = getStealShowdownMetric(options.defendingGuess, effectiveRule)
  const attackingScore = getStealShowdownMetric(options.attackingGuess, effectiveRule)

  const setWinnerAction = outcome.actions.find((action) => action.kind === 'setWinner')
  const setNextPlayerAction = outcome.actions.find((action) => action.kind === 'setNextPlayer')

  return {
    successful: outcome.successful,
    hadShowdownScores: outcome.hasShowdownScores,
    attackingGameName: options.attackingGuess.gameName,
    attackingScore: attackingScore ?? null,
    defendingGameName: options.defendingGuess.gameName,
    defendingScore: defendingScore ?? null,
    resolutionKind:
      setWinnerAction?.kind === 'setWinner'
        ? ('defender-wins' as const)
        : setNextPlayerAction?.kind === 'setNextPlayer'
          ? ('next-player' as const)
          : undefined,
    defender: setWinnerAction?.kind === 'setWinner' ? setWinnerAction.player : undefined,
    nextPlayer:
      setNextPlayerAction?.kind === 'setNextPlayer' ? setNextPlayerAction.player : undefined,
  }
}

async function buildAuthoritativeClaimPayload(options: {
  puzzle: Puzzle | null
  player: RoomPlayer
  payload: ClaimPayload
}): Promise<
  | {
      ok: true
      payload: ClaimPayload
    }
  | {
      ok: false
      error: string
      code: string
      status: number
    }
> {
  const authoritativeGuess = await buildAuthoritativeGuess({
    puzzle: options.puzzle,
    cellIndex: options.payload.cellIndex,
    gameId: options.payload.guess.gameId,
    player: options.player,
  })

  if (!authoritativeGuess.ok) {
    return authoritativeGuess
  }

  return {
    ok: true,
    payload: {
      ...options.payload,
      guess: authoritativeGuess.guess as ClaimPayload['guess'],
    },
  }
}

async function buildAuthoritativeStealPayload(options: {
  puzzle: Puzzle | null
  player: RoomPlayer
  payload: StealPayload
  state: ValidatedOnlineVersusRuntimeState
  stealRule: 'off' | 'lower' | 'higher' | 'fewer_reviews' | 'more_reviews'
}): Promise<
  | {
      ok: true
      payload: StealPayload
    }
  | {
      ok: false
      error: string
      code: string
      status: number
    }
> {
  const authoritativeGuess = await buildAuthoritativeGuess({
    puzzle: options.puzzle,
    cellIndex: options.payload.cellIndex,
    gameId: options.payload.attackingGuess.gameId,
    player: options.player,
  })

  if (!authoritativeGuess.ok) {
    return authoritativeGuess
  }

  const defendingGuess = options.state.guesses[options.payload.cellIndex]
  if (!defendingGuess) {
    return {
      ok: false,
      error: 'The active steal target no longer exists on the server.',
      code: 'steal_not_available',
      status: 409,
    }
  }

  const authoritativeOutcome = getAuthoritativeStealOutcome({
    rule: options.stealRule,
    defendingGuess,
    attackingGuess: authoritativeGuess.guess,
  })
  const authoritativeResolution = getAuthoritativeStealResolutionPayload({
    rule: options.stealRule,
    currentPlayer: options.player,
    pendingFinalSteal: options.state.pendingFinalSteal,
    cellIndex: options.payload.cellIndex,
    defendingGuess,
    attackingGuess: authoritativeGuess.guess,
  })

  if (options.payload.successful !== authoritativeOutcome.successful) {
    return {
      ok: false,
      error: 'The steal result did not match the authoritative showdown outcome.',
      code: 'steal_outcome_mismatch',
      status: 409,
    }
  }

  return {
    ok: true,
    payload: {
      ...options.payload,
      attackingGuess: authoritativeGuess.guess as StealPayload['attackingGuess'],
      successful: authoritativeOutcome.successful,
      hadShowdownScores: authoritativeOutcome.hadShowdownScores,
      attackingGameName: authoritativeGuess.guess.gameName,
      attackingScore: authoritativeOutcome.attackingScore,
      defendingGameName: defendingGuess.gameName,
      defendingScore: authoritativeOutcome.defendingScore,
      resolutionKind: !authoritativeOutcome.successful
        ? authoritativeResolution.resolutionKind
        : undefined,
      nextPlayer: !authoritativeOutcome.successful ? authoritativeResolution.nextPlayer : undefined,
      defender: !authoritativeOutcome.successful ? authoritativeResolution.defender : undefined,
    },
  }
}

async function buildAuthoritativeObjectionPayload(options: {
  puzzle: Puzzle | null
  player: RoomPlayer
  payload: ObjectionPayload
  state: ValidatedOnlineVersusRuntimeState
  stealRule: 'off' | 'lower' | 'higher' | 'fewer_reviews' | 'more_reviews'
}): Promise<
  | {
      ok: true
      payload: ObjectionPayload
    }
  | {
      ok: false
      error: string
      code: string
      status: number
    }
> {
  const originalUpdatedGuess = options.payload.updatedGuess as Partial<CellGuess>
  const normalizedObjectionDetails = {
    objectionExplanation: normalizeObjectionExplanation(originalUpdatedGuess.objectionExplanation),
    objectionOriginalMatchedRow: normalizeObjectionOriginalMatch(
      originalUpdatedGuess.objectionOriginalMatchedRow
    ),
    objectionOriginalMatchedCol: normalizeObjectionOriginalMatch(
      originalUpdatedGuess.objectionOriginalMatchedCol
    ),
  }

  if (options.payload.verdict !== 'sustained') {
    const missResolution = getAuthoritativeMissLikeResolution({
      currentPlayer: options.player,
      pendingFinalSteal: options.state.pendingFinalSteal,
      cellIndex: options.payload.cellIndex,
    })

    return {
      ok: true,
      payload: {
        cellIndex: options.payload.cellIndex,
        clientEventId: options.payload.clientEventId,
        verdict: options.payload.verdict,
        updatedGuess: {
          ...options.payload.updatedGuess,
          objectionExplanation: normalizedObjectionDetails.objectionExplanation,
          objectionOriginalMatchedRow: normalizedObjectionDetails.objectionOriginalMatchedRow,
          objectionOriginalMatchedCol: normalizedObjectionDetails.objectionOriginalMatchedCol,
        } as ObjectionPayload['updatedGuess'],
        isSteal: options.payload.isSteal,
        resolutionKind: missResolution.resolutionKind,
        nextPlayer: missResolution.nextPlayer,
        defender: missResolution.defender,
      },
    }
  }
  const { rowCategory, colCategory } = getPuzzleCategoriesForCell(
    options.puzzle,
    options.payload.cellIndex
  )
  if (!rowCategory || !colCategory) {
    return {
      ok: false,
      error: 'The room puzzle is missing category data for that cell.',
      code: 'state_mismatch',
      status: 409,
    }
  }

  let authoritativeGuess = await buildAuthoritativeGuess({
    puzzle: options.puzzle,
    cellIndex: options.payload.cellIndex,
    gameId: options.payload.updatedGuess.gameId,
    player: options.player,
  })

  if (
    !authoritativeGuess.ok &&
    verifyObjectionProof(options.payload.proof, {
      gameId: options.payload.updatedGuess.gameId,
      rowCategory,
      colCategory,
      verdict: 'sustained',
    })
  ) {
    const resolvedDetails = await getResolvedIGDBGameDetails(options.payload.updatedGuess.gameId)
    if (!resolvedDetails) {
      return {
        ok: false,
        error: 'The submitted game could not be resolved on the server.',
        code: 'invalid_guess',
        status: 409,
      }
    }

    authoritativeGuess = {
      ok: true,
      guess: buildGuessFromResolvedDetails({
        player: options.player,
        resolvedGame: resolvedDetails.game,
        selectedGame: resolvedDetails.selectedGame,
        matchedRow: true,
        matchedCol: true,
        validationExplanation:
          (options.payload.updatedGuess as Partial<CellGuess>).validationExplanation ?? null,
      }),
    }
  }

  if (!authoritativeGuess.ok) {
    return authoritativeGuess
  }

  const updatedGuess: CellGuess = {
    ...authoritativeGuess.guess,
    objectionUsed: true,
    objectionVerdict: 'sustained',
    objectionExplanation: normalizedObjectionDetails.objectionExplanation,
    objectionOriginalMatchedRow: normalizedObjectionDetails.objectionOriginalMatchedRow,
    objectionOriginalMatchedCol: normalizedObjectionDetails.objectionOriginalMatchedCol,
  }

  if (!options.payload.isSteal) {
    return {
      ok: true,
      payload: {
        cellIndex: options.payload.cellIndex,
        clientEventId: options.payload.clientEventId,
        verdict: options.payload.verdict,
        updatedGuess: updatedGuess as ObjectionPayload['updatedGuess'],
        isSteal: options.payload.isSteal,
      },
    }
  }

  const defendingGuess = options.state.guesses[options.payload.cellIndex]
  if (!defendingGuess) {
    return {
      ok: false,
      error: 'The active steal target no longer exists on the server.',
      code: 'steal_not_available',
      status: 409,
    }
  }

  const authoritativeResolution = getAuthoritativeStealResolutionPayload({
    rule: options.stealRule,
    currentPlayer: options.player,
    pendingFinalSteal: options.state.pendingFinalSteal,
    cellIndex: options.payload.cellIndex,
    defendingGuess,
    attackingGuess: updatedGuess,
  })

  return {
    ok: true,
    payload: {
      cellIndex: options.payload.cellIndex,
      clientEventId: options.payload.clientEventId,
      verdict: options.payload.verdict,
      updatedGuess: updatedGuess as ObjectionPayload['updatedGuess'],
      isSteal: options.payload.isSteal,
      successful: authoritativeResolution.successful,
      hadShowdownScores: authoritativeResolution.hadShowdownScores,
      attackingGameName: authoritativeResolution.attackingGameName,
      attackingScore: authoritativeResolution.attackingScore,
      defendingGameName: authoritativeResolution.defendingGameName,
      defendingScore: authoritativeResolution.defendingScore,
      resolutionKind: authoritativeResolution.resolutionKind,
      nextPlayer: authoritativeResolution.nextPlayer,
      defender: authoritativeResolution.defender,
    },
  }
}

export async function POST(request: NextRequest) {
  const logger = createRequestLogger()
  const supabase = createAdminClient()
  const session = resolveAnonymousSession(request)

  try {
    const body = await request.json()
    const { roomId, player, type, payload, matchNumber } = body as {
      roomId: string
      player: RoomPlayer
      type: OnlineVersusEventType
      payload: Record<string, unknown>
      matchNumber?: number
    }

    if (!roomId || !player || !type || !Number.isInteger(matchNumber)) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    // Verify the session owns the player slot they're claiming
    const { data: room, error: roomError } = await supabase
      .from('versus_rooms')
      .select(
        'host_session_id, guest_session_id, match_number, status, settings, puzzle_id, puzzle_data, state_data'
      )
      .eq('id', roomId)
      .single()

    if (roomError) {
      logger.error('Online versus event room lookup failed', {
        roomId,
        player,
        type,
        sessionId: session.sessionId,
        error: roomError,
      })
      return NextResponse.json({ error: roomError.message }, { status: 500 })
    }

    if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })

    const assignments = getOnlineVersusRoleAssignments(
      room.state_data,
      room.host_session_id,
      room.guest_session_id
    )
    const expectedSession = player === 'x' ? assignments.xSessionId : assignments.oSessionId

    if (expectedSession !== session.sessionId) {
      return NextResponse.json({ error: 'Not authorized for that player slot.' }, { status: 403 })
    }

    if (matchNumber !== room.match_number) {
      return NextResponse.json(
        { error: 'This room has moved to a newer match.', code: 'stale_match' },
        { status: 409 }
      )
    }

    if (room.status === 'finished')
      return NextResponse.json({ error: 'Match is over.' }, { status: 409 })

    const { data: existingEventRows, error: existingEventsError } = await supabase
      .from('versus_events')
      .select('id, player, type, payload')
      .eq('room_id', roomId)
      .eq('match_number', room.match_number)
      .order('id', { ascending: true })

    if (existingEventsError) {
      logger.error('Online versus event history lookup failed', {
        roomId,
        player,
        type,
        sessionId: session.sessionId,
        error: existingEventsError,
      })
      return NextResponse.json({ error: existingEventsError.message }, { status: 500 })
    }

    const duplicateClientEventId = getClientEventId(payload)
    if (duplicateClientEventId) {
      const duplicateEvent = ((existingEventRows ?? []) as StoredOnlineVersusEvent[]).find(
        (event) =>
          event.player === player &&
          event.type === type &&
          getClientEventId(event.payload) === duplicateClientEventId
      )

      if (duplicateEvent) {
        return NextResponse.json({
          ok: true,
          duplicateEvent: true,
          type: duplicateEvent.type,
          payload: duplicateEvent.payload ?? {},
        })
      }
    }

    const validation = validateOnlineVersusEvent({
      roomStatus: room.status,
      puzzleId: room.puzzle_id,
      settings: room.settings,
      snapshot: room.state_data,
      player,
      type,
      payload: payload ?? {},
      existingEvents: (existingEventRows ?? []) as StoredOnlineVersusEvent[],
    })

    if (!validation.ok) {
      const snapshotSummary = isOnlineVersusSnapshot(room.state_data)
        ? {
            currentPlayer: room.state_data.currentPlayer,
            winner: room.state_data.winner,
            stealableCell: room.state_data.stealableCell,
            pendingFinalSteal: room.state_data.pendingFinalSteal,
            objectionsUsed: room.state_data.objectionsUsed,
          }
        : null
      logger.warn('Online versus event validation failed', {
        roomId,
        matchNumber,
        player,
        type,
        sessionId: session.sessionId,
        code: validation.code,
        error: validation.error,
        payload,
        snapshotSummary,
        recentEvents: ((existingEventRows ?? []) as StoredOnlineVersusEvent[])
          .slice(-5)
          .map((event) => ({
            id: event.id,
            player: event.player,
            type: event.type,
            payload: event.payload,
          })),
      })
      return NextResponse.json(
        { error: validation.error, code: validation.code },
        { status: validation.status }
      )
    }

    let authoritativePayload = validation.payload as Record<string, unknown>

    if (validation.type === 'claim') {
      const authoritativeEvent = await buildAuthoritativeClaimPayload({
        puzzle: (room.puzzle_data as Puzzle | null) ?? null,
        player,
        payload: validation.payload as ClaimPayload,
      })

      if (!authoritativeEvent.ok) {
        logger.warn('Online versus objection authoritative build failed', {
          roomId,
          matchNumber: room.match_number,
          player,
          sessionId: session.sessionId,
          code: authoritativeEvent.code,
          error: authoritativeEvent.error,
          payload: validation.payload,
        })
        return NextResponse.json(
          { error: authoritativeEvent.error, code: authoritativeEvent.code },
          { status: authoritativeEvent.status }
        )
      }

      authoritativePayload = authoritativeEvent.payload as Record<string, unknown>
    }

    if (validation.type === 'steal') {
      const authoritativeEvent = await buildAuthoritativeStealPayload({
        puzzle: (room.puzzle_data as Puzzle | null) ?? null,
        player,
        payload: validation.payload as StealPayload,
        state: validation.state,
        stealRule: room.settings.stealRule,
      })

      if (!authoritativeEvent.ok) {
        return NextResponse.json(
          { error: authoritativeEvent.error, code: authoritativeEvent.code },
          { status: authoritativeEvent.status }
        )
      }

      authoritativePayload = authoritativeEvent.payload as Record<string, unknown>
    }

    if (validation.type === 'objection') {
      logger.info('Online versus objection validated', {
        roomId,
        matchNumber: room.match_number,
        player,
        sessionId: session.sessionId,
        currentPlayer: validation.state.currentPlayer,
        winner: validation.state.winner,
        stealableCell: validation.state.stealableCell,
        pendingFinalSteal: validation.state.pendingFinalSteal,
        objectionsUsed: validation.state.objectionsUsed,
        payload: validation.payload,
      })

      const authoritativeEvent = await buildAuthoritativeObjectionPayload({
        puzzle: (room.puzzle_data as Puzzle | null) ?? null,
        player,
        payload: validation.payload as ObjectionPayload,
        state: validation.state,
        stealRule: room.settings.stealRule,
      })

      if (!authoritativeEvent.ok) {
        return NextResponse.json(
          { error: authoritativeEvent.error, code: authoritativeEvent.code },
          { status: authoritativeEvent.status }
        )
      }

      logger.info('Online versus objection authoritative payload', {
        roomId,
        matchNumber: room.match_number,
        player,
        sessionId: session.sessionId,
        payload: authoritativeEvent.payload,
      })

      authoritativePayload = authoritativeEvent.payload as Record<string, unknown>
    }

    const { error } = await supabase.from('versus_events').insert({
      room_id: roomId,
      match_number: room.match_number,
      player,
      type: validation.type,
      payload: authoritativePayload,
    })

    if (error) {
      logger.error('Online versus event insert failed', {
        roomId,
        player,
        type,
        sessionId: session.sessionId,
        payload,
        error,
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (validation.type === 'objection') {
      logger.info('Online versus objection inserted', {
        roomId,
        matchNumber: room.match_number,
        player,
        sessionId: session.sessionId,
        payload: authoritativePayload,
      })
    }

    return NextResponse.json({ ok: true, type: validation.type, payload: authoritativePayload })
  } catch (error) {
    logger.error('Online versus event route crashed', {
      sessionId: session.sessionId,
      error,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
