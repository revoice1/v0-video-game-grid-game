'use client'

import { useState, useEffect, useCallback } from 'react'
import { GameHeader } from './game-header'
import { GameGrid } from './game-grid'
import { GameSearch } from './game-search'
import { ResultsModal } from './results-modal'
import { HowToPlayModal } from './how-to-play-modal'
import { GuessDetailsModal } from './guess-details-modal'
import { AchievementsModal } from './achievements-modal'
import { getSessionId, saveGameState, loadGameState, clearGameState, type CellGuessRecord } from '@/lib/session'
import { unlockAchievement } from '@/lib/achievements'
import { EASTER_EGGS, type EasterEggConfig, type EasterEggPieceKind } from '@/lib/easter-eggs'
import type { Puzzle, CellGuess, Game, Category } from '@/lib/types'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'

const MAX_GUESSES = 9

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
  const easterEgg = EASTER_EGGS.find(entry => entry.achievementId === achievementId)

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
            <div
              className="absolute left-1/2 top-[10%] h-[68%] w-[68%] -translate-x-1/2 rounded-full border border-[#D86F2C] bg-[#F59A44] shadow-[0_8px_22px_rgba(245,154,68,0.3)]"
            />
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
            style={{ clipPath: 'polygon(50% 0%, 64% 34%, 100% 50%, 64% 66%, 50% 100%, 36% 66%, 0% 50%, 36% 34%)' }}
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
            style={{ clipPath: 'polygon(50% 0%, 62% 28%, 100% 14%, 72% 50%, 100% 86%, 62% 72%, 50% 100%, 38% 72%, 0% 86%, 28% 50%, 0% 14%, 38% 28%)' }}
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
            style={{ clipPath: 'polygon(50% 0%, 70% 24%, 100% 18%, 80% 50%, 100% 82%, 70% 76%, 50% 100%, 30% 76%, 0% 82%, 20% 50%, 0% 18%, 30% 24%)' }}
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
              style={{ clipPath: 'polygon(0% 0%, 76% 62%, 46% 66%, 60% 100%, 44% 100%, 30% 70%, 0% 100%)' }}
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
              style={{ clipPath: 'polygon(100% 100%, 72% 72%, 54% 34%, 32% 0%, 18% 4%, 30% 42%, 54% 82%)' }}
            />
            <div
              className="absolute right-[6%] top-[10%] h-[56%] w-[36%] origin-bottom -rotate-[18deg] bg-[#67E8F9] shadow-[0_0_22px_rgba(103,232,249,0.6)]"
              style={{ clipPath: 'polygon(0% 100%, 28% 72%, 46% 34%, 68% 0%, 82% 4%, 70% 42%, 46% 82%)' }}
            />
            <div
              className="absolute left-[14%] top-[14%] h-[42%] w-[20%] origin-bottom rotate-[18deg] bg-[#E0F7FF]"
              style={{ clipPath: 'polygon(100% 100%, 74% 74%, 58% 36%, 38% 2%, 28% 8%, 40% 44%, 58% 84%)' }}
            />
            <div
              className="absolute right-[14%] top-[14%] h-[42%] w-[20%] origin-bottom -rotate-[18deg] bg-[#E0F7FF]"
              style={{ clipPath: 'polygon(0% 100%, 26% 74%, 42% 36%, 62% 2%, 72% 8%, 60% 44%, 42% 84%)' }}
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
]

function getEasterEggDefinition(gameName: string): EasterEggDefinition | null {
  const normalizedName = gameName.trim().toLowerCase()

  return EASTER_EGG_DEFINITIONS.find(definition =>
    definition.triggerNames.includes(normalizedName)
  ) ?? null
}

function EasterEggCelebration({ burstId, renderPiece, particles }: ActiveEasterEgg) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      <style>{`
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
      `}</style>
      {particles.map((particle) => {
        return (
          <div
            key={`${burstId}-${particle.id}`}
            className="absolute top-0"
            style={{
              left: particle.left,
              animationName: 'easter-egg-fall',
              animationDelay: particle.delay,
              animationDuration: particle.duration,
              animationTimingFunction: 'linear',
              animationFillMode: 'both',
              ['--rotation' as string]: particle.rotate,
              ['--drift' as string]: particle.drift,
            }}
          >
            {renderPiece(particle)}
          </div>
        )
      })}
    </div>
  )
}

