import { z } from 'zod'
import {
  getNextPlayer,
  getVersusPlacementResolution,
} from '@/components/game/game-client-versus-helpers'
import type { CellGuess } from './types'
import type {
  OnlineVersusEventType,
  OnlineVersusSnapshot,
  RoomPlayer,
  RoomSettings,
} from './versus-room'

type SupportedGameplayEventType = 'claim' | 'miss' | 'objection' | 'steal'

export interface StoredOnlineVersusEvent {
  id: number
  player: RoomPlayer
  type: OnlineVersusEventType
  payload: Record<string, unknown> | null
}

export interface ValidatedOnlineVersusRuntimeState {
  guesses: (CellGuess | null)[]
  guessesRemaining: number
  currentPlayer: RoomPlayer
  winner: RoomPlayer | 'draw' | null
  stealableCell: number | null
  pendingFinalSteal: {
    defender: RoomPlayer
    cellIndex: number
  } | null
  objectionsUsed: {
    x: number
    o: number
  }
}

type RuntimeState = ValidatedOnlineVersusRuntimeState

interface ValidationFailure {
  code:
    | 'room_inactive'
    | 'match_finished'
    | 'puzzle_not_ready'
    | 'unsupported_event_type'
    | 'invalid_event_payload'
    | 'wrong_turn'
    | 'cell_unavailable'
    | 'duplicate_game'
    | 'steal_not_available'
    | 'objections_unavailable'
    | 'objection_limit_reached'
    | 'state_mismatch'
  error: string
  status: number
}

export interface ValidationSuccess {
  ok: true
  type: SupportedGameplayEventType
  payload: ClaimPayload | MissPayload | ObjectionPayload | StealPayload
  state: ValidatedOnlineVersusRuntimeState
}

export interface ValidationError extends ValidationFailure {
  ok: false
}

export type OnlineVersusEventValidationResult = ValidationSuccess | ValidationError

export interface ValidateOnlineVersusEventOptions {
  roomStatus: 'waiting' | 'active' | 'finished'
  puzzleId: string | null
  settings: RoomSettings
  snapshot: OnlineVersusSnapshot | null
  player: RoomPlayer
  type: string
  payload: unknown
  existingEvents: StoredOnlineVersusEvent[]
}

const LooseCellGuessSchema = z
  .object({
    gameId: z.number(),
    gameName: z.string(),
    gameImage: z.string().nullable().optional(),
    isCorrect: z.boolean().optional(),
    owner: z.enum(['x', 'o']).optional(),
  })
  .passthrough()

const ClaimPayloadSchema = z.object({
  cellIndex: z.number().int().min(0).max(8),
  clientEventId: z.string().trim().min(1).max(100).optional(),
  guess: LooseCellGuessSchema,
})

const MissPayloadSchema = z.object({
  cellIndex: z.number().int().min(0).max(8),
  clientEventId: z.string().trim().min(1).max(100).optional(),
  guessesRemaining: z.number().int().min(0).max(9).optional(),
  resolutionKind: z.enum(['next-player', 'defender-wins']),
  nextPlayer: z.enum(['x', 'o']).optional(),
  defender: z.enum(['x', 'o']).optional(),
})

const ObjectionPayloadSchema = z.object({
  cellIndex: z.number().int().min(0).max(8),
  clientEventId: z.string().trim().min(1).max(100).optional(),
  verdict: z.enum(['sustained', 'overruled']),
  updatedGuess: LooseCellGuessSchema,
  isSteal: z.boolean(),
  successful: z.boolean().optional(),
  guessesRemaining: z.number().int().min(0).max(9).optional(),
  resolutionKind: z.enum(['next-player', 'defender-wins']).optional(),
  nextPlayer: z.enum(['x', 'o']).optional(),
  defender: z.enum(['x', 'o']).optional(),
  hadShowdownScores: z.boolean().optional(),
  attackingGameName: z.string().nullable().optional(),
  attackingScore: z.number().nullable().optional(),
  defendingGameName: z.string().nullable().optional(),
  defendingScore: z.number().nullable().optional(),
})

