'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { GameHeader } from './game-header'
import { GameGrid } from './game-grid'
import { GameSearch } from './game-search'
import { ResultsModal } from './results-modal'
import { HowToPlayModal } from './how-to-play-modal'
import { GuessDetailsModal } from './guess-details-modal'
import { VersusObjectionModal } from './versus-objection-modal'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { AchievementsModal } from './achievements-modal'
import { FallingParticlesOverlay } from './falling-particles-overlay'
import { PuzzleLoadingScreen } from './puzzle-loading-screen'
import { StealShowdownOverlay } from './steal-showdown-overlay'
import {
  DoubleKoSplash,
  JudgmentPendingOverlay,
  JudgmentVerdictSplash,
  ObjectionSplash,
  StealMissSplash,
} from './game-feedback-overlays'
import {
  buildMissReason,
  detectAnimationQuality,
  getInitialVersusRecord,
  hasNonEmptyFilters,
  primeVersusAudioContext,
  saveVersusRecord,
  type AnimationQuality,
  type VersusRecord,
} from './game-client-runtime-helpers'
import { ModeStartScreen } from './mode-start-screen'
import {
  buildGuessFromSelection,
  getCategoriesForCell,
  hydrateStoredGuess,
  isDuplicateGuessSelection,
  isGuessHydrated,
} from './game-client-helpers'
import {
  buildDailyStatsPayload,
  getPostGuessCompletionEffects,
  getPostGuessState,
  lookupGuessDetails,
  postDailyStats,
  shouldUnlockRealStinker,
  submitGuessSelection,
} from './game-client-submission'
import {
  buildStealFailureDescription,
  getPlayerLabel,
  getVersusInvalidGuessResolution,
  getVersusPlacementResolution,
  type TicTacToePlayer,
} from './game-client-versus-helpers'
import {
  buildAttemptIntersections,
  type LoadingAttempt,
  type LoadingIntersection,
} from './loading-helpers'
import {
  VersusSetupModal,
  type VersusCategoryFilters,
  type VersusObjectionRule,
  type VersusStealRule,
  type VersusTurnTimerOption,
} from './versus-setup-modal'
import { getSessionId, saveGameState, loadGameState, clearGameState } from '@/lib/session'
import {
  useAnimationPreference,
  useSearchConfirmPreference,
  useVersusAlarmPreference,
  useVersusAudioPreference,
} from '@/lib/ui-preferences'
import { unlockAchievement } from '@/lib/achievements'
import { EASTER_EGGS, type EasterEggConfig, type EasterEggPieceKind } from '@/lib/easter-eggs'
import { ROUTE_ACHIEVEMENT_ID, ROUTE_PENDING_TOAST_KEY } from '@/lib/route-index'
import type { Puzzle, CellGuess, Game, Category } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { useAnimationQuality } from '@/hooks/use-animation-quality'
import { useLoadingState } from '@/hooks/use-loading-state'
import { useGameModeState } from '@/hooks/use-game-mode-state'
import { useOverlayState } from '@/hooks/use-overlay-state'
import { useGameGridDevTools } from '@/hooks/use-game-grid-dev-tools'
import { usePracticeSetupState } from '@/hooks/use-practice-setup-state'
import { usePuzzleState } from '@/hooks/use-puzzle-state'
import { useTimedOverlayDismiss } from '@/hooks/use-timed-overlay-dismiss'
import { useVersusMatchState } from '@/hooks/use-versus-match-state'
import { useVersusSetupState } from '@/hooks/use-versus-setup-state'
import { useVersusTurnTimer } from '@/hooks/use-versus-turn-timer'
import {
  resolveStealOutcome,
  type PendingVersusSteal,
  type StealAction,
} from '@/hooks/use-versus-steal'

const MAX_GUESSES = 9
type GameMode = 'daily' | 'practice' | 'versus'

interface EasterEggParticle {
  id: string
  left: string
  delay: string
  duration: string
  size: string
  rotate: string
  drift: string
  kind: EasterEggPieceKind
}

interface EasterEggDefinition extends EasterEggConfig {
  renderPiece: (particle: EasterEggParticle) => React.ReactNode
}

interface ActiveEasterEgg {
  burstId: number
  durationMs: number
  renderPiece: EasterEggDefinition['renderPiece']
  particles: EasterEggParticle[]
}

interface ActivePerfectCelebration {
  burstId: number
  durationMs: number
  particles: Array<EasterEggParticle & { variant: 'g-green' | 'g-white' }>
}

