'use client'

import { useEffect, useRef, useState } from 'react'
import { Moon, Settings2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useSearchConfirmPreference } from '@/lib/ui-preferences'

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

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const {
    mounted: preferencesMounted,
    enabled: confirmBeforeSelect,
    setEnabled: setConfirmBeforeSelect,
  } = useSearchConfirmPreference()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isSettingsOpen) {
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
        <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-sm">
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
                  'group relative inline-flex h-8 w-[64px] shrink-0 items-center rounded-full border p-1 transition-[background-color,border-color,box-shadow] duration-300 ease-out',
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
                      ? 'left-[31px] border-border bg-foreground'
                      : 'left-1 border-border bg-primary'
                  )}
                />
                <span className="relative z-10 grid w-full grid-cols-2 place-items-center">
                  <FlashbangIcon
                    className={cn(
                      'h-[14px] w-[14px] transition-[color,transform,opacity] duration-300 ease-out',
                      isDark ? 'text-muted-foreground' : 'text-primary-foreground'
                    )}
                  />
                  <Moon
                    className={cn(
                      'h-[14px] w-[14px] transition-[color,transform,opacity] duration-300 ease-out',
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
              aria-label={confirmBeforeSelect ? 'Turn off search confirmation' : 'Turn on search confirmation'}
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
                  confirmBeforeSelect
                    ? 'left-[18px] bg-primary'
                    : 'left-0.5 bg-muted-foreground'
                )}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
