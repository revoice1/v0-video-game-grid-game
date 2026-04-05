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
  status: RoomStatus
  settings: RoomSettings
  puzzle_id: string | null
  puzzle_data: Puzzle | null
  state_data: OnlineVersusSnapshot | null
}

/**
 * Events broadcast over Realtime. Mirrors VersusEventRecord from versus-events.ts
 * but scoped to the online room flow (includes ready/rematch lifecycle events).
 */
export type OnlineVersusEventType = 'claim' | 'miss' | 'objection' | 'steal' | 'ready' | 'rematch'

export interface OnlineVersusClaimPayload {
  cellIndex: number
  guess: CellGuess
}

export interface OnlineVersusMissPayload {
  cellIndex: number
  guessesRemaining: number
  resolutionKind: 'next-player' | 'defender-wins'
  nextPlayer?: RoomPlayer
  defender?: RoomPlayer
}

export interface OnlineVersusObjectionPayload {
  cellIndex: number
  verdict: 'sustained' | 'overruled'
  updatedGuess: CellGuess
  isSteal: boolean
  guessesRemaining?: number
  resolutionKind?: 'next-player' | 'defender-wins'
  nextPlayer?: RoomPlayer
  defender?: RoomPlayer
}

export interface OnlineVersusStealPayload {
  cellIndex: number
  attackingGuess: CellGuess
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
  player: RoomPlayer
  type: OnlineVersusEventType
  payload: Record<string, unknown>
}
