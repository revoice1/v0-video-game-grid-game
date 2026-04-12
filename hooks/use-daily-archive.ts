'use client'

import { useCallback, useState } from 'react'
import type { DailyArchiveEntry } from '@/components/game/daily-history-modal'
import { buildLegacySessionHeaders } from '@/components/game/game-client-submission'

interface DailyArchiveResponse {
  entries?: Array<{
    id: string
    date: string
    is_completed?: boolean
    guess_count?: number
  }>
  error?: string
}

export function useDailyArchive(sessionId: string) {
  const [entries, setEntries] = useState<DailyArchiveEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDailyArchive = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/daily-history', {
        headers: buildLegacySessionHeaders(sessionId),
      })
      const data = (await response.json()) as DailyArchiveResponse

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load daily archive')
      }

      setEntries(
        (data.entries ?? []).map((entry) => ({
          id: entry.id,
          date: entry.date,
          isCompleted: entry.is_completed ?? false,
          guessCount: entry.guess_count ?? 0,
        }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load daily archive')
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  return { entries, isLoading, error, fetchDailyArchive }
}
