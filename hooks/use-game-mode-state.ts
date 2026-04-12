import { useCallback, useEffect, useState } from 'react'

type GameMode = 'daily' | 'practice' | 'versus'
const ACTIVE_MODE_KEY = 'gamegrid_active_mode'

function readStoredMode(): GameMode {
  const savedMode = window.sessionStorage.getItem(ACTIVE_MODE_KEY)
  return savedMode === 'practice' || savedMode === 'versus' || savedMode === 'daily'
    ? savedMode
    : 'daily'
}

export function useGameModeState() {
  // Always start with 'daily' to match SSR output, then sync from sessionStorage
  // after hydration to avoid server/client mismatch.
  const [mode, setModeState] = useState<GameMode>('daily')
  const [loadedPuzzleMode, setLoadedPuzzleMode] = useState<GameMode | null>(null)

  useEffect(() => {
    setModeState(readStoredMode())
  }, [])

  const setMode = useCallback((nextMode: GameMode) => {
    setModeState(nextMode)
    window.sessionStorage.setItem(ACTIVE_MODE_KEY, nextMode)
  }, [])

  return {
    mode,
    setMode,
    loadedPuzzleMode,
    setLoadedPuzzleMode,
  }
}
