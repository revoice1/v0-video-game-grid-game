'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { GameHeader } from './game-header'
import { GameGrid } from './game-grid'
import { GameSearch } from './game-search'
import { ResultsModal } from './results-modal'
import { HowToPlayModal } from './how-to-play-modal'
import { GuessDetailsModal } from './guess-details-modal'
import { AchievementsModal } from './achievements-modal'
import { FallingParticlesOverlay } from './falling-particles-overlay'
import {
  buildAttemptIntersections,
  getIntersectionLabelClass,
  type LoadingAttempt,
  type LoadingIntersection,
} from './loading-helpers'
import {
  VersusSetupModal,
  type VersusCategoryFilters,
  type VersusStealRule,
  type VersusTurnTimerOption,
} from './versus-setup-modal'
import { getSessionId, saveGameState, loadGameState, clearGameState } from '@/lib/session'
import {
  useAnimationPreference,
  useSearchConfirmPreference,
  useVersusAlarmPreference,
} from '@/lib/ui-preferences'
import { unlockAchievement } from '@/lib/achievements'
import { EASTER_EGGS, type EasterEggConfig, type EasterEggPieceKind } from '@/lib/easter-eggs'
import { ROUTE_ACHIEVEMENT_ID, ROUTE_PENDING_TOAST_KEY } from '@/lib/route-index'
import type { Puzzle, CellGuess, Game, Category } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { useAnimationQuality } from '@/hooks/use-animation-quality'
import { useLoadingState } from '@/hooks/use-loading-state'
import { useGameModeState } from '@/hooks/use-game-mode-state'
import { useOverlayState } from '@/hooks/use-overlay-state'
import { useGameGridDevTools } from '@/hooks/use-game-grid-dev-tools'
import { usePracticeSetupState } from '@/hooks/use-practice-setup-state'
import { usePuzzleState } from '@/hooks/use-puzzle-state'
import { useVersusMatchState } from '@/hooks/use-versus-match-state'
import { useVersusSetupState } from '@/hooks/use-versus-setup-state'
import {
  resolveStealOutcome,
  type PendingVersusSteal,
  type StealAction,
} from '@/hooks/use-versus-steal'

const MAX_GUESSES = 9
const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const

type GameMode = 'daily' | 'practice' | 'versus'
type TicTacToePlayer = 'x' | 'o'
type AnimationQuality = 'high' | 'medium' | 'low'
const VERSUS_RECORD_KEY = 'gamegrid_versus_record'

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
  rule: VersusStealRule
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

const STEAL_SHOWDOWN_DURATION_MS = 3400

interface VersusRecord {
  xWins: number
  oWins: number
}

interface PendingFinalSteal {
  defender: TicTacToePlayer
  cellIndex: number
}

function getNextPlayer(player: TicTacToePlayer): TicTacToePlayer {
  return player === 'x' ? 'o' : 'x'
}

function getPlayerLabel(player: TicTacToePlayer): string {
  return player === 'x' ? 'X' : 'O'
}

function detectAnimationQuality(): AnimationQuality {
  if (typeof window === 'undefined') {
    return 'high'
  }

  const prefersReducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  if (prefersReducedMotion) {
    return 'low'
  }

  const navigatorWithHints = navigator as Navigator & {
    deviceMemory?: number
    hardwareConcurrency?: number
  }
  const deviceMemory = navigatorWithHints.deviceMemory ?? 8
  const hardwareConcurrency = navigatorWithHints.hardwareConcurrency ?? 8

  if (deviceMemory <= 4 || hardwareConcurrency <= 4) {
    return 'low'
  }

  if (deviceMemory <= 8 || hardwareConcurrency <= 8) {
    return 'medium'
  }

  return 'high'
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

function hasNonEmptyFilters(filters: VersusCategoryFilters): boolean {
  return Object.values(filters).some((values) => Array.isArray(values) && values.length > 0)
}

function getWinningPlayer(guesses: (CellGuess | null)[]): TicTacToePlayer | null {
  for (const [a, b, c] of WINNING_LINES) {
    const owner = guesses[a]?.owner

    if (owner && owner === guesses[b]?.owner && owner === guesses[c]?.owner) {
      return owner
    }
  }

  return null
}

function getInitialVersusRecord(): VersusRecord {
  if (typeof window === 'undefined') {
    return { xWins: 0, oWins: 0 }
  }

  try {
    const raw = sessionStorage.getItem(VERSUS_RECORD_KEY)
    if (!raw) {
      return { xWins: 0, oWins: 0 }
    }

    const parsed = JSON.parse(raw) as Partial<VersusRecord>
    return {
      xWins: parsed.xWins ?? 0,
      oWins: parsed.oWins ?? 0,
    }
  } catch {
    return { xWins: 0, oWins: 0 }
  }
}

function saveVersusRecord(record: VersusRecord) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    sessionStorage.setItem(VERSUS_RECORD_KEY, JSON.stringify(record))
  } catch {
    // Ignore storage failures and keep the in-memory record.
  }
}