const StealPayloadSchema = z.object({
  cellIndex: z.number().int().min(0).max(8),
  attackingGuess: LooseCellGuessSchema,
  clientEventId: z.string().trim().min(1).max(100).optional(),
  successful: z.boolean(),
  resolutionKind: z.enum(['next-player', 'defender-wins']).optional(),
  nextPlayer: z.enum(['x', 'o']).optional(),
  defender: z.enum(['x', 'o']).optional(),
  hadShowdownScores: z.boolean().optional(),
  attackingGameName: z.string().nullable().optional(),
  attackingScore: z.number().nullable().optional(),
  defendingGameName: z.string().nullable().optional(),
  defendingScore: z.number().nullable().optional(),
})

const SnapshotSchema = z.object({
  guesses: z
    .array(LooseCellGuessSchema.nullable())
    .length(9)
    .transform((guesses) => guesses as (CellGuess | null)[]),
  guessesRemaining: z.number().int().min(0).max(9),
  currentPlayer: z.enum(['x', 'o']),
  winner: z.enum(['x', 'o', 'draw']).nullable(),
  stealableCell: z.number().int().min(0).max(8).nullable(),
  pendingFinalSteal: z
    .object({
      defender: z.enum(['x', 'o']),
      cellIndex: z.number().int().min(0).max(8),
    })
    .nullable(),
  objectionsUsed: z.object({
    x: z.number().int().min(0),
    o: z.number().int().min(0),
  }),
})

export type ClaimPayload = z.infer<typeof ClaimPayloadSchema>
export type MissPayload = z.infer<typeof MissPayloadSchema>
export type ObjectionPayload = z.infer<typeof ObjectionPayloadSchema>
export type StealPayload = z.infer<typeof StealPayloadSchema>
type ParsedIncomingEvent =
  | {
      type: 'claim'
      parsed: z.SafeParseReturnType<unknown, ClaimPayload>
    }
  | {
      type: 'miss'
      parsed: z.SafeParseReturnType<unknown, MissPayload>
    }
  | {
      type: 'objection'
      parsed: z.SafeParseReturnType<unknown, ObjectionPayload>
    }
  | {
      type: 'steal'
      parsed: z.SafeParseReturnType<unknown, StealPayload>
    }

function reject(failure: ValidationFailure): ValidationError {
  return {
    ok: false,
    ...failure,
  }
}

function getObjectionLimit(rule: RoomSettings['objectionRule']): number {
  if (rule === 'one') {
    return 1
  }
  if (rule === 'three') {
    return 3
  }
  return 0
}

function createInitialRuntimeState(): RuntimeState {
  return {
    guesses: Array.from({ length: 9 }, () => null),
    guessesRemaining: 9,
    currentPlayer: 'x',
    winner: null,
    stealableCell: null,
    pendingFinalSteal: null,
    objectionsUsed: { x: 0, o: 0 },
  }
}

function normalizeSnapshot(snapshot: OnlineVersusSnapshot | null): RuntimeState | null {
  if (!snapshot) {
    return null
  }

  const parsed = SnapshotSchema.safeParse(snapshot)
  if (!parsed.success) {
    return null
  }

  return {
    guesses: parsed.data.guesses,
    guessesRemaining: parsed.data.guessesRemaining,
    currentPlayer: parsed.data.currentPlayer,
    winner: parsed.data.winner,
    stealableCell: parsed.data.stealableCell,
    pendingFinalSteal: parsed.data.pendingFinalSteal,
    objectionsUsed: parsed.data.objectionsUsed,
  }
}

