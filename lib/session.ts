import type { CellGuess, Puzzle } from './types'
import type { VersusEventRecord } from './versus-events'

// Session management for anonymous users
const SESSION_KEY = 'gamegrid_session_id'

function createSessionId(): string {
  if (typeof window === 'undefined') {
    return ''
  }

  const cryptoApi = window.crypto

  if (typeof cryptoApi !== 'undefined' && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }

  if (typeof cryptoApi !== 'undefined' && typeof cryptoApi.getRandomValues === 'function') {
    const randomBytes = cryptoApi.getRandomValues(new Uint8Array(8))
    const randomSuffix = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join(
      ''
    )
    return `gg-${Date.now().toString(36)}-${randomSuffix}`
  }

  return `gg-${Date.now().toString(36)}-fallback`
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return ''

  let sessionId = localStorage.getItem(SESSION_KEY)

  if (!sessionId) {
    sessionId = createSessionId()
    localStorage.setItem(SESSION_KEY, sessionId)
  }

  return sessionId
}

// Game state persistence
const DAILY_STATE_KEY = 'gamegrid_daily_state'
const PRACTICE_STATE_KEY = 'gamegrid_practice_state'
const VERSUS_STATE_KEY = 'gamegrid_versus_state'

function getUtcDateKey(): string {
  return new Date().toISOString().split('T')[0]
}

export type PersistedMode = 'daily' | 'practice' | 'versus'

export interface CellGuessRecord {
  gameId: number
  gameName: string
  gameImage: string | null
  isCorrect: boolean
  owner?: 'x' | 'o'
  gameSlug?: string | null
  gameUrl?: string | null
  released?: string | null
  metacritic?: number | null
  stealRating?: number | null
  genres?: string[]
  platforms?: string[]
  developers?: string[]
  publishers?: string[]
  tags?: string[]
  gameModes?: string[]
  themes?: string[]
  perspectives?: string[]
  companies?: string[]
  matchedRow?: boolean
  matchedCol?: boolean
  objectionUsed?: boolean
  objectionVerdict?: 'sustained' | 'overruled' | null
  objectionExplanation?: string | null
  objectionOriginalMatchedRow?: boolean | null
  objectionOriginalMatchedCol?: boolean | null
  showdownScoreRevealed?: boolean
}

export interface SavedGameState {
  puzzleId: string
  puzzle?: Puzzle
  guesses: (CellGuess | CellGuessRecord | null)[]
  guessesRemaining: number
  isComplete: boolean
  selectedCell?: number | null
  searchQuery?: string | null
  date?: string
  currentPlayer?: 'x' | 'o'
  stealableCell?: number | null
  winner?: 'x' | 'o' | 'draw' | null
  pendingFinalSteal?: {
    defender: 'x' | 'o'
    cellIndex: number
  } | null
  versusCategoryFilters?: Record<string, string[]>
  versusStealRule?: 'off' | 'lower' | 'higher'
  versusTimerOption?: 'none' | 20 | 60 | 120 | 300
  versusDisableDraws?: boolean
  versusObjectionRule?: 'off' | 'one' | 'three'
  versusObjectionsUsed?: {
    x?: number
    o?: number
  }
  versusEventLog?: VersusEventRecord[]
  turnTimeLeft?: number | null
  turnDeadlineAt?: string | null
}

function getStateKey(mode: PersistedMode, dailyDate?: string): string {
  if (mode === 'daily') {
    return `${DAILY_STATE_KEY}:${dailyDate ?? getUtcDateKey()}`
  }
  if (mode === 'practice') return PRACTICE_STATE_KEY
  return VERSUS_STATE_KEY
}

export function saveGameState(
  state: SavedGameState,
  mode: PersistedMode,
  dailyDate?: string
): void {
  if (typeof window === 'undefined') return

  const resolvedDailyDate = dailyDate ?? state.puzzle?.date ?? state.date ?? getUtcDateKey()
  const key = getStateKey(mode, resolvedDailyDate)
  const saveState = mode === 'daily' ? { ...state, date: resolvedDailyDate } : state
  localStorage.setItem(key, JSON.stringify(saveState))
}

export function loadGameState(mode: PersistedMode, dailyDate?: string): SavedGameState | null {
  if (typeof window === 'undefined') return null

  const resolvedDailyDate = dailyDate ?? getUtcDateKey()
  const key = getStateKey(mode, resolvedDailyDate)
  const saved = localStorage.getItem(key)

  if (!saved) return null

  try {
    const state = JSON.parse(saved) as SavedGameState

    if (mode === 'daily' && state.date !== resolvedDailyDate) {
      localStorage.removeItem(key)
      return null
    }

    return state
  } catch {
    return null
  }
}

export function clearGameState(mode: PersistedMode, dailyDate?: string): void {
  if (typeof window === 'undefined') return
  const key = getStateKey(mode, dailyDate)
  localStorage.removeItem(key)
}