interface ActiveStealShowdown {
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

interface ActiveStealMissSplash {
  burstId: number
  durationMs: number
}

interface ActiveDoubleKoSplash {
  burstId: number
  durationMs: number
}

interface ActiveJudgmentPending {
  burstId: number
}

interface ActiveObjectionSplash {
  burstId: number
  durationMs: number
}

interface ActiveJudgmentVerdict {
  burstId: number
  durationMs: number
  verdict: 'sustained' | 'overruled'
}

const STEAL_SHOWDOWN_DURATION_MS = 3400

interface PendingFinalSteal {
  defender: TicTacToePlayer
  cellIndex: number
}

interface VersusObjectionsUsed {
  x: number
  o: number
}

interface PendingVersusObjectionReview {
  cellIndex: number
  player: TicTacToePlayer
  isVersusSteal: boolean
  guess: CellGuess
  rowCategory: Category
  colCategory: Category
  invalidGuessResolution: ReturnType<typeof getVersusInvalidGuessResolution>
}

function scaleParticleDensity(density: number, quality: AnimationQuality): number {
  if (quality === 'low') {
    return Math.max(10, Math.round(density * 0.45))
  }

  if (quality === 'medium') {
    return Math.max(14, Math.round(density * 0.7))
  }

  return density
}

function createSeededRandom(seed: number) {
  let value = seed % 2147483647

  if (value <= 0) {
    value += 2147483646
  }

  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

function createFallingParticles(
  density: number,
  pieceKinds: EasterEggPieceKind[],
  seed: number
): EasterEggParticle[] {
  const random = createSeededRandom(seed)

  return Array.from({ length: density }, (_, index) => {
    const sizePx = Math.round(14 + random() * 22)
    const delayMs = Math.round(random() * 2000)
    const durationMs = Math.round(3400 + random() * 1700)
    const rotation = Math.round(-30 + random() * 60)
    const driftPx = Math.round(-18 + random() * 36)
    const kind = pieceKinds[Math.floor(random() * pieceKinds.length)]

    return {
      id: `${seed}-${index}`,
      left: `${Math.round(2 + random() * 96)}%`,
      delay: `${delayMs}ms`,
      duration: `${durationMs}ms`,
      size: `${sizePx}px`,
      rotate: `${rotation}deg`,
      drift: `${driftPx}px`,
      kind,
    }
  })
}

function parseMs(value: string): number {
  return Number.parseInt(value.replace('ms', ''), 10)
}

function getEasterEggLifetimeMs(
  definition: EasterEggDefinition,
  particles: EasterEggParticle[]
): number {
  const longestParticleMs = particles.reduce((longest, particle) => {
    return Math.max(longest, parseMs(particle.delay) + parseMs(particle.duration))
  }, 0)

  return Math.max(definition.durationMs, longestParticleMs)
}

function renderRealStinkerPiece(particle: EasterEggParticle) {
  return (
    <div
      className="relative"
      style={{
        width: particle.size,
        height: `calc(${particle.size} * 1.05)`,
      }}
    >
      <div className="absolute inset-x-[18%] bottom-0 h-[22%] rounded-full bg-[#5B4331] shadow-[0_8px_18px_rgba(91,67,49,0.28)]" />
      <div className="absolute inset-x-[10%] bottom-[16%] h-[30%] rounded-[46%] bg-[#6B4F3A]" />
      <div className="absolute left-[18%] bottom-[34%] h-[26%] w-[28%] rounded-full bg-[#7A5A43]" />
      <div className="absolute right-[18%] bottom-[34%] h-[24%] w-[26%] rounded-full bg-[#7A5A43]" />
      <div className="absolute left-1/2 bottom-[44%] h-[30%] w-[34%] -translate-x-1/2 rounded-full bg-[#8A674C]" />
      <div className="absolute left-[34%] top-[30%] h-[10%] w-[10%] rounded-full bg-[#2A2019]" />
      <div className="absolute right-[34%] top-[30%] h-[10%] w-[10%] rounded-full bg-[#2A2019]" />
      <div className="absolute left-1/2 top-[46%] h-[10%] w-[18%] -translate-x-1/2 rounded-full bg-[#2A2019]" />
    </div>
  )
}

function requireEasterEgg(achievementId: string): EasterEggConfig {
  const easterEgg = EASTER_EGGS.find((entry) => entry.achievementId === achievementId)

  if (!easterEgg) {
    throw new Error(`Missing easter egg config for ${achievementId}`)
  }

  return easterEgg
}

const EASTER_EGG_DEFINITIONS: EasterEggDefinition[] = [
  {
    ...requireEasterEgg('chex-mix'),
    renderPiece: (particle) => {
      if (particle.kind === 'chex') {
        return (
          <div
            className="rounded-[28%] border-2 border-[#D18D32] bg-[#F6C35B] shadow-[0_6px_18px_rgba(246,195,91,0.35)]"
            style={{
              width: particle.size,
              height: particle.size,
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            }}
          />
        )
      }

      return (
        <div
          className="rounded-full bg-[#7DFF72] shadow-[0_6px_18px_rgba(125,255,114,0.4)]"
          style={{
            width: particle.size,
            height: `calc(${particle.size} * 0.85)`,
          }}
        />
      )
    },
  },
  {
    ...requireEasterEgg('golden-path'),
    renderPiece: (particle) => {
      if (particle.kind === 'fox') {
        return (
          <div
            className="relative"
            style={{
              width: particle.size,
              height: `calc(${particle.size} * 1.05)`,
            }}
          >
            <div className="absolute left-1/2 top-[10%] h-[68%] w-[68%] -translate-x-1/2 rounded-full border border-[#D86F2C] bg-[#F59A44] shadow-[0_8px_22px_rgba(245,154,68,0.3)]" />
            <div className="absolute left-[18%] top-[2%] h-[34%] w-[24%] -rotate-[18deg] rounded-t-[85%] rounded-b-[20%] border border-[#D86F2C] bg-[#F59A44]" />
            <div className="absolute right-[18%] top-[2%] h-[34%] w-[24%] rotate-[18deg] rounded-t-[85%] rounded-b-[20%] border border-[#D86F2C] bg-[#F59A44]" />
            <div className="absolute left-[31%] top-[17%] h-[11%] w-[11%] rounded-full bg-[#FFF3DE]" />
            <div className="absolute right-[31%] top-[17%] h-[11%] w-[11%] rounded-full bg-[#FFF3DE]" />
            <div className="absolute left-1/2 top-[34%] h-[26%] w-[34%] -translate-x-1/2 rounded-full bg-[#FFF3DE]" />
            <div className="absolute left-[36%] top-[43%] h-[5%] w-[5%] rounded-full bg-[#3B2415]" />
            <div className="absolute right-[36%] top-[43%] h-[5%] w-[5%] rounded-full bg-[#3B2415]" />
          </div>
        )
      }

      return (
        <div
          className="relative"
          style={{
            width: particle.size,
            height: `calc(${particle.size} * 1.25)`,
          }}
        >
          <div className="absolute left-1/2 top-0 h-[18%] w-[22%] -translate-x-1/2 rounded-t-full rounded-b-[20%] border border-[#B58B47] bg-[#E8D38B]" />
          <div className="absolute left-1/2 top-[16%] h-[10%] w-[58%] -translate-x-1/2 rounded-full border border-[#B58B47] bg-[#E8D38B]" />
          <div className="absolute left-1/2 top-[23%] h-[52%] w-[22%] -translate-x-1/2 rounded-full border border-[#74CFC0] bg-[#B7FFF3] shadow-[0_6px_18px_rgba(116,207,192,0.35)]" />
          <div
            className="absolute left-1/2 top-[68%] h-[28%] w-[34%] -translate-x-1/2 border border-[#74CFC0] bg-[#B7FFF3]"
            style={{ clipPath: 'polygon(50% 100%, 0% 0%, 100% 0%)' }}
          />
        </div>
      )
    },
  },
  {
    ...requireEasterEgg('dust-to-dust'),
    renderPiece: (particle) => {
      if (particle.kind === 'spellcard') {
        return (
          <div
            className="relative rounded-[18%] border border-[#8D7DF8] bg-[#171B31] shadow-[0_8px_22px_rgba(95,84,201,0.35)]"
            style={{
              width: particle.size,
              height: `calc(${particle.size} * 1.28)`,
            }}
          >
            <div className="absolute inset-x-[14%] top-[12%] h-[18%] rounded-md bg-[#63E0C4]/20" />
            <div
              className="absolute left-1/2 top-[27%] h-[28%] w-[44%] -translate-x-1/2 bg-[#63E0C4] shadow-[0_0_12px_rgba(99,224,196,0.5)]"
              style={{
                clipPath:
                  'polygon(50% 0%, 72% 26%, 100% 50%, 72% 74%, 50% 100%, 28% 74%, 0% 50%, 28% 26%)',
              }}
            />
            <div className="absolute inset-x-[18%] bottom-[16%] h-[8%] rounded-full bg-[#8D7DF8]/45" />
          </div>
        )
      }

      return (
        <div
          className="relative"
          style={{
            width: particle.size,
            height: particle.size,
          }}
        >
          <div className="absolute inset-[14%] rounded-full bg-[#8F6BFF]/55 blur-[2px]" />
          <div className="absolute inset-x-[28%] top-[10%] bottom-[10%] rounded-full bg-[#63E0C4]/85 blur-[1px]" />
          <div className="absolute inset-y-[28%] left-[10%] right-[10%] rounded-full bg-[#63E0C4]/65 blur-[1px]" />
        </div>
      )
    },
  },
  {
    ...requireEasterEgg('snap-happy'),
    renderPiece: (particle) => {
      if (particle.kind === 'photo') {
        return (
          <div
            className="relative rounded-[14%] border border-[#EADDBB] bg-[#FFF7E5] shadow-[0_8px_22px_rgba(255,247,229,0.35)]"
            style={{
              width: particle.size,
              height: `calc(${particle.size} * 1.2)`,
            }}
          >
            <div className="absolute inset-x-[10%] top-[10%] bottom-[22%] rounded-[10%] bg-[#8ED8FF]" />
            <div className="absolute left-[18%] bottom-[30%] h-[28%] w-[24%] rounded-full bg-[#FFE36D]" />
            <div
              className="absolute bottom-[28%] right-[14%] h-[34%] w-[42%] bg-[#5CC07A]"
              style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }}
            />
            <div className="absolute inset-x-[22%] bottom-[8%] h-[6%] rounded-full bg-[#D1C2A1]" />
          </div>
        )
      }

      return (
        <div
          className="relative rounded-full border border-[#1F2432] shadow-[0_8px_20px_rgba(31,36,50,0.28)]"
          style={{
            width: particle.size,
            height: particle.size,
            background: 'linear-gradient(to bottom, #FF6B6B 0 48%, #F9F9F9 48% 100%)',
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-[10%] -translate-y-1/2 bg-[#1F2432]" />
          <div className="absolute left-1/2 top-1/2 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#1F2432] bg-[#F9F9F9]" />
          <div className="absolute left-1/2 top-1/2 h-[12%] w-[12%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1F2432]" />
        </div>
      )
    },
  },
  {
    ...requireEasterEgg('garden-party'),
    renderPiece: (particle) => {
      if (particle.kind === 'candy') {
        return (
          <div
            className="relative"
            style={{
              width: particle.size,
              height: `calc(${particle.size} * 0.72)`,
            }}
          >
            <div
              className="absolute inset-y-[20%] left-0 w-[22%] bg-[#5EEAD4]"
              style={{ clipPath: 'polygon(100% 0%, 0% 50%, 100% 100%)' }}
            />
            <div className="absolute inset-y-0 left-[16%] right-[16%] rounded-full border border-[#C026D3] bg-[#F472B6] shadow-[0_8px_20px_rgba(244,114,182,0.35)]" />
            <div className="absolute inset-y-[18%] left-[28%] right-[28%] rounded-full bg-[#FDE047]/85" />
            <div
              className="absolute inset-y-[20%] right-0 w-[22%] bg-[#60A5FA]"
              style={{ clipPath: 'polygon(0% 0%, 100% 50%, 0% 100%)' }}
            />
          </div>
        )
      }

      return (
        <div
          className="relative"
          style={{
            width: particle.size,
            height: `calc(${particle.size} * 1.1)`,
          }}
        >
          <div className="absolute left-1/2 top-0 h-[18%] w-[28%] -translate-x-1/2 rounded-full bg-[#FDE68A]" />
          <div className="absolute left-1/2 top-[10%] h-[10%] w-[10%] -translate-x-1/2 rounded-full bg-[#92400E]" />
          <div className="absolute inset-x-[8%] top-[16%] bottom-[6%] rounded-[36%] border border-[#FB7185] bg-[#F43F5E] shadow-[0_8px_20px_rgba(244,63,94,0.28)]" />
          <div className="absolute inset-y-[22%] left-[18%] w-[12%] rounded-full bg-[#38BDF8]" />
          <div className="absolute inset-y-[28%] right-[16%] w-[16%] rounded-full bg-[#4ADE80]" />
          <div className="absolute inset-x-[34%] top-[28%] h-[16%] rounded-full bg-[#FDE047]" />
          <div className="absolute inset-x-[28%] bottom-[18%] h-[18%] rounded-full bg-[#A78BFA]" />
        </div>
      )
    },
  },
  {
    ...requireEasterEgg('war-never-changes'),
    renderPiece: (particle) => {
      if (particle.kind === 'cap') {
        return (
          <div
            className="relative rounded-full border-2 border-[#7C5A1E] bg-[#D6A447] shadow-[0_8px_20px_rgba(214,164,71,0.34)]"
            style={{
              width: particle.size,
              height: particle.size,
            }}
          >
            <div className="absolute inset-[16%] rounded-full border border-[#7C5A1E] bg-[#E9C46A]" />
            <div className="absolute inset-x-[22%] top-1/2 h-[2px] -translate-y-1/2 bg-[#7C5A1E]" />
            <div className="absolute inset-y-[22%] left-1/2 w-[2px] -translate-x-1/2 bg-[#7C5A1E]" />
          </div>
        )
      }

      return (
        <div
          className="relative"
          style={{
            width: particle.size,
            height: `calc(${particle.size} * 1.08)`,
          }}
        >
          <div className="absolute inset-x-[12%] top-[10%] h-[74%] rounded-[40%] border border-[#2E7D32] bg-[#9AE6B4] shadow-[0_8px_22px_rgba(154,230,180,0.3)]" />
          <div className="absolute left-[22%] top-[18%] h-[12%] w-[12%] rounded-full bg-[#1F2937]" />
          <div className="absolute right-[22%] top-[18%] h-[12%] w-[12%] rounded-full bg-[#1F2937]" />
          <div className="absolute left-1/2 top-[34%] h-[14%] w-[26%] -translate-x-1/2 rounded-full bg-[#F8FAFC]" />
          <div className="absolute inset-x-[24%] bottom-[18%] h-[12%] rounded-full border border-[#2E7D32] bg-[#FDE68A]" />
          <div className="absolute left-[8%] top-[28%] h-[24%] w-[12%] rounded-full bg-[#2563EB]" />
          <div className="absolute right-[8%] top-[28%] h-[24%] w-[12%] rounded-full bg-[#2563EB]" />
        </div>
      )
    },
  },
  {
    ...requireEasterEgg('brain-bounce'),
    renderPiece: (particle) => {
      if (particle.kind === 'brain') {
        return (
          <div
            className="relative"
            style={{
              width: particle.size,
              height: `calc(${particle.size} * 0.9)`,
            }}
          >
            <div className="absolute inset-x-[8%] inset-y-[12%] rounded-[42%] border border-[#B45309] bg-[#F9A8D4] shadow-[0_8px_20px_rgba(249,168,212,0.32)]" />
            <div className="absolute left-[18%] top-[18%] h-[22%] w-[18%] rounded-full border border-[#DB2777]/70 bg-[#FBCFE8]" />
            <div className="absolute left-[38%] top-[10%] h-[28%] w-[20%] rounded-full border border-[#DB2777]/70 bg-[#FBCFE8]" />
            <div className="absolute right-[18%] top-[18%] h-[22%] w-[18%] rounded-full border border-[#DB2777]/70 bg-[#FBCFE8]" />
            <div className="absolute left-[22%] bottom-[18%] h-[18%] w-[24%] rounded-full border border-[#DB2777]/70 bg-[#FBCFE8]" />
            <div className="absolute right-[22%] bottom-[18%] h-[18%] w-[24%] rounded-full border border-[#DB2777]/70 bg-[#FBCFE8]" />
          </div>
        )
      }

      return (
        <div
          className="relative rounded-full border-2 border-[#1D4ED8] bg-[#60A5FA] shadow-[0_8px_20px_rgba(96,165,250,0.34)]"
          style={{
            width: particle.size,
            height: particle.size,
          }}
        >
          <div className="absolute inset-[18%] rounded-full bg-[#DBEAFE]" />
          <div className="absolute left-1/2 top-1/2 h-[18%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1D4ED8]" />
        </div>
      )
    },
  },
  {
    ...requireEasterEgg('cute-chaos'),
    renderPiece: (particle) => {
      if (particle.kind === 'bow') {
        return (
          <div
            className="relative"
            style={{
              width: particle.size,
              height: `calc(${particle.size} * 0.8)`,
            }}
          >
            <div className="absolute left-[8%] top-[18%] h-[56%] w-[34%] rounded-full bg-[#FF7AB8] shadow-[0_8px_18px_rgba(255,122,184,0.32)]" />
            <div className="absolute right-[8%] top-[18%] h-[56%] w-[34%] rounded-full bg-[#FF7AB8] shadow-[0_8px_18px_rgba(255,122,184,0.32)]" />
            <div className="absolute left-1/2 top-1/2 h-[34%] w-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FDE68A]" />
          </div>
        )
      }

      return (
        <div
          className="relative rounded-full border-2 border-[#EA580C] bg-[#FDBA74] shadow-[0_8px_20px_rgba(253,186,116,0.32)]"
          style={{
            width: particle.size,
            height: particle.size,
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-[#EA580C]" />
          <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-[#EA580C]" />
          <div className="absolute inset-[28%] rounded-full bg-[#FFF7ED]" />
        </div>
      )
    },
  },
  {
    ...requireEasterEgg('rub-rabbit-fever'),
    renderPiece: (particle) => {
      if (particle.kind === 'bow') {
        return (
          <div
            className="relative"
            style={{
              width: particle.size,
              height: `calc(${particle.size} * 0.8)`,
            }}
          >
            <div className="absolute left-[8%] top-[18%] h-[56%] w-[34%] rounded-full bg-[#FF7AB8] shadow-[0_8px_18px_rgba(255,122,184,0.32)]" />
            <div className="absolute right-[8%] top-[18%] h-[56%] w-[34%] rounded-full bg-[#FF7AB8] shadow-[0_8px_18px_rgba(255,122,184,0.32)]" />
            <div className="absolute left-1/2 top-1/2 h-[34%] w-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FDE68A]" />
          </div>
        )
      }

      return (
        <div
          className="relative"
          style={{
            width: particle.size,
            height: particle.size,
          }}
        >
          <div className="absolute left-1/2 top-1/2 h-[26%] w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFF7ED] shadow-[0_0_18px_rgba(255,247,237,0.45)]" />
          <div className="absolute left-1/2 top-[6%] h-[26%] w-[10%] -translate-x-1/2 rounded-full bg-[#F59E0B] blur-[0.5px]" />
          <div className="absolute left-[18%] top-[18%] h-[8%] w-[8%] rounded-full bg-[#FDE68A]" />
          <div className="absolute right-[18%] top-[18%] h-[8%] w-[8%] rounded-full bg-[#FDE68A]" />
          <div className="absolute left-[18%] bottom-[18%] h-[8%] w-[8%] rounded-full bg-[#FDE68A]" />
          <div className="absolute right-[18%] bottom-[18%] h-[8%] w-[8%] rounded-full bg-[#FDE68A]" />
        </div>
      )
    },
  },
  {
    ...requireEasterEgg('second-round'),
    renderPiece: (particle) => {
      if (particle.kind === 'die') {
        return (
          <div
            className="relative rounded-[24%] border border-[#7C3AED] bg-[#A78BFA] shadow-[0_8px_20px_rgba(167,139,250,0.32)]"
            style={{
              width: particle.size,
              height: particle.size,
            }}
          >
            <div className="absolute left-[22%] top-[22%] h-[12%] w-[12%] rounded-full bg-[#F8FAFC]" />
            <div className="absolute right-[22%] top-[22%] h-[12%] w-[12%] rounded-full bg-[#F8FAFC]" />
            <div className="absolute left-1/2 top-1/2 h-[12%] w-[12%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F8FAFC]" />
            <div className="absolute left-[22%] bottom-[22%] h-[12%] w-[12%] rounded-full bg-[#F8FAFC]" />
            <div className="absolute right-[22%] bottom-[22%] h-[12%] w-[12%] rounded-full bg-[#F8FAFC]" />
          </div>
        )
      }

      return (
        <div
          className="relative"
          style={{
            width: particle.size,
            height: `calc(${particle.size} * 1.08)`,
          }}
        >
          <div className="absolute left-1/2 top-0 h-[18%] w-[18%] -translate-x-1/2 rounded-full bg-[#FDE68A]" />
          <div
            className="absolute inset-x-[18%] top-[16%] bottom-[8%] bg-[#22C55E] shadow-[0_8px_18px_rgba(34,197,94,0.3)]"
            style={{ clipPath: 'polygon(50% 0%, 100% 36%, 84% 100%, 16% 100%, 0% 36%)' }}
          />
          <div className="absolute inset-x-[34%] top-[42%] h-[10%] rounded-full bg-[#F8FAFC]" />
          <div className="absolute inset-x-[24%] bottom-[16%] h-[8%] rounded-full bg-[#FDE68A]" />
        </div>
      )
    },
  },
  {
    ...requireEasterEgg('blast-zone'),
    renderPiece: (particle) => {
      if (particle.kind === 'bomb') {
        return (
          <div
            className="relative"
            style={{
              width: particle.size,
              height: `calc(${particle.size} * 1.02)`,
            }}
          >
            <div className="absolute left-1/2 top-0 h-[18%] w-[16%] -translate-x-1/2 rounded-full bg-[#FDE68A]" />
            <div className="absolute left-[52%] top-[8%] h-[22%] w-[10%] rounded-full bg-[#F97316]" />
            <div className="absolute inset-x-[10%] bottom-0 top-[14%] rounded-full border border-[#111827] bg-[#111827] shadow-[0_8px_20px_rgba(17,24,39,0.36)]" />
            <div className="absolute right-[24%] top-[26%] h-[14%] w-[14%] rounded-full bg-[#F8FAFC]/85" />
          </div>
        )
      }

      return (
        <div
          className="relative"
          style={{
            width: particle.size,
            height: particle.size,
          }}
        >
          <div
            className="absolute inset-[8%] bg-[#FDE047] shadow-[0_0_18px_rgba(253,224,71,0.45)]"
            style={{
              clipPath:
                'polygon(50% 0%, 64% 34%, 100% 50%, 64% 66%, 50% 100%, 36% 66%, 0% 50%, 36% 34%)',
            }}
          />
          <div className="absolute inset-[30%] rounded-full bg-[#FFF7ED]" />
        </div>
      )
    },
  },
  {
    ...requireEasterEgg('time-to-collect'),
    renderPiece: (particle) => {
      if (particle.kind === 'hat') {
        return (
          <div
            className="relative"
            style={{
              width: particle.size,
              height: `calc(${particle.size} * 0.82)`,
            }}
          >
            <div className="absolute left-[18%] top-[12%] h-[46%] w-[64%] rounded-t-[85%] rounded-b-[28%] border border-[#4338CA] bg-[#7C3AED] shadow-[0_8px_20px_rgba(124,58,237,0.32)]" />
            <div className="absolute inset-x-[6%] bottom-[12%] h-[18%] rounded-full bg-[#A78BFA]" />
            <div className="absolute right-[18%] top-[16%] h-[16%] w-[16%] rounded-full bg-[#FDE047]" />
          </div>
        )
      }

      return (
        <div
          className="relative"
          style={{
            width: particle.size,
            height: `calc(${particle.size} * 1.08)`,
          }}
        >
          <div className="absolute left-1/2 top-0 h-[26%] w-[22%] -translate-x-1/2 rounded-full bg-[#38BDF8]" />
          <div className="absolute left-1/2 top-[14%] h-[68%] w-[54%] -translate-x-1/2 rounded-[42%] border border-[#0369A1] bg-[#7DD3FC] shadow-[0_8px_20px_rgba(125,211,252,0.34)]" />
          <div className="absolute left-1/2 top-[34%] h-[18%] w-[22%] -translate-x-1/2 rounded-full bg-[#F8FAFC]" />
          <div className="absolute inset-x-[34%] bottom-[8%] h-[8%] rounded-full bg-[#FDE047]" />
        </div>
      )
    },
  },
  {
    ...requireEasterEgg('sold-out-crowd'),
    renderPiece: (particle) => {
      if (particle.kind === 'belt') {
        return (
          <div
            className="relative"
            style={{
              width: particle.size,
              height: `calc(${particle.size} * 0.62)`,
            }}
          >
            <div className="absolute inset-y-[18%] left-0 right-0 rounded-full bg-[#111827]" />
            <div className="absolute left-1/2 top-1/2 h-[78%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#A16207] bg-[#FBBF24] shadow-[0_8px_20px_rgba(251,191,36,0.34)]" />
            <div className="absolute left-[22%] top-1/2 h-[40%] w-[16%] -translate-y-1/2 rounded-full bg-[#D1D5DB]" />
            <div className="absolute right-[22%] top-1/2 h-[40%] w-[16%] -translate-y-1/2 rounded-full bg-[#D1D5DB]" />
          </div>
        )
      }

      return (
        <div
          className="relative"
          style={{
            width: particle.size,
            height: particle.size,
          }}
        >
          <div
            className="absolute inset-[10%] bg-[#EF4444] shadow-[0_0_16px_rgba(239,68,68,0.34)]"
            style={{
              clipPath:
                'polygon(50% 0%, 62% 28%, 100% 14%, 72% 50%, 100% 86%, 62% 72%, 50% 100%, 38% 72%, 0% 86%, 28% 50%, 0% 14%, 38% 28%)',
            }}
          />
          <div className="absolute inset-[34%] rounded-full bg-[#F8FAFC]" />
        </div>
      )
    },
  },
  {
    ...requireEasterEgg('maximum-impact'),
    renderPiece: (particle) => {
      if (particle.kind === 'fist') {
        return (
          <div
            className="relative"
            style={{
              width: particle.size,
              height: `calc(${particle.size} * 0.86)`,
            }}
          >
            <div className="absolute left-[12%] top-[22%] h-[40%] w-[16%] rounded-t-full bg-[#FDE68A]" />
            <div className="absolute left-[28%] top-[18%] h-[44%] w-[16%] rounded-t-full bg-[#FDE68A]" />
            <div className="absolute left-[44%] top-[14%] h-[48%] w-[16%] rounded-t-full bg-[#FDE68A]" />
            <div className="absolute left-[60%] top-[18%] h-[44%] w-[16%] rounded-t-full bg-[#FDE68A]" />
            <div className="absolute inset-x-[12%] bottom-[10%] top-[42%] rounded-[28%] border border-[#C2410C] bg-[#FB923C] shadow-[0_8px_20px_rgba(251,146,60,0.34)]" />
          </div>
        )
      }

      return (
        <div
          className="relative"
          style={{
            width: particle.size,
            height: particle.size,
          }}
        >
          <div
            className="absolute inset-[8%] bg-[#F59E0B] shadow-[0_0_18px_rgba(245,158,11,0.4)]"
            style={{
              clipPath:
                'polygon(50% 0%, 70% 24%, 100% 18%, 80% 50%, 100% 82%, 70% 76%, 50% 100%, 30% 76%, 0% 82%, 20% 50%, 0% 18%, 30% 24%)',
            }}
          />
          <div className="absolute inset-[30%] rounded-full bg-[#7C2D12]" />
        </div>
      )
    },
  },
  {
    ...requireEasterEgg('wrong-dimension'),
    renderPiece: (particle) => {
      if (particle.kind === 'pointer') {
        return (
          <div
            className="relative"
            style={{
              width: particle.size,
              height: `calc(${particle.size} * 1.1)`,
            }}
          >
            <div
              className="absolute inset-[10%] border border-[#111827] bg-[#F8FAFC] shadow-[0_8px_20px_rgba(248,250,252,0.28)]"
              style={{
                clipPath: 'polygon(0% 0%, 76% 62%, 46% 66%, 60% 100%, 44% 100%, 30% 70%, 0% 100%)',
              }}
            />
          </div>
        )
      }

      return (
        <div
          className="relative rounded-[22%] border border-[#1D4ED8] bg-[#60A5FA] shadow-[0_8px_20px_rgba(96,165,250,0.3)]"
          style={{
            width: particle.size,
            height: `calc(${particle.size} * 0.86)`,
          }}
        >
          <div className="absolute left-[10%] right-[42%] top-[18%] h-[18%] bg-[#111827]" />
          <div className="absolute left-[36%] right-[14%] top-[18%] h-[18%] bg-[#F8FAFC]" />
          <div className="absolute left-[18%] right-[28%] top-[46%] h-[18%] bg-[#111827]" />
        </div>
      )
    },
  },
  {
    ...requireEasterEgg('finish-the-fight'),
    renderPiece: (particle) => {
      if (particle.kind === 'energy-sword') {
        return (
          <div
            className="relative"
            style={{
              width: `calc(${particle.size} * 1.3)`,
              height: `calc(${particle.size} * 0.98)`,
            }}
          >
            <div className="absolute left-1/2 top-[52%] h-[18%] w-[16%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0F172A]" />
            <div className="absolute left-1/2 top-[52%] h-[10%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1E293B]" />
            <div
              className="absolute left-[6%] top-[10%] h-[56%] w-[36%] origin-bottom rotate-[18deg] bg-[#67E8F9] shadow-[0_0_22px_rgba(103,232,249,0.6)]"
              style={{
                clipPath: 'polygon(100% 100%, 72% 72%, 54% 34%, 32% 0%, 18% 4%, 30% 42%, 54% 82%)',
              }}
            />
            <div
              className="absolute right-[6%] top-[10%] h-[56%] w-[36%] origin-bottom -rotate-[18deg] bg-[#67E8F9] shadow-[0_0_22px_rgba(103,232,249,0.6)]"
              style={{
                clipPath: 'polygon(0% 100%, 28% 72%, 46% 34%, 68% 0%, 82% 4%, 70% 42%, 46% 82%)',
              }}
            />
            <div
              className="absolute left-[14%] top-[14%] h-[42%] w-[20%] origin-bottom rotate-[18deg] bg-[#E0F7FF]"
              style={{
                clipPath: 'polygon(100% 100%, 74% 74%, 58% 36%, 38% 2%, 28% 8%, 40% 44%, 58% 84%)',
              }}
            />
            <div
              className="absolute right-[14%] top-[14%] h-[42%] w-[20%] origin-bottom -rotate-[18deg] bg-[#E0F7FF]"
              style={{
                clipPath: 'polygon(0% 100%, 26% 74%, 42% 36%, 62% 2%, 72% 8%, 60% 44%, 42% 84%)',
              }}
            />
          </div>
        )
      }

      return (
        <div
          className="relative"
          style={{
            width: `calc(${particle.size} * 1.1)`,
            height: `calc(${particle.size} * 0.72)`,
          }}
        >
          <div
            className="absolute inset-y-[8%] left-[8%] right-[8%] bg-[#38BDF8] shadow-[0_0_18px_rgba(56,189,248,0.48)]"
            style={{ clipPath: 'polygon(0% 50%, 20% 18%, 84% 18%, 100% 50%, 84% 82%, 20% 82%)' }}
          />
          <div
            className="absolute inset-y-[26%] left-[24%] right-[24%] bg-[#E0F2FE]"
            style={{ clipPath: 'polygon(0% 50%, 18% 18%, 82% 18%, 100% 50%, 82% 82%, 18% 82%)' }}
          />
        </div>
      )
    },
  },
  {
    ...requireEasterEgg('flying-power-disc'),
    renderPiece: (particle) => {
      if (particle.kind === 'disc') {
        return (
          <div
            className="relative"
            style={{
              width: particle.size,
              height: particle.size,
            }}
          >
            <div className="absolute inset-0 rounded-full border-2 border-[#EA580C] bg-[#F97316] shadow-[0_8px_20px_rgba(249,115,22,0.34)]" />
            <div className="absolute inset-[18%] rounded-full border border-[#FDE68A] bg-[#FDBA74]" />
            <div className="absolute inset-[36%] rounded-full bg-[#FFF7ED]" />
          </div>
        )
      }

      return (
        <div
          className="relative"
          style={{
            width: `calc(${particle.size} * 1.25)`,
            height: `calc(${particle.size} * 0.7)`,
          }}
        >
          <div className="absolute inset-y-[18%] left-[6%] right-[6%] rounded-full border border-[#38BDF8] bg-[#38BDF8]/18 shadow-[0_0_18px_rgba(56,189,248,0.3)]" />
          <div className="absolute inset-y-[34%] left-[18%] right-[18%] rounded-full bg-[#E0F2FE]" />
        </div>
      )
    },
  },
  {
    ...requireEasterEgg('free-planeswalker'),
    renderPiece: (particle) => {
      if (particle.kind === 'mtg-card') {
        return (
          <div
            className="relative rounded-[14%] border border-[#7C3AED] bg-[#161127] shadow-[0_8px_22px_rgba(124,58,237,0.3)]"
            style={{
              width: `calc(${particle.size} * 0.78)`,
              height: `calc(${particle.size} * 1.08)`,
            }}
          >
            <div className="absolute inset-x-[10%] top-[8%] h-[12%] rounded-md bg-[#2A1E4A]" />
            <div className="absolute inset-x-[12%] top-[24%] bottom-[18%] rounded-[12%] bg-[linear-gradient(180deg,#7C3AED_0%,#2563EB_48%,#F59E0B_100%)]" />
            <div
              className="absolute left-1/2 top-[42%] h-[28%] w-[34%] -translate-x-1/2 -translate-y-1/2 bg-[#F8FAFC]/90 shadow-[0_0_12px_rgba(248,250,252,0.35)]"
              style={{
                clipPath:
                  'polygon(50% 0%, 64% 36%, 100% 36%, 70% 58%, 80% 94%, 50% 72%, 20% 94%, 30% 58%, 0% 36%, 36% 36%)',
              }}
            />
            <div className="absolute inset-x-[18%] bottom-[8%] h-[6%] rounded-full bg-[#D1D5DB]/65" />
          </div>
        )
      }

      return (
        <div
          className="relative"
          style={{
            width: particle.size,
            height: particle.size,
          }}
        >
          <div
            className="absolute inset-[12%] bg-[#8B5CF6] shadow-[0_0_18px_rgba(139,92,246,0.42)]"
            style={{
              clipPath:
                'polygon(50% 0%, 62% 18%, 82% 18%, 72% 38%, 88% 50%, 72% 62%, 82% 82%, 62% 82%, 50% 100%, 38% 82%, 18% 82%, 28% 62%, 12% 50%, 28% 38%, 18% 18%, 38% 18%)',
            }}
          />
          <div
            className="absolute inset-[30%] bg-[#C4B5FD]"
            style={{
              clipPath:
                'polygon(50% 0%, 62% 18%, 82% 18%, 72% 38%, 88% 50%, 72% 62%, 82% 82%, 62% 82%, 50% 100%, 38% 82%, 18% 82%, 28% 62%, 12% 50%, 28% 38%, 18% 18%, 38% 18%)',
            }}
          />
        </div>
      )
    },
  },
]

function getEasterEggDefinition(gameId: number): EasterEggDefinition | null {
  return (
    EASTER_EGG_DEFINITIONS.find((definition) => definition.triggerGameIds.includes(gameId)) ?? null
  )
}

function EasterEggCelebration({ burstId, renderPiece, particles }: ActiveEasterEgg) {
  return (
    <FallingParticlesOverlay
      burstId={burstId}
      particles={particles}
      dataTestId="easter-egg-celebration"
      zIndexClassName="z-[80]"
      animationName="easter-egg-fall"
      animationStyles={`
        @keyframes easter-egg-fall {
          0% {
            transform: translate3d(0, -14vh, 0) rotate(var(--rotation));
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--drift), 112vh, 0) rotate(calc(var(--rotation) + 140deg));
            opacity: 0.95;
          }
        }
      `}
      renderParticle={renderPiece}
    />
  )
}

function PerfectGridCelebration({ burstId, particles }: ActivePerfectCelebration) {
  return (
    <FallingParticlesOverlay
      burstId={burstId}
      particles={particles}
      dataTestId="perfect-grid-celebration"
      zIndexClassName="z-[90]"
      animationName="perfect-grid-fall"
      animationStyles={`
        @keyframes perfect-grid-fall {
          0% {
            transform: translate3d(0, -12vh, 0) rotate(var(--rotation)) scale(0.9);
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--drift), 108vh, 0) rotate(calc(var(--rotation) + 110deg)) scale(1.05);
            opacity: 0;
          }
        }
        @keyframes perfect-grid-banner {
          0% {
            transform: translateY(16px) scale(0.96);
            opacity: 0;
          }
          18% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          82% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-10px) scale(1.02);
            opacity: 0;
          }
        }
      `}
      background={
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(98,212,140,0.14),transparent_52%)]" />
      }
      renderParticle={(particle) => (
        <div
          className="relative"
          style={{
            width: particle.size,
            height: particle.size,
          }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center text-center text-2xl font-black italic leading-none drop-shadow-[0_8px_18px_rgba(0,0,0,0.28)]"
            style={{
              color: particle.variant === 'g-green' ? '#16C23A' : '#F5F7FB',
            }}
          >
            G
          </div>
        </div>
      )}
      overlay={
        <div className="absolute inset-x-4 top-14 flex justify-center sm:top-20">
          <div
            className="rounded-2xl border border-[#D7B65A]/60 bg-[#11161F]/92 px-5 py-4 text-center shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm"
            style={{ animation: 'perfect-grid-banner 2600ms ease-out both' }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#F7D772]">
              Perfect Grid
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">9/9</p>
            <p className="mt-1 text-sm text-foreground/75">Clean sweep.</p>
          </div>
        </div>
      }
    />
  )
}

interface PuzzleStreamMessage {
  type: 'progress' | 'puzzle' | 'error'
  pct?: number
  message?: string
  puzzle?: Puzzle
  stage?: 'families' | 'attempt' | 'cell' | 'metadata' | 'rejected' | 'done'
  attempt?: number
  rows?: string[]
  cols?: string[]
  cellIndex?: number
  rowCategory?: string
  colCategory?: string
  validOptionCount?: number
  passed?: boolean
}

export function GameClient() {
  const skipNextVersusAutoLoadRef = useRef(false)
  const skipNextPracticeAutoLoadRef = useRef(false)
  const activeTurnTimerKeyRef = useRef<string | null>(null)
  const activePuzzleLoadControllerRef = useRef<AbortController | null>(null)
  const isPuzzleLoadInFlightRef = useRef(false)
  const recordedVersusWinnerKeyRef = useRef<string | null>(null)
  const { mode, setMode, loadedPuzzleMode, setLoadedPuzzleMode } = useGameModeState()
  const {
    puzzle,
    setPuzzle,
    guesses,
    setGuesses,
    guessesRemaining,
    setGuessesRemaining,
    currentPlayer,
    setCurrentPlayer,
    stealableCell,
    setStealableCell,
    winner,
    setWinner,
    selectedCell,
    setSelectedCell,
  } = usePuzzleState({ cellCount: 9, maxGuesses: MAX_GUESSES })
  const [isLoading, setIsLoading] = useState(true)
  const {
    showResults,
    setShowResults,
    showHowToPlay,
    setShowHowToPlay,
    showAchievements,
    setShowAchievements,
    detailCell,
    setDetailCell,
  } = useOverlayState()
  const {
    practiceCategoryFilters,
    setPracticeCategoryFilters,
    showPracticeSetup,
    setShowPracticeSetup,
    showPracticeStartOptions,
    setShowPracticeStartOptions,
    practiceSetupError,
    setPracticeSetupError,
  } = usePracticeSetupState()
  const {
    versusCategoryFilters,
    setVersusCategoryFilters,
    versusStealRule,
    setVersusStealRule,
    versusTimerOption,
    setVersusTimerOption,
    versusDisableDraws,
    setVersusDisableDraws,
    versusObjectionRule,
    setVersusObjectionRule,
    showVersusSetup,
    setShowVersusSetup,
    showVersusStartOptions,
    setShowVersusStartOptions,
    versusSetupError,
    setVersusSetupError,
  } = useVersusSetupState()
  const {
    sessionId,
    setSessionId,
    loadingProgress,
    setLoadingProgress,
    loadingStage,
    setLoadingStage,
    loadingAttempts,
    setLoadingAttempts,
    dailyResetLabel,
  } = useLoadingState<LoadingAttempt>()
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
  const [activeObjectionSplash, setActiveObjectionSplash] = useState<ActiveObjectionSplash | null>(
    null
  )
  const [activeJudgmentVerdict, setActiveJudgmentVerdict] = useState<ActiveJudgmentVerdict | null>(
    null
  )
  const [objectionPending, setObjectionPending] = useState(false)
  const [objectionVerdict, setObjectionVerdict] = useState<'sustained' | 'overruled' | null>(null)
  const [objectionExplanation, setObjectionExplanation] = useState<string | null>(null)
  const [versusObjectionsUsed, setVersusObjectionsUsed] = useState<VersusObjectionsUsed>({
    x: 0,
    o: 0,
  })
  const [pendingVersusObjectionReview, setPendingVersusObjectionReview] =
    useState<PendingVersusObjectionReview | null>(null)
  const [showVersusWinnerBanner, setShowVersusWinnerBanner] = useState(true)
  const {
    turnTimeLeft,
    setTurnTimeLeft,
    versusRecord,
    setVersusRecord,
    pendingFinalSteal,
    setPendingFinalSteal,
    lockImpactCell,
    setLockImpactCell,
  } = useVersusMatchState<VersusRecord, PendingFinalSteal>({
    initialRecord: { xWins: 0, oWins: 0 },
  })
  const { enabled: animationsEnabled } = useAnimationPreference()
  const { enabled: versusAlarmsEnabled } = useVersusAlarmPreference()
  const { enabled: versusAudioEnabled } = useVersusAudioPreference()
  const detectConfiguredAnimationQuality = useCallback(
    () => (animationsEnabled ? detectAnimationQuality() : 'low'),
    [animationsEnabled]
  )
  const animationQuality = useAnimationQuality(detectConfiguredAnimationQuality)
  const { enabled: confirmBeforeSelect } = useSearchConfirmPreference()
  const { toast } = useToast()
  const versusStealRuleRef = useRef(versusStealRule)
  const versusTimerOptionRef = useRef(versusTimerOption)
  const versusDisableDrawsRef = useRef(versusDisableDraws)
  const versusObjectionRuleRef = useRef(versusObjectionRule)

  useEffect(() => {
    versusStealRuleRef.current = versusStealRule
  }, [versusStealRule])

  useEffect(() => {
    versusTimerOptionRef.current = versusTimerOption
  }, [versusTimerOption])

  useEffect(() => {
    versusDisableDrawsRef.current = versusDisableDraws
  }, [versusDisableDraws])

  useEffect(() => {
    versusObjectionRuleRef.current = versusObjectionRule
  }, [versusObjectionRule])

  const score = guesses.filter((g) => g?.isCorrect).length
  const isVersusMode = mode === 'versus'
  const stealsEnabled = versusStealRule !== 'off'
  const getVersusObjectionLimit = useCallback((rule: VersusObjectionRule) => {
    if (rule === 'one') {
      return 1
    }

    if (rule === 'three') {
      return 3
    }

    return 0
  }, [])
  const hasActivePracticeCustomSetup = hasNonEmptyFilters(practiceCategoryFilters)
  const hasActiveVersusCustomSetup = hasNonEmptyFilters(versusCategoryFilters)
  const hasActiveCustomSetup =
    mode === 'practice'
      ? hasActivePracticeCustomSetup
      : mode === 'versus'
        ? hasActiveVersusCustomSetup
        : false

  useEffect(() => {
    if (!isVersusMode || !versusAudioEnabled) {
      return
    }

    primeVersusAudioContext()
  }, [isVersusMode, versusAudioEnabled])
  // Game is over when out of guesses OR all cells filled (not necessarily all correct)
  const gridFull = guesses.every((g) => g !== null)
  const isComplete = isVersusMode ? winner !== null : guessesRemaining === 0 || gridFull

  const triggerEasterEggCelebration = useCallback(
    (gameId: number) => {
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
    const particles = createFallingParticles(3, ['chex'], burstId).map((particle, index) => ({
      ...particle,
      left: ['18%', '50%', '82%'][index] ?? particle.left,
      delay: `${index * 160}ms`,
      size: `${32 + index * 6}px`,
      duration: `${2600 + index * 180}ms`,
      drift: `${index === 1 ? 0 : index === 0 ? -12 : 12}px`,
      rotate: `${index === 1 ? -6 : index === 0 ? -14 : 10}deg`,
      variant: index === 1 ? ('g-white' as const) : ('g-green' as const),
    }))

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
        particles.reduce((longest, particle) => {
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
        rule: versusStealRule === 'higher' ? 'higher' : 'lower',
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

  useGameGridDevTools({
    triggerEasterEgg: triggerEasterEggCelebration,
    triggerPerfectCelebration,
    triggerStealShowdown: triggerStealShowdownPreview,
    triggerStealMiss: triggerStealMissPreview,
  })

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

  const unlockAchievementWithToast = useCallback(
    (achievementId: string, options?: { imageUrl?: string | null }) => {
      const result = unlockAchievement(achievementId, options)

      if (!result.unlocked || !result.achievement) {
        return
      }

      toast({
        title: `Achievement Unlocked: ${result.achievement.title}`,
        description: result.achievement.description,
      })
    },
    [toast]
  )

  // Initialize session
  useEffect(() => {
    setSessionId(getSessionId())
    setVersusRecord(getInitialVersusRecord())
  }, [])

  useEffect(() => {
    if (!puzzle || mode !== 'versus' || winner === null) {
      return
    }

    if (winner === 'draw') {
      return
    }

    const winnerKey = `${puzzle.id}:${winner}`
    if (recordedVersusWinnerKeyRef.current === winnerKey) {
      return
    }

    recordedVersusWinnerKeyRef.current = winnerKey
    setVersusRecord((current) => {
      const nextRecord =
        winner === 'x'
          ? { ...current, xWins: current.xWins + 1 }
          : { ...current, oWins: current.oWins + 1 }

      saveVersusRecord(nextRecord)
      return nextRecord
    })
  }, [mode, puzzle, winner, setVersusRecord])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const pendingAchievementId = window.sessionStorage.getItem(ROUTE_PENDING_TOAST_KEY)
    if (pendingAchievementId !== ROUTE_ACHIEVEMENT_ID) {
      return
    }

    window.sessionStorage.removeItem(ROUTE_PENDING_TOAST_KEY)
    const result = unlockAchievement(ROUTE_ACHIEVEMENT_ID)

    if (!result.achievement) {
      return
    }

    toast({
      title: result.unlocked
        ? `Achievement Unlocked: ${result.achievement.title}`
        : `${result.achievement.title} Found`,
      description: result.achievement.description,
    })
  }, [toast])

  useEffect(() => {
    if (!activeEasterEgg) {
      return
    }

    const timer = setTimeout(() => {
      setActiveEasterEgg(null)
    }, activeEasterEgg.durationMs)

    return () => clearTimeout(timer)
  }, [activeEasterEgg])

  useEffect(() => {
    if (!activePerfectCelebration) {
      return
    }

    const timer = setTimeout(() => {
      setActivePerfectCelebration(null)
    }, activePerfectCelebration.durationMs)

    return () => clearTimeout(timer)
  }, [activePerfectCelebration])

  useEffect(() => {
    setShowVersusWinnerBanner(winner !== null)
  }, [winner])

  useEffect(() => {
    return () => {
      activePuzzleLoadControllerRef.current?.abort()
    }
  }, [])

  const triggerLockImpact = useCallback(
    (cell: number) => {
      setLockImpactCell(cell)
      window.setTimeout(() => {
        setLockImpactCell((current) => (current === cell ? null : current))
      }, 550)
    },
    [setLockImpactCell]
  )

  const applyStealActions = useCallback(
    (actions: StealAction[]) => {
      for (const action of actions) {
        switch (action.kind) {
          case 'clearSelection':
            setSelectedCell(null)
            break
          case 'clearStealable':
            setStealableCell(null)
            break
          case 'clearPendingSteal':
            setPendingFinalSteal(null)
            break
          case 'setLockImpact':
            triggerLockImpact(action.cell)
            break
          case 'setNextPlayer':
            setCurrentPlayer(action.player)
            break
          case 'setWinner':
            setWinner(action.player)
            break
        }
      }
    },
    [
      setCurrentPlayer,
      setPendingFinalSteal,
      setSelectedCell,
      setStealableCell,
      setWinner,
      triggerLockImpact,
    ]
  )

  useTimedOverlayDismiss(activeStealShowdown, () => setActiveStealShowdown(null))
  useTimedOverlayDismiss(activeStealMissSplash, () => setActiveStealMissSplash(null))
  useTimedOverlayDismiss(activeDoubleKoSplash, () => setActiveDoubleKoSplash(null))
  useTimedOverlayDismiss(activeObjectionSplash, () => setActiveObjectionSplash(null))
  useTimedOverlayDismiss(activeJudgmentVerdict, () => setActiveJudgmentVerdict(null))

  const activeDetailCell = pendingVersusObjectionReview?.cellIndex ?? detailCell
  const detailGuess =
    pendingVersusObjectionReview?.guess ?? (detailCell !== null ? guesses[detailCell] : null)
  const { row: storedDetailRowCategory, col: storedDetailColCategory } = getCategoriesForCell(
    puzzle,
    detailCell
  )
  const detailRowCategory = pendingVersusObjectionReview?.rowCategory ?? storedDetailRowCategory
  const detailColCategory = pendingVersusObjectionReview?.colCategory ?? storedDetailColCategory
  const activeObjectionLimit = getVersusObjectionLimit(versusObjectionRule)
  const showVersusObjectionModal =
    mode === 'versus' &&
    !objectionPending &&
    (pendingVersusObjectionReview !== null || detailGuess?.objectionUsed === true)
  const objectionDisabled = pendingVersusObjectionReview
    ? versusObjectionsUsed[pendingVersusObjectionReview.player] >= activeObjectionLimit
    : Boolean(detailGuess?.objectionUsed)
  const objectionDisabledLabel =
    pendingVersusObjectionReview && objectionVerdict === null
      ? activeObjectionLimit === 0
        ? 'Objections off'
        : versusObjectionsUsed[pendingVersusObjectionReview.player] >= activeObjectionLimit
          ? 'No objections left'
          : null
      : null

  useEffect(() => {
    setObjectionPending(false)
    setObjectionVerdict(detailGuess?.objectionVerdict ?? null)
    setObjectionExplanation(detailGuess?.objectionExplanation ?? null)
    setActiveObjectionSplash(null)
    setActiveJudgmentPending(null)
  }, [activeDetailCell, detailGuess?.objectionExplanation, detailGuess?.objectionVerdict])

  const resolveVersusRejectedGuess = useCallback(
    (
      invalidGuessResolution: ReturnType<typeof getVersusInvalidGuessResolution>,
      nextVersusObjectionsUsed: VersusObjectionsUsed = versusObjectionsUsed,
      options?: {
        fromOverruledObjection?: boolean
      }
    ) => {
      setPendingVersusObjectionReview(null)
      setDetailCell(null)

      if (!puzzle) {
        return
      }

      if (invalidGuessResolution.kind === 'defender-wins') {
        setWinner(invalidGuessResolution.defender)
        setPendingFinalSteal(null)
        saveGameState(
          {
            puzzleId: puzzle.id,
            puzzle,
            guesses,
            guessesRemaining,
            isComplete: true,
            currentPlayer,
            stealableCell: null,
            winner: invalidGuessResolution.defender,
            pendingFinalSteal: null,
            versusCategoryFilters,
            versusStealRule,
            versusTimerOption,
            versusDisableDraws,
            versusObjectionRule,
            versusObjectionsUsed: nextVersusObjectionsUsed,
            turnTimeLeft,
          },
          mode
        )
      } else {
        setCurrentPlayer(invalidGuessResolution.nextPlayer)
        saveGameState(
          {
            puzzleId: puzzle.id,
            puzzle,
            guesses,
            guessesRemaining,
            isComplete,
            currentPlayer: invalidGuessResolution.nextPlayer,
            stealableCell: null,
            winner,
            pendingFinalSteal,
            versusCategoryFilters,
            versusStealRule,
            versusTimerOption,
            versusDisableDraws,
            versusObjectionRule,
            versusObjectionsUsed: nextVersusObjectionsUsed,
            turnTimeLeft,
          },
          mode
        )
      }

      toast({
        variant: 'destructive',
        title: options?.fromOverruledObjection
          ? 'Objection overruled'
          : invalidGuessResolution.title,
        description: invalidGuessResolution.description,
      })
    },
    [
      currentPlayer,
      guesses,
      guessesRemaining,
      isComplete,
      mode,
      pendingFinalSteal,
      puzzle,
      toast,
      turnTimeLeft,
      versusCategoryFilters,
      versusDisableDraws,
      versusObjectionRule,
      versusObjectionsUsed,
      versusStealRule,
      versusTimerOption,
      winner,
    ]
  )

  const handleCloseDetailModal = useCallback(() => {
    if (objectionPending) {
      return
    }

    if (pendingVersusObjectionReview) {
      resolveVersusRejectedGuess(pendingVersusObjectionReview.invalidGuessResolution)
      return
    }

    setDetailCell(null)
  }, [objectionPending, pendingVersusObjectionReview, resolveVersusRejectedGuess])

  const handleObjection = useCallback(async () => {
    if (
      !detailGuess ||
      !detailRowCategory ||
      !detailColCategory ||
      detailGuess.isCorrect ||
      detailGuess.objectionUsed ||
      activeDetailCell === null ||
      !puzzle
    ) {
      return
    }

    const objectionPlayer = pendingVersusObjectionReview?.player
    if (
      objectionPlayer &&
      versusObjectionsUsed[objectionPlayer] >= getVersusObjectionLimit(versusObjectionRule)
    ) {
      return
    }

    setObjectionPending(true)
    setObjectionVerdict(null)
    setObjectionExplanation(null)
    setActiveObjectionSplash({
      burstId: Date.now(),
      durationMs: 900,
    })
    setActiveJudgmentPending({ burstId: Date.now() })

    try {
      const response = await fetch('/api/objection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guess: detailGuess,
          rowCategory: detailRowCategory,
          colCategory: detailColCategory,
        }),
      })

      const payload = (await response.json()) as {
        error?: string
        verdict?: 'sustained' | 'overruled'
        confidence?: 'low' | 'medium' | 'high'
        explanation?: string
      }

      if (!response.ok || !payload.verdict) {
        throw new Error(payload.error ?? 'Judgment failed.')
      }

      const nextVersusObjectionsUsed =
        objectionPlayer !== undefined
          ? {
              ...versusObjectionsUsed,
              [objectionPlayer]: versusObjectionsUsed[objectionPlayer] + 1,
            }
          : versusObjectionsUsed
      let nextGuess = {
        ...detailGuess,
        objectionUsed: true,
        objectionVerdict: payload.verdict,
        objectionExplanation: payload.explanation ?? null,
        objectionOriginalMatchedRow:
          detailGuess.objectionOriginalMatchedRow ?? detailGuess.matchedRow ?? false,
        objectionOriginalMatchedCol:
          detailGuess.objectionOriginalMatchedCol ?? detailGuess.matchedCol ?? false,
        ...(payload.verdict === 'sustained'
          ? {
              isCorrect: true,
              matchedRow: true,
              matchedCol: true,
            }
          : null),
      }

      const nextGuesses = guesses.map((guess, index) =>
        index === activeDetailCell ? nextGuess : guess
      )

      const shouldCommitGuessToBoard =
        !pendingVersusObjectionReview || payload.verdict === 'sustained'

      if (shouldCommitGuessToBoard) {
        setGuesses(nextGuesses)
      }
      setObjectionVerdict(payload.verdict)
      setObjectionExplanation(payload.explanation ?? null)
      setVersusObjectionsUsed(nextVersusObjectionsUsed)
      setActiveJudgmentVerdict({
        burstId: Date.now(),
        durationMs: 2200,
        verdict: payload.verdict,
      })

      if (mode === 'versus' && pendingVersusObjectionReview) {
        if (payload.verdict === 'sustained') {
          const objectionCellIndex = activeDetailCell
          const objectionPlayer = pendingVersusObjectionReview.player

          if (pendingVersusObjectionReview.isVersusSteal) {
            const effectiveStealRule = versusStealRule === 'higher' ? 'higher' : 'lower'
            const defendingGuess = guesses[objectionCellIndex]

            if (defendingGuess) {
              const stealOutcome = resolveStealOutcome({
                currentPlayer: objectionPlayer,
                defendingGuess,
                attackingGuess: nextGuess,
                rule: effectiveStealRule,
                pendingFinalSteal: pendingFinalSteal as PendingVersusSteal | null,
                selectedCell: objectionCellIndex,
              })
              const showdownDuration =
                animationsEnabled && stealOutcome.hasShowdownScores ? STEAL_SHOWDOWN_DURATION_MS : 0

              if (stealOutcome.hasShowdownScores) {
                setActiveStealShowdown({
                  burstId: Date.now(),
                  durationMs: showdownDuration,
                  defenderName: defendingGuess.gameName,
                  defenderScore: defendingGuess.stealRating!,
                  attackerName: nextGuess.gameName,
                  attackerScore: nextGuess.stealRating!,
                  rule: effectiveStealRule,
                  successful: stealOutcome.successful,
                })
              }

              setPendingVersusObjectionReview(null)
              setDetailCell(null)
              setObjectionVerdict(null)
              setObjectionExplanation(null)

              if (!stealOutcome.successful) {
                const failureDescription = buildStealFailureDescription({
                  pendingFinalSteal,
                  selectedCell: objectionCellIndex,
                  hasShowdownScores: stealOutcome.hasShowdownScores,
                  gameName: nextGuess.gameName,
                  attackingScore: nextGuess.stealRating,
                  defendingGameName: defendingGuess.gameName,
                  defendingScore: defendingGuess.stealRating,
                  versusStealRule: effectiveStealRule,
                  currentPlayer: objectionPlayer,
                })

                const resolveFailedSustainedSteal = () => {
                  const revealedGuesses = stealOutcome.hasShowdownScores
                    ? guesses.map((guess, index) =>
                        index === objectionCellIndex && guess
                          ? {
                              ...guess,
                              showdownScoreRevealed: true,
                            }
                          : guess
                      )
                    : guesses
                  let persistedCurrentPlayer = currentPlayer
                  let persistedWinner = winner
                  let persistedPendingFinalSteal = pendingFinalSteal

                  if (stealOutcome.hasShowdownScores) {
                    setGuesses(revealedGuesses)
                  }

                  for (const action of stealOutcome.actions) {
                    if (action.kind === 'setNextPlayer') {
                      persistedCurrentPlayer = action.player
                    } else if (action.kind === 'setWinner') {
                      persistedWinner = action.player
                    } else if (action.kind === 'clearPendingSteal') {
                      persistedPendingFinalSteal = null
                    }
                  }

                  applyStealActions(stealOutcome.actions)
                  saveGameState(
                    {
                      puzzleId: puzzle.id,
                      puzzle,
                      guesses: revealedGuesses,
                      guessesRemaining,
                      isComplete,
                      currentPlayer: persistedCurrentPlayer,
                      stealableCell: null,
                      winner: persistedWinner,
                      pendingFinalSteal: persistedPendingFinalSteal,
                      versusCategoryFilters,
                      versusStealRule,
                      versusTimerOption,
                      versusDisableDraws,
                      versusObjectionRule,
                      versusObjectionsUsed: nextVersusObjectionsUsed,
                      turnTimeLeft,
                    },
                    mode
                  )
                  toast({
                    variant: 'destructive',
                    title: 'Steal failed',
                    description: failureDescription,
                  })
                }

                if (showdownDuration > 0) {
                  window.setTimeout(resolveFailedSustainedSteal, showdownDuration)
                } else {
                  resolveFailedSustainedSteal()
                }

                return
              }

              nextGuess = {
                ...nextGuess,
                ...(stealOutcome.hasShowdownScores ? { showdownScoreRevealed: true } : null),
              }
              const successfulStealGuesses = guesses.map((guess, index) =>
                index === objectionCellIndex ? nextGuess : guess
              )

              setGuesses(successfulStealGuesses)
              setPendingFinalSteal(null)
              setLockImpactCell(null)
              setStealableCell(stealsEnabled ? objectionCellIndex : null)

              const placementResolution = getVersusPlacementResolution({
                newGuesses: successfulStealGuesses,
                currentPlayer: objectionPlayer,
                selectedCell: objectionCellIndex,
                isVersusSteal: true,
                stealsEnabled,
                disableDraws: versusDisableDraws,
              })

              let persistedCurrentPlayer = currentPlayer
              let persistedWinner = winner
              let persistedStealableCell = stealsEnabled ? objectionCellIndex : null
              let persistedPendingFinalSteal = null

              if (placementResolution.kind === 'final-steal') {
                setPendingFinalSteal({
                  defender: placementResolution.defender,
                  cellIndex: placementResolution.cellIndex,
                })
                setCurrentPlayer(placementResolution.nextPlayer)
                persistedCurrentPlayer = placementResolution.nextPlayer
                persistedPendingFinalSteal = {
                  defender: placementResolution.defender,
                  cellIndex: placementResolution.cellIndex,
                }
              } else if (placementResolution.kind === 'winner') {
                setWinner(placementResolution.winner)
                setStealableCell(null)
                persistedWinner = placementResolution.winner
                persistedStealableCell = null
              } else if (placementResolution.kind === 'claims-win') {
                setWinner(placementResolution.winner)
                setStealableCell(null)
                persistedWinner = placementResolution.winner
                persistedStealableCell = null
              } else if (placementResolution.kind === 'draw') {
                setActiveDoubleKoSplash({
                  burstId: Date.now(),
                  durationMs: 1400,
                })
                setWinner('draw')
                setStealableCell(null)
                persistedWinner = 'draw'
                persistedStealableCell = null
              } else {
                setCurrentPlayer(placementResolution.nextPlayer)
                persistedCurrentPlayer = placementResolution.nextPlayer
              }

              saveGameState(
                {
                  puzzleId: puzzle.id,
                  puzzle,
                  guesses: successfulStealGuesses,
                  guessesRemaining,
                  isComplete,
                  currentPlayer: persistedCurrentPlayer,
                  stealableCell: persistedStealableCell,
                  winner: persistedWinner,
                  pendingFinalSteal: persistedPendingFinalSteal,
                  versusCategoryFilters,
                  versusStealRule,
                  versusTimerOption,
                  versusDisableDraws,
                  versusObjectionRule,
                  versusObjectionsUsed: nextVersusObjectionsUsed,
                  turnTimeLeft,
                },
                mode
              )

              return
            }
          }

          setPendingVersusObjectionReview(null)
          setDetailCell(null)
          setObjectionVerdict(null)
          setObjectionExplanation(null)
          setPendingFinalSteal(null)
          setLockImpactCell(null)
          setStealableCell(stealsEnabled ? objectionCellIndex : null)

          const placementResolution = getVersusPlacementResolution({
            newGuesses: nextGuesses,
            currentPlayer: objectionPlayer,
            selectedCell: objectionCellIndex,
            isVersusSteal: pendingVersusObjectionReview.isVersusSteal,
            stealsEnabled,
            disableDraws: versusDisableDraws,
          })

          let persistedCurrentPlayer = currentPlayer
          let persistedWinner = winner
          let persistedStealableCell = stealsEnabled ? objectionCellIndex : null
          let persistedPendingFinalSteal = null

          if (placementResolution.kind === 'final-steal') {
            setPendingFinalSteal({
              defender: placementResolution.defender,
              cellIndex: placementResolution.cellIndex,
            })
            setCurrentPlayer(placementResolution.nextPlayer)
            persistedCurrentPlayer = placementResolution.nextPlayer
            persistedPendingFinalSteal = {
              defender: placementResolution.defender,
              cellIndex: placementResolution.cellIndex,
            }
          } else if (placementResolution.kind === 'winner') {
            setWinner(placementResolution.winner)
            setStealableCell(null)
            persistedWinner = placementResolution.winner
            persistedStealableCell = null
          } else if (placementResolution.kind === 'claims-win') {
            setWinner(placementResolution.winner)
            setStealableCell(null)
            persistedWinner = placementResolution.winner
            persistedStealableCell = null
          } else if (placementResolution.kind === 'draw') {
            setActiveDoubleKoSplash({
              burstId: Date.now(),
              durationMs: 1400,
            })
            setWinner('draw')
            setStealableCell(null)
            persistedWinner = 'draw'
            persistedStealableCell = null
          } else {
            setCurrentPlayer(placementResolution.nextPlayer)
            persistedCurrentPlayer = placementResolution.nextPlayer
          }

          saveGameState(
            {
              puzzleId: puzzle.id,
              puzzle,
              guesses: nextGuesses,
              guessesRemaining,
              isComplete,
              currentPlayer: persistedCurrentPlayer,
              stealableCell: persistedStealableCell,
              winner: persistedWinner,
              pendingFinalSteal: persistedPendingFinalSteal,
              versusCategoryFilters,
              versusStealRule,
              versusTimerOption,
              versusDisableDraws,
              versusObjectionRule,
              versusObjectionsUsed: nextVersusObjectionsUsed,
              turnTimeLeft,
            },
            mode
          )
        } else {
          setObjectionVerdict(null)
          setObjectionExplanation(null)
          resolveVersusRejectedGuess(
            pendingVersusObjectionReview.invalidGuessResolution,
            nextVersusObjectionsUsed,
            { fromOverruledObjection: true }
          )
        }

        return
      }

      if (payload.verdict === 'sustained') {
        const correctedScore = nextGuesses.filter((guess) => guess?.isCorrect).length
        const correctedRemaining = MAX_GUESSES - correctedScore
        setGuessesRemaining(correctedRemaining)
        saveGameState(
          {
            puzzleId: puzzle.id,
            puzzle,
            guesses: nextGuesses,
            guessesRemaining: correctedRemaining,
            isComplete: correctedRemaining === 0 || nextGuesses.every((guess) => guess !== null),
            versusObjectionsUsed: nextVersusObjectionsUsed,
          },
          mode
        )
      } else {
        saveGameState(
          {
            puzzleId: puzzle.id,
            puzzle,
            guesses: nextGuesses,
            guessesRemaining,
            isComplete,
            ...(mode === 'versus'
              ? {
                  currentPlayer,
                  stealableCell,
                  winner,
                  pendingFinalSteal,
                  versusCategoryFilters,
                  versusStealRule,
                  versusTimerOption,
                  versusDisableDraws,
                  versusObjectionRule,
                  versusObjectionsUsed: nextVersusObjectionsUsed,
                  turnTimeLeft,
                }
              : {}),
          },
          mode
        )
      }

      toast({
        title: payload.verdict === 'sustained' ? 'Objection sustained' : 'Objection overruled',
        description: payload.explanation ?? 'The courtroom judge returned a verdict.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Judgment failed.'
      toast({
        variant: 'destructive',
        title: 'Objection failed',
        description: message,
      })
    } finally {
      setObjectionPending(false)
      setActiveJudgmentPending(null)
    }
  }, [
    activeDetailCell,
    currentPlayer,
    detailColCategory,
    detailGuess,
    detailRowCategory,
    guesses,
    guessesRemaining,
    isComplete,
    mode,
    pendingVersusObjectionReview,
    pendingFinalSteal,
    puzzle,
    stealableCell,
    toast,
    turnTimeLeft,
    versusCategoryFilters,
    versusDisableDraws,
    versusObjectionRule,
    versusObjectionsUsed,
    versusStealRule,
    stealsEnabled,
    versusTimerOption,
    winner,
  ])

  useVersusTurnTimer({
    isVersusMode,
    isLoading,
    loadedPuzzleMode,
    puzzleId: puzzle?.id ?? null,
    currentPlayer,
    winner,
    versusTimerOption,
    turnTimeLeft,
    pendingFinalSteal,
    animationsEnabled,
    audioEnabled: versusAudioEnabled,
    activeTurnTimerKeyRef,
    setTurnTimeLeft,
    onTurnExpired: (nextPlayer) => {
      setSelectedCell(null)
      setCurrentPlayer(nextPlayer)
      setStealableCell(null)
      toast({
        variant: 'destructive',
        title: 'Turn expired',
        description: `${getPlayerLabel(nextPlayer)} is up.`,
      })
    },
  })

  // Load puzzle
  const loadPuzzle = useCallback(
    async (gameMode: GameMode, customFilters?: VersusCategoryFilters) => {
      if (isPuzzleLoadInFlightRef.current) {
        return
      }

      isPuzzleLoadInFlightRef.current = true
      const shouldPersist = true
      const streamMode = gameMode === 'daily' ? 'daily' : 'practice'
      const savedState = loadGameState(gameMode)
      const effectiveFilters =
        gameMode === 'versus'
          ? (customFilters ?? versusCategoryFilters)
          : gameMode === 'practice'
            ? (customFilters ?? practiceCategoryFilters)
            : undefined

      if (savedState?.puzzle) {
        recordedVersusWinnerKeyRef.current =
          gameMode === 'versus' && savedState.winner
            ? `${savedState.puzzle.id}:${savedState.winner}`
            : null
        activeTurnTimerKeyRef.current =
          gameMode === 'versus' && savedState.currentPlayer
            ? `${savedState.puzzle.id}:${savedState.currentPlayer}`
            : null
        setLoadedPuzzleMode(gameMode)
        setPuzzle(savedState.puzzle)
        setGuesses(savedState.guesses as (CellGuess | null)[])
        setGuessesRemaining(savedState.guessesRemaining)
        setCurrentPlayer(savedState.currentPlayer ?? 'x')
        setStealableCell(savedState.stealableCell ?? null)
        setWinner(savedState.winner ?? null)
        setPendingFinalSteal(savedState.pendingFinalSteal ?? null)
        setVersusCategoryFilters((savedState.versusCategoryFilters as VersusCategoryFilters) ?? {})
        setVersusStealRule(savedState.versusStealRule ?? 'lower')
        setVersusTimerOption(savedState.versusTimerOption ?? 'none')
        setVersusDisableDraws(savedState.versusDisableDraws ?? false)
        setVersusObjectionRule(savedState.versusObjectionRule ?? 'off')
        setVersusObjectionsUsed({
          x: savedState.versusObjectionsUsed?.x ?? 0,
          o: savedState.versusObjectionsUsed?.o ?? 0,
        })
        setTurnTimeLeft(savedState.turnTimeLeft ?? null)
        setLockImpactCell(null)
        setSelectedCell(null)
        setShowResults(savedState.isComplete)
        setDetailCell(null)
        setIsLoading(false)
        isPuzzleLoadInFlightRef.current = false
        return
      }

      setIsLoading(true)
      activeTurnTimerKeyRef.current = null
      recordedVersusWinnerKeyRef.current = null
      setGuesses(Array(9).fill(null))
      setGuessesRemaining(gameMode === 'versus' ? MAX_GUESSES : MAX_GUESSES)
      setCurrentPlayer('x')
      setStealableCell(null)
      setWinner(null)
      setPendingFinalSteal(null)
      if (gameMode !== 'versus') {
        setVersusObjectionRule('off')
      }
      setVersusObjectionsUsed({ x: 0, o: 0 })
      setPendingVersusObjectionReview(null)
      setLockImpactCell(null)
      setSelectedCell(null)
      setShowResults(false)
      setDetailCell(null)

      setLoadingProgress(8)
      setLoadingStage(
        gameMode === 'daily' ? "Loading today's board..." : 'Warming up the puzzle generator...'
      )
      setLoadingAttempts([])
      const controller = new AbortController()
      activePuzzleLoadControllerRef.current?.abort()
      activePuzzleLoadControllerRef.current = controller

      try {
        let puzzleData: Puzzle | null = null

        const params = new URLSearchParams({ mode: streamMode })
        if (gameMode === 'versus' || gameMode === 'practice') {
          if (effectiveFilters && Object.keys(effectiveFilters).length > 0) {
            params.set('filters', JSON.stringify(effectiveFilters))
          }
        }

        const response = await fetch(`/api/puzzle-stream?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!response.ok || !response.body) {
          throw new Error('Failed to open puzzle stream')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split('\n\n')
          buffer = events.pop() ?? ''

          for (const eventChunk of events) {
            const dataLine = eventChunk.split('\n').find((line) => line.startsWith('data: '))

            if (!dataLine) {
              continue
            }

            const event = JSON.parse(dataLine.slice(6)) as PuzzleStreamMessage

            if (event.type === 'progress') {
              if (typeof event.pct === 'number') {
                setLoadingProgress((current) => Math.max(current, event.pct!))
              }
              if (event.message) {
                setLoadingStage(event.message)
              }
              if (event.stage === 'attempt' && event.attempt && event.rows && event.cols) {
                setLoadingAttempts((current) => {
                  const nextAttempt: LoadingAttempt = {
                    attempt: event.attempt!,
                    rows: event.rows!,
                    cols: event.cols!,
                    intersections: buildAttemptIntersections(event.rows!, event.cols!),
                  }
                  const filtered = current.filter((entry) => entry.attempt !== event.attempt)
                  return [...filtered, nextAttempt].slice(-4)
                })
              }
              if (
                event.stage === 'cell' &&
                typeof event.attempt === 'number' &&
                typeof event.cellIndex === 'number'
              ) {
                setLoadingAttempts((current) =>
                  current.map((entry) => {
                    if (entry.attempt !== event.attempt) {
                      return entry
                    }

                    const intersections = entry.intersections.map((intersection, index) =>
                      index === event.cellIndex
                        ? {
                            ...intersection,
                            status: (event.passed
                              ? 'passed'
                              : 'failed') as LoadingIntersection['status'],
                            validOptionCount: event.passed ? undefined : event.validOptionCount,
                          }
                        : intersection
                    )

                    return { ...entry, intersections }
                  })
                )
              }
              if (
                event.stage === 'metadata' &&
                typeof event.attempt === 'number' &&
                typeof event.cellIndex === 'number'
              ) {
                setLoadingAttempts((current) =>
                  current.map((entry) => {
                    if (entry.attempt !== event.attempt) {
                      return entry
                    }

                    const intersections = entry.intersections.map((intersection, index) =>
                      index === event.cellIndex
                        ? {
                            ...intersection,
                            status: 'passed' as LoadingIntersection['status'],
                            validOptionCount: event.validOptionCount,
                          }
                        : intersection
                    )

                    return { ...entry, intersections }
                  })
                )
              }
              if (event.stage === 'rejected' && typeof event.attempt === 'number') {
                setLoadingAttempts((current) =>
                  current.map((entry) =>
                    entry.attempt === event.attempt
                      ? { ...entry, rejectedMessage: event.message ?? 'Rejected' }
                      : entry
                  )
                )
              }
            } else if (event.type === 'puzzle' && event.puzzle) {
              puzzleData = event.puzzle
            } else if (event.type === 'error') {
              throw new Error(event.message ?? 'Failed to generate puzzle')
            }
          }
        }

        if (!puzzleData) {
          throw new Error('Puzzle stream completed without a puzzle')
        }

        setLoadingProgress(100)
        setLoadingStage('Board ready.')
        setLoadedPuzzleMode(gameMode)
        setPuzzle(puzzleData)

        if (shouldPersist) {
          saveGameState(
            {
              puzzleId: puzzleData.id,
              puzzle: puzzleData,
              guesses: Array(9).fill(null),
              guessesRemaining: MAX_GUESSES,
              isComplete: false,
              ...(gameMode === 'versus'
                ? {
                    currentPlayer: 'x' as const,
                    stealableCell: null,
                    winner: null,
                    pendingFinalSteal: null,
                    versusCategoryFilters: effectiveFilters ?? {},
                    versusStealRule: versusStealRuleRef.current,
                    versusTimerOption: versusTimerOptionRef.current,
                    versusDisableDraws: versusDisableDrawsRef.current,
                    versusObjectionRule: versusObjectionRuleRef.current,
                    versusObjectionsUsed: { x: 0, o: 0 },
                    turnTimeLeft:
                      versusTimerOptionRef.current === 'none' ? null : versusTimerOptionRef.current,
                  }
                : {}),
            },
            gameMode
          )
        }

        if (savedState && savedState.puzzleId === puzzleData.id) {
          setGuesses(savedState.guesses as (CellGuess | null)[])
          setGuessesRemaining(savedState.guessesRemaining)
          if (savedState.isComplete) setShowResults(true)
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }

        console.error('Failed to load puzzle:', error)
        const hadCustomFilters = Boolean(
          effectiveFilters && Object.keys(effectiveFilters).length > 0
        )
        const generationErrorMessage =
          error instanceof Error && error.message
            ? error.message
            : 'No valid board could be generated from that combination. Try widening a category family or enabling more options.'

        if (gameMode === 'practice' && hadCustomFilters) {
          setPracticeSetupError(generationErrorMessage)
          setShowPracticeStartOptions(false)
          setShowPracticeSetup(true)
        } else if (gameMode === 'versus' && hadCustomFilters) {
          setVersusSetupError(generationErrorMessage)
          setShowVersusStartOptions(false)
          setShowVersusSetup(true)
        } else {
          toast({
            variant: 'destructive',
            title: 'Puzzle generation failed',
            description: 'Please try again.',
          })
        }
      } finally {
        if (activePuzzleLoadControllerRef.current === controller) {
          activePuzzleLoadControllerRef.current = null
        }
        isPuzzleLoadInFlightRef.current = false
        setIsLoading(false)
      }
    },
    [practiceCategoryFilters, toast, versusCategoryFilters]
  )

  useEffect(() => {
    if (mode !== 'versus' || !puzzle || loadedPuzzleMode !== 'versus') {
      return
    }

    saveGameState(
      {
        puzzleId: puzzle.id,
        puzzle,
        guesses,
        guessesRemaining,
        isComplete,
        currentPlayer,
        stealableCell,
        winner,
        pendingFinalSteal,
        versusCategoryFilters,
        versusStealRule,
        versusTimerOption,
        versusDisableDraws,
        versusObjectionRule,
        versusObjectionsUsed,
        turnTimeLeft,
      },
      'versus'
    )
  }, [
    currentPlayer,
    guesses,
    guessesRemaining,
    isComplete,
    mode,
    loadedPuzzleMode,
    pendingFinalSteal,
    puzzle,
    stealableCell,
    turnTimeLeft,
    versusCategoryFilters,
    versusStealRule,
    versusTimerOption,
    versusDisableDraws,
    versusObjectionRule,
    versusObjectionsUsed,
    winner,
  ])

  useEffect(() => {
    if (mode === 'practice' && showPracticeStartOptions) {
      setIsLoading(false)
      return
    }

    if (mode === 'versus' && showVersusStartOptions) {
      setIsLoading(false)
      return
    }

    if (mode === 'practice' && skipNextPracticeAutoLoadRef.current) {
      skipNextPracticeAutoLoadRef.current = false
      return
    }

    if (mode === 'versus' && skipNextVersusAutoLoadRef.current) {
      skipNextVersusAutoLoadRef.current = false
      return
    }

    if (isPuzzleLoadInFlightRef.current) {
      return
    }

    if (loadedPuzzleMode === mode && puzzle) {
      return
    }

    loadPuzzle(mode)
  }, [loadPuzzle, loadedPuzzleMode, mode, puzzle, showPracticeStartOptions, showVersusStartOptions])

  // Handle mode change
  const handleModeChange = (newMode: GameMode) => {
    if (newMode !== mode) {
      activePuzzleLoadControllerRef.current?.abort()

      if (newMode === 'practice') {
        const hasSavedPracticeState = Boolean(loadGameState('practice')?.puzzle)
        setShowVersusStartOptions(false)
        setShowVersusSetup(false)
        setVersusSetupError(null)
        setShowPracticeSetup(false)
        setPracticeSetupError(null)

        if (!hasSavedPracticeState) {
          setLoadedPuzzleMode(null)
          setPuzzle(null)
          setGuesses(Array(9).fill(null))
          setSelectedCell(null)
          setShowResults(false)
          setWinner(null)
          setStealableCell(null)
          setShowPracticeStartOptions(true)
        } else {
          setShowPracticeStartOptions(false)
        }
      } else if (newMode === 'versus') {
        setShowPracticeStartOptions(false)
        setShowPracticeSetup(false)
        setPracticeSetupError(null)
        setVersusSetupError(null)
        const hasSavedVersusState = Boolean(loadGameState('versus')?.puzzle)

        if (!hasSavedVersusState) {
          setLoadedPuzzleMode(null)
          setPuzzle(null)
          setGuesses(Array(9).fill(null))
          setSelectedCell(null)
          setShowResults(false)
          setWinner(null)
          setStealableCell(null)
          setShowVersusStartOptions(true)
        } else {
          setShowVersusStartOptions(false)
        }
      } else {
        setShowPracticeStartOptions(false)
        setShowPracticeSetup(false)
        setPracticeSetupError(null)
        setShowVersusStartOptions(false)
        setShowVersusSetup(false)
        setVersusSetupError(null)
      }
      setMode(newMode)
    }
  }

  const handleApplyPracticeFilters = (
    filters: VersusCategoryFilters,
    stealRule: VersusStealRule,
    timerOption: VersusTurnTimerOption,
    disableDraws: boolean,
    objectionRule: VersusObjectionRule
  ) => {
    void stealRule
    void timerOption
    void disableDraws
    void objectionRule
    setPracticeCategoryFilters(filters)
    setPracticeSetupError(null)
    setShowPracticeSetup(false)
    setShowPracticeStartOptions(false)
    skipNextPracticeAutoLoadRef.current = true
    clearGameState('practice')
    loadPuzzle('practice', filters)
  }

  const handleApplyVersusFilters = (
    filters: VersusCategoryFilters,
    stealRule: VersusStealRule,
    timerOption: VersusTurnTimerOption,
    disableDraws: boolean,
    objectionRule: VersusObjectionRule
  ) => {
    setVersusCategoryFilters(filters)
    setVersusSetupError(null)
    versusStealRuleRef.current = stealRule
    versusTimerOptionRef.current = timerOption
    versusDisableDrawsRef.current = disableDraws
    versusObjectionRuleRef.current = objectionRule
    setVersusStealRule(stealRule)
    setVersusTimerOption(timerOption)
    setVersusDisableDraws(disableDraws)
    setVersusObjectionRule(objectionRule)
    setShowVersusSetup(false)
    setShowVersusStartOptions(false)
    skipNextVersusAutoLoadRef.current = true
    clearGameState('versus')
    loadPuzzle('versus', filters)
  }

  const hydrateGuessDetails = useCallback(
    async (cellIndex: number) => {
      if (!puzzle) return

      const guess = guesses[cellIndex]
      if (!guess) return

      if (isGuessHydrated(guess)) {
        return
      }

      const { row: rowCategory, col: colCategory } = getCategoriesForCell(puzzle, cellIndex)
      if (!rowCategory || !colCategory) {
        return
      }

      try {
        const result = await lookupGuessDetails(fetch, {
          gameId: guess.gameId,
          rowCategory,
          colCategory,
        })
        if (!result.game) {
          return
        }

        setGuesses((current) =>
          current.map((existingGuess, index) => {
            if (index !== cellIndex || !existingGuess) {
              return existingGuess
            }

            return hydrateStoredGuess(existingGuess, result)
          })
        )
      } catch (error) {
        console.error('Failed to hydrate guess details:', error)
      }
    },
    [guesses, puzzle]
  )

  // Handle cell click
  const handleCellClick = async (index: number) => {
    if (activeStealShowdown) {
      return
    }

    if (mode === 'versus') {
      if (isComplete) return
      if (pendingFinalSteal && index !== pendingFinalSteal.cellIndex) {
        return
      }

      const existingGuess = guesses[index]
      const canSteal =
        stealsEnabled &&
        existingGuess !== null &&
        existingGuess.owner !== currentPlayer &&
        stealableCell === index

      if (existingGuess && !canSteal) {
        return
      }

      setSelectedCell(index)
      return
    }

    if (guesses[index] !== null) {
      await hydrateGuessDetails(index)
      setDetailCell(index)
      return
    }
    if (isComplete) return
    setSelectedCell(index)
  }

  // Handle game selection
  const handleGameSelect = async (game: Game) => {
    if (selectedCell === null || !puzzle) return

    const existingGuess = guesses[selectedCell]
    const isVersusSteal =
      mode === 'versus' &&
      stealsEnabled &&
      existingGuess !== null &&
      existingGuess.owner !== currentPlayer &&
      stealableCell === selectedCell

    if (isDuplicateGuessSelection(guesses, game.id, mode, selectedCell)) {
      toast({
        variant: 'destructive',
        title: 'Game already used',
        description: 'Each game can only be used once per grid.',
      })
      return
    }

    const rowIndex = Math.floor(selectedCell / 3)
    const colIndex = selectedCell % 3
    const rowCategory = puzzle.row_categories[rowIndex]
    const colCategory = puzzle.col_categories[colIndex]

    try {
      const result = await submitGuessSelection(fetch, {
        puzzleId: puzzle.id,
        cellIndex: selectedCell,
        gameId: game.id,
        gameName: game.name,
        gameImage: game.background_image,
        sessionId,
        rowCategory,
        colCategory,
        isDaily: mode === 'daily',
      })

      if (result.duplicate) {
        toast({
          variant: 'destructive',
          title: 'Game already used',
          description: 'Each game can only be used once per grid.',
        })
        return
      }

      let newGuess = buildGuessFromSelection({
        game,
        result,
        mode,
        currentPlayer,
      })

      if (mode === 'versus' && !result.valid) {
        setSelectedCell(null)
        setStealableCell(null)
        setLockImpactCell(null)
        const missReason = buildMissReason(
          rowCategory,
          colCategory,
          result.matchesRow,
          result.matchesCol
        )
        if (isVersusSteal) {
          setActiveStealMissSplash({
            burstId: Date.now(),
            durationMs: 900,
          })
        }

        const invalidGuessResolution = getVersusInvalidGuessResolution({
          currentPlayer,
          pendingFinalSteal,
          selectedCell,
          missReason,
        })

        const availableObjectionCount =
          getVersusObjectionLimit(versusObjectionRule) - versusObjectionsUsed[currentPlayer]

        if (availableObjectionCount <= 0) {
          resolveVersusRejectedGuess(invalidGuessResolution)
          return
        }

        setPendingVersusObjectionReview({
          cellIndex: selectedCell,
          player: currentPlayer,
          isVersusSteal,
          guess: newGuess,
          rowCategory,
          colCategory,
          invalidGuessResolution,
        })
        setDetailCell(selectedCell)
        return
      }

      if (mode === 'versus' && isVersusSteal) {
        const outcome = resolveStealOutcome({
          currentPlayer,
          defendingGuess: existingGuess,
          attackingGuess: newGuess,
          rule: versusStealRule,
          pendingFinalSteal: pendingFinalSteal as PendingVersusSteal | null,
          selectedCell,
        })
        const defendingScore = existingGuess.stealRating
        const attackingScore = newGuess.stealRating
        const showdownDuration =
          animationsEnabled && outcome.hasShowdownScores ? STEAL_SHOWDOWN_DURATION_MS : 0

        if (outcome.hasShowdownScores) {
          setActiveStealShowdown({
            burstId: Date.now(),
            durationMs: showdownDuration,
            defenderName: existingGuess.gameName,
            defenderScore: defendingScore!,
            attackerName: game.name,
            attackerScore: attackingScore!,
            rule: versusStealRule === 'higher' ? 'higher' : 'lower',
            successful: outcome.successful,
          })
        }

        if (!outcome.successful) {
          const failureDescription = buildStealFailureDescription({
            pendingFinalSteal,
            selectedCell,
            hasShowdownScores: outcome.hasShowdownScores,
            gameName: game.name,
            attackingScore,
            defendingGameName: existingGuess.gameName,
            defendingScore,
            versusStealRule,
            currentPlayer,
          })

          const resolveFailedSteal = () => {
            if (outcome.hasShowdownScores) {
              setGuesses((current) =>
                current.map((guess, index) =>
                  index === selectedCell && guess
                    ? {
                        ...guess,
                        showdownScoreRevealed: true,
                      }
                    : guess
                )
              )
            }
            applyStealActions(outcome.actions)
            toast({
              variant: 'destructive',
              title: 'Steal failed',
              description: failureDescription,
            })
          }

          if (showdownDuration > 0) {
            window.setTimeout(resolveFailedSteal, showdownDuration)
          } else {
            resolveFailedSteal()
          }
          return
        }

        if (outcome.hasShowdownScores) {
          newGuess = {
            ...newGuess,
            showdownScoreRevealed: true,
          }
        }
      }

      const postGuessState = getPostGuessState({
        mode,
        puzzle,
        guesses,
        selectedCell,
        guessesRemaining,
        newGuess,
      })
      const newGuesses = postGuessState.nextGuesses
      setGuesses(newGuesses)

      if (newGuess.isCorrect) {
        const easterEggDefinition = getEasterEggDefinition(game.id)

        if (easterEggDefinition) {
          triggerEasterEggCelebration(game.id)

          if (easterEggDefinition.achievementId) {
            unlockAchievementWithToast(easterEggDefinition.achievementId, {
              imageUrl: game.background_image,
            })
          }
        }

        if (shouldUnlockRealStinker(game)) {
          triggerRealStinkerCelebration()
          unlockAchievementWithToast('real-stinker')
        }
      }

      const newGuessesRemaining = postGuessState.nextGuessesRemaining
      setGuessesRemaining(newGuessesRemaining)
      setSelectedCell(null)

      if (postGuessState.persistedState) {
        saveGameState(postGuessState.persistedState, mode)
      }

      if (mode === 'versus') {
        setPendingFinalSteal(null)
        setLockImpactCell(null)
        setStealableCell(stealsEnabled ? selectedCell : null)

        const placementResolution = getVersusPlacementResolution({
          newGuesses,
          currentPlayer,
          selectedCell,
          isVersusSteal,
          stealsEnabled,
          disableDraws: versusDisableDraws,
        })

        if (placementResolution.kind === 'final-steal') {
          setPendingFinalSteal({
            defender: placementResolution.defender,
            cellIndex: placementResolution.cellIndex,
          })
          setCurrentPlayer(placementResolution.nextPlayer)
          toast({
            title: placementResolution.title,
            description: placementResolution.description,
          })
          return
        }

        if (placementResolution.kind === 'winner') {
          setWinner(placementResolution.winner)
          setStealableCell(null)
          toast({
            title: placementResolution.title,
            description: placementResolution.description,
          })
          return
        }

        if (placementResolution.kind === 'claims-win') {
          setWinner(placementResolution.winner)
          setStealableCell(null)
          toast({
            title: placementResolution.title,
            description: placementResolution.description,
          })
          return
        }

        if (placementResolution.kind === 'draw') {
          setActiveDoubleKoSplash({
            burstId: Date.now(),
            durationMs: 1400,
          })
          setWinner('draw')
          setStealableCell(null)
          toast({
            title: placementResolution.title,
            description: placementResolution.description,
          })
          return
        }

        setCurrentPlayer(placementResolution.nextPlayer)
        toast({
          title: placementResolution.title,
          description: placementResolution.description,
        })
        return
      }

      const completionEffects = getPostGuessCompletionEffects({
        mode,
        isComplete: postGuessState.isComplete,
        finalScore: postGuessState.finalScore,
      })

      if (completionEffects.shouldUnlockPerfectGrid) {
        unlockAchievementWithToast('perfect-grid')
        triggerPerfectCelebration()
      }

      if (completionEffects.shouldPostDailyStats && postGuessState.finalScore !== null) {
        await postDailyStats(
          fetch,
          buildDailyStatsPayload({
            puzzleId: puzzle.id,
            sessionId,
            score: postGuessState.finalScore,
          })
        )
      }

      if (completionEffects.shouldShowResults) {
        setTimeout(() => setShowResults(true), 500)
      }
    } catch (error) {
      console.error('Guess error:', error)
      toast({
        variant: 'destructive',
        title: 'Guess failed',
        description: 'Something went wrong while checking that game.',
      })
    }
  }

  // Handle starting a fresh non-daily board
  const handleNewGame = () => {
    activePuzzleLoadControllerRef.current?.abort()

    if (mode === 'practice') {
      clearGameState('practice')
      skipNextPracticeAutoLoadRef.current = true
      loadPuzzle('practice', practiceCategoryFilters)
      return
    }

    clearGameState('versus')
    setShowVersusStartOptions(false)
    skipNextVersusAutoLoadRef.current = true
    loadPuzzle('versus', versusCategoryFilters)
  }

  // Get categories for selected cell
  const { row: selectedRowCategory, col: selectedColCategory } = getCategoriesForCell(
    puzzle,
    selectedCell
  )
  const minimumCellOptions = puzzle?.cell_metadata?.reduce(
    (lowest, cell) => Math.min(lowest, cell.validOptionCount),
    Number.POSITIVE_INFINITY
  )
  const resolvedMinimumCellOptions: number | null = Number.isFinite(
    minimumCellOptions ?? Number.NaN
  )
    ? (minimumCellOptions ?? null)
    : null
  const turnTimerLabel =
    isVersusMode && turnTimeLeft !== null
      ? `Turn: ${Math.floor(turnTimeLeft / 60)}:${String(turnTimeLeft % 60).padStart(2, '0')}`
      : null
  const activeCategoryTypes = puzzle
    ? Array.from(
        new Set([
          ...puzzle.row_categories.map((category) => category.type),
          ...puzzle.col_categories.map((category) => category.type),
        ])
      )
    : []

  if (isLoading) {
    return (
      <PuzzleLoadingScreen
        mode={mode}
        loadingStage={loadingStage}
        loadingProgress={loadingProgress}
        loadingAttempts={loadingAttempts}
      />
    )
  }

  if (!puzzle) {
    if (
      (mode === 'versus' && showVersusStartOptions) ||
      (mode === 'practice' && showPracticeStartOptions)
    ) {
      return (
        <ModeStartScreen
          mode={mode}
          guessesRemaining={guessesRemaining}
          score={score}
          currentPlayer={currentPlayer}
          winner={winner}
          versusRecord={versusRecord}
          versusObjectionsUsed={versusObjectionsUsed}
          isHowToPlayOpen={showHowToPlay}
          isAchievementsOpen={showAchievements}
          hasActiveCustomSetup={hasActiveCustomSetup}
          minimumCellOptions={resolvedMinimumCellOptions}
          dailyResetLabel={dailyResetLabel}
          showPracticeSetup={showPracticeSetup}
          showVersusSetup={showVersusSetup}
          practiceSetupError={practiceSetupError}
          versusSetupError={versusSetupError}
          practiceCategoryFilters={practiceCategoryFilters}
          versusCategoryFilters={versusCategoryFilters}
          versusStealRule={versusStealRule}
          versusTimerOption={versusTimerOption}
          versusDisableDraws={versusDisableDraws}
          versusObjectionRule={versusObjectionRule}
          onModeChange={handleModeChange}
          onAchievementsOpen={() => setShowAchievements(true)}
          onAchievementsClose={() => setShowAchievements(false)}
          onHowToPlayOpen={() => setShowHowToPlay(true)}
          onHowToPlayClose={() => setShowHowToPlay(false)}
          onOpenPracticeSetup={() => setShowPracticeSetup(true)}
          onOpenVersusSetup={() => setShowVersusSetup(true)}
          onClosePracticeSetup={() => setShowPracticeSetup(false)}
          onCloseVersusSetup={() => setShowVersusSetup(false)}
          onStartStandard={() => {
            if (mode === 'practice') {
              setPracticeCategoryFilters({})
              setPracticeSetupError(null)
              setShowPracticeStartOptions(false)
              skipNextPracticeAutoLoadRef.current = true
              clearGameState('practice')
              loadPuzzle('practice', {})
              return
            }

            setVersusCategoryFilters({})
            setVersusSetupError(null)
            versusStealRuleRef.current = 'lower'
            versusTimerOptionRef.current = 'none'
            versusDisableDrawsRef.current = false
            versusObjectionRuleRef.current = 'off'
            setVersusStealRule('lower')
            setVersusTimerOption('none')
            setVersusDisableDraws(false)
            setVersusObjectionRule('off')
            setShowVersusStartOptions(false)
            skipNextVersusAutoLoadRef.current = true
            clearGameState('versus')
            loadPuzzle('versus', {})
          }}
          onApplyPracticeFilters={handleApplyPracticeFilters}
          onApplyVersusFilters={handleApplyVersusFilters}
        />
      )
    }

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load puzzle</p>
          <button onClick={() => loadPuzzle(mode)} className="text-primary hover:underline">
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <main id="top" className="min-h-screen py-6 px-4">
      {animationsEnabled && activeEasterEgg && <EasterEggCelebration {...activeEasterEgg} />}
      {animationsEnabled && activePerfectCelebration && (
        <PerfectGridCelebration {...activePerfectCelebration} />
      )}
      {animationsEnabled && activeStealShowdown && (
        <StealShowdownOverlay {...activeStealShowdown} lowEffects={animationQuality === 'low'} />
      )}
      {animationsEnabled && activeStealMissSplash && <StealMissSplash {...activeStealMissSplash} />}
      {animationsEnabled && activeDoubleKoSplash && <DoubleKoSplash {...activeDoubleKoSplash} />}
      {activeObjectionSplash && <ObjectionSplash {...activeObjectionSplash} />}
      {activeJudgmentPending && <JudgmentPendingOverlay {...activeJudgmentPending} />}
      {activeJudgmentVerdict && <JudgmentVerdictSplash {...activeJudgmentVerdict} />}

      <div className="mx-auto w-full max-w-xl">
        <GameHeader
          mode={mode}
          guessesRemaining={guessesRemaining}
          score={score}
          currentPlayer={isVersusMode ? currentPlayer : null}
          winner={isVersusMode ? winner : null}
          versusRecord={versusRecord}
          versusObjectionRule={versusObjectionRule}
          versusObjectionsUsed={versusObjectionsUsed}
          dailyResetLabel={mode === 'daily' ? dailyResetLabel : null}
          isHowToPlayOpen={showHowToPlay}
          isAchievementsOpen={showAchievements}
          hasActiveCustomSetup={hasActiveCustomSetup}
          onModeChange={handleModeChange}
          onAchievements={() => setShowAchievements(true)}
          onHowToPlay={() => setShowHowToPlay(true)}
          onNewGame={mode === 'practice' || mode === 'versus' ? handleNewGame : undefined}
          onCustomizeGame={
            mode === 'practice'
              ? () => setShowPracticeSetup(true)
              : mode === 'versus'
                ? () => setShowVersusSetup(true)
                : undefined
          }
        />
      </div>

      {puzzle.validation_status && puzzle.validation_status !== 'validated' && (
        <div className="max-w-lg mx-auto mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium text-amber-200">Cross-sections are not fully validated</p>
          <p className="mt-1 text-amber-100/90">
            {puzzle.validation_message ??
              'This puzzle may contain weaker or less certain intersections than usual.'}
          </p>
        </div>
      )}

      <div className="relative mx-auto w-full max-w-xl">
        <GameGrid
          rowCategories={puzzle.row_categories}
          colCategories={puzzle.col_categories}
          guesses={guesses}
          cellMetadata={puzzle.cell_metadata}
          selectedCell={selectedCell}
          stealableCell={isVersusMode ? stealableCell : null}
          finalStealCell={isVersusMode ? (pendingFinalSteal?.cellIndex ?? null) : null}
          currentPlayer={isVersusMode ? currentPlayer : null}
          score={!isVersusMode ? score : undefined}
          guessesRemaining={!isVersusMode ? guessesRemaining : undefined}
          winner={isVersusMode ? winner : null}
          turnTimerLabel={isVersusMode ? turnTimerLabel : null}
          turnTimerSeconds={isVersusMode ? turnTimeLeft : null}
          turnTimerMaxSeconds={
            isVersusMode && versusTimerOption !== 'none' ? versusTimerOption : null
          }
          versusRecord={versusRecord}
          alarmsEnabled={!isVersusMode || versusAlarmsEnabled}
          animationsEnabled={animationsEnabled}
          lockImpactCell={isVersusMode ? lockImpactCell : null}
          isGameOver={isComplete}
          onCellClick={handleCellClick}
        />
      </div>

      <Dialog
        open={isVersusMode && winner !== null && showVersusWinnerBanner}
        onOpenChange={(open) => {
          if (!open) {
            setShowVersusWinnerBanner(false)
          }
        }}
      >
        <DialogContent className="max-w-md border-border bg-card/95 p-5 text-center shadow-xl backdrop-blur-sm">
          <DialogTitle className="sr-only">
            {winner === 'draw'
              ? 'Versus match ended in a draw'
              : `${getPlayerLabel(winner ?? 'x')} wins the match`}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {winner === 'draw'
              ? 'The versus match ended in a draw. Close this dialog to review the finished board or start a new match.'
              : 'The versus match is over. Close this dialog to review the finished board or start a new match.'}
          </DialogDescription>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Match Over
          </p>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {winner === 'draw' ? 'Draw game' : `${getPlayerLabel(winner ?? 'x')} wins`}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {winner === 'draw'
              ? 'No line was completed before the board filled up.'
              : 'Click outside to review the finished board, or start a new match.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setShowVersusWinnerBanner(false)}
              className="rounded-lg border border-border bg-secondary/40 px-4 py-2.5 font-medium text-foreground transition-colors hover:bg-secondary/65"
            >
              Hide
            </button>
            <button
              onClick={handleNewGame}
              className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              New Match
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Show results button when complete */}
      {!isVersusMode && isComplete && !showResults && (
        <div className="max-w-lg mx-auto mt-6 text-center">
          <button
            onClick={() => setShowResults(true)}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            View Results
          </button>
        </div>
      )}

      <GameSearch
        isOpen={selectedCell !== null}
        puzzleId={mode === 'daily' ? puzzle.id : undefined}
        hideScores={mode === 'versus'}
        confirmBeforeSelect={confirmBeforeSelect}
        lowEffects={animationQuality === 'low'}
        turnTimerLabel={isVersusMode ? turnTimerLabel : null}
        turnTimerSeconds={isVersusMode ? turnTimeLeft : null}
        activeCategoryTypes={activeCategoryTypes}
        rowCategory={selectedRowCategory}
        colCategory={selectedColCategory}
        onSelect={handleGameSelect}
        onClose={() => setSelectedCell(null)}
      />

      {!isVersusMode && (
        <ResultsModal
          isOpen={showResults}
          onClose={() => setShowResults(false)}
          guesses={guesses}
          puzzleId={puzzle.id}
          puzzleDate={puzzle.date}
          rowCategories={puzzle.row_categories}
          colCategories={puzzle.col_categories}
          isDaily={mode === 'daily'}
          onPlayAgain={handleNewGame}
        />
      )}

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        mode={mode}
        minimumCellOptions={resolvedMinimumCellOptions}
        validationStatus={puzzle.validation_status}
        dailyResetLabel={dailyResetLabel}
      />

      <AchievementsModal isOpen={showAchievements} onClose={() => setShowAchievements(false)} />

      <VersusSetupModal
        mode="practice"
        isOpen={showPracticeSetup}
        onClose={() => setShowPracticeSetup(false)}
        errorMessage={practiceSetupError}
        filters={practiceCategoryFilters}
        stealRule="off"
        timerOption="none"
        disableDraws={false}
        objectionRule="off"
        onApply={handleApplyPracticeFilters}
      />

      <VersusSetupModal
        isOpen={showVersusSetup}
        onClose={() => setShowVersusSetup(false)}
        mode="versus"
        errorMessage={versusSetupError}
        filters={versusCategoryFilters}
        stealRule={versusStealRule}
        timerOption={versusTimerOption}
        disableDraws={versusDisableDraws}
        objectionRule={versusObjectionRule}
        onApply={handleApplyVersusFilters}
      />

      {showVersusObjectionModal ? (
        <VersusObjectionModal
          isOpen
          onClose={handleCloseDetailModal}
          guess={detailGuess}
          rowCategory={detailRowCategory}
          colCategory={detailColCategory}
          onObjection={handleObjection}
          objectionPending={objectionPending}
          objectionVerdict={objectionVerdict}
          objectionExplanation={objectionExplanation}
          objectionDisabled={objectionDisabled}
          objectionDisabledLabel={objectionDisabledLabel}
        />
      ) : (
        <GuessDetailsModal
          isOpen={
            (detailCell !== null && detailGuess !== null) || pendingVersusObjectionReview !== null
          }
          onClose={handleCloseDetailModal}
          guess={detailGuess}
          rowCategory={detailRowCategory}
          colCategory={detailColCategory}
          onObjection={handleObjection}
          objectionPending={objectionPending}
          objectionVerdict={objectionVerdict}
          objectionExplanation={objectionExplanation}
          objectionDisabled={objectionDisabled}
          objectionDisabledLabel={objectionDisabledLabel}
        />
      )}

      {/* Footer */}
      <footer className="max-w-lg mx-auto mt-8 text-center text-xs text-muted-foreground">
        <p>
          Game data from{' '}
          <a
            href="https://www.igdb.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            IGDB
          </a>
        </p>
      </footer>
    </main>
  )
}
