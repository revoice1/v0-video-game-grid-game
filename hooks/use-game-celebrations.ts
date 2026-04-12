'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AnimationQuality } from '@/components/game/game-client-runtime-helpers'
import {
  type ActiveEasterEgg,
  type ActivePerfectCelebration,
  type EasterEggParticle,
  createFallingParticles,
  getEasterEggDefinition,
  getEasterEggLifetimeMs,
  parseMs,
  renderRealStinkerPiece,
  scaleParticleDensity,
} from '@/components/game/easter-egg-celebrations'
import { useTimedOverlayDismiss } from '@/hooks/use-timed-overlay-dismiss'
import type { VersusStealRule } from '@/components/game/versus-setup-modal'

export interface ActiveStealShowdown {
  burstId: number
  durationMs: number
  defenderName: string
  defenderScore: number
  attackerName: string
  attackerScore: number
  rule: Exclude<VersusStealRule, 'off'>
  successful: boolean
  lowEffects?: boolean
}

export interface ActiveStealMissSplash {
  burstId: number
  durationMs: number
}

export interface ActiveDoubleKoSplash {
  burstId: number
  durationMs: number
}

export interface ActiveJudgmentPending {
  burstId: number
}

export interface ActiveJudgmentVerdict {
  burstId: number
  durationMs: number
  verdict: 'sustained' | 'overruled'
}

export const STEAL_SHOWDOWN_DURATION_MS = 3400

interface UseGameCelebrationsOptions {
  animationsEnabled: boolean
  animationQuality: AnimationQuality
  versusStealRule: VersusStealRule
}