function applyPlacementResolution(options: {
  state: RuntimeState
  nextGuesses: (CellGuess | null)[]
  player: RoomPlayer
  cellIndex: number
  settings: RoomSettings
  isVersusSteal: boolean
}): RuntimeState {
  const { state, nextGuesses, player, cellIndex, settings, isVersusSteal } = options
  const stealsEnabled = settings.stealRule !== 'off'
  const placementResolution = getVersusPlacementResolution({
    newGuesses: nextGuesses,
    currentPlayer: player,
    selectedCell: cellIndex,
    isVersusSteal,
    stealsEnabled,
    disableDraws: settings.disableDraws,
  })

  if (placementResolution.kind === 'final-steal') {
    return {
      ...state,
      guesses: nextGuesses,
      currentPlayer: placementResolution.nextPlayer,
      winner: null,
      stealableCell: stealsEnabled ? cellIndex : null,
      pendingFinalSteal: {
        defender: placementResolution.defender,
        cellIndex: placementResolution.cellIndex,
      },
    }
  }

  if (placementResolution.kind === 'winner') {
    return {
      ...state,
      guesses: nextGuesses,
      winner: placementResolution.winner,
      stealableCell: null,
      pendingFinalSteal: null,
    }
  }

  if (placementResolution.kind === 'claims-win') {
    return {
      ...state,
      guesses: nextGuesses,
      winner: placementResolution.winner,
      stealableCell: null,
      pendingFinalSteal: null,
    }
  }

  if (placementResolution.kind === 'draw') {
    return {
      ...state,
      guesses: nextGuesses,
      winner: 'draw',
      stealableCell: null,
      pendingFinalSteal: null,
    }
  }

  return {
    ...state,
    guesses: nextGuesses,
    currentPlayer: placementResolution.nextPlayer,
    winner: null,
    stealableCell: stealsEnabled ? cellIndex : null,
    pendingFinalSteal: null,
  }
}

function applyStoredEvent(
  state: RuntimeState,
  event: StoredOnlineVersusEvent,
  settings: RoomSettings
): RuntimeState {
  if (event.type === 'claim') {
    const parsed = ClaimPayloadSchema.safeParse(event.payload ?? {})
    if (!parsed.success) {
      return state
    }

    const placedGuess = {
      ...parsed.data.guess,
      owner: event.player,
    } as CellGuess
    const nextGuesses = state.guesses.map((guess, index) =>
      index === parsed.data.cellIndex ? placedGuess : guess
    )
    return applyPlacementResolution({
      state,
      nextGuesses,
      player: event.player,
      cellIndex: parsed.data.cellIndex,
      settings,
      isVersusSteal: false,
    })
  }

  if (event.type === 'miss') {
    const parsed = MissPayloadSchema.safeParse(event.payload ?? {})
    if (!parsed.success) {
      return state
    }

    return {
      ...state,
      guessesRemaining: parsed.data.guessesRemaining ?? Math.max(0, state.guessesRemaining - 1),
      currentPlayer:
        parsed.data.resolutionKind === 'next-player'
          ? (parsed.data.nextPlayer ?? state.currentPlayer)
          : state.currentPlayer,
      winner:
        parsed.data.resolutionKind === 'defender-wins'
          ? (parsed.data.defender ?? state.winner)
          : state.winner,
      stealableCell: null,
      pendingFinalSteal: null,
    }
  }

  if (event.type === 'objection') {
    const parsed = ObjectionPayloadSchema.safeParse(event.payload ?? {})
    if (!parsed.success) {
      return state
    }

    const nextState = {
      ...state,
      objectionsUsed: {
        ...state.objectionsUsed,
        [event.player]: state.objectionsUsed[event.player] + 1,
      },
    }

    if (parsed.data.verdict === 'overruled') {
      return {
        ...nextState,
        guessesRemaining: parsed.data.guessesRemaining ?? Math.max(0, state.guessesRemaining - 1),
        currentPlayer:
          parsed.data.resolutionKind === 'next-player'
            ? (parsed.data.nextPlayer ?? state.currentPlayer)
            : state.currentPlayer,
        winner:
          parsed.data.resolutionKind === 'defender-wins'
            ? (parsed.data.defender ?? state.winner)
            : state.winner,
        stealableCell: null,
        pendingFinalSteal: null,
      }
    }

    const updatedGuess = {
      ...parsed.data.updatedGuess,
      owner: event.player,
    } as CellGuess

    if (parsed.data.isSteal && parsed.data.successful === false) {
      return {
        ...nextState,
        currentPlayer:
          parsed.data.resolutionKind === 'next-player'
            ? (parsed.data.nextPlayer ?? state.currentPlayer)
            : state.currentPlayer,
        winner:
          parsed.data.resolutionKind === 'defender-wins'
            ? (parsed.data.defender ?? state.winner)
            : state.winner,
        stealableCell: null,
        pendingFinalSteal: null,
      }
    }

    const nextGuesses = state.guesses.map((guess, index) =>
      index === parsed.data.cellIndex ? updatedGuess : guess
    )

    return applyPlacementResolution({
      state: nextState,
      nextGuesses,
      player: event.player,
      cellIndex: parsed.data.cellIndex,
      settings,
      isVersusSteal: parsed.data.isSteal,
    })
  }

  if (event.type === 'steal') {
    const parsed = StealPayloadSchema.safeParse(event.payload ?? {})
    if (!parsed.success) {
      return state
    }

    if (!parsed.data.successful) {
      return {
        ...state,
        currentPlayer:
          parsed.data.resolutionKind === 'next-player'
            ? (parsed.data.nextPlayer ?? state.currentPlayer)
            : state.currentPlayer,
        winner:
          parsed.data.resolutionKind === 'defender-wins'
            ? (parsed.data.defender ?? state.winner)
            : state.winner,
        stealableCell: null,
        pendingFinalSteal: null,
      }
    }

    const attackingGuess = {
      ...parsed.data.attackingGuess,
      owner: event.player,
    } as CellGuess
    const nextGuesses = state.guesses.map((guess, index) =>
      index === parsed.data.cellIndex ? attackingGuess : guess
    )

    return applyPlacementResolution({
      state: {
        ...state,
        pendingFinalSteal: null,
        stealableCell: null,
      },
      nextGuesses,
      player: event.player,
      cellIndex: parsed.data.cellIndex,
      settings,
      isVersusSteal: true,
    })
  }

  return state
}

