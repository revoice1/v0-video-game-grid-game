'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { normalizeTransferCode } from '@/lib/session-transfer'

function TransferPageShell({
  phase = 'loading',
}: {
  phase?: 'loading' | 'success' | 'invalid' | 'error'
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-6">
      <div className="w-full rounded-3xl border border-border bg-card/95 p-6 shadow-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          History Transfer
        </p>
        {phase === 'loading' && (
          <>
            <h1 className="mt-2 text-xl font-semibold text-foreground">Transferring history…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Hold on for a second while we move your completed boards to this device.
            </p>
          </>
        )}
        {phase === 'success' && (
          <>
            <h1 className="mt-2 text-xl font-semibold text-foreground">Transfer complete</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your history is ready on this device.
            </p>
          </>
        )}
        {phase === 'invalid' && (
          <>
            <h1 className="mt-2 text-xl font-semibold text-foreground">That code is invalid</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The transfer link is missing, expired, or already used.
            </p>
          </>
        )}
        {phase === 'error' && (
          <>
            <h1 className="mt-2 text-xl font-semibold text-foreground">Transfer failed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Something went wrong while importing your history. Please try again.
            </p>
          </>
        )}
        <div className="mt-5">
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-border bg-background/80 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          >
            {phase === 'success' ? 'Open GameGrid' : 'Back to GameGrid'}
          </Link>
        </div>
      </div>
    </main>
  )
}

function TransferPageContent() {
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<'loading' | 'success' | 'invalid' | 'error'>('loading')

  useEffect(() => {
    const normalizedCode = normalizeTransferCode(searchParams.get('code'))
    if (!normalizedCode) {
      setPhase('invalid')
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const response = await fetch('/api/session/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: normalizedCode }),
        })

        if (cancelled) {
          return
        }

        if (response.ok) {
          setPhase('success')
          return
        }

        setPhase(response.status === 400 ? 'invalid' : 'error')
      } catch {
        if (!cancelled) {
          setPhase('error')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [searchParams])

  return <TransferPageShell phase={phase} />
}

export default function TransferPage() {
  return (
    <Suspense fallback={<TransferPageShell />}>
      <TransferPageContent />
    </Suspense>
  )
}
