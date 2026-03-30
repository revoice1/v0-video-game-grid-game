import { useCallback, useState } from 'react'

type GameMode = 'daily' | 'practice' | 'versus'
const ACTIVE_MODE_KEY = 'gamegrid_active_mode'

function readInitialMode(): GameMode {
  if (typeof window === 'undefined') {
    return 'daily'
  }

  const savedMode = window.sessionStorage.getItem(ACTIVE_MODE_KEY)
  return savedMode === 'practice' || savedMode === 'versus' || savedMode === 'daily'
    ? savedMode
    : 'daily'
}

export function useGameModeState() {
  const [mode, setModeState] = useState<GameMode>(readInitialMode)
  const [loadedPuzzleMode, setLoadedPuzzleMode] = useState<GameMode | null>(null)

  const setMode = useCallback((nextMode: GameMode) => {
    setModeState(nextMode)

    if (typeof window === 'undefined') {
      return
    }

    window.sessionStorage.setItem(ACTIVE_MODE_KEY, nextMode)
  }, [])

  return {
    mode,
    setMode,
    loadedPuzzleMode,
    setLoadedPuzzleMode,
  }
}
