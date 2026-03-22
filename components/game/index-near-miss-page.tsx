import { ROUTE_SLUG } from '@/lib/route-index'

interface IndexNearMissPageProps {
  attemptedSlug: string
}

export function IndexNearMissPage({ attemptedSlug }: IndexNearMissPageProps) {
  return (
    <main className="fixed inset-0 z-[120] overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.1),transparent_24%),radial-gradient(circle_at_center,rgba(59,130,246,0.06),transparent_52%),#020409]" />
      <div className="relative flex min-h-screen items-center justify-center px-6">
        <div className="max-w-xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.38em] text-white/45">
            Hidden Route
          </p>
          <div className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.03] px-8 py-7 shadow-[0_0_60px_rgba(15,23,42,0.35)]">
            <p className="font-mono text-sm uppercase tracking-[0.32em] text-white/35">
              {attemptedSlug}
            </p>
            <h1 className="mt-4 text-3xl font-black uppercase tracking-[0.18em] text-white/92 sm:text-4xl">
              almost...
            </h1>
            <p className="mt-4 text-sm text-white/55 sm:text-base">
              some routes only open when entered exactly.
            </p>
          </div>
          <p className="mt-5 text-[11px] uppercase tracking-[0.34em] text-white/20">
            {ROUTE_SLUG.length} chars
          </p>
        </div>
      </div>
    </main>
  )
}