function PerfectGridCelebration({ burstId, particles }: ActivePerfectCelebration) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden">
      <style>{`
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
      `}</style>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(98,212,140,0.14),transparent_52%)]" />

      {particles.map((particle) => (
        <div
          key={`${burstId}-${particle.id}`}
          className="absolute top-0"
          style={{
            left: particle.left,
            animationName: 'perfect-grid-fall',
            animationDelay: particle.delay,
            animationDuration: particle.duration,
            animationTimingFunction: 'linear',
            animationFillMode: 'both',
            ['--rotation' as string]: particle.rotate,
            ['--drift' as string]: particle.drift,
          }}
        >
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
        </div>
      ))}

      <div className="absolute inset-x-4 top-14 flex justify-center sm:top-20">
        <div
          className="rounded-2xl border border-[#D7B65A]/60 bg-[#11161F]/92 px-5 py-4 text-center shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm"
          style={{ animation: 'perfect-grid-banner 2600ms ease-out both' }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#F7D772]">
            Perfect Grid
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            9/9
          </p>
          <p className="mt-1 text-sm text-foreground/75">
            Clean sweep.
          </p>
        </div>
      </div>
    </div>
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

interface LoadingIntersection {
  label: string
  status: 'pending' | 'passed' | 'failed'
  validOptionCount?: number
}

interface LoadingAttempt {
  attempt: number
  rows: string[]
  cols: string[]
  intersections: LoadingIntersection[]
  rejectedMessage?: string
}

function buildAttemptIntersections(rows: string[], cols: string[]): LoadingIntersection[] {
  return rows.flatMap(row => cols.map(col => ({
    label: `${row} x ${col}`,
    status: 'pending' as const,
  })))
}

function getIntersectionLabelClass(label: string): string {
  if (label.length > 42) {
    return 'text-[10px]'
  }

  if (label.length > 30) {
    return 'text-[11px]'
  }

  return 'text-xs'
}

function getTimeUntilNextUtcMidnight(now = new Date()) {
  const nextReset = new Date(now)
  nextReset.setUTCHours(24, 0, 0, 0)

  const diffMs = Math.max(0, nextReset.getTime() - now.getTime())
  const totalSeconds = Math.floor(diffMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return {
    hours,
    minutes,
    seconds,
    label: `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`,
  }
}

export function GameClient() {
  const [mode, setMode] = useState<'daily' | 'practice'>('daily')
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [guesses, setGuesses] = useState<(CellGuess | null)[]>(Array(9).fill(null))
  const [guessesRemaining, setGuessesRemaining] = useState(MAX_GUESSES)
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showResults, setShowResults] = useState(false)
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const [showAchievements, setShowAchievements] = useState(false)
  const [detailCell, setDetailCell] = useState<number | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [loadingProgress, setLoadingProgress] = useState(8)
  const [loadingStage, setLoadingStage] = useState('Warming up the puzzle generator...')
  const [loadingAttempts, setLoadingAttempts] = useState<LoadingAttempt[]>([])
  const [dailyResetLabel, setDailyResetLabel] = useState(() => getTimeUntilNextUtcMidnight().label)
  const [activeEasterEgg, setActiveEasterEgg] = useState<ActiveEasterEgg | null>(null)
  const [activePerfectCelebration, setActivePerfectCelebration] = useState<ActivePerfectCelebration | null>(null)
  const { toast } = useToast()

  const score = guesses.filter(g => g?.isCorrect).length
  // Game is over when out of guesses OR all cells filled (not necessarily all correct)
  const gridFull = guesses.every(g => g !== null)
  const isComplete = guessesRemaining === 0 || gridFull

  const unlockAchievementWithToast = useCallback((achievementId: string) => {
    const result = unlockAchievement(achievementId)

    if (!result.unlocked || !result.achievement) {
      return
    }

    toast({
      title: `Achievement Unlocked: ${result.achievement.title}`,
      description: result.achievement.description,
    })
  }, [toast])

  // Initialize session
  useEffect(() => {
    setSessionId(getSessionId())
  }, [])

  useEffect(() => {
    const updateResetCountdown = () => {
      setDailyResetLabel(getTimeUntilNextUtcMidnight().label)
    }

    updateResetCountdown()
    const timer = setInterval(updateResetCountdown, 1000)

    return () => clearInterval(timer)
  }, [])

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

  // Load puzzle
  const loadPuzzle = useCallback(async (gameMode: 'daily' | 'practice') => {
    const savedState = loadGameState(gameMode === 'daily')

    if (savedState?.puzzle) {
      setPuzzle(savedState.puzzle)
      setGuesses(
        savedState.guesses.map(g =>
          g ? { gameId: g.gameId, gameName: g.gameName, gameImage: g.gameImage, isCorrect: g.isCorrect } : null
        )
      )
      setGuessesRemaining(savedState.guessesRemaining)
      setSelectedCell(null)
      setShowResults(savedState.isComplete)
      setDetailCell(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setGuesses(Array(9).fill(null))
    setGuessesRemaining(MAX_GUESSES)
    setSelectedCell(null)
    setShowResults(false)
    setDetailCell(null)

    setLoadingProgress(8)
    setLoadingStage(gameMode === 'daily' ? "Loading today's board..." : 'Warming up the puzzle generator...')
    setLoadingAttempts([])

    try {
      let puzzleData: Puzzle | null = null

      const response = await fetch(`/api/puzzle-stream?mode=${gameMode}`)
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
          const dataLine = eventChunk
            .split('\n')
            .find(line => line.startsWith('data: '))

          if (!dataLine) {
            continue
          }

          const event = JSON.parse(dataLine.slice(6)) as PuzzleStreamMessage

          if (event.type === 'progress') {
            if (typeof event.pct === 'number') {
              setLoadingProgress(current => Math.max(current, event.pct!))
            }
            if (event.message) {
              setLoadingStage(event.message)
            }
            if (event.stage === 'attempt' && event.attempt && event.rows && event.cols) {
              setLoadingAttempts(current => {
                const nextAttempt: LoadingAttempt = {
                  attempt: event.attempt!,
                  rows: event.rows!,
                  cols: event.cols!,
                  intersections: buildAttemptIntersections(event.rows!, event.cols!),
                }
                const filtered = current.filter(entry => entry.attempt !== event.attempt)
                return [...filtered, nextAttempt].slice(-4)
              })
            }
            if (event.stage === 'cell' && typeof event.attempt === 'number' && typeof event.cellIndex === 'number') {
              setLoadingAttempts(current =>
                current.map(entry => {
                  if (entry.attempt !== event.attempt) {
                    return entry
                  }

                  const intersections = entry.intersections.map((intersection, index) =>
                    index === event.cellIndex
                      ? {
                          ...intersection,
                          status: (event.passed ? 'passed' : 'failed') as LoadingIntersection['status'],
                          validOptionCount: event.validOptionCount,
                        }
                      : intersection
                  )

                  return { ...entry, intersections }
                })
              )
            }
            if (event.stage === 'rejected' && typeof event.attempt === 'number') {
              setLoadingAttempts(current =>
                current.map(entry =>
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
      setPuzzle(puzzleData)

      saveGameState({
        puzzleId: puzzleData.id,
        puzzle: puzzleData,
        guesses: Array(9).fill(null),
        guessesRemaining: MAX_GUESSES,
        isComplete: false,
      }, gameMode === 'daily')

      if (savedState && savedState.puzzleId === puzzleData.id) {
        const restoredGuesses = savedState.guesses.map(g =>
          g ? { gameId: g.gameId, gameName: g.gameName, gameImage: g.gameImage, isCorrect: g.isCorrect } : null
        )
        setGuesses(restoredGuesses)
        setGuessesRemaining(savedState.guessesRemaining)
        if (savedState.isComplete) setShowResults(true)
      }
    } catch (error) {
      console.error('Failed to load puzzle:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPuzzle(mode)
  }, [mode, loadPuzzle])

  // Handle mode change
  const handleModeChange = (newMode: 'daily' | 'practice') => {
    if (newMode !== mode) {
      setMode(newMode)
    }
  }

  const hydrateGuessDetails = useCallback(async (cellIndex: number) => {
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

      setGuesses(current =>
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
  }, [guesses, puzzle])

  // Handle cell click
  const handleCellClick = async (index: number) => {
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

    if (guesses.some(guess => guess?.gameId === game.id)) {
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
        gameSlug: result.game?.slug ?? game.slug ?? null,
        gameUrl: result.game?.url ?? game.gameUrl ?? null,
        gameImage: game.background_image,
        isCorrect: result.valid,
        released: result.game?.released ?? null,
        metacritic: result.game?.metacritic ?? null,
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

      const newGuesses = [...guesses]
      newGuesses[selectedCell] = newGuess
      setGuesses(newGuesses)

      const easterEggDefinition = getEasterEggDefinition(game.name)

      if (easterEggDefinition) {
        const burstId = Date.now()
        const particles = createFallingParticles(
          easterEggDefinition.density,
          easterEggDefinition.pieceKinds,
          burstId
        )

        setActiveEasterEgg({
          burstId,
          durationMs: getEasterEggLifetimeMs(easterEggDefinition, particles),
          renderPiece: easterEggDefinition.renderPiece,
          particles,
        })

        if (easterEggDefinition.achievementId) {
          unlockAchievementWithToast(easterEggDefinition.achievementId)
        }
      }
      
      const newGuessesRemaining = guessesRemaining - 1
      setGuessesRemaining(newGuessesRemaining)
      setSelectedCell(null)

      // Save state with full guess objects for proper restoration
      saveGameState({
        puzzleId: puzzle.id,
        puzzle,
        guesses: newGuesses.map(g => g ? { gameId: g.gameId, gameName: g.gameName, gameImage: g.gameImage, isCorrect: g.isCorrect } : null),
        guessesRemaining: newGuessesRemaining,
        isComplete: newGuessesRemaining === 0 || newGuesses.every(g => g !== null),
      }, mode === 'daily')

      // Check if game is complete
      if (newGuessesRemaining === 0 || newGuesses.every(g => g !== null)) {
        // Record completion
        const finalScore = newGuesses.filter(g => g?.isCorrect).length

        if (finalScore === 9) {
          unlockAchievementWithToast('perfect-grid')

          const burstId = Date.now()
          const particles = createFallingParticles(3, ['chex'], burstId).map((particle, index) => ({
            ...particle,
            left: ['18%', '50%', '82%'][index] ?? particle.left,
            delay: `${index * 160}ms`,
            size: `${32 + index * 6}px`,
            duration: `${2600 + index * 180}ms`,
            drift: `${index === 1 ? 0 : index === 0 ? -12 : 12}px`,
            rotate: `${index === 1 ? -6 : index === 0 ? -14 : 10}deg`,
            variant: index === 1 ? 'g-white' as const : 'g-green' as const,
          }))

          setActivePerfectCelebration({
            burstId,
            durationMs: 2800,
            particles,
          })
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

  // Handle play again (practice mode only)
  const handlePlayAgain = () => {
    clearGameState(false)
    loadPuzzle('practice')
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
  const detailRowCategory = detailCell !== null && puzzle
    ? puzzle.row_categories[Math.floor(detailCell / 3)]
    : null
  const detailColCategory = detailCell !== null && puzzle
    ? puzzle.col_categories[detailCell % 3]
    : null
  const minimumCellOptions = puzzle?.cell_metadata?.reduce(
    (lowest, cell) => Math.min(lowest, cell.validOptionCount),
    Number.POSITIVE_INFINITY
  )
  const resolvedMinimumCellOptions = Number.isFinite(minimumCellOptions ?? Number.NaN)
    ? minimumCellOptions
    : null

  if (isLoading) {
    const activeAttempt = loadingAttempts[loadingAttempts.length - 1] ?? null
    const pastAttempts = loadingAttempts.slice(0, -1).reverse()

    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-5xl md:flex md:items-start md:justify-center md:gap-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card/70 p-6 shadow-xl backdrop-blur-sm">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.24em] text-primary">
            {mode === 'daily' ? 'Daily Puzzle' : 'Building Grid'}
          </p>
          <p className="mt-3 whitespace-pre-line text-center text-lg font-semibold text-foreground">{loadingStage}</p>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {mode === 'daily'
              ? loadingProgress < 10
                ? 'Checking for today\'s puzzle...'
                : loadingProgress < 75
                  ? 'Generating today\'s puzzle and validating intersections.'
                  : 'Almost done!'
              : 'Generating a fresh practice puzzle and sanity-checking each intersection.'}
          </p>
          {mode === 'practice' && (
            <div className="mt-6 space-y-2">
              <Progress value={loadingProgress} className="h-3" />
              <p className="text-right text-xs font-medium text-muted-foreground">
                {loadingProgress}% complete
              </p>
            </div>
          )}
        </div>
          {mode === 'practice' && (
            <aside className="mt-4 w-full rounded-2xl border border-border bg-card/70 p-4 shadow-xl backdrop-blur-sm md:mt-0 md:max-w-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Attempt Notes</p>
              {!activeAttempt && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Waiting for the generator to pick a board...
                </p>
              )}
              {activeAttempt && (
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl border border-border/80 bg-secondary/30 p-3">
                    <p className="text-sm font-semibold text-foreground">Attempt {activeAttempt.attempt}</p>
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
                        <span className={`pr-3 text-foreground/90 whitespace-nowrap ${getIntersectionLabelClass(intersection.label)}`}>
                          {intersection.label}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {intersection.status === 'passed' && 'OK'}
                          {intersection.status === 'failed' && `X${typeof intersection.validOptionCount === 'number' ? ` ${intersection.validOptionCount}` : ''}`}
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
                  {pastAttempts.length > 0 && (
                    <div className="border-t border-border/70 pt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Recent Tries
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {pastAttempts.map((attempt) => (
                          <div
                            key={`history-${attempt.attempt}`}
                            className="rounded-lg border border-border/60 bg-background/30 px-3 py-2 text-xs text-muted-foreground"
                          >
                            <p className="font-medium text-foreground/80">Attempt {attempt.attempt}</p>
                            <p className="mt-1 truncate">{attempt.rejectedMessage ?? 'Moved on to a new board.'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load puzzle</p>
          <button
            onClick={() => loadPuzzle(mode)}
            className="text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <main id="top" className="min-h-screen py-6 px-4">
      {activeEasterEgg && <EasterEggCelebration {...activeEasterEgg} />}
      {activePerfectCelebration && <PerfectGridCelebration {...activePerfectCelebration} />}

      <GameHeader
        mode={mode}
        guessesRemaining={guessesRemaining}
        score={score}
        dailyResetLabel={mode === 'daily' ? dailyResetLabel : null}
        isHowToPlayOpen={showHowToPlay}
        isAchievementsOpen={showAchievements}
        onModeChange={handleModeChange}
        onAchievements={() => setShowAchievements(true)}
        onHowToPlay={() => setShowHowToPlay(true)}
        onNewPracticeGame={mode === 'practice' ? handlePlayAgain : undefined}
      />

      {puzzle.validation_status && puzzle.validation_status !== 'validated' && (
        <div className="max-w-lg mx-auto mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium text-amber-200">Cross-sections are not fully validated</p>
          <p className="mt-1 text-amber-100/90">
            {puzzle.validation_message ?? 'This puzzle may contain weaker or less certain intersections than usual.'}
          </p>
        </div>
      )}

      <GameGrid
        rowCategories={puzzle.row_categories}
        colCategories={puzzle.col_categories}
        guesses={guesses}
        cellMetadata={puzzle.cell_metadata}
        selectedCell={selectedCell}
        isGameOver={isComplete}
        onCellClick={handleCellClick}
      />

      {/* Show results button when complete */}
      {isComplete && !showResults && (
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
        rowCategory={selectedRowCategory}
        colCategory={selectedColCategory}
        onSelect={handleGameSelect}
        onClose={() => setSelectedCell(null)}
      />

      <ResultsModal
        isOpen={showResults}
        onClose={() => setShowResults(false)}
        guesses={guesses}
        puzzleId={puzzle.id}
        puzzleDate={puzzle.date}
        rowCategories={puzzle.row_categories}
        colCategories={puzzle.col_categories}
        isDaily={mode === 'daily'}
        onPlayAgain={handlePlayAgain}
      />

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        minimumCellOptions={resolvedMinimumCellOptions}
        validationStatus={puzzle.validation_status}
        dailyResetLabel={dailyResetLabel}
      />

      <AchievementsModal
        isOpen={showAchievements}
        onClose={() => setShowAchievements(false)}
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
