'use client'

import { useEffect, useRef, useState } from 'react'
import { Moon, Settings2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { QRCodeCanvas } from 'qrcode.react'
import { IndexBadge } from '@/components/index-badge'
import { cn } from '@/lib/utils'
import {
  useAnimationPreference,
  useSearchConfirmPreference,
  useVersusAlarmPreference,
  useVersusAudioPreference,
} from '@/lib/ui-preferences'
import { normalizeTransferCode } from '@/lib/session-transfer'
import { clearAllDailyGameStates } from '@/lib/session'

function FlashbangIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2.9v2.5" />
      <path d="M18.14 5.86l-1.78 1.78" />
      <path d="M21.1 12h-2.5" />
      <path d="M18.14 18.14l-1.78-1.78" />
      <path d="M5.86 18.14l1.78-1.78" />
      <path d="M2.9 12h2.5" />
      <path d="M5.86 5.86l1.78 1.78" />
      <path d="M9.65 8.55h4.2l1.8 2.15v4.75l-2.05 2.05H9.45l-1.95-2.05V10.8z" />
      <path d="M9.15 9.9 6.55 8.05" />
      <path d="M6.55 8.05 5.45 9.7" />
      <circle cx="12" cy="13" r="1.6" />
    </svg>
  )
}

export function ThemeToggle({ showVersusAlarms = false }: { showVersusAlarms?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [transferMode, setTransferMode] = useState<'export' | 'import'>('export')
  const [transferStatus, setTransferStatus] = useState<
    'idle' | 'loading' | 'copied' | 'success' | 'error' | 'invalid' | 'ratelimit'
  >('idle')
  const [importCode, setImportCode] = useState('')
  const [exportCode, setExportCode] = useState('')
  const [exportExpiresAt, setExportExpiresAt] = useState('')
  const [exportUrl, setExportUrl] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const {
    mounted: preferencesMounted,
    enabled: confirmBeforeSelect,
    setEnabled: setConfirmBeforeSelect,
  } = useSearchConfirmPreference()
  const { enabled: animationsEnabled, setEnabled: setAnimationsEnabled } = useAnimationPreference()
  const { enabled: versusAlarmsEnabled, setEnabled: setVersusAlarmsEnabled } =
    useVersusAlarmPreference()
  const { enabled: versusAudioEnabled, setEnabled: setVersusAudioEnabled } =
    useVersusAudioPreference()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isSettingsOpen) {
      setTransferMode('export')
      setTransferStatus('idle')
      setImportCode('')
      setExportCode('')
      setExportExpiresAt('')
      setExportUrl('')
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsSettingsOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isSettingsOpen])

  const isDark = !mounted || resolvedTheme !== 'light'

  const handleCopyTransferCode = async () => {
    setTransferStatus('loading')
    setExportCode('')
    setExportExpiresAt('')
    setExportUrl('')

    try {
      const response = await fetch('/api/session/export')
      const payload = (await response.json()) as {
        code?: string
        expiresAt?: string
        error?: string
      }

      const normalizedCode = normalizeTransferCode(payload.code)
      if (!response.ok || !normalizedCode || !payload.expiresAt) {
        throw new Error(payload.error ?? 'Failed to export session')
      }

      const nextExportUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/transfer?code=${encodeURIComponent(normalizedCode)}`
          : ''

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        setExportCode(normalizedCode)
        setExportExpiresAt(payload.expiresAt)
        setExportUrl(nextExportUrl)
        setTransferStatus('success')
        void navigator.clipboard
          .writeText(normalizedCode)
          .then(() => {
            setTransferStatus('copied')
            window.setTimeout(() => {
              setTransferStatus((current) => (current === 'copied' ? 'idle' : current))
            }, 2000)
          })
          .catch(() => {})
      } else {
        setExportCode(normalizedCode)
        setExportExpiresAt(payload.expiresAt)
        setExportUrl(nextExportUrl)
        setTransferStatus('success')
      }
    } catch {
      setTransferStatus('error')
    }
  }

  const handleConfirmImport = async () => {
    const normalizedCode = normalizeTransferCode(importCode)

    if (!normalizedCode) {
      setTransferStatus('invalid')
      return
    }

    setTransferStatus('loading')

    try {
      const response = await fetch('/api/session/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalizedCode }),
      })

      if (response.ok) {
        clearAllDailyGameStates()
        setTransferStatus('success')
        window.setTimeout(() => window.location.reload(), 600)
        return
      }

      if (response.status === 400) {
        setTransferStatus('invalid')
        return
      }

      if (response.status === 429) {
        setTransferStatus('ratelimit')
        return
      }

      setTransferStatus('error')
    } catch {
      setTransferStatus('error')
    }
  }

  const transferMessage =
    transferMode === 'export'
      ? transferStatus === 'copied'
        ? 'Copied!'
        : transferStatus === 'success'
          ? 'Clipboard unavailable. Copy the code below.'
          : transferStatus === 'error'
            ? 'Something went wrong. Please try again.'
            : null
      : transferStatus === 'invalid'
        ? "That code doesn't look right. Check it and try again."
        : transferStatus === 'ratelimit'
          ? 'Too many attempts. Please wait a moment.'
          : transferStatus === 'success'
            ? 'History transferred! Reloading...'
            : transferStatus === 'error'
              ? 'Something went wrong. Please try again.'
              : null

  return (
    <div ref={wrapperRef} className="relative flex flex-col items-end gap-2">
      <button
        type="button"
        aria-label="Open settings"
        aria-expanded={isSettingsOpen}
        onClick={() => setIsSettingsOpen((open) => !open)}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isSettingsOpen
            ? 'border-primary/35 bg-primary/12 text-foreground'
            : 'border-border bg-card/90 text-muted-foreground hover:bg-secondary/35 hover:text-foreground'
        )}
        title="Settings"
      >
        <Settings2 className="h-4 w-4" />
      </button>

      {isSettingsOpen && (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 max-w-[calc(100vw-1rem)] rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Settings
          </p>
          <div className="mt-3 rounded-xl border border-border/70 bg-secondary/20 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Theme</p>
                <p className="text-[11px] text-muted-foreground">
                  {isDark ? 'Dark mode enabled' : 'Light mode enabled'}
                </p>
              </div>
              <button
                type="button"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-pressed={!isDark}
                onClick={() => mounted && setTheme(isDark ? 'light' : 'dark')}
                className={cn(
                  'group relative inline-flex h-8 w-16 shrink-0 items-center rounded-full border p-1 transition-[background-color,border-color,box-shadow] duration-300 ease-out',
                  isDark
                    ? 'border-border bg-secondary/70 text-foreground shadow-sm'
                    : 'border-border bg-card/95 text-foreground shadow-sm'
                )}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <span
                  className={cn(
                    'absolute top-1 h-6 w-6 rounded-full border shadow-sm transition-[left,background-color,transform] duration-300 ease-out group-active:scale-95',
                    isDark
                      ? 'left-7.75 border-border bg-foreground'
                      : 'left-1 border-border bg-primary'
                  )}
                />
                <span className="relative z-10 grid w-full grid-cols-2 place-items-center">
                  <FlashbangIcon
                    className={cn(
                      'h-3.5 w-3.5 transition-[color,transform,opacity] duration-300 ease-out',
                      isDark ? 'text-muted-foreground' : 'text-primary-foreground'
                    )}
                  />
                  <Moon
                    className={cn(
                      'h-3.5 w-3.5 transition-[color,transform,opacity] duration-300 ease-out',
                      isDark ? 'text-background' : 'text-muted-foreground'
                    )}
                  />
                </span>
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/20 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Confirm Picks</p>
              <p className="text-[11px] text-muted-foreground">
                {confirmBeforeSelect ? 'Ask before submitting' : 'Tap to submit instantly'}
              </p>
            </div>
            <button
              type="button"
              aria-label={
                confirmBeforeSelect ? 'Turn off search confirmation' : 'Turn on search confirmation'
              }
              aria-pressed={confirmBeforeSelect}
              onClick={() => preferencesMounted && setConfirmBeforeSelect(!confirmBeforeSelect)}
              className={cn(
                'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors',
                confirmBeforeSelect
                  ? 'border-primary/40 bg-primary/20'
                  : 'border-border bg-secondary/50'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-4.5 w-4.5 rounded-full transition-[left,background-color] duration-200',
                  confirmBeforeSelect ? 'left-4.5 bg-primary' : 'left-0.5 bg-muted-foreground'
                )}
              />
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/20 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Animations</p>
              <p className="text-[11px] text-muted-foreground">
                {animationsEnabled ? 'Show effects and pulses' : 'Use still visuals only'}
              </p>
            </div>
            <button
              type="button"
              aria-label={animationsEnabled ? 'Turn off animations' : 'Turn on animations'}
              aria-pressed={animationsEnabled}
              onClick={() => preferencesMounted && setAnimationsEnabled(!animationsEnabled)}
              className={cn(
                'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors',
                animationsEnabled
                  ? 'border-primary/40 bg-primary/20'
                  : 'border-border bg-secondary/50'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-4.5 w-4.5 rounded-full transition-[left,background-color] duration-200',
                  animationsEnabled ? 'left-4.5 bg-primary' : 'left-0.5 bg-muted-foreground'
                )}
              />
            </button>
          </div>
          {showVersusAlarms && (
            <>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/20 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Versus Alarms</p>
                  <p className="text-[11px] text-muted-foreground">
                    {versusAlarmsEnabled
                      ? 'Show timer and threat alarms'
                      : 'Keep versus board calm'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={
                    versusAlarmsEnabled ? 'Turn off versus alarms' : 'Turn on versus alarms'
                  }
                  aria-pressed={versusAlarmsEnabled}
                  onClick={() => preferencesMounted && setVersusAlarmsEnabled(!versusAlarmsEnabled)}
                  className={cn(
                    'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors',
                    versusAlarmsEnabled
                      ? 'border-primary/40 bg-primary/20'
                      : 'border-border bg-secondary/50'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-4.5 w-4.5 rounded-full transition-[left,background-color] duration-200',
                      versusAlarmsEnabled ? 'left-4.5 bg-primary' : 'left-0.5 bg-muted-foreground'
                    )}
                  />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/20 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Audio</p>
                  <p className="text-[11px] text-muted-foreground">
                    {versusAudioEnabled
                      ? 'Play heartbeat and future sound cues'
                      : 'Mute versus audio cues'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={versusAudioEnabled ? 'Turn off versus audio' : 'Turn on versus audio'}
                  aria-pressed={versusAudioEnabled}
                  onClick={() => preferencesMounted && setVersusAudioEnabled(!versusAudioEnabled)}
                  className={cn(
                    'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors',
                    versusAudioEnabled
                      ? 'border-primary/40 bg-primary/20'
                      : 'border-border bg-secondary/50'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-4.5 w-4.5 rounded-full transition-[left,background-color] duration-200',
                      versusAudioEnabled ? 'left-4.5 bg-primary' : 'left-0.5 bg-muted-foreground'
                    )}
                  />
                </button>
              </div>
            </>
          )}
          <div className="mt-3 rounded-xl border border-border/70 bg-secondary/20 px-3 py-2.5">
            <p className="text-sm font-medium text-foreground">Transfer History</p>
            {transferMode === 'export' ? (
              <>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Create a temporary code on this device, then paste it on another. Only completed
                  puzzles transfer — boards in progress stay on this device.
                </p>
                <button
                  type="button"
                  onClick={handleCopyTransferCode}
                  disabled={transferStatus === 'loading'}
                  className={cn(
                    'mt-2 inline-flex items-center rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors',
                    'hover:bg-secondary/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-60'
                  )}
                >
                  {transferStatus === 'loading' ? 'Creating...' : 'Create transfer code'}
                </button>
                {exportExpiresAt && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    This code expires in about 10 minutes.
                  </p>
                )}
                {transferMessage && (
                  <p className="mt-2 text-[11px] text-muted-foreground">{transferMessage}</p>
                )}
                {exportCode && (
                  <>
                    <div className="mt-3 rounded-xl border border-border/70 bg-background/50 p-3">
                      <div className="flex flex-col items-center text-center">
                        <div
                          aria-label="Transfer QR code"
                          className="inline-flex w-fit shrink-0 rounded-xl border border-border bg-white p-2 shadow-sm"
                        >
                          {exportUrl ? (
                            <QRCodeCanvas
                              value={exportUrl}
                              size={112}
                              marginSize={2}
                              level="M"
                              className="block shrink-0"
                            />
                          ) : null}
                        </div>
                        <p className="mt-3 text-[11px] font-medium text-foreground">
                          Scan on your phone, or copy the code below.
                        </p>
                        <input
                          readOnly
                          value={exportCode}
                          aria-label="Transfer code"
                          onFocus={(event) => event.currentTarget.select()}
                          onClick={(event) => event.currentTarget.select()}
                          className="mt-2.5 w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-center text-[13px] font-medium tracking-[0.18em] text-foreground outline-none"
                        />
                        {exportUrl && (
                          <a
                            href={exportUrl}
                            className="mt-2 inline-flex items-center text-[11px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
                          >
                            Open transfer link
                          </a>
                        )}
                      </div>
                    </div>
                  </>
                )}
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTransferMode('import')
                      setTransferStatus('idle')
                    }}
                    className="text-[11px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
                  >
                    Import on this device
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Paste the temporary code from your other device to move completed history here.
                </p>
                <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-500/8 px-2.5 py-2 text-[11px] text-amber-100/90">
                  This replaces completed history on this device. Boards in progress stay local.
                </p>
                <input
                  type="text"
                  value={importCode}
                  onChange={(event) => {
                    setImportCode(event.target.value.toUpperCase())
                    if (transferStatus !== 'idle') {
                      setTransferStatus('idle')
                    }
                  }}
                  placeholder="Paste code here..."
                  className="mt-2 w-full rounded-lg border border-border bg-background/80 px-2.5 py-2 text-[11px] text-foreground outline-none placeholder:text-muted-foreground"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={transferStatus === 'loading'}
                    className={cn(
                      'inline-flex items-center rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors',
                      'hover:bg-secondary/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-60'
                    )}
                  >
                    {transferStatus === 'loading' ? 'Importing...' : 'Replace history'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTransferMode('export')
                      setImportCode('')
                      setTransferStatus('idle')
                    }}
                    className={cn(
                      'inline-flex items-center rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors',
                      'hover:bg-secondary/50 hover:text-foreground'
                    )}
                  >
                    Cancel
                  </button>
                </div>
                {transferMessage && (
                  <p className="mt-2 text-[11px] text-muted-foreground">{transferMessage}</p>
                )}
              </>
            )}
          </div>
          <div className="mt-3 rounded-xl border border-border/70 bg-secondary/20 px-3 py-2.5">
            <p className="text-sm font-medium text-foreground">Feedback</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Found a bug or have an idea? Open an issue on GitHub.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href="/changelog"
                className={cn(
                  'inline-flex items-center rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors',
                  'hover:bg-secondary/50 hover:text-foreground'
                )}
              >
                Changelog
              </a>
              <a
                href="https://github.com/revoice1/gamegrid/issues/new?template=bug_report.yml"
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'inline-flex items-center rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors',
                  'hover:bg-secondary/50 hover:text-foreground'
                )}
              >
                Report Bug
              </a>
              <a
                href="https://github.com/revoice1/gamegrid/issues/new?template=feature_request.yml"
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'inline-flex items-center rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors',
                  'hover:bg-secondary/50 hover:text-foreground'
                )}
              >
                Request Feature
              </a>
            </div>
            <div className="mt-3 flex justify-end">
              <IndexBadge slot="settings" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
