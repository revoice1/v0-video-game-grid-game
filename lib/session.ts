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
const CURRENT_SAVE_STATE_VERSION = 2
const VALID_VERSUS_STEAL_RULES = new Set([
  'off',
  'lower',
  'higher',
  'fewer_reviews',
  'more_reviews',
])
const VALID_VERSUS_TIMER_OPTIONS = new Set(['none', 20, 60, 120, 300])
const VALID_VERSUS_OBJECTION_RULES = new Set(['off', 'one', 'three'])

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
  stealRatingCount?: number | null
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
  version?: number
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
  practiceMinimumValidOptions?: number | null
  versusMinimumValidOptions?: number | null
  versusStealRule?: 'off' | 'lower' | 'higher' | 'fewer_reviews' | 'more_reviews'
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

function sanitizeIntegerOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null
  }
  return value
}

function sanitizeCategoryFilters(value: unknown): Record<string, string[]> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const sanitizedEntries = Object.entries(value).map(([key, rawValues]) => [
    key,
    Array.isArray(rawValues)
      ? rawValues.filter((entry): entry is string => typeof entry === 'string')
      : [],
  ])

  return Object.fromEntries(sanitizedEntries)
}

function isPuzzleSnapshotCompatible(value: unknown): value is Puzzle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const puzzle = value as Record<string, unknown>
  return (
    typeof puzzle.id === 'string' &&
    Array.isArray(puzzle.row_categories) &&
    puzzle.row_categories.length === 3 &&
    Array.isArray(puzzle.col_categories) &&
    puzzle.col_categories.length === 3
  )
}

function sanitizeSavedGameState(rawState: unknown): SavedGameState | null {
  if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
    return null
  }

  const state = rawState as Record<string, unknown>
  if (typeof state.puzzleId !== 'string' || !Array.isArray(state.guesses)) {
    return null
  }

  const sanitized: SavedGameState = {
    version: CURRENT_SAVE_STATE_VERSION,
    puzzleId: state.puzzleId,
    guesses: state.guesses
      .slice(0, 9)
      .map((guess) => (guess && typeof guess === 'object' ? guess : null)),
    guessesRemaining:
      typeof state.guessesRemaining === 'number' && Number.isFinite(state.guessesRemaining)
        ? state.guessesRemaining
        : 9,
    isComplete: Boolean(state.isComplete),
  }
  const isLegacyState =
    typeof state.version !== 'number' || state.version < CURRENT_SAVE_STATE_VERSION

  if (isPuzzleSnapshotCompatible(state.puzzle)) {
    sanitized.puzzle = state.puzzle
  } else if (isLegacyState && state.puzzle !== undefined) {
    sanitized.guesses = Array(9).fill(null)
    sanitized.guessesRemaining = 9
    sanitized.isComplete = false
  }

  if (typeof state.date === 'string') sanitized.date = state.date
  if (typeof state.selectedCell === 'number') sanitized.selectedCell = state.selectedCell
  if (typeof state.searchQuery === 'string' || state.searchQuery === null) {
    sanitized.searchQuery = state.searchQuery
  }
  if (state.currentPlayer === 'x' || state.currentPlayer === 'o') {
    sanitized.currentPlayer = state.currentPlayer
  }
  if (typeof state.stealableCell === 'number' || state.stealableCell === null) {
    sanitized.stealableCell = state.stealableCell
  }
  if (
    state.winner === 'x' ||
    state.winner === 'o' ||
    state.winner === 'draw' ||
    state.winner === null
  ) {
    sanitized.winner = state.winner
  }
  if (state.pendingFinalSteal && typeof state.pendingFinalSteal === 'object') {
    const pendingFinalSteal = state.pendingFinalSteal as Record<string, unknown>
    if (
      (pendingFinalSteal.defender === 'x' || pendingFinalSteal.defender === 'o') &&
      typeof pendingFinalSteal.cellIndex === 'number'
    ) {
      sanitized.pendingFinalSteal = {
        defender: pendingFinalSteal.defender,
        cellIndex: pendingFinalSteal.cellIndex,
      }
    }
  } else if (state.pendingFinalSteal === null) {
    sanitized.pendingFinalSteal = null
  }

  if ('versusCategoryFilters' in state) {
    sanitized.versusCategoryFilters = sanitizeCategoryFilters(state.versusCategoryFilters)
  }
  if ('practiceMinimumValidOptions' in state) {
    sanitized.practiceMinimumValidOptions = sanitizeIntegerOrNull(state.practiceMinimumValidOptions)
  }
  if ('versusMinimumValidOptions' in state) {
    sanitized.versusMinimumValidOptions = sanitizeIntegerOrNull(state.versusMinimumValidOptions)
  }
  if (
    typeof state.versusStealRule === 'string' &&
    VALID_VERSUS_STEAL_RULES.has(state.versusStealRule)
  ) {
    sanitized.versusStealRule = state.versusStealRule as SavedGameState['versusStealRule']
  }
  if (VALID_VERSUS_TIMER_OPTIONS.has(state.versusTimerOption as never)) {
    sanitized.versusTimerOption = state.versusTimerOption as SavedGameState['versusTimerOption']
  }
  if (typeof state.versusDisableDraws === 'boolean') {
    sanitized.versusDisableDraws = state.versusDisableDraws
  }
  if (
    typeof state.versusObjectionRule === 'string' &&
    VALID_VERSUS_OBJECTION_RULES.has(state.versusObjectionRule)
  ) {
    sanitized.versusObjectionRule =
      state.versusObjectionRule as SavedGameState['versusObjectionRule']
  }
  if (state.versusObjectionsUsed && typeof state.versusObjectionsUsed === 'object') {
    const objectionsUsed = state.versusObjectionsUsed as Record<string, unknown>
    sanitized.versusObjectionsUsed = {
      x: typeof objectionsUsed.x === 'number' ? objectionsUsed.x : 0,
      o: typeof objectionsUsed.o === 'number' ? objectionsUsed.o : 0,
    }
  }
  if (Array.isArray(state.versusEventLog)) {
    sanitized.versusEventLog = state.versusEventLog as VersusEventRecord[]
  }
  if (typeof state.turnTimeLeft === 'number' || state.turnTimeLeft === null) {
    sanitized.turnTimeLeft = state.turnTimeLeft
  }
  if (typeof state.turnDeadlineAt === 'string' || state.turnDeadlineAt === null) {
    sanitized.turnDeadlineAt = state.turnDeadlineAt
  }

  return sanitized
}

export function saveGameState(
  state: SavedGameState,
  mode: PersistedMode,
  dailyDate?: string
): void {
  if (typeof window === 'undefined') return

  const resolvedDailyDate = dailyDate ?? state.puzzle?.date ?? state.date ?? getUtcDateKey()
  const key = getStateKey(mode, resolvedDailyDate)
  const versionedState: SavedGameState = {
    ...state,
    version: CURRENT_SAVE_STATE_VERSION,
  }
  const saveState =
    mode === 'daily' ? { ...versionedState, date: resolvedDailyDate } : versionedState
  localStorage.setItem(key, JSON.stringify(saveState))
}

export function loadGameState(mode: PersistedMode, dailyDate?: string): SavedGameState | null {
  if (typeof window === 'undefined') return null

  const resolvedDailyDate = dailyDate ?? getUtcDateKey()
  const key = getStateKey(mode, resolvedDailyDate)
  const saved = localStorage.getItem(key)

  if (!saved) return null

  try {
    const state = sanitizeSavedGameState(JSON.parse(saved))
    if (!state) {
      localStorage.removeItem(key)
      return null
    }

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