export function useGameCelebrations({
  animationsEnabled,
  animationQuality,
  versusStealRule,
}: UseGameCelebrationsOptions) {
  const [activeEasterEgg, setActiveEasterEgg] = useState<ActiveEasterEgg | null>(null)
  const [activePerfectCelebration, setActivePerfectCelebration] =
    useState<ActivePerfectCelebration | null>(null)
  const [activeStealShowdown, setActiveStealShowdown] = useState<ActiveStealShowdown | null>(null)
  const [activeStealMissSplash, setActiveStealMissSplash] = useState<ActiveStealMissSplash | null>(
    null
  )
  const [activeDoubleKoSplash, setActiveDoubleKoSplash] = useState<ActiveDoubleKoSplash | null>(
    null
  )
  const [activeJudgmentPending, setActiveJudgmentPending] = useState<ActiveJudgmentPending | null>(
    null
  )
  const [activeJudgmentVerdict, setActiveJudgmentVerdict] = useState<ActiveJudgmentVerdict | null>(
    null
  )

  // Clear all celebrations when animations are disabled
  useEffect(() => {
    if (animationsEnabled) {
      return
    }

    setActiveEasterEgg(null)
    setActivePerfectCelebration(null)
    setActiveStealShowdown(null)
    setActiveStealMissSplash(null)
    setActiveDoubleKoSplash(null)
  }, [animationsEnabled])

  // Auto-dismiss easter egg after its duration
  useEffect(() => {
    if (!activeEasterEgg) {
      return
    }

    const timer = setTimeout(() => {
      setActiveEasterEgg(null)
    }, activeEasterEgg.durationMs)

    return () => clearTimeout(timer)
  }, [activeEasterEgg])

  // Auto-dismiss perfect celebration after its duration
  useEffect(() => {
    if (!activePerfectCelebration) {
      return
    }

    const timer = setTimeout(() => {
      setActivePerfectCelebration(null)
    }, activePerfectCelebration.durationMs)

    return () => clearTimeout(timer)
  }, [activePerfectCelebration])

  useTimedOverlayDismiss(activeStealShowdown, () => setActiveStealShowdown(null))
  useTimedOverlayDismiss(activeStealMissSplash, () => setActiveStealMissSplash(null))
  useTimedOverlayDismiss(activeDoubleKoSplash, () => setActiveDoubleKoSplash(null))
  useTimedOverlayDismiss(activeJudgmentVerdict, () => setActiveJudgmentVerdict(null))

  const triggerEasterEggCelebration = useCallback(
    (gameId: number): boolean => {
      const easterEggDefinition = getEasterEggDefinition(gameId)

      if (!easterEggDefinition || !animationsEnabled) {
        return false
      }

      const burstId = Date.now()
      const particles = createFallingParticles(
        scaleParticleDensity(easterEggDefinition.density, animationQuality),
        easterEggDefinition.pieceKinds,
        burstId
      )

      setActiveEasterEgg({
        burstId,
        durationMs: getEasterEggLifetimeMs(easterEggDefinition, particles),
        renderPiece: easterEggDefinition.renderPiece,
        particles,
      })

      return true
    },
    [animationQuality, animationsEnabled]
  )

  const triggerPerfectCelebration = useCallback(() => {
    if (!animationsEnabled) {
      return
    }

    const burstId = Date.now()
    const particles = createFallingParticles(3, ['chex'], burstId).map(
      (particle: EasterEggParticle, index: number) => ({
        ...particle,
        left: ['18%', '50%', '82%'][index] ?? particle.left,
        delay: `${index * 160}ms`,
        size: `${32 + index * 6}px`,
        duration: `${2600 + index * 180}ms`,
        drift: `${index === 1 ? 0 : index === 0 ? -12 : 12}px`,
        rotate: `${index === 1 ? -6 : index === 0 ? -14 : 10}deg`,
        variant: index === 1 ? ('g-white' as const) : ('g-green' as const),
      })
    )

    setActivePerfectCelebration({
      burstId,
      durationMs: 2800,
      particles,
    })
  }, [animationsEnabled])

  const triggerRealStinkerCelebration = useCallback(() => {
    if (!animationsEnabled) {
      return
    }

    const burstId = Date.now()
    const particles = createFallingParticles(
      scaleParticleDensity(28, animationQuality),
      ['dust'],
      burstId
    )

    setActiveEasterEgg({
      burstId,
      durationMs: Math.max(
        4200,
        particles.reduce((longest: number, particle: EasterEggParticle) => {
          return Math.max(longest, parseMs(particle.delay) + parseMs(particle.duration))
        }, 0)
      ),
      renderPiece: renderRealStinkerPiece,
      particles,
    })
  }, [animationQuality, animationsEnabled])

  const triggerStealShowdownPreview = useCallback(
    (options?: { successful?: boolean; attackerScore?: number; defenderScore?: number }) => {
      if (!animationsEnabled) {
        return
      }

      setActiveStealShowdown({
        burstId: Date.now(),
        durationMs: STEAL_SHOWDOWN_DURATION_MS,
        defenderName: 'Defender',
        defenderScore: options?.defenderScore ?? 82,
        attackerName: 'Challenger',
        attackerScore: options?.attackerScore ?? 76,
        rule: versusStealRule === 'off' ? 'lower' : versusStealRule,
        successful: options?.successful ?? true,
        lowEffects: animationQuality === 'low',
      })
    },
    [animationQuality, animationsEnabled, versusStealRule]
  )

  const triggerStealMissPreview = useCallback(() => {
    if (!animationsEnabled) {
      return
    }

    setActiveStealMissSplash({
      burstId: Date.now(),
      durationMs: 900,
    })
  }, [animationsEnabled])

  const clearAll = useCallback(() => {
    setActiveEasterEgg(null)
    setActivePerfectCelebration(null)
    setActiveStealShowdown(null)
    setActiveStealMissSplash(null)
    setActiveDoubleKoSplash(null)
    setActiveJudgmentPending(null)
    setActiveJudgmentVerdict(null)
  }, [])

  return {
    // State
    activeEasterEgg,
    activePerfectCelebration,
    activeStealShowdown,
    activeStealMissSplash,
    activeDoubleKoSplash,
    activeJudgmentPending,
    activeJudgmentVerdict,
    // Setters (needed by online versus reset and objection logic)
    setActiveStealShowdown,
    setActiveStealMissSplash,
    setActiveDoubleKoSplash,
    setActiveJudgmentPending,
    setActiveJudgmentVerdict,
    // Triggers
    triggerEasterEggCelebration,
    triggerPerfectCelebration,
    triggerRealStinkerCelebration,
    triggerStealShowdownPreview,
    triggerStealMissPreview,
    clearAll,
  }
}
