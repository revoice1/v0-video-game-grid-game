import { useState } from 'react'

type GameMode = 'daily' | 'practice' | 'versus'

export function useGameModeState() {
  const [mode, setMode] = useState<GameMode>('daily')
  const [loadedPuzzleMode, setLoadedPuzzleMode] = useState<GameMode | null>(null)

  return {
    mode,
    setMode,
    loadedPuzzleMode,
    setLoadedPuzzleMode,
  }
}
