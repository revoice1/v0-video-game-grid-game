import { useEffect } from 'react'

declare global {
  interface Window {
    __gameGridDev?: {
      triggerEasterEgg: (gameId: number) => boolean
      triggerPerfectCelebration: () => void
      triggerStealShowdown: (options?: {
        successful?: boolean
        attackerScore?: number
        defenderScore?: number
      }) => void
      triggerStealMiss: () => void
    }
  }
}

interface UseGameGridDevToolsOptions {
  triggerEasterEgg: (gameId: number) => boolean
  triggerPerfectCelebration: () => void
  triggerStealShowdown: (options?: {
    successful?: boolean
    attackerScore?: number
    defenderScore?: number
  }) => void
  triggerStealMiss: () => void
}

export function useGameGridDevTools({
  triggerEasterEgg,
  triggerPerfectCelebration,
  triggerStealShowdown,
  triggerStealMiss,
}: UseGameGridDevToolsOptions) {
  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') {
      return
    }

    window.__gameGridDev = {
      triggerEasterEgg,
      triggerPerfectCelebration,
      triggerStealShowdown,
      triggerStealMiss,
    }

    return () => {
      if (window.__gameGridDev) {
        delete window.__gameGridDev
      }
    }
  }, [triggerEasterEgg, triggerPerfectCelebration, triggerStealShowdown, triggerStealMiss])
}
