'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { clearAllDailyGameStates } from '@/lib/session'
import { normalizeTransferCode } from '@/lib/session-transfer'

function TransferPageShell({
  phase = 'loading',
  hasCode = false,
  onConfirm,
}: {
  phase?: 'loading' | 'ready' | 'submitting' | 'success' | 'invalid' | 'error'
  hasCode?: boolean
  onConfirm?: () => void
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-6">
      <div className="w-full rounded-3xl border border-border bg-card/95 p-6 shadow-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          History Transfer
        </p>
        {phase === 'loading' && (
          <>
            <h1 className="mt-2 text-xl font-semibold text-foreground">Checking transfer…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Hold on for a second while we verify this transfer code.
            </p>
          </>
        )}
        {phase === 'ready' && (
          <>
            <h1 className="mt-2 text-xl font-semibold text-foreground">Import history?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This transfer code is ready to use on this device.
            </p>
            <p className="mt-3 rounded-lg border border-amber-400/25 bg-amber-500/8 px-3 py-2 text-sm text-amber-100/90">
              This replaces completed history on this device. Boards in progress stay local.
            </p>
          </>
        )}
        {phase === 'submitting' && (
          <>
            <h1 className="mt-2 text-xl font-semibold text-foreground">Importing history…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Hold on while we move your completed boards to this device.
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
        <div className="mt-5 flex flex-wrap gap-2">
          {phase === 'ready' && hasCode && onConfirm ? (
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex items-center rounded-full border border-border bg-background/80 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
            >
              Replace history
            </button>
          ) : null}
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
  const [phase, setPhase] = useState<
    'loading' | 'ready' | 'submitting' | 'success' | 'invalid' | 'error'
  >('loading')
  const [code, setCode] = useState<string | null>(null)

  useEffect(() => {
    const normalizedCode = normalizeTransferCode(searchParams.get('code'))
    if (!normalizedCode) {
      setPhase('invalid')
      setCode(null)
      return
    }
    setCode(normalizedCode)
    setPhase('ready')
  }, [searchParams])

  const handleConfirm = async () => {
    if (!code) {
      setPhase('invalid')
      return
    }

    setPhase('submitting')

    try {
      const response = await fetch('/api/session/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      if (response.ok) {
        clearAllDailyGameStates()
        setPhase('success')
        return
      }

      setPhase(response.status === 400 ? 'invalid' : 'error')
    } catch {
      setPhase('error')
    }
  }

  return <TransferPageShell phase={phase} hasCode={Boolean(code)} onConfirm={handleConfirm} />
}

export default function TransferPage() {
  return (
    <Suspense fallback={<TransferPageShell />}>
      <TransferPageContent />
    </Suspense>
  )
}
