'use client'

import {
  EASTER_EGG_DEFINITIONS,
  type EasterEggParticle,
  renderRealStinkerPiece,
} from '@/components/game/easter-egg-celebrations'
import type { EasterEggPieceKind } from '@/lib/easter-eggs'

const SIZES = [
  { label: 'game (20px)', value: '20px' },
  { label: '2x (40px)', value: '40px' },
  { label: '3x (60px)', value: '60px' },
]

function fakeParticle(kind: EasterEggPieceKind, size: string): EasterEggParticle {
  return {
    id: `preview-${kind}-${size}`,
    left: '0%',
    delay: '0ms',
    duration: '0ms',
    size,
    rotate: '0deg',
    drift: '0px',
    kind,
  }
}

function PieceCell({
  render,
  kind,
  size,
}: {
  render: (p: EasterEggParticle) => React.ReactNode
  kind: EasterEggPieceKind
  size: string
}) {
  return (
    <td className="px-4 py-3 align-middle">
      <div className="flex items-center justify-center" style={{ width: '72px', height: '72px' }}>
        {render(fakeParticle(kind, size))}
      </div>
    </td>
  )
}

export function ConfettiPageClient() {
  return (
    <div className="min-h-screen bg-background px-8 py-10 text-foreground">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold tracking-tight">Particle Shape Preview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each piece rendered at game size, 2x, and 3x. Dev only.
        </p>

        <div className="mt-8 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                  Achievement
                </th>
                <th className="px-4 py-3 text-left font-mono text-xs font-semibold text-muted-foreground">
                  kind
                </th>
                {SIZES.map((s) => (
                  <th
                    key={s.value}
                    className="px-4 py-3 text-center font-mono text-xs font-semibold text-muted-foreground"
                  >
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EASTER_EGG_DEFINITIONS.map((def, defIndex) =>
                def.pieceKinds.map((kind, kindIndex) => (
                  <tr
                    key={`${def.achievementId}-${kind}`}
                    className={`border-b border-border/50 ${defIndex % 2 === 0 ? 'bg-background' : 'bg-secondary/10'}`}
                  >
                    {kindIndex === 0 ? (
                      <td className="px-4 py-3 align-top" rowSpan={def.pieceKinds.length}>
                        <p className="font-medium">{def.achievementTitle}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          {def.achievementId}
                        </p>
                      </td>
                    ) : null}
                    <td className="px-4 py-3 align-middle font-mono text-xs text-muted-foreground">
                      {kind}
                    </td>
                    {SIZES.map((s) => (
                      <PieceCell
                        key={s.value}
                        render={def.renderPiece}
                        kind={kind}
                        size={s.value}
                      />
                    ))}
                  </tr>
                ))
              )}

              <tr className="border-b border-border bg-secondary/20">
                <td
                  colSpan={2 + SIZES.length}
                  className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Special (non-easter-egg)
                </td>
              </tr>
              <tr className="border-b border-border/50 bg-background">
                <td className="px-4 py-3 align-middle">
                  <p className="font-medium">Real Stinker</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">real-stinker</p>
                </td>
                <td className="px-4 py-3 align-middle font-mono text-xs text-muted-foreground">
                  poop
                </td>
                {SIZES.map((s) => (
                  <PieceCell
                    key={s.value}
                    render={renderRealStinkerPiece}
                    kind={'dust' as EasterEggPieceKind}
                    size={s.value}
                  />
                ))}
              </tr>
              <tr className="bg-secondary/10">
                <td className="px-4 py-3 align-middle">
                  <p className="font-medium">Perfect Grid</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">perfect-grid</p>
                </td>
                <td className="px-4 py-3 align-middle font-mono text-xs text-muted-foreground">
                  G (green)
                </td>
                {SIZES.map((s) => (
                  <td key={s.value} className="px-4 py-3 align-middle">
                    <div
                      className="flex items-center justify-center"
                      style={{ width: '72px', height: '72px' }}
                    >
                      <div className="relative" style={{ width: s.value, height: s.value }}>
                        <div
                          className="absolute inset-0 flex items-center justify-center text-center font-black italic leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
                          style={{ color: '#16C23A', fontSize: `calc(${s.value} * 0.9)` }}
                        >
                          G
                        </div>
                      </div>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Pieces are shown without rotation. In-game they rotate randomly between -30 and +30
          degrees.
        </p>
      </div>
    </div>
  )
}
