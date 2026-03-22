import { useState } from 'react'

export function useOverlayState() {
  const [showResults, setShowResults] = useState(false)
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const [showAchievements, setShowAchievements] = useState(false)
  const [detailCell, setDetailCell] = useState<number | null>(null)

  return {
    showResults,
    setShowResults,
    showHowToPlay,
    setShowHowToPlay,
    showAchievements,
    setShowAchievements,
    detailCell,
    setDetailCell,
  }
}
