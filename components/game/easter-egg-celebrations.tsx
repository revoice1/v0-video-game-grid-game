'use client'

/**
 * Easter egg celebration system — particles, renderers, and overlay components.
 *
 * HOW IT WORKS
 * ─────────────
 * Each easter egg achievement has two parts:
 *
 *   1. Config  — in `lib/easter-eggs.ts`
 *      Defines the achievement ID, trigger game IDs, particle density, timing,
 *      and which piece kinds to use.
 *
 *   2. Renderer — in this file (EASTER_EGG_DEFINITIONS)
 *      Maps the config to a `renderPiece` function that draws one falling particle.
 *      The renderer switches on `particle.kind` to handle each visual shape.
 *
 * Adding a new easter egg requires touching both files. See docs/adding-achievements.md
 * for a full step-by-step walkthrough with templates.
 */

import { FallingParticlesOverlay } from './falling-particles-overlay'
import { type AnimationQuality } from './game-client-runtime-helpers'
import { EASTER_EGGS, type EasterEggConfig, type EasterEggPieceKind } from '@/lib/easter-eggs'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EasterEggParticle {
  id: string
  left: string
  delay: string
  duration: string
  size: string
  rotate: string
  drift: string
  kind: EasterEggPieceKind
}

/**
 * The full definition for one easter egg celebration.
 * Extends EasterEggConfig (from lib/easter-eggs.ts) with renderPiece —
 * the only thing you author here when adding a new easter egg.
 *
 * renderPiece receives a single particle and should return a React node.
 * Switch on `particle.kind` to render different shapes for each piece type.
 * Use `particle.size` (a CSS value like "18px") to set the piece's dimensions.
 * All positioning, animation, and z-index are handled by FallingParticlesOverlay.
 */
export interface EasterEggDefinition extends EasterEggConfig {
  renderPiece: (particle: EasterEggParticle) => React.ReactNode
}

export interface ActiveEasterEgg {
  burstId: number
  durationMs: number
  renderPiece: EasterEggDefinition['renderPiece']
  particles: EasterEggParticle[]
}

export interface ActivePerfectCelebration {
  burstId: number
  durationMs: number
  particles: Array<EasterEggParticle & { variant: 'g-green' | 'g-white' }>
}

// ─── Particle helpers ─────────────────────────────────────────────────────────

/**
 * Scales particle density to the user's animation quality setting.
 * Always call this before createFallingParticles to avoid janking lower-end devices.
 */