function buildMissReason(
  rowCategory: Category,
  colCategory: Category,
  matchesRow?: boolean,
  matchesCol?: boolean
): string {
  const failures: string[] = []

  if (matchesRow === false) {
    failures.push(`didn't match ${rowCategory.name}`)
  }

  if (matchesCol === false) {
    failures.push(`didn't match ${colCategory.name}`)
  }

  if (failures.length === 0) {
    return `didn't match ${rowCategory.name} x ${colCategory.name}`
  }

  if (failures.length === 1) {
    return failures[0]
  }

  return `${failures[0]} or ${failures[1]}`
}

function StealShowdownOverlay({
  burstId,
  defenderName,
  defenderScore,
  attackerName,
  attackerScore,
  rule,
  successful,
  lowEffects = false,
}: ActiveStealShowdown) {
  const attackerScoreLabel = `${attackerScore}`
  const defenderScoreLabel = `${defenderScore}`
  const [showVerdict, setShowVerdict] = useState(false)
  const [revealedAttackerDigits, setRevealedAttackerDigits] = useState<boolean[]>(() =>
    Array.from({ length: attackerScoreLabel.length }, () => false)
  )
  const [spinningAttackerDigits, setSpinningAttackerDigits] = useState<string[]>(() =>
    Array.from({ length: attackerScoreLabel.length }, () => `${Math.floor(Math.random() * 10)}`)
  )
  const [revealedDefenderDigits, setRevealedDefenderDigits] = useState<boolean[]>(() =>
    Array.from({ length: defenderScoreLabel.length }, () => false)
  )
  const [spinningDefenderDigits, setSpinningDefenderDigits] = useState<string[]>(() =>
    Array.from({ length: defenderScoreLabel.length }, () => `${Math.floor(Math.random() * 10)}`)
  )

  useEffect(() => {
    setShowVerdict(false)
    setRevealedAttackerDigits(Array.from({ length: attackerScoreLabel.length }, () => false))
    setSpinningAttackerDigits(
      Array.from({ length: attackerScoreLabel.length }, () => `${Math.floor(Math.random() * 10)}`)
    )
    setRevealedDefenderDigits(Array.from({ length: defenderScoreLabel.length }, () => false))
    setSpinningDefenderDigits(
      Array.from({ length: defenderScoreLabel.length }, () => `${Math.floor(Math.random() * 10)}`)
    )

    const attackerRevealTimers = attackerScoreLabel.split('').map((_, reverseIndex) => {
      const index = attackerScoreLabel.length - 1 - reverseIndex
      return setTimeout(
        () => {
          setRevealedAttackerDigits((current) =>
            current.map((value, digitIndex) => (digitIndex === index ? true : value))
          )
        },
        1120 + reverseIndex * 260
      )
    })

    const defenderRevealTimers = defenderScoreLabel.split('').map((_, reverseIndex) => {
      const index = defenderScoreLabel.length - 1 - reverseIndex
      return setTimeout(
        () => {
          setRevealedDefenderDigits((current) =>
            current.map((value, digitIndex) => (digitIndex === index ? true : value))
          )
        },
        480 + reverseIndex * 240
      )
    })

    return () => {
      attackerRevealTimers.forEach(clearTimeout)
      defenderRevealTimers.forEach(clearTimeout)
    }
  }, [attackerScoreLabel, burstId, defenderScoreLabel])

  useEffect(() => {
    const verdictTimer = setTimeout(() => {
      setShowVerdict(true)
    }, 2250)

    return () => clearTimeout(verdictTimer)
  }, [burstId])

  useEffect(() => {
    const attackerSpinIntervalMs = lowEffects ? 120 : 70
    const attackerInterval = setInterval(() => {
      setSpinningAttackerDigits((current) =>
        current.map((digit, index) =>
          revealedAttackerDigits[index] ? digit : `${Math.floor(Math.random() * 10)}`
        )
      )
    }, attackerSpinIntervalMs)

    return () => clearInterval(attackerInterval)
  }, [lowEffects, revealedAttackerDigits])

  useEffect(() => {
    const defenderSpinIntervalMs = lowEffects ? 120 : 70
    const defenderInterval = setInterval(() => {
      setSpinningDefenderDigits((current) =>
        current.map((digit, index) =>
          revealedDefenderDigits[index] ? digit : `${Math.floor(Math.random() * 10)}`
        )
      )
    }, defenderSpinIntervalMs)

    return () => clearInterval(defenderInterval)
  }, [lowEffects, revealedDefenderDigits])

  return (
    <div data-testid="steal-showdown-overlay" className="fixed inset-0 z-[80]">
      <div
        className={cn(
          'absolute inset-0 transition-all duration-300',
          !lowEffects && 'backdrop-blur-[3px]',
          successful
            ? 'bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.14),transparent_32%),radial-gradient(circle_at_center,rgba(0,0,0,0.88),rgba(0,0,0,0.72))]'
            : 'bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.18),transparent_30%),radial-gradient(circle_at_center,rgba(0,0,0,0.9),rgba(0,0,0,0.76))]'
        )}
      />
      <div className="pointer-events-none absolute inset-0 grid place-items-center p-4">
        <div
          className={cn(
            'showdown-shell w-full max-w-3xl rounded-[2rem] border border-border/80 bg-card/95 p-6 sm:p-7',
            lowEffects ? 'shadow-2xl' : 'shadow-[0_28px_90px_rgba(0,0,0,0.6)]'
          )}
        >
          <p className="text-center text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            Steal Attempt
          </p>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            {rule === 'lower'
              ? 'Lower rating steals the square'
              : 'Higher rating steals the square'}
          </p>
          <div className="mt-5 grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-5">
            <div className="showdown-panel showdown-panel-left min-w-0 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <p className="truncate text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Defender
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">{defenderName}</p>
              <div className="mt-3 flex justify-center gap-1.5">
                {defenderScoreLabel.split('').map((digit, index) => (
                  <span
                    key={`${burstId}-defender-${index}`}
                    className={cn(
                      'inline-flex h-14 w-10 items-center justify-center rounded-xl border border-emerald-400/30 bg-background/75 text-4xl font-black tabular-nums text-emerald-300',
                      !lowEffects && 'shadow-[0_0_18px_rgba(110,231,183,0.14)]'
                    )}
                  >
                    {revealedDefenderDigits[index] ? digit : spinningDefenderDigits[index]}
                  </span>
                ))}
              </div>
            </div>
            <div className="showdown-vs text-center sm:px-1">
              <p
                className={cn(
                  'text-xl font-black uppercase tracking-[0.28em] text-foreground/80',
                  !lowEffects && 'drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                )}
              >
                VS
              </p>
            </div>
            <div className="showdown-panel showdown-panel-right min-w-0 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <p className="truncate text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Challenger
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">{attackerName}</p>
              <div className="mt-3 flex justify-center gap-1.5">
                {attackerScoreLabel.split('').map((digit, index) => (
                  <span
                    key={`${burstId}-attacker-${index}`}
                    className={cn(
                      'inline-flex h-14 w-10 items-center justify-center rounded-xl border border-sky-400/30 bg-background/75 text-4xl font-black tabular-nums text-sky-300',
                      !lowEffects && 'shadow-[0_0_18px_rgba(56,189,248,0.14)]'
                    )}
                  >
                    {revealedAttackerDigits[index] ? digit : spinningAttackerDigits[index]}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div
            className={cn(
              'mt-5 transition-all duration-300',
              showVerdict ? 'opacity-100 translate-y-0' : 'translate-y-3 opacity-0'
            )}
          >
            <div
              className={cn(
                'rounded-2xl border px-4 py-3 text-center text-sm font-semibold uppercase tracking-[0.18em] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
                successful
                  ? lowEffects
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-primary/40 bg-primary/15 text-primary shadow-[0_0_28px_rgba(34,197,94,0.16)]'
                  : lowEffects
                    ? 'border-destructive/40 bg-destructive/15 text-destructive'
                    : 'border-destructive/40 bg-destructive/15 text-destructive shadow-[0_0_28px_rgba(239,68,68,0.18)]'
              )}
            >
              {successful ? 'Steal Successful' : 'Steal Denied'}
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .showdown-shell {
          animation: showdown-shell-in 320ms var(--ease-spring);
        }

        .showdown-panel-left {
          animation: showdown-panel-left 520ms var(--ease-spring);
        }

        .showdown-panel-right {
          animation: showdown-panel-right 520ms var(--ease-spring);
        }

        .showdown-vs {
          animation: showdown-vs-pop 420ms var(--ease-spring);
        }

        @keyframes showdown-shell-in {
          0% {
            transform: scale(0.96);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes showdown-panel-left {
          0% {
            transform: translateX(-22px) scale(0.96);
            opacity: 0;
          }
          100% {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
        }

        @keyframes showdown-panel-right {
          0% {
            transform: translateX(22px) scale(0.96);
            opacity: 0;
          }
          100% {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
        }

        @keyframes showdown-vs-pop {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

function StealMissSplash({ burstId }: ActiveStealMissSplash) {
  return (
    <div
      key={burstId}
      data-testid="steal-miss-splash"
      className="pointer-events-none fixed inset-0 z-[90] grid place-items-center p-4"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.12),transparent_28%),rgba(0,0,0,0.18)]" />
      <div className="steal-miss-splash select-none px-6 text-center font-black uppercase italic tracking-[0.08em] text-[#ff6262] drop-shadow-[0_10px_28px_rgba(0,0,0,0.78)]">
        Wasted
      </div>
      <style jsx>{`
        .steal-miss-splash {
          font-size: clamp(2.8rem, 10vw, 6.5rem);
          line-height: 1;
          animation: steal-miss-hit 700ms var(--ease-bounce);
        }

        @keyframes steal-miss-hit {
          0% {
            transform: scale(1.16);
            letter-spacing: 0.14em;
            opacity: 0;
            filter: blur(10px);
          }
          52% {
            transform: scale(0.95);
            opacity: 1;
            filter: blur(0);
          }
          100% {
            transform: scale(1);
            letter-spacing: 0.08em;
            opacity: 1;
            filter: blur(0);
          }
        }
      `}</style>
    </div>
  )
}

function DoubleKoSplash({ burstId }: ActiveDoubleKoSplash) {
  return (
    <div
      key={burstId}
      data-testid="double-ko-splash"
      className="pointer-events-none fixed inset-0 z-[90] grid place-items-center p-4"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.16),transparent_26%),radial-gradient(circle_at_center,rgba(239,68,68,0.14),transparent_44%),rgba(0,0,0,0.2)]" />
      <div className="double-ko-splash select-none px-6 text-center font-black uppercase italic tracking-[0.08em] text-[#ffcf5a] drop-shadow-[0_10px_28px_rgba(0,0,0,0.82)]">
        DOUBLE KO
      </div>
      <style jsx>{`
        .double-ko-splash {
          font-size: clamp(2.5rem, 8.8vw, 6rem);
          line-height: 0.9;
          text-shadow:
            0 0 18px rgba(245, 158, 11, 0.28),
            0 0 30px rgba(239, 68, 68, 0.18);
          animation: double-ko-hit 820ms var(--ease-bounce);
        }

        @keyframes double-ko-hit {
          0% {
            transform: scale(1.22) rotate(-2deg);
            letter-spacing: 0.16em;
            opacity: 0;
            filter: blur(12px);
          }
          48% {
            transform: scale(0.94) rotate(1deg);
            opacity: 1;
            filter: blur(0);
          }
          100% {
            transform: scale(1) rotate(0deg);
            letter-spacing: 0.08em;
            opacity: 1;
            filter: blur(0);
          }
        }
      `}</style>
    </div>
  )
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
  const detectConfiguredAnimationQuality = useCallback(
    () => (animationsEnabled ? detectAnimationQuality() : 'low'),
    [animationsEnabled]
  )
  const animationQuality = useAnimationQuality(detectConfiguredAnimationQuality)
  const { enabled: confirmBeforeSelect } = useSearchConfirmPreference()
  const { toast } = useToast()
  const versusStealRuleRef = useRef(versusStealRule)
  const versusTimerOptionRef = useRef(versusTimerOption)

  useEffect(() => {
    versusStealRuleRef.current = versusStealRule
  }, [versusStealRule])

  useEffect(() => {
    versusTimerOptionRef.current = versusTimerOption
  }, [versusTimerOption])

  const score = guesses.filter((g) => g?.isCorrect).length
  const isVersusMode = mode === 'versus'
  const hasActivePracticeCustomSetup = hasNonEmptyFilters(practiceCategoryFilters)
  const hasActiveVersusCustomSetup = hasNonEmptyFilters(versusCategoryFilters)
  const hasActiveCustomSetup =
    mode === 'practice'
      ? hasActivePracticeCustomSetup
      : mode === 'versus'
        ? hasActiveVersusCustomSetup
        : false
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
        rule: versusStealRule,
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
    if (!activeStealShowdown) {
      return
    }

    const timer = setTimeout(() => {
      setActiveStealShowdown(null)
    }, activeStealShowdown.durationMs)

    return () => clearTimeout(timer)
  }, [activeStealShowdown])

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

  useEffect(() => {
    if (!activeStealMissSplash) {
      return
    }

    const timer = setTimeout(() => {
      setActiveStealMissSplash(null)
    }, activeStealMissSplash.durationMs)

    return () => clearTimeout(timer)
  }, [activeStealMissSplash])

  useEffect(() => {
    if (!activeDoubleKoSplash) {
      return
    }

    const timer = setTimeout(() => {
      setActiveDoubleKoSplash(null)
    }, activeDoubleKoSplash.durationMs)

    return () => clearTimeout(timer)
  }, [activeDoubleKoSplash])

  useEffect(() => {
    const isVersusBoardReady =
      isVersusMode && !isLoading && loadedPuzzleMode === 'versus' && puzzle !== null

    if (!isVersusBoardReady || winner || versusTimerOption === 'none') {
      activeTurnTimerKeyRef.current = null
      setTurnTimeLeft(null)
      return
    }

    const turnTimerKey = `${puzzle.id}:${currentPlayer}`
    if (activeTurnTimerKeyRef.current === turnTimerKey) {
      return
    }

    activeTurnTimerKeyRef.current = turnTimerKey
    setTurnTimeLeft((current) => (current === null ? versusTimerOption : versusTimerOption))
  }, [currentPlayer, isLoading, isVersusMode, loadedPuzzleMode, puzzle, versusTimerOption, winner])

  useEffect(() => {
    if (!isVersusMode || winner || turnTimeLeft === null) {
      return
    }

    if (turnTimeLeft <= 0) {
      const nextPlayer = getNextPlayer(currentPlayer)
      setSelectedCell(null)
      setCurrentPlayer(nextPlayer)
      setStealableCell(null)
      toast({
        variant: 'destructive',
        title: 'Turn expired',
        description: `${getPlayerLabel(nextPlayer)} is up.`,
      })
      return
    }

    const timer = setTimeout(() => {
      setTurnTimeLeft((current) => (current === null ? null : current - 1))
    }, 1000)

    return () => clearTimeout(timer)
  }, [currentPlayer, isVersusMode, toast, turnTimeLeft, winner])

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
    timerOption: VersusTurnTimerOption
  ) => {
    void stealRule
    void timerOption
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
    timerOption: VersusTurnTimerOption
  ) => {
    setVersusCategoryFilters(filters)
    setVersusSetupError(null)
    setVersusStealRule(stealRule)
    setVersusTimerOption(timerOption)
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

      const alreadyHydrated =
        guess.released !== undefined ||
        guess.metacritic !== undefined ||
        guess.genres !== undefined ||
        guess.platforms !== undefined ||
        guess.developers !== undefined ||
        guess.publishers !== undefined ||
        guess.tags !== undefined ||
        guess.gameModes !== undefined ||
        guess.themes !== undefined ||
        guess.perspectives !== undefined ||
        guess.companies !== undefined

      if (alreadyHydrated) {
        return
      }

      const rowCategory = puzzle.row_categories[Math.floor(cellIndex / 3)]
      const colCategory = puzzle.col_categories[cellIndex % 3]

      try {
        const response = await fetch('/api/guess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId: guess.gameId,
            rowCategory,
            colCategory,
            lookupOnly: true,
          }),
        })

        const result = await response.json()
        if (!result.game) {
          return
        }

        setGuesses((current) =>
          current.map((existingGuess, index) => {
            if (index !== cellIndex || !existingGuess) {
              return existingGuess
            }

            return {
              ...existingGuess,
              gameSlug: result.game.slug ?? existingGuess.gameSlug ?? null,
              gameUrl: result.game.url ?? existingGuess.gameUrl ?? null,
              released: result.game.released ?? null,
              metacritic: result.game.metacritic ?? null,
              stealRating: result.game.stealRating ?? existingGuess.stealRating ?? null,
              genres: result.game.genres ?? [],
              platforms: result.game.platforms ?? [],
              developers: result.game.developers ?? [],
              publishers: result.game.publishers ?? [],
              tags: result.game.tags ?? [],
              gameModes: result.game.gameModes ?? [],
              themes: result.game.themes ?? [],
              perspectives: result.game.perspectives ?? [],
              companies: result.game.companies ?? [],
              matchedRow: result.matchesRow,
              matchedCol: result.matchesCol,
            }
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

      const existingGuess = guesses[index]
      const canSteal =
        existingGuess !== null && existingGuess.owner !== currentPlayer && stealableCell === index

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
      existingGuess !== null &&
      existingGuess.owner !== currentPlayer &&
      stealableCell === selectedCell

    if (
      guesses.some(
        (guess, index) => guess?.gameId === game.id && (mode !== 'versus' || index !== selectedCell)
      )
    ) {
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
      const response = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          puzzleId: puzzle.id,
          cellIndex: selectedCell,
          gameId: game.id,
          gameName: game.name,
          gameImage: game.background_image,
          sessionId,
          rowCategory,
          colCategory,
          isDaily: mode === 'daily',
        }),
      })

      const result = await response.json()

      if (result.duplicate) {
        toast({
          variant: 'destructive',
          title: 'Game already used',
          description: 'Each game can only be used once per grid.',
        })
        return
      }

      const newGuess: CellGuess = {
        gameId: game.id,
        gameName: game.name,
        owner: mode === 'versus' ? currentPlayer : undefined,
        gameSlug: result.game?.slug ?? game.slug ?? null,
        gameUrl: result.game?.url ?? game.gameUrl ?? null,
        gameImage: game.background_image,
        isCorrect: result.valid,
        released: result.game?.released ?? null,
        metacritic: result.game?.metacritic ?? null,
        stealRating: result.game?.stealRating ?? null,
        genres: result.game?.genres ?? [],
        platforms: result.game?.platforms ?? [],
        developers: result.game?.developers ?? [],
        publishers: result.game?.publishers ?? [],
        tags: result.game?.tags ?? [],
        gameModes: result.game?.gameModes ?? [],
        themes: result.game?.themes ?? [],
        perspectives: result.game?.perspectives ?? [],
        companies: result.game?.companies ?? [],
        matchedRow: result.matchesRow,
        matchedCol: result.matchesCol,
      }

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

        if (pendingFinalSteal && pendingFinalSteal.cellIndex === selectedCell) {
          setWinner(pendingFinalSteal.defender)
          setPendingFinalSteal(null)
          toast({
            variant: 'destructive',
            title: 'Final steal chance missed',
            description: `${missReason}. ${getPlayerLabel(pendingFinalSteal.defender)} keeps the win.`,
          })
        } else {
          const nextPlayer = getNextPlayer(currentPlayer)
          setCurrentPlayer(nextPlayer)
          toast({
            variant: 'destructive',
            title: 'Missed claim',
            description: `${missReason}. ${getPlayerLabel(nextPlayer)} is up.`,
          })
        }
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
            rule: versusStealRule,
            successful: outcome.successful,
          })
        }

        if (!outcome.successful) {
          const failureDescription =
            pendingFinalSteal && pendingFinalSteal.cellIndex === selectedCell
              ? !outcome.hasShowdownScores
                ? `${getPlayerLabel(pendingFinalSteal.defender)} keeps the win because both answers needed a score.`
                : `${game.name} (${attackingScore}) needed to be ${versusStealRule === 'lower' ? 'lower' : 'higher'} than ${existingGuess.gameName} (${defendingScore}). ${getPlayerLabel(pendingFinalSteal.defender)} keeps the win.`
              : !outcome.hasShowdownScores
                ? `${getPlayerLabel(getNextPlayer(currentPlayer))} is up. Both answers need a score to settle the steal.`
                : `${getPlayerLabel(getNextPlayer(currentPlayer))} is up. ${game.name} (${attackingScore}) had to be ${versusStealRule === 'lower' ? 'lower' : 'higher'} than ${existingGuess.gameName} (${defendingScore}).`

          const resolveFailedSteal = () => {
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
      }

      const newGuesses = [...guesses]
      newGuesses[selectedCell] = newGuess
      setGuesses(newGuesses)

      const easterEggDefinition = getEasterEggDefinition(game.id)

      if (easterEggDefinition) {
        triggerEasterEggCelebration(game.id)

        if (easterEggDefinition.achievementId) {
          unlockAchievementWithToast(easterEggDefinition.achievementId, {
            imageUrl: game.background_image,
          })
        }
      }

      const newGuessesRemaining = mode === 'versus' ? guessesRemaining : guessesRemaining - 1
      setGuessesRemaining(newGuessesRemaining)
      setSelectedCell(null)

      if (mode !== 'versus') {
        // Save state with full guess objects for proper restoration
        saveGameState(
          {
            puzzleId: puzzle.id,
            puzzle,
            guesses: newGuesses.map((g) =>
              g
                ? {
                    gameId: g.gameId,
                    gameName: g.gameName,
                    gameImage: g.gameImage,
                    isCorrect: g.isCorrect,
                  }
                : null
            ),
            guessesRemaining: newGuessesRemaining,
            isComplete: newGuessesRemaining === 0 || newGuesses.every((g) => g !== null),
          },
          mode
        )
      }

      if (mode === 'versus') {
        const winningPlayer = getWinningPlayer(newGuesses)
        const nextPlayer = getNextPlayer(currentPlayer)

        setPendingFinalSteal(null)
        setLockImpactCell(null)
        setStealableCell(selectedCell)

        if (currentPlayer === 'x' && winningPlayer === 'x') {
          setPendingFinalSteal({
            defender: winningPlayer,
            cellIndex: selectedCell,
          })
          setCurrentPlayer(nextPlayer)
          toast({
            title: 'Last chance steal',
            description: 'O gets one chance to answer back on that square.',
          })
          return
        }

        if (winningPlayer) {
          setWinner(winningPlayer)
          setStealableCell(null)
          toast({
            title: `${getPlayerLabel(winningPlayer)} wins!`,
            description: isVersusSteal
              ? 'That steal completed the line.'
              : 'Three in a row takes the match.',
          })
          return
        }

        if (newGuesses.every((guess) => guess !== null)) {
          setActiveDoubleKoSplash({
            burstId: Date.now(),
            durationMs: 1400,
          })
          setWinner('draw')
          setStealableCell(null)
          toast({
            title: 'Draw game',
            description: 'The board filled up without a three-in-a-row.',
          })
          return
        }

        setCurrentPlayer(nextPlayer)
        toast({
          title: isVersusSteal ? 'Stolen square' : 'Claim locked in',
          description: `${getPlayerLabel(nextPlayer)} is up.`,
        })
        return
      }

      // Check if game is complete
      if (newGuessesRemaining === 0 || newGuesses.every((g) => g !== null)) {
        // Record completion
        const finalScore = newGuesses.filter((g) => g?.isCorrect).length

        if (finalScore === 9) {
          unlockAchievementWithToast('perfect-grid')
          triggerPerfectCelebration()
        }

        if (mode === 'daily') {
          await fetch('/api/stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              puzzleId: puzzle.id,
              sessionId,
              score: finalScore,
              rarityScore: 0, // Will be calculated on results load
            }),
          })
        }

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
  const getSelectedCategories = (): { row: Category | null; col: Category | null } => {
    if (selectedCell === null || !puzzle) return { row: null, col: null }
    const rowIndex = Math.floor(selectedCell / 3)
    const colIndex = selectedCell % 3
    return {
      row: puzzle.row_categories[rowIndex],
      col: puzzle.col_categories[colIndex],
    }
  }

  const { row: selectedRowCategory, col: selectedColCategory } = getSelectedCategories()
  const detailGuess = detailCell !== null ? guesses[detailCell] : null
  const detailRowCategory =
    detailCell !== null && puzzle ? puzzle.row_categories[Math.floor(detailCell / 3)] : null
  const detailColCategory =
    detailCell !== null && puzzle ? puzzle.col_categories[detailCell % 3] : null
  const minimumCellOptions = puzzle?.cell_metadata?.reduce(
    (lowest, cell) => Math.min(lowest, cell.validOptionCount),
    Number.POSITIVE_INFINITY
  )
  const resolvedMinimumCellOptions = Number.isFinite(minimumCellOptions ?? Number.NaN)
    ? minimumCellOptions
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
    const activeAttempt = loadingAttempts[loadingAttempts.length - 1] ?? null
    const pastAttempts = loadingAttempts.slice(0, -1).reverse()
    const getFailedIntersections = (attempt: LoadingAttempt) =>
      attempt.intersections.filter((intersection) => intersection.status === 'failed')

    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-5xl md:flex md:items-start md:justify-center md:gap-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card/70 p-6 shadow-xl backdrop-blur-sm">
            <p className="text-center text-sm font-semibold uppercase tracking-[0.24em] text-primary">
              {mode === 'daily'
                ? 'Daily Puzzle'
                : mode === 'versus'
                  ? 'Setting Up Match'
                  : 'Building Grid'}
            </p>
            <p className="mt-3 whitespace-pre-line text-center text-lg font-semibold text-foreground">
              {loadingStage}
            </p>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {mode === 'daily'
                ? loadingProgress < 10
                  ? "Checking for today's puzzle..."
                  : loadingProgress < 75
                    ? "Generating today's puzzle and validating intersections."
                    : 'Almost done!'
                : mode === 'versus'
                  ? 'Building a local head-to-head board and validating each intersection.'
                  : 'Generating a fresh practice puzzle and sanity-checking each intersection.'}
            </p>
            {mode !== 'daily' && (
              <div className="mt-6 space-y-2">
                <Progress value={loadingProgress} className="h-3" />
                <p className="text-right text-xs font-medium text-muted-foreground">
                  {loadingProgress}% complete
                </p>
              </div>
            )}
            {mode !== 'daily' && pastAttempts.length > 0 && (
              <div className="mt-5 border-t border-border/70 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Rejected Intersections
                </p>
                <div className="mt-2 space-y-1.5">
                  {pastAttempts.map((attempt) => {
                    const failedIntersections = getFailedIntersections(attempt)

                    return (
                      <div
                        key={`history-${attempt.attempt}`}
                        className="rounded-lg border border-border/60 bg-background/30 px-3 py-2 text-xs text-muted-foreground"
                      >
                        <p className="font-medium text-foreground/80">Attempt {attempt.attempt}</p>
                        {failedIntersections.length > 0 ? (
                          <div className="mt-1 space-y-1">
                            {failedIntersections.map((intersection) => (
                              <p
                                key={`${attempt.attempt}-${intersection.label}`}
                                className="break-words"
                              >
                                {intersection.label}
                                {typeof intersection.validOptionCount === 'number'
                                  ? ` (${intersection.validOptionCount})`
                                  : ''}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 truncate">
                            {attempt.rejectedMessage ?? 'Moved on to a new board.'}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          {mode !== 'daily' && (
            <aside className="mt-4 w-full rounded-2xl border border-border bg-card/70 p-4 shadow-xl backdrop-blur-sm md:mt-0 md:max-w-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Attempt Notes
              </p>
              {!activeAttempt && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Waiting for the generator to pick a board...
                </p>
              )}
              {activeAttempt && (
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl border border-border/80 bg-secondary/30 p-3">
                    <p className="text-sm font-semibold text-foreground">
                      Attempt {activeAttempt.attempt}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Rows: {activeAttempt.rows.join(', ')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cols: {activeAttempt.cols.join(', ')}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {activeAttempt.intersections.map((intersection) => (
                      <div
                        key={`${activeAttempt.attempt}-${intersection.label}`}
                        className="flex items-center justify-between rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-xs"
                      >
                        <span
                          className={`pr-3 text-foreground/90 whitespace-nowrap ${getIntersectionLabelClass(intersection.label)}`}
                        >
                          {intersection.label}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {intersection.status === 'passed' && 'OK'}
                          {intersection.status === 'failed' &&
                            `X${typeof intersection.validOptionCount === 'number' ? ` ${intersection.validOptionCount}` : ''}`}
                          {intersection.status === 'pending' && '...'}
                        </span>
                      </div>
                    ))}
                  </div>
                  {activeAttempt.rejectedMessage && (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                      {activeAttempt.rejectedMessage}
                    </p>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    )
  }

  if (!puzzle) {
    if (
      (mode === 'versus' && showVersusStartOptions) ||
      (mode === 'practice' && showPracticeStartOptions)
    ) {
      const isPracticeStart = mode === 'practice'

      return (
        <main id="top" className="min-h-screen px-4 py-6">
          <div className="mx-auto w-full max-w-xl">
            <GameHeader
              mode={mode}
              guessesRemaining={guessesRemaining}
              score={score}
              currentPlayer={currentPlayer}
              winner={winner}
              turnTimerLabel={null}
              versusRecord={versusRecord}
              isHowToPlayOpen={showHowToPlay}
              isAchievementsOpen={showAchievements}
              hasActiveCustomSetup={hasActiveCustomSetup}
              onModeChange={handleModeChange}
              onAchievements={() => setShowAchievements(true)}
              onHowToPlay={() => setShowHowToPlay(true)}
              onNewGame={undefined}
              onCustomizeGame={() =>
                isPracticeStart ? setShowPracticeSetup(true) : setShowVersusSetup(true)
              }
            />
          </div>

          <div className="mx-auto mt-16 max-w-lg rounded-3xl border border-border bg-card/80 p-6 text-center shadow-xl backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              {isPracticeStart ? 'Practice Mode' : 'Versus Mode'}
            </p>
            <h2 className="mt-3 text-2xl font-bold text-foreground">How do you want to start?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isPracticeStart
                ? 'Launch a standard solo board right away, or customize the category pool first.'
                : 'Launch a standard head-to-head board right away, or customize the category pool and steal rules first.'}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => {
                  if (isPracticeStart) {
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
                  setShowVersusStartOptions(false)
                  skipNextVersusAutoLoadRef.current = true
                  clearGameState('versus')
                  loadPuzzle('versus', {})
                }}
                className="rounded-2xl border border-border bg-secondary/40 px-4 py-4 text-left transition-colors hover:bg-secondary/65"
              >
                <p className="text-sm font-semibold text-foreground">
                  {isPracticeStart ? 'Standard Puzzle' : 'Standard Match'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isPracticeStart
                    ? 'Use the default solo category pool and jump right in.'
                    : 'Use the default versus rules and random category families.'}
                </p>
              </button>
              <button
                onClick={() =>
                  isPracticeStart ? setShowPracticeSetup(true) : setShowVersusSetup(true)
                }
                className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-4 text-left transition-colors hover:bg-primary/15"
              >
                <p className="text-sm font-semibold text-foreground">
                  {isPracticeStart ? 'Custom Puzzle' : 'Custom Match'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isPracticeStart
                    ? 'Pick the families you want in the solo category pool before generating.'
                    : 'Pick families, tune steals, and set an optional turn timer.'}
                </p>
              </button>
            </div>
          </div>

          <VersusSetupModal
            isOpen={showPracticeSetup}
            onClose={() => setShowPracticeSetup(false)}
            mode="practice"
            errorMessage={practiceSetupError}
            filters={practiceCategoryFilters}
            stealRule="lower"
            timerOption="none"
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
            onApply={handleApplyVersusFilters}
          />

          <AchievementsModal isOpen={showAchievements} onClose={() => setShowAchievements(false)} />

          <HowToPlayModal
            isOpen={showHowToPlay}
            onClose={() => setShowHowToPlay(false)}
            mode={mode}
            minimumCellOptions={resolvedMinimumCellOptions}
            validationStatus={undefined}
            dailyResetLabel={dailyResetLabel}
          />
        </main>
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

      <div className="mx-auto w-full max-w-xl">
        <GameHeader
          mode={mode}
          guessesRemaining={guessesRemaining}
          score={score}
          currentPlayer={isVersusMode ? currentPlayer : null}
          winner={isVersusMode ? winner : null}
          turnTimerLabel={turnTimerLabel}
          versusRecord={versusRecord}
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

        {isVersusMode && winner && showVersusWinnerBanner && (
          <div className="pointer-events-none absolute inset-x-4 top-24 z-20 sm:inset-x-6 sm:top-28">
            <div className="pointer-events-auto rounded-2xl border border-border bg-card/92 p-5 text-center shadow-xl backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Match Over
              </p>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {winner === 'draw' ? 'Draw game' : `${getPlayerLabel(winner)} wins`}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {winner === 'draw'
                  ? 'No line was completed before the board filled up.'
                  : 'Hide this panel to review the finished board, or start a new match.'}
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
            </div>
          </div>
        )}
      </div>

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
        stealRule="lower"
        timerOption="none"
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
        onApply={handleApplyVersusFilters}
      />

      <GuessDetailsModal
        isOpen={detailCell !== null && detailGuess !== null}
        onClose={() => setDetailCell(null)}
        guess={detailGuess}
        rowCategory={detailRowCategory}
        colCategory={detailColCategory}
      />

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
