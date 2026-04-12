'use client'

interface BurstOverlayProps {
  burstId: number
}

interface JudgmentPendingOverlayProps {
  burstId: number
}

interface JudgmentVerdictSplashProps extends BurstOverlayProps {
  verdict: 'sustained' | 'overruled'
}

export function ObjectionSplash({ burstId }: BurstOverlayProps) {
  return (
    <div
      key={burstId}
      data-testid="objection-splash"
      className="pointer-events-none fixed inset-0 z-[96] grid place-items-center overflow-hidden p-4"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.24),transparent_22%),linear-gradient(180deg,rgba(9,10,14,0.24),rgba(9,10,14,0.42))]" />
      <div className="absolute inset-0 opacity-70 [background-image:repeating-linear-gradient(-72deg,transparent_0_14px,rgba(255,185,64,0.13)_14px_22px,transparent_22px_38px)]" />
      <div className="objection-splash select-none px-6 text-center font-black uppercase italic tracking-[0.08em] text-[#ffb44a] drop-shadow-[0_16px_42px_rgba(0,0,0,0.88)]">
        Objection!
      </div>
    </div>
  )
}

export function StealMissSplash({ burstId }: BurstOverlayProps) {
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
    </div>
  )
}

export function DoubleKoSplash({ burstId }: BurstOverlayProps) {
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
    </div>
  )
}

export function JudgmentPendingOverlay({ burstId }: JudgmentPendingOverlayProps) {
  return (
    <div
      key={burstId}
      data-testid="judgment-pending-overlay"
      className="pointer-events-none fixed inset-0 z-[95] grid place-items-center overflow-hidden p-4"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.18),transparent_24%),linear-gradient(180deg,rgba(7,10,16,0.72),rgba(7,10,16,0.84))]" />
      <div className="absolute inset-0 opacity-60 [background-image:repeating-linear-gradient(-68deg,transparent_0_16px,rgba(245,158,11,0.12)_16px_24px,transparent_24px_40px)]" />
      <div className="relative w-full max-w-xl rounded-[28px] border border-[#f5b94e]/45 bg-[#0f1219]/90 px-6 py-7 text-center shadow-[0_28px_70px_rgba(0,0,0,0.48)] backdrop-blur-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.42em] text-[#ffd46f]">
          OBJECTION!
        </p>
        <p className="mt-4 text-4xl font-black uppercase italic tracking-[0.08em] text-[#fff3cf] drop-shadow-[0_10px_28px_rgba(0,0,0,0.82)] sm:text-6xl">
          Judge Gemini
          <span className="block text-[#ffb44a]">Deliberating</span>
        </p>
        <p className="mt-3 text-sm text-foreground/75">
          Reviewing the game, the intersection, and the current metadata.
        </p>
        <div className="mx-auto mt-6 flex w-full max-w-[220px] items-end justify-center">
          <div className="relative h-[92px] w-[148px]">
            <div className="judgment-gavel absolute left-[16px] top-[0px]">
              <svg
                aria-hidden="true"
                viewBox="0 0 120 100"
                className="h-full w-full overflow-visible drop-shadow-[0_10px_16px_rgba(0,0,0,0.26)]"
              >
                <defs>
                  <linearGradient id="gavelGold" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#ffe47c" />
                    <stop offset="55%" stopColor="#ffbf1d" />
                    <stop offset="100%" stopColor="#df7e10" />
                  </linearGradient>
                  <linearGradient id="gavelGoldDark" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#d88412" />
                    <stop offset="100%" stopColor="#9a470d" />
                  </linearGradient>
                  <radialGradient id="gavelJoint" cx="35%" cy="35%" r="75%">
                    <stop offset="0%" stopColor="#ffc94e" />
                    <stop offset="100%" stopColor="#af4f0d" />
                  </radialGradient>
                </defs>
                <g transform="rotate(-14 60 48)">
                  <g transform="translate(14 6)">
                    <rect x="18" y="12" width="30" height="36" rx="10" fill="url(#gavelGold)" />
                    <rect x="14" y="6" width="38" height="11" rx="5.5" fill="url(#gavelGold)" />
                    <rect x="14" y="43" width="38" height="11" rx="5.5" fill="url(#gavelGold)" />
                    <rect x="15" y="14" width="5" height="32" rx="2.5" fill="url(#gavelGoldDark)" />
                    <rect x="46" y="14" width="5" height="32" rx="2.5" fill="url(#gavelGoldDark)" />
                    <circle cx="54" cy="32" r="8" fill="url(#gavelJoint)" />
                    <rect x="54" y="26" width="40" height="12" rx="6" fill="url(#gavelGold)" />
                    <ellipse cx="95" cy="32" rx="12" ry="10" fill="url(#gavelGold)" />
                    <ellipse
                      cx="90"
                      cy="46"
                      rx="12"
                      ry="9"
                      fill="url(#gavelGoldDark)"
                      opacity="0.12"
                    />
                  </g>
                </g>
              </svg>
            </div>
            <div className="judgment-block absolute bottom-[14px] left-[26px]" />
            <div className="judgment-impact absolute bottom-[34px] left-[52px]" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function JudgmentVerdictSplash({ burstId, verdict }: JudgmentVerdictSplashProps) {
  const isSustained = verdict === 'sustained'

  return (
    <div
      key={burstId}
      data-testid="judgment-verdict-splash"
      className="pointer-events-none fixed inset-0 z-[96] grid place-items-center overflow-hidden p-4"
    >
      <div
        className={`absolute inset-0 ${
          isSustained
            ? 'bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.2),transparent_26%),rgba(4,10,14,0.2)]'
            : 'bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.18),transparent_24%),rgba(7,8,14,0.24)]'
        }`}
      />
      <div
        className={`verdict-splash select-none px-6 text-center font-black uppercase italic drop-shadow-[0_14px_38px_rgba(0,0,0,0.82)] ${
          isSustained
            ? 'verdict-splash-sustained text-[#8df3a8]'
            : 'verdict-splash-overruled text-[#ff8a8a]'
        }`}
      >
        {isSustained ? 'Sustained' : 'Overruled'}
      </div>
    </div>
  )
}