export function scaleParticleDensity(density: number, quality: AnimationQuality): number {
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

/**
 * Generates a deterministic list of falling particles for a celebration burst.
 * Each particle gets randomised position, timing, size, rotation, and drift.
 * Pass `Date.now()` as the seed — unique per trigger, stable across re-renders.
 */
export function createFallingParticles(
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

export function parseMs(value: string): number {
  return Number.parseInt(value.replace('ms', ''), 10)
}

/**
 * Computes the full display lifetime for an easter egg burst.
 * Takes the longer of the config's durationMs or the last particle's fade-out,
 * so the overlay stays alive until every piece has finished falling.
 */
export function getEasterEggLifetimeMs(
  definition: EasterEggDefinition,
  particles: EasterEggParticle[]
): number {
  const longestParticleMs = particles.reduce((longest, particle) => {
    return Math.max(longest, parseMs(particle.delay) + parseMs(particle.duration))
  }, 0)

  return Math.max(definition.durationMs, longestParticleMs)
}

// ─── Built-in renderers ───────────────────────────────────────────────────────

/**
 * Render function for the "Real Stinker" achievement celebration.
 * Unlike easter egg pieces this renderer ignores `particle.kind` entirely —
 * it always renders a poop shape. The `pieceKinds: ['dust']` in the trigger
 * is a required placeholder that the particle system needs but this renderer
 * doesn't use.
 */
export function renderRealStinkerPiece(particle: EasterEggParticle) {
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

// ─── Easter egg definitions ───────────────────────────────────────────────────

function requireEasterEgg(achievementId: string): EasterEggConfig {
  const easterEgg = EASTER_EGGS.find((entry) => entry.achievementId === achievementId)

  if (!easterEgg) {
    throw new Error(`Missing easter egg config for ${achievementId}`)
  }

  return easterEgg
}

/**
 * One entry per easter egg achievement. Each entry spreads its config from
 * lib/easter-eggs.ts (via requireEasterEgg) and adds a renderPiece function.
 *
 * ADDING A NEW EASTER EGG — quick reference
 * ──────────────────────────────────────────
 * Step 1 — lib/easter-eggs.ts
 *   • Add new kind(s) to EasterEggPieceKind
 *   • Add an EasterEggConfig entry to EASTER_EGGS
 *
 * Step 2 — this file
 *   • Add an entry to EASTER_EGG_DEFINITIONS:
 *       {
 *         ...requireEasterEgg('your-achievement-id'),
 *         renderPiece: (particle) => {
 *           if (particle.kind === 'your-kind') { return <YourShape size={particle.size} /> }
 *           return <YourOtherShape size={particle.size} />
 *         },
 *       }
 *
 * Step 3 — lib/achievements.ts
 *   • Nothing needed — achievements auto-register from EASTER_EGGS
 *
 * Full details: docs/adding-achievements.md
 */
export const EASTER_EGG_DEFINITIONS: EasterEggDefinition[] = [
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

      // Slime blob with irregular edges and a drip
      return (
        <div
          className="relative bg-[#22C55E] shadow-[0_4px_14px_rgba(34,197,94,0.55)]"
          style={{
            width: `calc(${particle.size} * 0.9)`,
            height: `calc(${particle.size} * 1.15)`,
            clipPath:
              'polygon(22% 12%, 42% 2%, 64% 6%, 80% 20%, 82% 40%, 74% 56%, 70% 70%, 62% 86%, 54% 100%, 46% 100%, 38% 86%, 28% 66%, 18% 48%, 12% 28%)',
          }}
        >
          <div
            className="absolute left-[22%] top-[10%] h-[22%] w-[28%] rounded-full bg-[#4ADE80]/70"
            style={{ transform: 'rotate(-20deg)' }}
          />
        </div>
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
              className="absolute left-1/2 top-[10%] h-[70%] w-[70%] -translate-x-1/2 border border-[#D86F2C] bg-[#F59A44] shadow-[0_8px_22px_rgba(245,154,68,0.3)]"
              style={{ clipPath: 'polygon(50% 0%, 90% 24%, 86% 64%, 50% 100%, 14% 64%, 10% 24%)' }}
            />
            <div className="absolute left-[18%] top-[2%] h-[34%] w-[24%] -rotate-[18deg] rounded-t-[88%] rounded-b-[18%] border border-[#D86F2C] bg-[#F59A44]" />
            <div className="absolute right-[18%] top-[2%] h-[34%] w-[24%] rotate-[18deg] rounded-t-[88%] rounded-b-[18%] border border-[#D86F2C] bg-[#F59A44]" />
            <div className="absolute left-[26%] top-[18%] h-[12%] w-[12%] rounded-full bg-[#FFF3DE]" />
            <div className="absolute right-[26%] top-[18%] h-[12%] w-[12%] rounded-full bg-[#FFF3DE]" />
            <div
              className="absolute left-1/2 top-[34%] h-[34%] w-[36%] -translate-x-1/2 bg-[#FFF3DE]"
              style={{ clipPath: 'polygon(50% 0%, 100% 34%, 76% 100%, 24% 100%, 0% 34%)' }}
            />
            <div className="absolute left-[36%] top-[40%] h-[5%] w-[5%] rounded-full bg-[#3B2415]" />
            <div className="absolute right-[36%] top-[40%] h-[5%] w-[5%] rounded-full bg-[#3B2415]" />
            <div className="absolute left-1/2 top-[53%] h-[5%] w-[8%] -translate-x-1/2 rounded-full bg-[#3B2415]" />
          </div>
        )
      }

      return (
        <div
          className="relative"
          style={{
            width: particle.size,
            height: `calc(${particle.size} * 1.24)`,
          }}
        >
          <div
            className="absolute left-1/2 top-[2%] h-[16%] w-[26%] -translate-x-1/2 bg-[#FDE68A]"
            style={{ clipPath: 'polygon(50% 0%, 92% 100%, 8% 100%)' }}
          />
          <div
            className="absolute left-1/2 top-[12%] h-[50%] w-[20%] -translate-x-1/2 rounded-b-[24%] border border-[#A16207] bg-[#FCD34D] shadow-[0_5px_14px_rgba(245,158,11,0.3)]"
            style={{ clipPath: 'polygon(50% 0%, 84% 16%, 74% 100%, 26% 100%, 16% 16%)' }}
          />
          <div className="absolute left-1/2 top-[16%] h-[34%] w-[8%] -translate-x-1/2 rounded-full bg-[#FFF7ED]" />
          <div className="absolute left-1/2 top-[56%] h-[10%] w-[46%] -translate-x-1/2 rounded-full border border-[#92400E] bg-[#F59E0B]" />
          <div className="absolute left-[24%] top-[58%] h-[6%] w-[12%] rounded-full bg-[#78350F]" />
          <div className="absolute right-[24%] top-[58%] h-[6%] w-[12%] rounded-full bg-[#78350F]" />
          <div className="absolute left-1/2 top-[63%] h-[12%] w-[14%] -translate-x-1/2 rounded-[30%] bg-[#0F766E]" />
          <div className="absolute left-1/2 top-[73%] h-[20%] w-[10%] -translate-x-1/2 rounded-b-full bg-[#14B8A6]" />
          <div className="absolute left-1/2 bottom-[4%] h-[10%] w-[18%] -translate-x-1/2 rounded-full bg-[#BAFFF6]" />
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
          <div
            className="absolute left-[12%] top-[14%] h-[14%] w-[30%] bg-[#63E0C4] shadow-[0_0_10px_rgba(99,224,196,0.68)]"
            style={{ clipPath: 'polygon(0% 50%, 50% 0%, 100% 50%, 50% 100%)' }}
          />
          <div
            className="absolute right-[16%] top-[10%] h-[16%] w-[16%] bg-[#A78BFA] shadow-[0_0_10px_rgba(167,139,250,0.68)]"
            style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
          />
          <div
            className="absolute left-[28%] top-[34%] h-[18%] w-[38%] bg-[#67E8F9] shadow-[0_0_12px_rgba(103,232,249,0.68)]"
            style={{ clipPath: 'polygon(0% 50%, 20% 8%, 76% 8%, 100% 50%, 76% 92%, 20% 92%)' }}
          />
          <div
            className="absolute left-[34%] top-[58%] h-[12%] w-[24%] bg-[#E9D5FF] shadow-[0_0_10px_rgba(233,213,255,0.56)]"
            style={{ clipPath: 'polygon(50% 0%, 92% 50%, 50% 100%, 8% 50%)' }}
          />
          <div
            className="absolute right-[10%] bottom-[18%] h-[14%] w-[22%] bg-[#C4B5FD] shadow-[0_0_10px_rgba(196,181,253,0.64)]"
            style={{ clipPath: 'polygon(0% 50%, 50% 0%, 100% 50%, 50% 100%)' }}
          />
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
          <div className="absolute left-1/2 top-0 h-[16%] w-[10%] -translate-x-1/2 rounded-full bg-[#92400E]" />
          <div className="absolute left-1/2 top-[10%] h-[8%] w-[16%] -translate-x-1/2 rounded-full bg-[#FDE68A]" />
          <div className="absolute left-[26%] top-[16%] h-[26%] w-[44%] rounded-[42%] border border-[#FB7185] bg-[#F43F5E] shadow-[0_7px_18px_rgba(244,63,94,0.28)]" />
          <div className="absolute left-[14%] top-[28%] h-[24%] w-[24%] rounded-l-[78%] rounded-r-[22%] border border-[#FB7185] bg-[#FB7185]" />
          <div className="absolute left-[24%] top-[48%] h-[18%] w-[40%] rounded-[28%] border border-[#FB7185] bg-[#F43F5E]" />
          <div className="absolute right-[20%] top-[46%] h-[22%] w-[22%] rounded-[34%] border border-[#FB7185] bg-[#FB7185]" />
          <div className="absolute right-[10%] top-[54%] h-[18%] w-[16%] rounded-[40%] border border-[#FB7185] bg-[#FB7185]" />
          <div className="absolute left-[28%] top-[28%] h-[7%] w-[10%] rounded-full bg-[#38BDF8]" />
          <div className="absolute left-[42%] top-[22%] h-[7%] w-[10%] rounded-full bg-[#FDE047]" />
          <div className="absolute left-[52%] top-[34%] h-[7%] w-[10%] rounded-full bg-[#4ADE80]" />
          <div className="absolute left-[38%] top-[50%] h-[7%] w-[10%] rounded-full bg-[#A78BFA]" />
        </div>
      )
    },
  },
  {
    ...requireEasterEgg('war-never-changes'),
    renderPiece: (particle) => {
      if (particle.kind === 'cap') {
        // Nuka-Cola bottle cap — crimped edge, inner circle, star
        return (
          <div
            className="relative bg-[#B8941C] shadow-[0_4px_14px_rgba(184,148,28,0.5)]"
            style={{
              width: particle.size,
              height: particle.size,
              clipPath:
                'polygon(50% 0%, 57% 9%, 66% 2%, 69% 13%, 79% 10%, 80% 20%, 91% 21%, 87% 31%, 98% 35%, 92% 43%, 100% 50%, 92% 57%, 98% 66%, 87% 69%, 91% 79%, 80% 80%, 79% 91%, 69% 87%, 66% 98%, 57% 92%, 50% 100%, 43% 92%, 34% 98%, 31% 87%, 21% 91%, 20% 80%, 10% 79%, 13% 69%, 2% 66%, 9% 57%, 0% 50%, 9% 43%, 2% 35%, 13% 31%, 10% 21%, 20% 20%, 21% 10%, 31% 13%, 34% 2%, 43% 9%)',
            }}
          >
            <div className="absolute inset-[14%] rounded-full bg-[#D4AA24]" />
            <div
              className="absolute inset-[32%] bg-[#6B5210]"
              style={{
                clipPath:
                  'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
              }}
            />
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
          <div className="absolute left-[18%] top-[4%] h-[24%] w-[44%] rounded-t-[95%] rounded-b-[34%] bg-[#FDE68A]" />
          <div className="absolute left-[48%] top-[7%] h-[18%] w-[22%] rounded-t-[95%] rounded-b-[34%] bg-[#FACC15]" />
          <div className="absolute inset-x-[14%] top-[18%] h-[54%] rounded-[42%] border border-[#EAB308] bg-[#FDE68A] shadow-[0_8px_20px_rgba(250,204,21,0.26)]" />
          <div className="absolute left-[26%] top-[34%] h-[10%] w-[10%] rounded-full bg-[#111827]" />
          <div className="absolute right-[26%] top-[34%] h-[10%] w-[10%] rounded-full bg-[#111827]" />
          <div className="absolute left-1/2 top-[49%] h-[6%] w-[18%] -translate-x-1/2 rounded-full bg-[#111827]" />
          <div className="absolute inset-x-[18%] bottom-[6%] h-[26%] rounded-t-[28%] rounded-b-[14%] border border-[#2563EB] bg-[#2563EB]" />
          <div className="absolute inset-x-[22%] bottom-[20%] h-[6%] rounded-full bg-[#60A5FA]" />
          <div className="absolute left-1/2 bottom-[12%] h-[10%] w-[24%] -translate-x-1/2 rounded-full bg-[#FDE047]" />
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
          <div className="absolute left-[22%] top-[20%] h-[16%] w-[16%] rounded-full bg-[#F8FAFC]/90" />
          <div className="absolute inset-y-[44%] left-[18%] right-[18%] rounded-full bg-[#1D4ED8]/55" />
          <div className="absolute inset-x-[46%] top-[18%] bottom-[18%] rounded-full bg-[#1D4ED8]/45" />
          <div className="absolute left-1/2 top-1/2 h-[18%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1D4ED8]" />
          <div className="absolute left-[12%] top-[40%] h-[10%] w-[14%] rounded-full bg-[#93C5FD]" />
          <div className="absolute right-[12%] top-[40%] h-[10%] w-[14%] rounded-full bg-[#93C5FD]" />
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
          className="relative"
          style={{
            width: particle.size,
            height: particle.size,
          }}
        >
          <div
            className="absolute inset-[10%] rounded-full border-2 border-[#EA580C] bg-[#FDBA74] shadow-[0_8px_20px_rgba(253,186,116,0.32)]"
            style={{
              clipPath:
                'polygon(0% 40%, 40% 40%, 40% 0%, 60% 0%, 60% 40%, 100% 40%, 100% 60%, 60% 60%, 60% 100%, 40% 100%, 40% 60%, 0% 60%)',
            }}
          />
          <div className="absolute inset-[34%] rounded-full bg-[#FFF7ED]" />
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
          <div className="absolute left-1/2 top-1/2 h-[26%] w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFF7ED] shadow-[0_0_14px_rgba(255,247,237,0.42)]" />
          <div
            className="absolute left-1/2 top-[6%] h-[24%] w-[12%] -translate-x-1/2 bg-[#F59E0B]"
            style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }}
          />
          <div className="absolute left-[16%] top-[18%] h-[10%] w-[10%] rounded-full bg-[#FDE68A]" />
          <div className="absolute right-[16%] top-[18%] h-[10%] w-[10%] rounded-full bg-[#FDE68A]" />
          <div className="absolute left-[14%] bottom-[18%] h-[9%] w-[18%] rounded-full bg-[#FDE68A]" />
          <div className="absolute right-[14%] bottom-[18%] h-[9%] w-[18%] rounded-full bg-[#FDE68A]" />
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

      // Party popper / confetti cannon — cone with coloured dots bursting out
      return (
        <div
          className="relative"
          style={{
            width: `calc(${particle.size} * 1.15)`,
            height: `calc(${particle.size} * 0.95)`,
          }}
        >
          {/* Cone body */}
          <div
            className="absolute bottom-[8%] left-[2%] h-[78%] w-[58%] bg-[#F43F5E] shadow-[0_4px_12px_rgba(244,63,94,0.4)]"
            style={{ clipPath: 'polygon(0% 100%, 100% 0%, 100% 100%)' }}
          />
          {/* Stripe */}
          <div
            className="absolute bottom-[8%] left-[2%] h-[52%] w-[44%] bg-[#FB923C]/65"
            style={{ clipPath: 'polygon(0% 100%, 100% 0%, 100% 100%)' }}
          />
          {/* Confetti dots bursting from tip */}
          <div className="absolute right-[4%] top-[2%] h-[18%] w-[18%] rounded-full bg-[#FDE047]" />
          <div className="absolute right-0 top-[24%] h-[15%] w-[15%] rounded-full bg-[#4ADE80]" />
          <div className="absolute right-[6%] top-[44%] h-[17%] w-[17%] rounded-full bg-[#60A5FA]" />
          <div className="absolute right-[2%] bottom-[10%] h-[13%] w-[13%] rounded-full bg-[#F472B6]" />
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
          <div className="absolute left-1/2 top-1/2 h-[16%] w-[16%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFF7ED]" />
          <div className="absolute left-1/2 top-[6%] h-[20%] w-[10%] -translate-x-1/2 rounded-full bg-[#FDE047] shadow-[0_0_10px_rgba(253,224,71,0.42)]" />
          <div className="absolute left-[16%] top-[20%] h-[10%] w-[10%] rounded-full bg-[#FDE047]" />
          <div className="absolute right-[16%] top-[20%] h-[10%] w-[10%] rounded-full bg-[#FDE047]" />
          <div
            className="absolute left-[8%] top-[42%] h-[8%] w-[26%] rounded-full bg-[#FDE047]"
            style={{ transform: 'rotate(-18deg)' }}
          />
          <div
            className="absolute right-[8%] top-[42%] h-[8%] w-[26%] rounded-full bg-[#FDE047]"
            style={{ transform: 'rotate(18deg)' }}
          />
          <div className="absolute left-[18%] bottom-[18%] h-[10%] w-[10%] rounded-full bg-[#FDE047]" />
          <div className="absolute right-[18%] bottom-[18%] h-[10%] w-[10%] rounded-full bg-[#FDE047]" />
          <div className="absolute left-1/2 bottom-[6%] h-[18%] w-[10%] -translate-x-1/2 rounded-full bg-[#FDE047]" />
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
          <div className="absolute left-1/2 top-[2%] h-[12%] w-[14%] -translate-x-1/2 rounded-full bg-[#0369A1]" />
          <div className="absolute left-1/2 top-[8%] h-[10%] w-[26%] -translate-x-1/2 rounded-full bg-[#38BDF8]" />
          <div className="absolute left-1/2 top-[16%] h-[62%] w-[56%] -translate-x-1/2 rounded-full border border-[#0369A1] bg-[#7DD3FC] shadow-[0_8px_20px_rgba(125,211,252,0.34)]" />
          <div className="absolute inset-[30%] rounded-full border border-[#0EA5E9] bg-[#F8FAFC]" />
          <div className="absolute left-1/2 top-[34%] h-[6%] w-[2px] -translate-x-1/2 rounded-full bg-[#0369A1]" />
          <div className="absolute left-1/2 top-[42%] h-[2px] w-[16%] -translate-x-1/2 rounded-full bg-[#0369A1]" />
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
            className="absolute inset-[8%] bg-[#EF4444] shadow-[0_0_16px_rgba(239,68,68,0.34)]"
            style={{
              clipPath:
                'polygon(50% 0%, 60% 24%, 86% 10%, 76% 38%, 100% 50%, 76% 62%, 86% 90%, 60% 76%, 50% 100%, 40% 76%, 14% 90%, 24% 62%, 0% 50%, 24% 38%, 14% 10%, 40% 24%)',
            }}
          />
          <div className="absolute inset-[30%] rounded-full border border-[#FCA5A5] bg-[#F8FAFC]" />
          <div className="absolute left-[12%] top-1/2 h-[8%] w-[16%] -translate-y-1/2 rounded-full bg-[#FCA5A5]" />
          <div className="absolute right-[12%] top-1/2 h-[8%] w-[16%] -translate-y-1/2 rounded-full bg-[#FCA5A5]" />
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
            className="absolute inset-[10%] bg-[#F59E0B] shadow-[0_0_18px_rgba(245,158,11,0.4)]"
            style={{
              clipPath:
                'polygon(50% 0%, 62% 20%, 86% 8%, 76% 34%, 100% 50%, 76% 66%, 86% 92%, 62% 80%, 50% 100%, 38% 80%, 14% 92%, 24% 66%, 0% 50%, 24% 34%, 14% 8%, 38% 20%)',
            }}
          />
          <div className="absolute inset-[30%] rounded-full bg-[#7C2D12]" />
          <div className="absolute left-1/2 top-1/2 h-[36%] w-[10%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FDE68A]/80" />
          <div className="absolute left-1/2 top-1/2 h-[10%] w-[36%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FDE68A]/80" />
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

      // RGB-split digital glitch — three displaced colour bands
      return (
        <div
          className="relative overflow-hidden rounded-[8%]"
          style={{
            width: `calc(${particle.size} * 1.1)`,
            height: `calc(${particle.size} * 0.72)`,
          }}
        >
          <div className="absolute inset-0 bg-[#0F172A]" />
          <div className="absolute left-[-10%] right-[22%] top-0 h-[36%] bg-[#F43F5E]" />
          <div className="absolute left-[14%] right-[-10%] top-[32%] h-[36%] bg-[#4ADE80]" />
          <div className="absolute left-[-5%] right-[10%] bottom-0 h-[36%] bg-[#38BDF8]" />
        </div>
      )
    },
  },
  {
    ...requireEasterEgg('finish-the-fight'),
    renderPiece: (particle) => {
      if (particle.kind === 'energy-sword') {
        // Halo energy sword — vertical V-shape, two blades from central guard
        return (
          <div
            className="relative"
            style={{
              width: `calc(${particle.size} * 0.85)`,
              height: `calc(${particle.size} * 1.2)`,
            }}
          >
            {/* Left blade — triangle with tip at top-center, base at bottom-left */}
            <div
              className="absolute left-0 top-0 h-[52%] w-[46%] bg-[#67E8F9] shadow-[0_0_16px_rgba(103,232,249,0.75)]"
              style={{ clipPath: 'polygon(100% 0%, 100% 100%, 0% 100%)' }}
            />
            <div
              className="absolute left-[3%] top-[4%] h-[40%] w-[34%] bg-[#E0F7FF]"
              style={{ clipPath: 'polygon(100% 0%, 100% 100%, 14% 100%)' }}
            />
            {/* Right blade */}
            <div
              className="absolute right-0 top-0 h-[52%] w-[46%] bg-[#67E8F9] shadow-[0_0_16px_rgba(103,232,249,0.75)]"
              style={{ clipPath: 'polygon(0% 0%, 100% 100%, 0% 100%)' }}
            />
            <div
              className="absolute right-[3%] top-[4%] h-[40%] w-[34%] bg-[#E0F7FF]"
              style={{ clipPath: 'polygon(0% 0%, 86% 100%, 0% 100%)' }}
            />
            {/* Guard */}
            <div className="absolute left-[6%] right-[6%] top-[50%] h-[5%] -translate-y-1/2 rounded-full bg-[#0F172A]" />
            <div className="absolute left-1/2 top-[47%] h-[12%] w-[12%] -translate-x-1/2 rounded-full bg-[#1E293B]" />
            {/* Handle */}
            <div className="absolute left-1/2 top-[57%] bottom-[4%] w-[10%] -translate-x-1/2 rounded-b-full bg-[#475569]" />
          </div>
        )
      }

      return (
        <div
          className="relative"
          style={{
            width: `calc(${particle.size} * 1.18)`,
            height: `calc(${particle.size} * 0.72)`,
          }}
        >
          <div
            className="absolute inset-y-[16%] left-[4%] right-[10%] bg-[#38BDF8] shadow-[0_0_18px_rgba(56,189,248,0.48)]"
            style={{ clipPath: 'polygon(0% 50%, 14% 8%, 74% 8%, 100% 50%, 74% 92%, 14% 92%)' }}
          />
          <div
            className="absolute inset-y-[26%] left-[22%] right-[24%] bg-[#E0F2FE]"
            style={{ clipPath: 'polygon(0% 50%, 18% 12%, 76% 12%, 100% 50%, 76% 88%, 18% 88%)' }}
          />
          <div
            className="absolute right-0 top-[28%] h-[28%] w-[18%] bg-[#67E8F9]"
            style={{ clipPath: 'polygon(0% 12%, 100% 50%, 0% 88%)' }}
          />
          <div className="absolute left-[12%] top-[38%] h-[8%] w-[10%] rounded-full bg-[#E0F2FE]" />
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

      // Energy comet trail — teardrop streak with bright glowing core
      return (
        <div
          className="relative"
          style={{
            width: `calc(${particle.size} * 1.5)`,
            height: `calc(${particle.size} * 0.48)`,
          }}
        >
          <div
            className="absolute inset-0 bg-[#38BDF8] shadow-[0_0_12px_rgba(56,189,248,0.55)]"
            style={{ clipPath: 'polygon(6% 50%, 18% 0%, 100% 8%, 100% 92%, 18% 100%)' }}
          />
          <div className="absolute inset-y-[16%] left-[20%] right-[4%] bg-[#E0F2FE]" />
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

export function getEasterEggDefinition(gameId: number): EasterEggDefinition | null {
  return (
    EASTER_EGG_DEFINITIONS.find((definition) => definition.triggerGameIds.includes(gameId)) ?? null
  )
}

// ─── Overlay components ───────────────────────────────────────────────────────

export function EasterEggCelebration({ burstId, renderPiece, particles }: ActiveEasterEgg) {
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

export function PerfectGridCelebration({ burstId, particles }: ActivePerfectCelebration) {
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
