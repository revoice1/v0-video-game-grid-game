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
        'group relative inline-flex h-10 w-[76px] items-center rounded-full border p-1 transition-[background-color,border-color,box-shadow] duration-300 ease-out',
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
          'absolute top-1 h-8 w-8 rounded-full border shadow-sm transition-[left,background-color,transform] duration-300 ease-out group-active:scale-95',
          isDark
            ? 'left-[36px] border-border bg-foreground'
            : 'left-1 border-border bg-primary'
        )}
      />
      <span className="relative z-10 grid w-full grid-cols-2 place-items-center">
        <FlashbangIcon
          className={cn(
            'h-[18px] w-[18px] transition-[color,transform,opacity] duration-300 ease-out',
            isDark ? 'text-muted-foreground' : 'text-primary-foreground'
          )}
        />
        <Moon
          className={cn(
            'h-[18px] w-[18px] transition-[color,transform,opacity] duration-300 ease-out',
            isDark ? 'text-background' : 'text-muted-foreground'
          )}
        />
      </span>
    </button>
  )
}
