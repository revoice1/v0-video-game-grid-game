'use client'

import { useEffect, useState } from 'react'
import { Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

function FlashbangIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3.5v2.25" />
      <path d="M17.66 5.84l-1.6 1.6" />
      <path d="M20 11.5h-2.25" />
      <path d="M17.66 17.16l-1.6-1.6" />
      <path d="M6.34 17.16l1.6-1.6" />
      <path d="M4 11.5h2.25" />
      <path d="M6.34 5.84l1.6 1.6" />
      <path d="M10.25 8.25h3.5l1.5 1.8v4.2l-1.8 1.8h-3.5l-1.7-1.8V10.1z" />
      <path d="M9.25 9.5 7.5 8.2" />
      <path d="M7.5 8.2 6.7 9.4" />
      <circle cx="12" cy="12.15" r="1.1" />
    </svg>
  )
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = !mounted || resolvedTheme !== 'light'

  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={!isDark}
      onClick={() => mounted && setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'group relative inline-flex h-9 w-[72px] items-center rounded-full border px-2 transition-[background-color,border-color,box-shadow] duration-300 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'focus-visible:ring-offset-background',
        isDark
          ? 'border-border bg-secondary/70 text-foreground shadow-sm'
          : 'border-border bg-card/95 text-foreground shadow-sm'
      )}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span
        className={cn(
          'absolute top-1/2 h-7 w-7 -translate-y-1/2 rounded-full border shadow-sm transition-[left,background-color,transform] duration-300 ease-out group-active:scale-95',
          isDark
            ? 'left-[38px] border-border bg-foreground'
            : 'left-[4px] border-border bg-primary'
        )}
      />
      <span className="relative z-10 flex w-full items-center justify-between">
        <FlashbangIcon
          className={cn(
            'h-4 w-4 transition-[color,transform,opacity] duration-300 ease-out',
            isDark ? 'text-muted-foreground' : 'text-primary-foreground'
          )}
        />
        <Moon
          className={cn(
            'h-4 w-4 transition-[color,transform,opacity] duration-300 ease-out',
            isDark ? 'text-background' : 'text-muted-foreground'
          )}
        />
      </span>
    </button>
  )
}