function buildRuntimeStateFromEvents(
  settings: RoomSettings,
  events: StoredOnlineVersusEvent[]
): RuntimeState {
  return [...events]
    .sort((left, right) => left.id - right.id)
    .reduce((state, event) => applyStoredEvent(state, event, settings), createInitialRuntimeState())
}

function parseIncomingEvent(type: string, payload: unknown): ParsedIncomingEvent | null {
  if (type === 'claim') {
    return {
      type,
      parsed: ClaimPayloadSchema.safeParse(payload ?? {}),
    }
  }

  if (type === 'miss') {
    return {
      type,
      parsed: MissPayloadSchema.safeParse(payload ?? {}),
    }
  }

  if (type === 'objection') {
    return {
      type,
      parsed: ObjectionPayloadSchema.safeParse(payload ?? {}),
    }
  }

  if (type === 'steal') {
    return {
      type,
      parsed: StealPayloadSchema.safeParse(payload ?? {}),
    }
  }

  return null
}

function validateMissLikeResolution(
  state: RuntimeState,
  player: RoomPlayer,
  payload: MissPayload | ObjectionPayload
): ValidationFailure | null {
  const expectedGuessesRemaining = Math.max(0, state.guessesRemaining - 1)

  if (
    payload.guessesRemaining !== undefined &&
    payload.guessesRemaining !== expectedGuessesRemaining
  ) {
    return {
      code: 'state_mismatch',
      error: 'The miss payload does not match the current guess count.',
      status: 409,
    }
  }

  if (payload.resolutionKind === 'next-player') {
    if (payload.nextPlayer !== getNextPlayer(player)) {
      return {
        code: 'state_mismatch',
        error: 'The miss payload does not match the expected next player.',
        status: 409,
      }
    }
    return null
  }

  if (payload.resolutionKind === 'defender-wins') {
    if (!state.pendingFinalSteal || payload.defender !== state.pendingFinalSteal.defender) {
      return {
        code: 'state_mismatch',
        error: 'The miss payload does not match the active final steal.',
        status: 409,
      }
    }
  }

  return null
}

function validateClaimAgainstState(
  state: RuntimeState,
  player: RoomPlayer,
  payload: ClaimPayload
): ValidationFailure | null {
  if (state.currentPlayer !== player) {
    return {
      code: 'wrong_turn',
      error: 'It is not your turn.',
      status: 409,
    }
  }

  if (state.pendingFinalSteal) {
    return {
      code: 'state_mismatch',
      error: 'Only the active final steal cell can be played right now.',
      status: 409,
    }
  }

  if (state.guesses[payload.cellIndex] !== null) {
    return {
      code: 'cell_unavailable',
      error: 'That cell is already occupied.',
      status: 409,
    }
  }

  if (state.guesses.some((guess) => guess?.gameId === payload.guess.gameId)) {
    return {
      code: 'duplicate_game',
      error: 'That game has already been used on this board.',
      status: 409,
    }
  }

  if (payload.guess.owner && payload.guess.owner !== player) {
    return {
      code: 'invalid_event_payload',
      error: 'The claim payload owner does not match the acting player.',
      status: 400,
    }
  }

  return null
}

