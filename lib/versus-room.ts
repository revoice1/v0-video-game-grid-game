import type { Puzzle } from './types'
import type { CellGuess } from './types'
import type {
  VersusCategoryFilters,
  VersusObjectionRule,
  VersusStealRule,
  VersusTurnTimerOption,
} from '@/components/game/versus-setup-modal'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RoomStatus = 'waiting' | 'active' | 'finished'
export type RoomPlayer = 'x' | 'o'
export type OnlineVersusEventSource = 'live' | 'history' | 'live-catchup'

export interface OnlineVersusRoleAssignments {
  xSessionId: string
  oSessionId: string | null
}

export interface OnlineVersusRoleAssignmentState {
  roleAssignments: OnlineVersusRoleAssignments
}

export interface RoomSettings {
  categoryFilters: VersusCategoryFilters
  stealRule: VersusStealRule
  timerOption: VersusTurnTimerOption
  disableDraws: boolean
  objectionRule: VersusObjectionRule
  minimumValidOptionsOverride?: number | null
}

export interface OnlineVersusSnapshot {
  puzzleId: string | null
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
  turnDeadlineAt: string | null
  turnDurationSeconds: number | null
  roleAssignments?: OnlineVersusRoleAssignments
}

/**
 * Safe client-side room shape — session IDs are intentionally omitted.
 * Role (x/o) is determined server-side at join/create time and returned
 * separately; the client never needs to inspect session membership directly.
 */
export interface VersusRoom {
  id: string
  code: string
  created_at: string
  expires_at: string
  match_number: number
  status: RoomStatus
  settings: RoomSettings
  puzzle_id: string | null
  puzzle_data: Puzzle | null
  state_data: OnlineVersusSnapshot | OnlineVersusRoleAssignmentState | null
}

export function isOnlineVersusSnapshot(
  state: VersusRoom['state_data']
): state is OnlineVersusSnapshot {
  return Boolean(
    state &&
    typeof state === 'object' &&
    'guesses' in state &&
    Array.isArray((state as { guesses?: unknown }).guesses)
  )
}

export function getOnlineVersusRoleAssignments(
  state: VersusRoom['state_data'],
  hostSessionId: string,
  guestSessionId: string | null
): OnlineVersusRoleAssignments {
  if (
    state &&
    typeof state === 'object' &&
    'roleAssignments' in state &&
    state.roleAssignments &&
    typeof state.roleAssignments === 'object' &&
    typeof state.roleAssignments.xSessionId === 'string' &&
    (typeof state.roleAssignments.oSessionId === 'string' ||
      state.roleAssignments.oSessionId === null)
  ) {
    return {
      xSessionId: state.roleAssignments.xSessionId,
      oSessionId: state.roleAssignments.oSessionId,
    }
  }

  return {
    xSessionId: hostSessionId,
    oSessionId: guestSessionId,
  }
}

/**
 * Events broadcast over Realtime. Mirrors VersusEventRecord from versus-events.ts
 * but scoped to the online room flow (includes ready/rematch lifecycle events).
 */
export type OnlineVersusEventType = 'claim' | 'miss' | 'objection' | 'steal' | 'ready' | 'rematch'

export interface OnlineVersusClaimPayload {
  cellIndex: number
  clientEventId?: string
  guess: CellGuess
}

export interface OnlineVersusMissPayload {
  cellIndex: number
  clientEventId?: string
  guessesRemaining: number
  resolutionKind: 'next-player' | 'defender-wins'
  nextPlayer?: RoomPlayer
  defender?: RoomPlayer
}

export interface OnlineVersusObjectionPayload {
  cellIndex: number
  clientEventId?: string
  verdict: 'sustained' | 'overruled'
  updatedGuess: CellGuess
  isSteal: boolean
  successful?: boolean
  guessesRemaining?: number
  resolutionKind?: 'next-player' | 'defender-wins'
  nextPlayer?: RoomPlayer
  defender?: RoomPlayer
  hadShowdownScores?: boolean
  attackingGameName?: string | null
  attackingScore?: number | null
  defendingGameName?: string | null
  defendingScore?: number | null
}

export interface OnlineVersusStealPayload {
  cellIndex: number
  attackingGuess: CellGuess
  clientEventId?: string
  successful: boolean
  resolutionKind?: 'next-player' | 'defender-wins'
  nextPlayer?: RoomPlayer
  defender?: RoomPlayer
  hadShowdownScores?: boolean
  attackingGameName?: string | null
  attackingScore?: number | null
  defendingGameName?: string | null
  defendingScore?: number | null
}

export interface OnlineVersusEvent {
  id: number
  room_id: string
  created_at: string
  match_number: number
  player: RoomPlayer
  type: OnlineVersusEventType
  payload: Record<string, unknown>
  source?: OnlineVersusEventSource
}
