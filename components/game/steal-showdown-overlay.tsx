'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { VersusStealRule } from './versus-setup-modal'

export interface StealShowdownOverlayProps {
  burstId: number
  defenderName: string
  defenderScore: number
  attackerName: string
  attackerScore: number
  rule: Exclude<VersusStealRule, 'off'>
  successful: boolean
  lowEffects?: boolean
}

export function StealShowdownOverlay({
  burstId,
  defenderName,
  defenderScore,
  attackerName,
  attackerScore,
  rule,
  successful,
  lowEffects = false,
}: StealShowdownOverlayProps) {
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
    <div data-testid="steal-showdown-overlay" className="fixed inset-0 z-110">
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
            'showdown-shell w-full max-w-3xl rounded-4xl border border-border/80 bg-card/95 p-6 sm:p-7',
            lowEffects ? 'shadow-2xl' : 'shadow-[0_28px_90px_rgba(0,0,0,0.6)]'
          )}
        >
          <p className="text-center text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            Steal Attempt
          </p>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            {rule === 'lower'
              ? 'Lower rating steals the square'
              : rule === 'higher'
                ? 'Higher rating steals the square'
                : rule === 'fewer_reviews'
                  ? 'Fewer reviews steals the square'
                  : 'More reviews steals the square'}
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
              showVerdict ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
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
    </div>
  )
}