function validateStealAgainstState(
  state: RuntimeState,
  player: RoomPlayer,
  payload: StealPayload
): ValidationFailure | null {
  if (state.currentPlayer !== player) {
    return {
      code: 'wrong_turn',
      error: 'It is not your turn.',
      status: 409,
    }
  }

  const availableStealCell = state.stealableCell ?? state.pendingFinalSteal?.cellIndex ?? null
  if (availableStealCell !== payload.cellIndex) {
    return {
      code: 'steal_not_available',
      error: 'A steal is not available on that cell.',
      status: 409,
    }
  }

  const defendingGuess = state.guesses[payload.cellIndex]
  if (!defendingGuess || defendingGuess.owner === player) {
    return {
      code: 'steal_not_available',
      error: 'There is no opponent claim to steal from on that cell.',
      status: 409,
    }
  }

  if (
    state.guesses.some(
      (guess, index) =>
        index !== payload.cellIndex && guess?.gameId === payload.attackingGuess.gameId
    )
  ) {
    return {
      code: 'duplicate_game',
      error: 'That game has already been used on this board.',
      status: 409,
    }
  }

  if (payload.attackingGuess.owner && payload.attackingGuess.owner !== player) {
    return {
      code: 'invalid_event_payload',
      error: 'The steal payload owner does not match the acting player.',
      status: 400,
    }
  }

  if (!payload.successful) {
    if (!payload.resolutionKind) {
      return {
        code: 'invalid_event_payload',
        error: 'Failed steals must include a resolution kind.',
        status: 400,
      }
    }

    return validateMissLikeResolution(state, player, {
      cellIndex: payload.cellIndex,
      guessesRemaining: undefined,
      resolutionKind: payload.resolutionKind,
      nextPlayer: payload.nextPlayer,
      defender: payload.defender,
    })
  }

  return null
}

function validateMissAgainstState(
  state: RuntimeState,
  player: RoomPlayer,
  payload: MissPayload
): ValidationFailure | null {
  if (state.currentPlayer !== player) {
    return {
      code: 'wrong_turn',
      error: 'It is not your turn.',
      status: 409,
    }
  }

  if (state.pendingFinalSteal && state.pendingFinalSteal.cellIndex !== payload.cellIndex) {
    return {
      code: 'state_mismatch',
      error: 'Only the active final steal cell can resolve right now.',
      status: 409,
    }
  }

  return validateMissLikeResolution(state, player, payload)
}

function validateObjectionAgainstState(
  state: RuntimeState,
  settings: RoomSettings,
  player: RoomPlayer,
  payload: ObjectionPayload
): ValidationFailure | null {
  if (state.currentPlayer !== player) {
    return {
      code: 'wrong_turn',
      error: 'It is not your turn.',
      status: 409,
    }
  }

  const objectionLimit = getObjectionLimit(settings.objectionRule)
  if (objectionLimit === 0) {
    return {
      code: 'objections_unavailable',
      error: 'Objections are disabled for this match.',
      status: 409,
    }
  }

  if (state.objectionsUsed[player] >= objectionLimit) {
    return {
      code: 'objection_limit_reached',
      error: 'You have already used all objections for this match.',
      status: 409,
    }
  }

  if (payload.updatedGuess.owner && payload.updatedGuess.owner !== player) {
    return {
      code: 'invalid_event_payload',
      error: 'The objection payload owner does not match the acting player.',
      status: 400,
    }
  }

  if (payload.isSteal) {
    const availableStealCell = state.stealableCell ?? state.pendingFinalSteal?.cellIndex ?? null
    if (availableStealCell !== payload.cellIndex) {
      return {
        code: 'steal_not_available',
        error: 'A steal objection is only allowed on the currently stealable cell.',
        status: 409,
      }
    }

    const defendingGuess = state.guesses[payload.cellIndex]
    if (!defendingGuess || defendingGuess.owner === player) {
      return {
        code: 'steal_not_available',
        error: 'There is no opponent claim to review on that cell.',
        status: 409,
      }
    }
  } else if (state.guesses[payload.cellIndex] !== null) {
    return {
      code: 'cell_unavailable',
      error: 'That cell is already occupied.',
      status: 409,
    }
  }

  if (
    payload.verdict === 'sustained' &&
    state.guesses.some(
      (guess, index) => index !== payload.cellIndex && guess?.gameId === payload.updatedGuess.gameId
    )
  ) {
    return {
      code: 'duplicate_game',
      error: 'That game has already been used on this board.',
      status: 409,
    }
  }

  if (payload.verdict === 'overruled') {
    if (!payload.resolutionKind) {
      return {
        code: 'invalid_event_payload',
        error: 'Overruled objections must include a resolution kind.',
        status: 400,
      }
    }

    return validateMissLikeResolution(state, player, payload)
  }

  return null
}

