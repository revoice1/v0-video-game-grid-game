import { useEffect, useState } from 'react'
import { getTimeUntilNextUtcMidnight } from '@/lib/utils'

export function useLoadingState<TLoadingAttempt = unknown>() {
  const [sessionId, setSessionId] = useState('')
  const [loadingProgress, setLoadingProgress] = useState(8)
  const [loadingStage, setLoadingStage] = useState('Warming up the puzzle generator...')
  const [loadingAttempts, setLoadingAttempts] = useState<TLoadingAttempt[]>([])
  const [dailyResetLabel, setDailyResetLabel] = useState(() => getTimeUntilNextUtcMidnight().label)

  useEffect(() => {
    const updateResetCountdown = () => {
      setDailyResetLabel(getTimeUntilNextUtcMidnight().label)
    }

    updateResetCountdown()
    const timer = setInterval(updateResetCountdown, 1000)

    return () => clearInterval(timer)
  }, [])

  return {
    sessionId,
    setSessionId,
    loadingProgress,
    setLoadingProgress,
    loadingStage,
    setLoadingStage,
    loadingAttempts,
    setLoadingAttempts,
    dailyResetLabel,
    setDailyResetLabel,
  }
}
