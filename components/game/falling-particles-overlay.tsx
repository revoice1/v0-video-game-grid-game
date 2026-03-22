'use client'

import type { ReactNode } from 'react'

interface FallingParticleBase {
  id: string
  left: string
  delay: string
  duration: string
  rotate: string
  drift: string
}

interface FallingParticlesOverlayProps<TParticle extends FallingParticleBase> {
  burstId: number
  particles: TParticle[]
  dataTestId: string
  zIndexClassName: string
  animationName: string
  animationStyles: string
  renderParticle: (particle: TParticle) => ReactNode
  background?: ReactNode
  overlay?: ReactNode
}

export function FallingParticlesOverlay<TParticle extends FallingParticleBase>({
  burstId,
  particles,
  dataTestId,
  zIndexClassName,
  animationName,
  animationStyles,
  renderParticle,
  background,
  overlay,
}: FallingParticlesOverlayProps<TParticle>) {
  return (
    <div
      data-testid={dataTestId}
      className={`pointer-events-none fixed inset-0 overflow-hidden ${zIndexClassName}`}
    >
      <style>{animationStyles}</style>
      {background}
      {particles.map((particle) => (
        <div
          key={`${burstId}-${particle.id}`}
          className="absolute top-0"
          style={{
            left: particle.left,
            animationName,
            animationDelay: particle.delay,
            animationDuration: particle.duration,
            animationTimingFunction: 'linear',
            animationFillMode: 'both',
            willChange: 'transform, opacity',
            ['--rotation' as string]: particle.rotate,
            ['--drift' as string]: particle.drift,
          }}
        >
          {renderParticle(particle)}
        </div>
      ))}
      {overlay}
    </div>
  )
}
