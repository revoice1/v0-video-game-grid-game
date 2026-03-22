import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getTimeUntilNextUtcMidnight(now = new Date()) {
  const nextReset = new Date(now)
  nextReset.setUTCHours(24, 0, 0, 0)

  const diffMs = Math.max(0, nextReset.getTime() - now.getTime())
  const totalSeconds = Math.floor(diffMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return {
    hours,
    minutes,
    seconds,
    label: `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`,
  }
}
