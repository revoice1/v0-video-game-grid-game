import { useEffect, useEffectEvent, useRef, type MutableRefObject } from 'react'
import { getNextPlayer, type TicTacToePlayer } from '@/components/game/game-client-versus-helpers'
import {
  startFinalStealHeartbeatLoop,
  stopFinalStealHeartbeatLoop,
} from '@/components/game/game-client-runtime-helpers'

interface PendingFinalStealLike {
  defender: TicTacToePlayer
  cellIndex: number
}

interface UseVersusTurnTimerOptions {
  isVersusMode: boolean
  isOnlineMatch?: boolean
  isLoading: boolean
  loadedPuzzleMode: 'daily' | 'practice' | 'versus' | null
  puzzleId: string | null
  currentPlayer: TicTacToePlayer
  winner: TicTacToePlayer | 'draw' | null
  versusTimerOption: number | 'none'
  turnTimeLeft: number | null
  turnDeadlineAt: string | null
  pendingFinalSteal: PendingFinalStealLike | null
  animationsEnabled: boolean
  audioEnabled: boolean
  activeTurnTimerKeyRef: MutableRefObject<string | null>
  setTurnTimeLeft: (value: number | null | ((current: number | null) => number | null)) => void
  setTurnDeadlineAt: (value: string | null) => void
  onTurnExpired: (nextPlayer: TicTacToePlayer) => void
}

export function useVersusTurnTimer({
  isVersusMode,
  isOnlineMatch = false,
  isLoading,
  loadedPuzzleMode,
  puzzleId,
  currentPlayer,
  winner,
  versusTimerOption,
  turnTimeLeft,
  turnDeadlineAt,
  pendingFinalSteal,
  animationsEnabled,
  audioEnabled,
  activeTurnTimerKeyRef,
  setTurnTimeLeft,
  setTurnDeadlineAt,
  onTurnExpired,
}: UseVersusTurnTimerOptions) {
  const onTurnExpiredEvent = useEffectEvent(onTurnExpired)
  const initializedTurnTimerKeyRef = useRef<string | null>(null)
  const expiredTurnTimerKeyRef = useRef<string | null>(null)

  useEffect(() => {
    const cueKey = pendingFinalSteal
      ? `${pendingFinalSteal.defender}:${pendingFinalSteal.cellIndex}`
      : null

    if (!cueKey || !animationsEnabled || !audioEnabled) {
      stopFinalStealHeartbeatLoop()
      return
    }

    startFinalStealHeartbeatLoop()

    return () => {
      stopFinalStealHeartbeatLoop()
    }
  }, [audioEnabled, animationsEnabled, pendingFinalSteal])

  useEffect(() => {
    if (!isVersusMode || winner) {
      stopFinalStealHeartbeatLoop()
      return
    }
  }, [isVersusMode, winner])

  useEffect(() => {
    const isVersusBoardReady =
      isVersusMode && !isLoading && loadedPuzzleMode === 'versus' && puzzleId !== null

    if (winner || versusTimerOption === 'none') {
      activeTurnTimerKeyRef.current = null
      initializedTurnTimerKeyRef.current = null
      expiredTurnTimerKeyRef.current = null
      setTurnTimeLeft(null)
      setTurnDeadlineAt(null)
      return
    }

    if (!isVersusBoardReady) {
      if (isVersusMode && (isLoading || loadedPuzzleMode !== 'versus' || puzzleId === null)) {
        initializedTurnTimerKeyRef.current = null
        expiredTurnTimerKeyRef.current = null
        setTurnTimeLeft(null)
      }
      return
    }

    const turnTimerKey = `${puzzleId}:${currentPlayer}`
    if (expiredTurnTimerKeyRef.current && expiredTurnTimerKeyRef.current !== turnTimerKey) {
      expiredTurnTimerKeyRef.current = null
    }
    const parsedDeadlineMs = turnDeadlineAt ? Date.parse(turnDeadlineAt) : Number.NaN
    const hasUsableOnlineDeadline =
      Number.isFinite(parsedDeadlineMs) && parsedDeadlineMs > Date.now()

    if (initializedTurnTimerKeyRef.current === turnTimerKey) {
      activeTurnTimerKeyRef.current = turnTimerKey
      if (isOnlineMatch && !hasUsableOnlineDeadline) {
        const nextDeadline = new Date(Date.now() + versusTimerOption * 1000).toISOString()
        setTurnDeadlineAt(nextDeadline)
        setTurnTimeLeft(versusTimerOption)
      } else if (!isOnlineMatch && turnTimeLeft === null) {
        setTurnTimeLeft(versusTimerOption)
      }
      return
    }

    const hadInitializedTurn = initializedTurnTimerKeyRef.current !== null
    initializedTurnTimerKeyRef.current = turnTimerKey
    if (isOnlineMatch) {
      const hasHydratedCurrentTurnDeadline =
        activeTurnTimerKeyRef.current === turnTimerKey && hasUsableOnlineDeadline

      if (!hasHydratedCurrentTurnDeadline) {
        const nextDeadline = new Date(Date.now() + versusTimerOption * 1000).toISOString()
        setTurnDeadlineAt(nextDeadline)
        setTurnTimeLeft(versusTimerOption)
      }
      activeTurnTimerKeyRef.current = turnTimerKey
    } else {
      activeTurnTimerKeyRef.current = turnTimerKey
      if (hadInitializedTurn || turnTimeLeft === null || turnTimeLeft <= 0) {
        setTurnTimeLeft(versusTimerOption)
      }
      setTurnDeadlineAt(null)
    }
  }, [
    activeTurnTimerKeyRef,
    currentPlayer,
    isLoading,
    isOnlineMatch,
    isVersusMode,
    loadedPuzzleMode,
    puzzleId,
    setTurnDeadlineAt,
    setTurnTimeLeft,
    turnDeadlineAt,
    turnTimeLeft,
    versusTimerOption,
    winner,
  ])

  useEffect(() => {
    if (!isVersusMode || winner) {
      return
    }

    const turnTimerKey = puzzleId ? `${puzzleId}:${currentPlayer}` : null

    if (isOnlineMatch) {
      if (!turnDeadlineAt) {
        setTurnTimeLeft(null)
        return
      }

      const deadlineMs = Date.parse(turnDeadlineAt)
      if (Number.isNaN(deadlineMs)) {
        setTurnTimeLeft(null)
        return
      }

      const remaining = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000))
      setTurnTimeLeft(remaining)

      if (remaining <= 0) {
        if (turnTimerKey && expiredTurnTimerKeyRef.current === turnTimerKey) {
          return
        }
        expiredTurnTimerKeyRef.current = turnTimerKey
        onTurnExpiredEvent(getNextPlayer(currentPlayer))
        return
      }

      const timer = window.setInterval(() => {
        setTurnTimeLeft(Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)))
      }, 250)

      return () => window.clearInterval(timer)
    }

    if (turnTimeLeft === null) {
      return
    }

    if (turnTimeLeft <= 0) {
      if (turnTimerKey && expiredTurnTimerKeyRef.current === turnTimerKey) {
        return
      }
      expiredTurnTimerKeyRef.current = turnTimerKey
      onTurnExpiredEvent(getNextPlayer(currentPlayer))
      return
    }

    const timer = window.setTimeout(() => {
      setTurnTimeLeft((current) => (current === null ? null : current - 1))
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [
    currentPlayer,
    isOnlineMatch,
    isVersusMode,
    setTurnTimeLeft,
    turnDeadlineAt,
    turnTimeLeft,
    winner,
  ])
}