function buildCandidateStates(options: ValidateOnlineVersusEventOptions): RuntimeState[] {
  const snapshotState = normalizeSnapshot(options.snapshot)
  const eventReplayState =
    options.existingEvents.length > 0
      ? buildRuntimeStateFromEvents(options.settings, options.existingEvents)
      : null

  const candidates = [snapshotState, eventReplayState].filter(
    (candidate): candidate is RuntimeState => candidate !== null
  )

  if (candidates.length === 0) {
    candidates.push(createInitialRuntimeState())
  }

  return candidates
}

function validateCandidates<T extends ClaimPayload | MissPayload | ObjectionPayload | StealPayload>(
  candidates: RuntimeState[],
  type: SupportedGameplayEventType,
  payload: T,
  validator: (state: RuntimeState) => ValidationFailure | null
): OnlineVersusEventValidationResult {
  const failures: ValidationFailure[] = []

  for (const candidateState of candidates) {
    if (candidateState.winner !== null) {
      failures.push({
        code: 'match_finished',
        error: 'The match is already over.',
        status: 409,
      })
      continue
    }

    const failure = validator(candidateState)

    if (!failure) {
      return {
        ok: true,
        type,
        payload,
        state: candidateState,
      }
    }

    failures.push(failure)
  }

  return reject(
    failures[0] ?? {
      code: 'state_mismatch',
      error: 'The event does not match the current room state.',
      status: 409,
    }
  )
}

export function validateOnlineVersusEvent(
  options: ValidateOnlineVersusEventOptions
): OnlineVersusEventValidationResult {
  if (options.roomStatus === 'finished') {
    return reject({
      code: 'match_finished',
      error: 'Match is over.',
      status: 409,
    })
  }

  if (options.roomStatus !== 'active') {
    return reject({
      code: 'room_inactive',
      error: 'Room is not active.',
      status: 409,
    })
  }

  if (!options.puzzleId) {
    return reject({
      code: 'puzzle_not_ready',
      error: 'The match puzzle is not ready yet.',
      status: 409,
    })
  }

  const parsedIncoming = parseIncomingEvent(options.type, options.payload)
  if (!parsedIncoming) {
    return reject({
      code: 'unsupported_event_type',
      error: 'Unsupported online versus event type.',
      status: 400,
    })
  }

  if (!parsedIncoming.parsed.success) {
    return reject({
      code: 'invalid_event_payload',
      error: 'Invalid online versus event payload.',
      status: 400,
    })
  }

  const candidateStates = buildCandidateStates(options)

  if (parsedIncoming.type === 'claim') {
    const payload = parsedIncoming.parsed.data
    return validateCandidates(candidateStates, 'claim', payload, (state) =>
      validateClaimAgainstState(state, options.player, payload)
    )
  }

  if (parsedIncoming.type === 'miss') {
    const payload = parsedIncoming.parsed.data
    return validateCandidates(candidateStates, 'miss', payload, (state) =>
      validateMissAgainstState(state, options.player, payload)
    )
  }

  if (parsedIncoming.type === 'objection') {
    const payload = parsedIncoming.parsed.data
    return validateCandidates(candidateStates, 'objection', payload, (state) =>
      validateObjectionAgainstState(state, options.settings, options.player, payload)
    )
  }

  const payload = parsedIncoming.parsed.data
  return validateCandidates(candidateStates, 'steal', payload, (state) =>
    validateStealAgainstState(state, options.player, payload)
  )
}
