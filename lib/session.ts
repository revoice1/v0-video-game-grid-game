import type { Puzzle } from './types'

// Session management for anonymous users
const SESSION_KEY = 'gamegrid_session_id'

export function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  
  let sessionId = localStorage.getItem(SESSION_KEY)
  
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, sessionId)
  }
  
  return sessionId
}

// Game state persistence
const DAILY_STATE_KEY = 'gamegrid_daily_state'
const PRACTICE_STATE_KEY = 'gamegrid_practice_state'

function getUtcDateKey(): string {
  return new Date().toISOString().split('T')[0]
}

export interface CellGuessRecord {
  gameId: number
  gameName: string
  gameImage: string | null
  isCorrect: boolean
}

interface SavedGameState {
  puzzleId: string
  puzzle?: Puzzle
  guesses: (CellGuessRecord | null)[]
  guessesRemaining: number
  isComplete: boolean
  date?: string
}

export function saveGameState(state: SavedGameState, isDaily: boolean): void {
  if (typeof window === 'undefined') return
  
  const key = isDaily ? DAILY_STATE_KEY : PRACTICE_STATE_KEY
  const saveState = isDaily ? { ...state, date: getUtcDateKey() } : state
  localStorage.setItem(key, JSON.stringify(saveState))
}

export function loadGameState(isDaily: boolean): SavedGameState | null {
  if (typeof window === 'undefined') return null
  
  const key = isDaily ? DAILY_STATE_KEY : PRACTICE_STATE_KEY
  const saved = localStorage.getItem(key)
  
  if (!saved) return null
  
  try {
    const state = JSON.parse(saved) as SavedGameState
    
    // For daily, align the saved-state key with the server's UTC rollover.
    if (isDaily && state.date !== getUtcDateKey()) {
      localStorage.removeItem(key)
      return null
    }
    
    return state
  } catch {
    return null
  }
}

export function clearGameState(isDaily: boolean): void {
  if (typeof window === 'undefined') return
  const key = isDaily ? DAILY_STATE_KEY : PRACTICE_STATE_KEY
  localStorage.removeItem(key)
}
