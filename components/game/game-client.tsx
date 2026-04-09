'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { GameHeader } from './game-header'
import { GameGrid } from './game-grid'
import { GameSearch } from './game-search'
import { DevReloadBadge } from './dev-reload-badge'
import type { DailyArchiveEntry } from './daily-history-modal'
import { VersusSummaryPanel } from './versus-summary-panel'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { PuzzleLoadingScreen } from './puzzle-loading-screen'
import { StealShowdownOverlay } from './steal-showdown-overlay'
import {
  DoubleKoSplash,
  JudgmentPendingOverlay,
  JudgmentVerdictSplash,
  ObjectionSplash,
  StealMissSplash,
} from './game-feedback-overlays'
import {
  buildMissReason,
  detectAnimationQuality,
  getInitialVersusRecord,
  hasNonEmptyFilters,
  primeVersusAudioContext,
  saveVersusRecord,
  type VersusRecord,
} from './game-client-runtime-helpers'
import { ModeStartScreen } from './mode-start-screen'
import {
  buildGuessFromSelection,
  getCategoriesForCell,
  hydrateStoredGuess,
  isDuplicateGuessSelection,
  isGuessHydrated,
} from './game-client-helpers'
import {
  hasRestorableVersusState,
  shouldForegroundOnlineVersusSession,
} from './game-client-online-helpers'
import {
  buildLegacySessionHeaders,
  buildDailyStatsPayload,
  getPostGuessCompletionEffects,
  getPostGuessState,
  lookupGuessDetails,
  persistDailyObjectionResult,
  postDailyStats,
  shouldUnlockRealStinker,
  submitGuessSelection,
} from './game-client-submission'
import {
  buildStealFailureDescription,
  getOnlineVersusStealShowdownData,
  getOnlineVersusPlacementStateTransition,
  getNextPlayer,
  getPlayerLabel,
  getStealShowdownMetric,
  getVersusInvalidGuessResolution,
  getVersusPlacementResolution,
  getVersusTurnExpiredResolution,
  type TicTacToePlayer,
} from './game-client-versus-helpers'
import {
  buildAttemptIntersections,
  type LoadingAttempt,
  type LoadingIntersection,
} from './loading-helpers'
import type {
  VersusCategoryFilters,
  VersusObjectionRule,
  VersusStealRule,
  VersusTurnTimerOption,
} from './versus-setup-modal'
import { clearGameState, loadGameState, saveGameState, type SavedGameState } from '@/lib/session'
import {
  normalizeOnlineVersusEventSource,
  shouldReplayOnlineVersusSpectacle,
  shouldSkipLocallyRenderedOwnOnlineVersusStealReplay,
  shouldSkipOwnOnlineVersusEventReplay,
  shouldSuppressOnlineVersusReplayEffects,
} from '@/lib/online-versus-event-source'
import { sanitizeMinValidOptionsOverride } from '@/lib/min-valid-options'
import {
  useAnimationPreference,
  useSearchConfirmPreference,
  useVersusAlarmPreference,
  useVersusAudioPreference,
} from '@/lib/ui-preferences'
import { unlockAchievement } from '@/lib/achievements'
import {
  ActiveEasterEgg,
  ActivePerfectCelebration,
  EasterEggCelebration,
  PerfectGridCelebration,
  createFallingParticles,
  getEasterEggDefinition,
  getEasterEggLifetimeMs,
  parseMs,
  renderRealStinkerPiece,
  scaleParticleDensity,
} from './easter-egg-celebrations'
import { ROUTE_ACHIEVEMENT_ID, ROUTE_PENDING_TOAST_KEY } from '@/lib/route-index'
import type { Puzzle, CellGuess, Game, Category } from '@/lib/types'
import type { VersusEventRecord } from '@/lib/versus-events'
import { useToast } from '@/hooks/use-toast'
import { useAnimationQuality } from '@/hooks/use-animation-quality'
import { useLoadingState } from '@/hooks/use-loading-state'
import { useGameModeState } from '@/hooks/use-game-mode-state'
import { useOverlayState } from '@/hooks/use-overlay-state'
import { useGameGridDevTools } from '@/hooks/use-game-grid-dev-tools'
import { usePracticeSetupState } from '@/hooks/use-practice-setup-state'
import { useOnlineVersusRoom } from '@/hooks/use-online-versus-room'
import { usePuzzleState } from '@/hooks/use-puzzle-state'
import { useTimedOverlayDismiss } from '@/hooks/use-timed-overlay-dismiss'
import { useVersusMatchState } from '@/hooks/use-versus-match-state'
import { useVersusSetupState } from '@/hooks/use-versus-setup-state'
import { useVersusTurnTimer } from '@/hooks/use-versus-turn-timer'
import type {
  OnlineVersusClaimPayload,
  OnlineVersusEventType,
  OnlineVersusEventSource,
  OnlineVersusMissPayload,
  OnlineVersusObjectionPayload,
  OnlineVersusSnapshot,
  OnlineVersusStealPayload,
} from '@/lib/versus-room'
import {
  resolveStealOutcome,
  type PendingVersusSteal,
  type StealAction,
} from '@/hooks/use-versus-steal'

const ResultsModal = dynamic(() => import('./results-modal').then((m) => m.ResultsModal))
const DailyHistoryModal = dynamic(() =>
  import('./daily-history-modal').then((m) => m.DailyHistoryModal)
)
const HowToPlayModal = dynamic(() => import('./how-to-play-modal').then((m) => m.HowToPlayModal))
const GuessDetailsModal = dynamic(() =>
  import('./guess-details-modal').then((m) => m.GuessDetailsModal)
)
const VersusObjectionModal = dynamic(() =>
  import('./versus-objection-modal').then((m) => m.VersusObjectionModal)
)
const OnlineVersusLobby = dynamic(() =>
  import('./online-versus-lobby').then((m) => m.OnlineVersusLobby)
)
const AchievementsModal = dynamic(() =>
  import('./achievements-modal').then((m) => m.AchievementsModal)
)
const VersusSetupModal = dynamic(() =>
  import('./versus-setup-modal').then((m) => m.VersusSetupModal)
)

const MAX_GUESSES = 9
const DEFAULT_VERSUS_STEAL_RULE: VersusStealRule = 'fewer_reviews'
const DEFAULT_VERSUS_TIMER_OPTION: VersusTurnTimerOption = 300
const DEFAULT_VERSUS_DISABLE_DRAWS = true
const DEFAULT_VERSUS_OBJECTION_RULE: VersusObjectionRule = 'one'
type GameMode = 'daily' | 'practice' | 'versus'

interface ActiveStealShowdown {
  burstId: number
  durationMs: number
  defenderName: string
  defenderScore: number
  attackerName: string
  attackerScore: number
  rule: Exclude<VersusStealRule, 'off'>
  successful: boolean
  lowEffects?: boolean
}

interface ActiveStealMissSplash {
  burstId: number
  durationMs: number
}

interface ActiveDoubleKoSplash {
  burstId: number
  durationMs: number
}

interface ActiveJudgmentPending {
  burstId: number
}

interface ActiveObjectionSplash {
  burstId: number
  durationMs: number
}

interface ActiveJudgmentVerdict {
  burstId: number
  durationMs: number
  verdict: 'sustained' | 'overruled'
}

const STEAL_SHOWDOWN_DURATION_MS = 3400

function createOnlineVersusStealClientEventId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `steal_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

interface PendingFinalSteal {
  defender: TicTacToePlayer
  cellIndex: number
}

interface VersusObjectionsUsed {
  x: number
  o: number
}

interface PendingVersusObjectionReview {
  cellIndex: number
  player: TicTacToePlayer
  isVersusSteal: boolean
  guess: CellGuess
  rowCategory: Category
  colCategory: Category
  invalidGuessResolution: ReturnType<typeof getVersusInvalidGuessResolution>
}

interface DailyArchiveResponse {
  entries?: Array<{
    id: string
    date: string
    is_completed?: boolean
    guess_count?: number
  }>
  error?: string
}

interface PuzzleStreamMessage {
  type: 'progress' | 'puzzle' | 'error'
  pct?: number
  message?: string
  puzzle?: Puzzle
  stage?: 'families' | 'attempt' | 'cell' | 'metadata' | 'rejected' | 'done'
  attempt?: number
  rows?: string[]
  cols?: string[]
  cellIndex?: number
  rowCategory?: string
  colCategory?: string
  validOptionCount?: number
  passed?: boolean
}

export function GameClient({ minimumValidOptionsDefault }: { minimumValidOptionsDefault: number }) {
  const pendingVersusSetupIntentRef = useRef<'local' | 'online-host' | null>(null)
  const skipNextVersusAutoLoadRef = useRef(false)
  const skipNextPracticeAutoLoadRef = useRef(false)
  const skipNextVersusSavedStateRestoreRef = useRef(false)
  const suppressVersusStatePersistenceRef = useRef(false)
  const activeTurnTimerKeyRef = useRef<string | null>(null)
  const activePuzzleLoadControllerRef = useRef<AbortController | null>(null)
  const isPuzzleLoadInFlightRef = useRef(false)
  const recordedVersusWinnerKeyRef = useRef<string | null>(null)
  const finishedOnlineRoomIdRef = useRef<string | null>(null)
  const preparedOnlineRoomKeyRef = useRef<string | null>(null)
  const lastSavedOnlineSnapshotRef = useRef<string | null>(null)
  const lastAppliedOnlineSnapshotRef = useRef<string | null>(null)
  const attemptedInviteJoinCodeRef = useRef<string | null>(null)
  const sanitizeMinimumValidOptions = useCallback(
    (value: number | null | undefined) =>
      sanitizeMinValidOptionsOverride(value, minimumValidOptionsDefault),
    [minimumValidOptionsDefault]
  )
  const { mode, setMode, loadedPuzzleMode, setLoadedPuzzleMode } = useGameModeState()
  const {
    puzzle,
    setPuzzle,
    guesses,
    setGuesses,
    guessesRemaining,
    setGuessesRemaining,
    currentPlayer,
    setCurrentPlayer,
    stealableCell,
    setStealableCell,
    winner,
    setWinner,
    selectedCell,
    setSelectedCell,
  } = usePuzzleState({ cellCount: 9, maxGuesses: MAX_GUESSES })
  const [isLoading, setIsLoading] = useState(true)
  const {
    showResults,
    setShowResults,
    showHowToPlay,
    setShowHowToPlay,
    showAchievements,
    setShowAchievements,
    detailCell,
    setDetailCell,
  } = useOverlayState()
  const {
    practiceCategoryFilters,
    setPracticeCategoryFilters,
    practiceMinimumValidOptions,
    setPracticeMinimumValidOptions,
    showPracticeSetup,
    setShowPracticeSetup,
    showPracticeStartOptions,
    setShowPracticeStartOptions,
    practiceSetupError,
    setPracticeSetupError,
  } = usePracticeSetupState()
  const {
    versusCategoryFilters,
    setVersusCategoryFilters,
    versusMinimumValidOptions,
    setVersusMinimumValidOptions,
    versusStealRule,
    setVersusStealRule,
    versusTimerOption,
    setVersusTimerOption,
    versusDisableDraws,
    setVersusDisableDraws,
    versusObjectionRule,
    setVersusObjectionRule,
    showVersusSetup,
    setShowVersusSetup,
    showVersusStartOptions,
    setShowVersusStartOptions,
    versusSetupError,
    setVersusSetupError,
  } = useVersusSetupState()
  const onlineVersus = useOnlineVersusRoom()
  const [showOnlineLobby, setShowOnlineLobby] = useState(false)
  const {
    sessionId,
    loadingProgress,
    setLoadingProgress,
    loadingStage,
    setLoadingStage,
    loadingAttempts,
    setLoadingAttempts,
    dailyResetLabel,
  } = useLoadingState<LoadingAttempt>()
  const [activeEasterEgg, setActiveEasterEgg] = useState<ActiveEasterEgg | null>(null)
  const [activePerfectCelebration, setActivePerfectCelebration] =
    useState<ActivePerfectCelebration | null>(null)
  const [activeStealShowdown, setActiveStealShowdown] = useState<ActiveStealShowdown | null>(null)
  const [activeStealMissSplash, setActiveStealMissSplash] = useState<ActiveStealMissSplash | null>(
    null
  )
  const [activeDoubleKoSplash, setActiveDoubleKoSplash] = useState<ActiveDoubleKoSplash | null>(
    null
  )
  const [activeJudgmentPending, setActiveJudgmentPending] = useState<ActiveJudgmentPending | null>(
    null
  )
  const [activeObjectionSplash, setActiveObjectionSplash] = useState<ActiveObjectionSplash | null>(
    null
  )
  const [activeJudgmentVerdict, setActiveJudgmentVerdict] = useState<ActiveJudgmentVerdict | null>(
    null
  )
  const [objectionPending, setObjectionPending] = useState(false)
  const [objectionVerdict, setObjectionVerdict] = useState<'sustained' | 'overruled' | null>(null)
  const [objectionExplanation, setObjectionExplanation] = useState<string | null>(null)
  const [versusObjectionsUsed, setVersusObjectionsUsed] = useState<VersusObjectionsUsed>({
    x: 0,
    o: 0,
  })
  const [versusEventLog, setVersusEventLog] = useState<VersusEventRecord[]>([])
  const [pendingVersusObjectionReview, setPendingVersusObjectionReview] =
    useState<PendingVersusObjectionReview | null>(null)
  const [showVersusWinnerBanner, setShowVersusWinnerBanner] = useState(true)
  const [showVersusSummaryDetails, setShowVersusSummaryDetails] = useState(false)
  const [searchQueryDraft, setSearchQueryDraft] = useState('')
  const [showDailyHistory, setShowDailyHistory] = useState(false)
  const [dailyArchiveEntries, setDailyArchiveEntries] = useState<DailyArchiveEntry[]>([])
  const [dailyArchiveLoading, setDailyArchiveLoading] = useState(false)
  const [dailyArchiveError, setDailyArchiveError] = useState<string | null>(null)
  const [activeDailyDate, setActiveDailyDate] = useState(
    () => new Date().toISOString().split('T')[0]
  )
  const {
    turnTimeLeft,
    setTurnTimeLeft,
    turnDeadlineAt,
    setTurnDeadlineAt,
    versusRecord,
    setVersusRecord,
    pendingFinalSteal,
    setPendingFinalSteal,
    lockImpactCell,
    setLockImpactCell,
  } = useVersusMatchState<VersusRecord, PendingFinalSteal>({
    initialRecord: { xWins: 0, oWins: 0 },
  })
  const { enabled: animationsEnabled } = useAnimationPreference()
  const { enabled: versusAlarmsEnabled } = useVersusAlarmPreference()
  const { enabled: versusAudioEnabled } = useVersusAudioPreference()
  const versusEventLogRef = useRef<VersusEventRecord[]>([])
  const activeStealShowdownRef = useRef<ActiveStealShowdown | null>(null)
  const detectConfiguredAnimationQuality = useCallback(
    () => (animationsEnabled ? detectAnimationQuality() : 'low'),
    [animationsEnabled]
  )
  const animationQuality = useAnimationQuality(detectConfiguredAnimationQuality)
  const { enabled: confirmBeforeSelect } = useSearchConfirmPreference()
  const { toast } = useToast()
  const versusStealRuleRef = useRef(versusStealRule)
  const versusTimerOptionRef = useRef(versusTimerOption)
  const versusDisableDrawsRef = useRef(versusDisableDraws)
  const versusObjectionRuleRef = useRef(versusObjectionRule)

  useEffect(() => {
    versusStealRuleRef.current = versusStealRule
  }, [versusStealRule])

  useEffect(() => {
    versusTimerOptionRef.current = versusTimerOption
  }, [versusTimerOption])

  useEffect(() => {
    versusDisableDrawsRef.current = versusDisableDraws
  }, [versusDisableDraws])

  useEffect(() => {
    versusObjectionRuleRef.current = versusObjectionRule
  }, [versusObjectionRule])

  useEffect(() => {
    activeStealShowdownRef.current = activeStealShowdown
  }, [activeStealShowdown])

  useEffect(() => {
    guessesRef.current = guesses
  }, [guesses])

  const hasActiveOnlineRoom = onlineVersus.room?.status === 'active'
  const isOnlineRoomActive = hasActiveOnlineRoom && onlineVersus.myRole !== null
  const currentOnlineRoomPuzzleId = onlineVersus.room?.puzzle_id ?? null
  const isCurrentOnlineMatch =
    isOnlineRoomActive &&
    mode === 'versus' &&
    currentOnlineRoomPuzzleId !== null &&
    puzzle?.id === currentOnlineRoomPuzzleId
  const shouldForegroundOnlineSession = shouldForegroundOnlineVersusSession({
    mode,
    showOnlineLobby,
    isResumingOnlineVersus: onlineVersus.isResuming,
  })
  const hasStableOnlineBoardLoaded =
    mode === 'versus' &&
    loadedPuzzleMode === 'versus' &&
    puzzle !== null &&
    currentOnlineRoomPuzzleId !== null &&
    puzzle.id === currentOnlineRoomPuzzleId
  const isWaitingForOnlinePuzzle =
    Boolean(onlineVersus.room) &&
    (onlineVersus.phase === 'joining' ||
      onlineVersus.phase === 'creating' ||
      (hasActiveOnlineRoom && (!onlineVersus.room?.puzzle_id || !onlineVersus.room?.puzzle_data)))

  const sendOnlineEventWithRecovery = useCallback(
    async (type: OnlineVersusEventType, payload: Record<string, unknown>) => {
      const result = await onlineVersus.sendEvent(type, payload)
      if (result.ok) {
        return result
      }

      const description =
        result.code === 'wrong_turn'
          ? 'Your local turn state was stale, so the match was refreshed from the server.'
          : result.code === 'cell_unavailable'
            ? 'That square was already resolved elsewhere, so the board was refreshed.'
            : result.code === 'steal_not_available'
              ? 'That steal window was no longer open, so the board was refreshed.'
              : result.code === 'objection_limit_reached'
                ? 'Your objection count was already exhausted, so the match was refreshed.'
                : result.code
                  ? `${result.error ?? 'The match state changed on the server.'} The board was refreshed.`
                  : (result.error ?? 'Failed to sync that move to the server.')

      toast({
        variant: result.code ? 'default' : 'destructive',
        title: result.code ? 'Match updated' : 'Sync failed',
        description,
      })

      return result
    },
    [onlineVersus, toast]
  )

  const resetOnlineVersusSession = useCallback(() => {
    onlineVersus.reset()
    setShowOnlineLobby(false)
    setActiveStealShowdown(null)
    setActiveStealMissSplash(null)
    setActiveDoubleKoSplash(null)
    setActiveObjectionSplash(null)
    setActiveJudgmentPending(null)
    setActiveJudgmentVerdict(null)
    publishedPuzzleRoomIdRef.current = null
    appliedOnlineEventIdsRef.current = new Set()
    shownOnlineStealShowdownIdsRef.current = new Set()
    processedOnlineEventSourcesRef.current = new Map()
    locallyRenderedOnlineStealClientEventIdsRef.current = new Set()
    finishedOnlineRoomIdRef.current = null
    preparedOnlineRoomKeyRef.current = null
    lastSavedOnlineSnapshotRef.current = null
    lastAppliedOnlineSnapshotRef.current = null
    snapshotSaveInFlightRef.current = false
    pendingSnapshotQueueRef.current = null
    attemptedInviteJoinCodeRef.current = null
    skipNextVersusSavedStateRestoreRef.current = false
    suppressVersusStatePersistenceRef.current = false

    if (typeof window === 'undefined') {
      return
    }

    const url = new URL(window.location.href)
    if (!url.searchParams.has('join')) {
      return
    }

    url.searchParams.delete('join')
    const query = url.searchParams.toString()
    window.history.replaceState({}, '', `${url.pathname}${query ? `?${query}` : ''}${url.hash}`)
  }, [onlineVersus])

  // Open the online lobby when arriving via an invite link (?join=CODE).
  // isResuming is derived synchronously from localStorage before this effect
  // runs, so the check is race-free — no async timing required.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const joinCode = params.get('join')?.toUpperCase() ?? null
    if (
      joinCode &&
      joinCode.length === 6 &&
      !onlineVersus.isResuming &&
      attemptedInviteJoinCodeRef.current !== joinCode
    ) {
      attemptedInviteJoinCodeRef.current = joinCode
      setShowOnlineLobby(true)
      onlineVersus.joinRoom(joinCode)
    }
  }, [])

  // When the online room becomes active, apply authoritative settings and reset board state
  useEffect(() => {
    const { room, myRole } = onlineVersus
    if (!hasActiveOnlineRoom || !room || !shouldForegroundOnlineSession) return

    // Apply room.settings as the authoritative rules for this match.
    // This is critical for the guest — their local settings are irrelevant.
    const {
      categoryFilters,
      stealRule,
      timerOption,
      disableDraws,
      objectionRule,
      minimumValidOptionsOverride,
    } = room.settings
    setVersusCategoryFilters(categoryFilters)
    setVersusMinimumValidOptions(minimumValidOptionsOverride ?? null)
    setVersusStealRule(stealRule)
    setVersusTimerOption(timerOption)
    setVersusDisableDraws(disableDraws)
    setVersusObjectionRule(objectionRule)
    versusStealRuleRef.current = stealRule
    versusTimerOptionRef.current = timerOption
    versusDisableDrawsRef.current = disableDraws
    versusObjectionRuleRef.current = objectionRule

    setMode('versus')
    setShowVersusStartOptions(false)
    setShowOnlineLobby(false)

    const roomSnapshot = room.state_data
    const roomMatchKey = `${room.id}:${room.match_number}`
    const roomPrepKey = `${roomMatchKey}:${room.puzzle_id ?? 'pending'}`
    const roomSnapshotSignature = roomSnapshot ? JSON.stringify(roomSnapshot) : null
    const hasMatchingLocalPuzzle =
      loadedPuzzleMode === 'versus' &&
      puzzle !== null &&
      room.puzzle_id !== null &&
      puzzle.id === room.puzzle_id
    const isSwitchingToDifferentPuzzle =
      room.puzzle_id !== null && (puzzle === null || puzzle.id !== room.puzzle_id)
    const needsFreshRoomPrep =
      preparedOnlineRoomKeyRef.current !== roomPrepKey && !hasMatchingLocalPuzzle
    const shouldHydrateRoomSnapshot =
      Boolean(roomSnapshot) &&
      (myRole === 'o' ||
        needsFreshRoomPrep ||
        isSwitchingToDifferentPuzzle ||
        !hasMatchingLocalPuzzle) &&
      roomSnapshotSignature !== lastAppliedOnlineSnapshotRef.current

    if (needsFreshRoomPrep || isSwitchingToDifferentPuzzle) {
      setSelectedCell(null)
      setDetailCell(null)
      setPendingVersusObjectionReview(null)
      publishedPuzzleRoomIdRef.current = null
      appliedOnlineEventIdsRef.current = new Set()
      shownOnlineStealShowdownIdsRef.current = new Set()
      processedOnlineEventSourcesRef.current = new Map()
      locallyRenderedOnlineStealClientEventIdsRef.current = new Set()
      lastSavedOnlineSnapshotRef.current = roomSnapshotSignature
      lastAppliedOnlineSnapshotRef.current = null
    }

    if (needsFreshRoomPrep && !roomSnapshot) {
      // Clear stale local versus state only when entering a genuinely new online room.
      clearGameState('versus')
      setLoadedPuzzleMode(null)
      setPuzzle(null)
      setGuesses(Array.from({ length: 9 }, () => null))
      setGuessesRemaining(9)
      setCurrentPlayer('x')
      setWinner(null)
      setStealableCell(null)
      setPendingFinalSteal(null)
      setLockImpactCell(null)
      setTurnDeadlineAt(null)
      setVersusObjectionsUsed({ x: 0, o: 0 })
      commitVersusEventLog([])
      setIsLoading(true)
      setLoadingProgress(8)
      setLoadingAttempts([])
      setLoadingStage(
        myRole === 'x'
          ? 'Preparing the shared board...'
          : 'Waiting for the host to finish preparing the board...'
      )
    }

    preparedOnlineRoomKeyRef.current = roomPrepKey

    if (room.puzzle_data && room.puzzle_id && (!puzzle || puzzle.id !== room.puzzle_id)) {
      // Puzzle already exists — load it directly (guest path, or host rejoining).
      // If the same puzzle is already loaded locally, keep it to avoid a harsh flash.
      setPuzzle(room.puzzle_data)
      setLoadedPuzzleMode('versus')
      setIsLoading(false)
    }

    if (shouldHydrateRoomSnapshot && roomSnapshot && room.puzzle_id) {
      const appliedSignature = roomSnapshotSignature ?? JSON.stringify(roomSnapshot)
      activeTurnTimerKeyRef.current = `${room.puzzle_id}:${roomSnapshot.currentPlayer}`
      setLoadedPuzzleMode('versus')
      guessesRef.current = roomSnapshot.guesses
      setGuesses(roomSnapshot.guesses)
      setGuessesRemaining(roomSnapshot.guessesRemaining)
      setCurrentPlayer(roomSnapshot.currentPlayer)
      setStealableCell(roomSnapshot.stealableCell)
      setWinner(roomSnapshot.winner)
      setPendingFinalSteal(roomSnapshot.pendingFinalSteal)
      setLockImpactCell(null)
      setVersusObjectionsUsed(roomSnapshot.objectionsUsed)
      setTurnDeadlineAt(roomSnapshot.turnDeadlineAt)
      lastAppliedOnlineSnapshotRef.current = appliedSignature
      lastSavedOnlineSnapshotRef.current = appliedSignature
      setIsLoading(false)
      return
    }

    if (myRole === 'x' && room.puzzle_id === null && needsFreshRoomPrep) {
      // Host generates the puzzle; after generation, the host should call
      // onlineVersus.setPuzzle() to push it to the room for the guest to load
      skipNextVersusAutoLoadRef.current = true
      loadPuzzle('versus', categoryFilters, undefined, minimumValidOptionsOverride ?? null)
    }
  }, [
    hasActiveOnlineRoom,
    loadedPuzzleMode,
    mode,
    onlineVersus.room?.puzzle_id,
    onlineVersus.room?.state_data,
    onlineVersus.isResuming,
    puzzle,
    shouldForegroundOnlineSession,
    showOnlineLobby,
  ])

  // Tracks which room/match boundary has already had its puzzle published.
  const publishedPuzzleRoomIdRef = useRef<string | null>(null)
  // Tracks online event IDs already applied to local state (prevents double-apply on re-renders).
  const appliedOnlineEventIdsRef = useRef(new Set<number>())
  // Tracks which steal events have already rendered a showdown overlay.
  const shownOnlineStealShowdownIdsRef = useRef(new Set<number>())
  // Tracks the most recent source classification applied for each event so a
  // steal showdown only replays when a previously historical event upgrades.
  const processedOnlineEventSourcesRef = useRef(new Map<number, OnlineVersusEventSource>())
  // Tracks locally rendered online steals so their later server echoes do not
  // replay the same showdown on a subsequent rerender or catch-up pass.
  const locallyRenderedOnlineStealClientEventIdsRef = useRef(new Set<string>())
  // Mirror of guesses state for synchronous reads inside the online event effect.
  const guessesRef = useRef(guesses)
  // True while a saveSnapshot() call is in-flight; prevents concurrent saves racing.
  const snapshotSaveInFlightRef = useRef(false)
  // Holds the next snapshot to save once the current in-flight save completes.
  const pendingSnapshotQueueRef = useRef<OnlineVersusSnapshot | null>(null)

  // Shared queued snapshot saver. Serialises saves so concurrent state changes
  // never race on the server. Key behaviours:
  //   - Skips the write if signature already matches the last confirmed save.
  //   - While a save is in-flight, queues the newest snapshot (newest-wins);
  //     earlier snapshots and their onConfirmed callbacks are dropped.
  //   - onConfirmed fires only after a confirmed successful write. Callers that
  //     need a semantic transition after the save (e.g. markFinished) pass it here.
  const enqueueSaveSnapshot = useCallback(
    (snapshot: OnlineVersusSnapshot, onConfirmed?: () => void) => {
      const sig = JSON.stringify(snapshot)
      if (sig === lastSavedOnlineSnapshotRef.current) {
        onConfirmed?.()
        return
      }

      if (snapshotSaveInFlightRef.current) {
        pendingSnapshotQueueRef.current = snapshot
        return
      }

      const doSave = (toSave: OnlineVersusSnapshot, afterSave?: () => void) => {
        const saveSig = JSON.stringify(toSave)
        snapshotSaveInFlightRef.current = true
        void onlineVersus.saveSnapshot(toSave).then((result) => {
          snapshotSaveInFlightRef.current = false
          if (result.ok) {
            lastSavedOnlineSnapshotRef.current = saveSig
            lastAppliedOnlineSnapshotRef.current = saveSig
            afterSave?.()
          } else {
            console.error('Failed to save online versus snapshot:', result.error)
          }
          const queued = pendingSnapshotQueueRef.current
          if (queued !== null) {
            pendingSnapshotQueueRef.current = null
            if (JSON.stringify(queued) !== lastSavedOnlineSnapshotRef.current) {
              doSave(queued)
            }
          }
        })
      }

      doSave(snapshot, onConfirmed)
    },
    [onlineVersus.saveSnapshot]
  )

  // Host-only: once the puzzle is generated and loaded locally, publish it to the room once.
  // Guards:
  //   - must be the host (myRole === 'x')
  //   - room must be active with no puzzle yet (room.puzzle_id null = not yet published)
  //   - puzzle must be fully loaded locally
  //   - ref prevents re-firing if this effect re-runs (e.g. strict mode double-invoke)
  useEffect(() => {
    const { room, myRole } = onlineVersus
    if (
      !isOnlineRoomActive ||
      !room ||
      myRole !== 'x' ||
      room.puzzle_id !== null || // room already has a puzzle — do not overwrite
      !puzzle ||
      loadedPuzzleMode !== 'versus' ||
      publishedPuzzleRoomIdRef.current === `${room.id}:${room.match_number}`
    ) {
      return
    }

    publishedPuzzleRoomIdRef.current = `${room.id}:${room.match_number}`

    onlineVersus.setPuzzle(puzzle.id, puzzle).then((result) => {
      if (!result.ok) {
        // Reset the guard so a retry is possible if the publish failed
        publishedPuzzleRoomIdRef.current = null
        toast({
          title: 'Failed to share puzzle',
          description: result.error ?? undefined,
          variant: 'destructive',
        })
      }
    })
  }, [
    isOnlineRoomActive,
    onlineVersus.room?.puzzle_id,
    onlineVersus.myRole,
    puzzle,
    loadedPuzzleMode,
  ])

  useEffect(() => {
    if (
      mode !== 'versus' ||
      !isCurrentOnlineMatch ||
      !onlineVersus.room ||
      !puzzle ||
      loadedPuzzleMode !== 'versus' ||
      onlineVersus.room.puzzle_id !== puzzle.id
    ) {
      return
    }

    const snapshot: OnlineVersusSnapshot = {
      puzzleId: puzzle.id,
      guesses,
      guessesRemaining,
      currentPlayer,
      winner,
      stealableCell,
      pendingFinalSteal,
      objectionsUsed: versusObjectionsUsed,
      turnDeadlineAt,
      turnDurationSeconds: typeof versusTimerOption === 'number' ? versusTimerOption : null,
    }

    if (onlineVersus.myRole !== 'x') {
      return
    }

    enqueueSaveSnapshot(snapshot)
  }, [
    currentPlayer,
    enqueueSaveSnapshot,
    guesses,
    guessesRemaining,
    isCurrentOnlineMatch,
    loadedPuzzleMode,
    mode,
    onlineVersus.myRole,
    onlineVersus.room,
    pendingFinalSteal,
    puzzle,
    stealableCell,
    turnDeadlineAt,
    versusObjectionsUsed,
    versusTimerOption,
    winner,
  ])

  // ── Apply incoming online opponent events to local board state ──────────────
  // Runs when onlineVersus.events grows and replays the authoritative room event log.
  // We rely on appliedOnlineEventIdsRef for dedupe rather than skipping "own" events,
  // because after a refresh/rejoin the local board is rebuilt from history.
  // Uses refs for game settings (versusStealRuleRef, versusDisableDrawsRef) to
  // avoid stale closures without triggering re-runs on every render.
  useEffect(() => {
    if (!isCurrentOnlineMatch || !onlineVersus.myRole) return

    const myRole = onlineVersus.myRole

    for (const event of onlineVersus.events) {
      const eventSource = normalizeOnlineVersusEventSource(
        event.source,
        onlineVersus.isHydratingHistory
      )
      const previousProcessedSource = processedOnlineEventSourcesRef.current.get(event.id) ?? null
      const isOwnNonHistoryEvent = shouldSkipOwnOnlineVersusEventReplay(
        eventSource,
        event.player,
        myRole
      )
      // Non-history events from this client are already applied locally.
      // History replay still needs to rebuild "own" events after a join/reload.
      if (isOwnNonHistoryEvent && event.type !== 'steal') {
        appliedOnlineEventIdsRef.current.add(event.id)
        processedOnlineEventSourcesRef.current.set(event.id, eventSource)
        continue
      }

      const alreadyApplied = appliedOnlineEventIdsRef.current.has(event.id) || isOwnNonHistoryEvent
      appliedOnlineEventIdsRef.current.add(event.id)

      const payload = event.payload as Record<string, unknown>
      const cellIndex = payload.cellIndex as number
      if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 8) {
        console.error('[online-versus] received event with invalid cellIndex', {
          eventId: event.id,
          type: event.type,
          cellIndex,
        })
        continue
      }
      const steals = versusStealRuleRef.current !== 'off'
      const noDraws = versusDisableDrawsRef.current

      // Helper: apply a placement resolution to local state (called after updating guesses)
      const applyResolution = (
        resolution: ReturnType<typeof getVersusPlacementResolution>,
        newStealable: number | null
      ) => {
        const nextState = getOnlineVersusPlacementStateTransition({
          resolution,
          newStealable,
        })

        setLockImpactCell(null)
        setPendingFinalSteal(nextState.pendingFinalSteal)
        setStealableCell(nextState.stealableCell)

        if (nextState.winner !== null) {
          setWinner(nextState.winner)
        } else if (nextState.nextPlayer) {
          setCurrentPlayer(nextState.nextPlayer)
        }

        if (nextState.shouldClearTurnDeadline) {
          setTurnDeadlineAt(null)
        }
      }

      if (event.type === 'claim') {
        if (alreadyApplied) continue
        const claimPayload = payload as unknown as OnlineVersusClaimPayload
        const guess = { ...claimPayload.guess, owner: event.player }
        const next = guessesRef.current.map((g, i) => (i === cellIndex ? guess : g))
        guessesRef.current = next
        setGuesses(next)
        const resolution = getVersusPlacementResolution({
          newGuesses: next,
          currentPlayer: event.player,
          selectedCell: cellIndex,
          isVersusSteal: false,
          stealsEnabled: steals,
          disableDraws: noDraws,
        })
        applyResolution(resolution, steals ? cellIndex : null)
      } else if (event.type === 'steal') {
        const stealPayload = payload as unknown as OnlineVersusStealPayload
        const attackingGuess = { ...stealPayload.attackingGuess, owner: event.player }
        const successful = stealPayload.successful
        const clientEventId =
          typeof stealPayload.clientEventId === 'string' && stealPayload.clientEventId.length > 0
            ? stealPayload.clientEventId
            : null
        const defendingGuess = guessesRef.current[cellIndex]
        const activeStealRule =
          versusStealRuleRef.current === 'off' ? 'lower' : versusStealRuleRef.current
        const showdown = getOnlineVersusStealShowdownData({
          stealPayload,
          defendingGuess,
          attackingGuess,
          rule: activeStealRule,
        })
        if (
          shouldSkipLocallyRenderedOwnOnlineVersusStealReplay({
            source: eventSource,
            eventPlayer: event.player,
            myRole,
            clientEventId,
            locallyRenderedClientEventIds: locallyRenderedOnlineStealClientEventIdsRef.current,
          }) ||
          (isOwnNonHistoryEvent && activeStealShowdownRef.current)
        ) {
          if (showdown.hasShowdownScores) {
            shownOnlineStealShowdownIdsRef.current.add(event.id)
          }
          if (clientEventId) {
            locallyRenderedOnlineStealClientEventIdsRef.current.delete(clientEventId)
          }
          processedOnlineEventSourcesRef.current.set(event.id, eventSource)
          continue
        }

        const suppressReplayEffects = shouldSuppressOnlineVersusReplayEffects(eventSource)
        const showdownDuration =
          !suppressReplayEffects && animationsEnabled && showdown.hasShowdownScores
            ? STEAL_SHOWDOWN_DURATION_MS
            : 0

        if (
          showdown.hasShowdownScores &&
          shouldReplayOnlineVersusSpectacle({
            eventSource,
            alreadyShown: shownOnlineStealShowdownIdsRef.current.has(event.id),
            previousProcessedSource,
          })
        ) {
          setActiveStealShowdown({
            burstId: Date.now(),
            durationMs: showdownDuration,
            defenderName: showdown.defenderName,
            defenderScore: showdown.defendingScore!,
            attackerName: showdown.attackerName,
            attackerScore: showdown.attackingScore!,
            rule: activeStealRule,
            successful,
          })
          shownOnlineStealShowdownIdsRef.current.add(event.id)
        }

        if (alreadyApplied) {
          processedOnlineEventSourcesRef.current.set(event.id, eventSource)
          continue
        }

        if (successful) {
          const nextGuess = showdown.hasShowdownScores
            ? {
                ...attackingGuess,
                showdownScoreRevealed: true,
              }
            : attackingGuess
          const next = guessesRef.current.map((g, i) => (i === cellIndex ? nextGuess : g))
          guessesRef.current = next
          setGuesses(next)
          const resolution = getVersusPlacementResolution({
            newGuesses: next,
            currentPlayer: event.player,
            selectedCell: cellIndex,
            isVersusSteal: true,
            stealsEnabled: steals,
            disableDraws: noDraws,
          })
          applyResolution(resolution, steals ? cellIndex : null)
        } else {
          const applyFailedSteal = () => {
            setPendingFinalSteal(null)
            setStealableCell(null)
            setLockImpactCell(null)
            if (stealPayload.resolutionKind === 'defender-wins') {
              const defender = stealPayload.defender as TicTacToePlayer
              if (defender === 'x' || defender === 'o') {
                setWinner(defender)
              }
              return
            }

            const nextPlayer = stealPayload.nextPlayer as TicTacToePlayer
            if (nextPlayer === 'x' || nextPlayer === 'o') {
              setCurrentPlayer(nextPlayer)
              return
            }

            setCurrentPlayer(myRole)
          }

          if (showdownDuration > 0) {
            window.setTimeout(applyFailedSteal, showdownDuration)
          } else {
            applyFailedSteal()
          }
        }
      } else if (event.type === 'miss') {
        if (alreadyApplied) continue
        const missPayload = payload as unknown as OnlineVersusMissPayload
        const nextGuessesRemaining =
          typeof missPayload.guessesRemaining === 'number'
            ? missPayload.guessesRemaining
            : Math.max(0, guessesRemaining - 1)
        setGuessesRemaining(nextGuessesRemaining)
        setPendingFinalSteal(null)
        setStealableCell(null)
        setLockImpactCell(null)

        if (missPayload.resolutionKind === 'defender-wins') {
          const defender = missPayload.defender as TicTacToePlayer
          if (defender === 'x' || defender === 'o') {
            setWinner(defender)
          }
        } else {
          const nextPlayer = missPayload.nextPlayer as TicTacToePlayer
          if (nextPlayer === 'x' || nextPlayer === 'o') {
            setCurrentPlayer(nextPlayer)
          }
        }
      } else if (event.type === 'objection') {
        if (alreadyApplied) continue
        const objectionPayload = payload as unknown as OnlineVersusObjectionPayload
        const verdict = objectionPayload.verdict
        const updatedGuess =
          verdict === 'sustained'
            ? ({ ...objectionPayload.updatedGuess, owner: event.player } as CellGuess)
            : null
        setVersusObjectionsUsed((current) => ({
          ...current,
          [event.player]: current[event.player] + 1,
        }))

        if (verdict === 'sustained') {
          const next = guessesRef.current.map((g, i) => (i === cellIndex ? updatedGuess : g))
          guessesRef.current = next
          setGuesses(next)
          const resolution = getVersusPlacementResolution({
            newGuesses: next,
            currentPlayer: event.player,
            selectedCell: cellIndex,
            isVersusSteal: false,
            stealsEnabled: steals,
            disableDraws: noDraws,
          })
          applyResolution(resolution, steals ? cellIndex : null)
        } else {
          const nextGuessesRemaining =
            typeof objectionPayload.guessesRemaining === 'number'
              ? objectionPayload.guessesRemaining
              : Math.max(0, guessesRemaining - 1)
          setGuessesRemaining(nextGuessesRemaining)
          setPendingFinalSteal(null)
          setStealableCell(null)
          setLockImpactCell(null)

          if (objectionPayload.resolutionKind === 'defender-wins') {
            const defender = objectionPayload.defender as TicTacToePlayer
            if (defender === 'x' || defender === 'o') {
              setWinner(defender)
            }
          } else {
            const nextPlayer = objectionPayload.nextPlayer as TicTacToePlayer
            if (nextPlayer === 'x' || nextPlayer === 'o') {
              setCurrentPlayer(nextPlayer)
            }
          }
        }
      }

      processedOnlineEventSourcesRef.current.set(event.id, eventSource)
    }
  }, [
    onlineVersus.events,
    onlineVersus.isHydratingHistory,
    onlineVersus.myRole,
    isCurrentOnlineMatch,
  ])

  const commitVersusEventLog = useCallback((nextEventLog: VersusEventRecord[]) => {
    versusEventLogRef.current = nextEventLog
    setVersusEventLog(nextEventLog)
    return nextEventLog
  }, [])

  const appendVersusEvent = useCallback(
    (event: VersusEventRecord) => commitVersusEventLog([...versusEventLogRef.current, event]),
    [commitVersusEventLog]
  )

  const score = guesses.filter((g) => g?.isCorrect).length
  const isVersusMode = mode === 'versus'
  const stealsEnabled = versusStealRule !== 'off'
  const getVersusObjectionLimit = useCallback((rule: VersusObjectionRule) => {
    if (rule === 'one') {
      return 1
    }

    if (rule === 'three') {
      return 3
    }

    return 0
  }, [])
  const hasActivePracticeCustomSetup =
    hasNonEmptyFilters(practiceCategoryFilters) || practiceMinimumValidOptions !== null
  const hasActiveVersusCustomSetup =
    hasNonEmptyFilters(versusCategoryFilters) || versusMinimumValidOptions !== null
  const hasActiveCustomSetup =
    mode === 'practice'
      ? hasActivePracticeCustomSetup
      : mode === 'versus'
        ? hasActiveVersusCustomSetup
        : false

  const fetchDailyArchive = useCallback(async () => {
    setDailyArchiveLoading(true)
    setDailyArchiveError(null)

    try {
      const response = await fetch('/api/daily-history', {
        headers: buildLegacySessionHeaders(sessionId),
      })
      const data = (await response.json()) as DailyArchiveResponse

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load daily archive')
      }

      setDailyArchiveEntries(
        (data.entries ?? []).map((entry) => ({
          id: entry.id,
          date: entry.date,
          isCompleted: entry.is_completed ?? false,
          guessCount: entry.guess_count ?? 0,
        }))
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load daily archive'
      setDailyArchiveError(message)
    } finally {
      setDailyArchiveLoading(false)
    }
  }, [sessionId])

  const openDailyHistory = useCallback(() => {
    setShowDailyHistory(true)
    void fetchDailyArchive()
  }, [fetchDailyArchive])

  useEffect(() => {
    if (!isVersusMode || !versusAudioEnabled) {
      return
    }

    primeVersusAudioContext()
  }, [isVersusMode, versusAudioEnabled])
  // Game is over when out of guesses OR all cells filled (not necessarily all correct)
  const gridFull = guesses.every((g) => g !== null)
  const isComplete = isVersusMode ? winner !== null : guessesRemaining === 0 || gridFull

  const buildPersistedVersusState = useCallback(
    (overrides: Partial<SavedGameState>): SavedGameState | null => {
      if (!puzzle) {
        return null
      }

      return {
        puzzleId: puzzle.id,
        puzzle,
        guesses,
        guessesRemaining,
        isComplete,
        selectedCell,
        searchQuery: selectedCell !== null ? searchQueryDraft : null,
        currentPlayer,
        stealableCell,
        winner,
        pendingFinalSteal,
        versusCategoryFilters,
        versusMinimumValidOptions,
        versusStealRule,
        versusTimerOption,
        versusDisableDraws,
        versusObjectionRule,
        versusObjectionsUsed,
        versusEventLog: versusEventLogRef.current,
        turnTimeLeft,
        turnDeadlineAt,
        ...overrides,
      }
    },
    [
      currentPlayer,
      guesses,
      guessesRemaining,
      isComplete,
      pendingFinalSteal,
      puzzle,
      searchQueryDraft,
      selectedCell,
      stealableCell,
      turnDeadlineAt,
      turnTimeLeft,
      versusCategoryFilters,
      versusMinimumValidOptions,
      versusDisableDraws,
      versusObjectionRule,
      versusObjectionsUsed,
      versusStealRule,
      versusTimerOption,
      winner,
    ]
  )

  const triggerEasterEggCelebration = useCallback(
    (gameId: number) => {
      const easterEggDefinition = getEasterEggDefinition(gameId)

      if (!easterEggDefinition || !animationsEnabled) {
        return false
      }

      const burstId = Date.now()
      const particles = createFallingParticles(
        scaleParticleDensity(easterEggDefinition.density, animationQuality),
        easterEggDefinition.pieceKinds,
        burstId
      )

      setActiveEasterEgg({
        burstId,
        durationMs: getEasterEggLifetimeMs(easterEggDefinition, particles),
        renderPiece: easterEggDefinition.renderPiece,
        particles,
      })

      return true
    },
    [animationQuality, animationsEnabled]
  )

  const triggerPerfectCelebration = useCallback(() => {
    if (!animationsEnabled) {
      return
    }

    const burstId = Date.now()
    const particles = createFallingParticles(3, ['chex'], burstId).map((particle, index) => ({
      ...particle,
      left: ['18%', '50%', '82%'][index] ?? particle.left,
      delay: `${index * 160}ms`,
      size: `${32 + index * 6}px`,
      duration: `${2600 + index * 180}ms`,
      drift: `${index === 1 ? 0 : index === 0 ? -12 : 12}px`,
      rotate: `${index === 1 ? -6 : index === 0 ? -14 : 10}deg`,
      variant: index === 1 ? ('g-white' as const) : ('g-green' as const),
    }))

    setActivePerfectCelebration({
      burstId,
      durationMs: 2800,
      particles,
    })
  }, [animationsEnabled])

  const triggerRealStinkerCelebration = useCallback(() => {
    if (!animationsEnabled) {
      return
    }

    const burstId = Date.now()
    const particles = createFallingParticles(
      scaleParticleDensity(28, animationQuality),
      ['dust'],
      burstId
    )

    setActiveEasterEgg({
      burstId,
      durationMs: Math.max(
        4200,
        particles.reduce((longest, particle) => {
          return Math.max(longest, parseMs(particle.delay) + parseMs(particle.duration))
        }, 0)
      ),
      renderPiece: renderRealStinkerPiece,
      particles,
    })
  }, [animationQuality, animationsEnabled])

  const triggerStealShowdownPreview = useCallback(
    (options?: { successful?: boolean; attackerScore?: number; defenderScore?: number }) => {
      if (!animationsEnabled) {
        return
      }

      setActiveStealShowdown({
        burstId: Date.now(),
        durationMs: STEAL_SHOWDOWN_DURATION_MS,
        defenderName: 'Defender',
        defenderScore: options?.defenderScore ?? 82,
        attackerName: 'Challenger',
        attackerScore: options?.attackerScore ?? 76,
        rule: versusStealRule === 'off' ? 'lower' : versusStealRule,
        successful: options?.successful ?? true,
        lowEffects: animationQuality === 'low',
      })
    },
    [animationQuality, animationsEnabled, versusStealRule]
  )

  const triggerStealMissPreview = useCallback(() => {
    if (!animationsEnabled) {
      return
    }

    setActiveStealMissSplash({
      burstId: Date.now(),
      durationMs: 900,
    })
  }, [animationsEnabled])

  useGameGridDevTools({
    triggerEasterEgg: triggerEasterEggCelebration,
    triggerPerfectCelebration,
    triggerStealShowdown: triggerStealShowdownPreview,
    triggerStealMiss: triggerStealMissPreview,
  })

  useEffect(() => {
    if (animationsEnabled) {
      return
    }

    setActiveEasterEgg(null)
    setActivePerfectCelebration(null)
    setActiveStealShowdown(null)
    setActiveStealMissSplash(null)
    setActiveDoubleKoSplash(null)
  }, [animationsEnabled])

  const unlockAchievementWithToast = useCallback(
    (achievementId: string, options?: { imageUrl?: string | null }) => {
      const result = unlockAchievement(achievementId, options)

      if (!result.unlocked || !result.achievement) {
        return
      }

      toast({
        title: `Achievement Unlocked: ${result.achievement.title}`,
        description: result.achievement.description,
      })
    },
    [toast]
  )

  // Initialize session
  useEffect(() => {
    setVersusRecord(getInitialVersusRecord())
  }, [])

  useEffect(() => {
    if (!puzzle || mode !== 'versus' || winner === null) {
      return
    }

    const winnerKey = `${puzzle.id}:${winner}`
    if (recordedVersusWinnerKeyRef.current === winnerKey) {
      return
    }

    recordedVersusWinnerKeyRef.current = winnerKey
    setVersusRecord((current) => {
      const nextRecord =
        winner === 'x'
          ? { ...current, xWins: current.xWins + 1 }
          : { ...current, oWins: current.oWins + 1 }

      saveVersusRecord(nextRecord)
      return nextRecord
    })
  }, [mode, puzzle, winner, setVersusRecord])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const pendingAchievementId = window.sessionStorage.getItem(ROUTE_PENDING_TOAST_KEY)
    if (pendingAchievementId !== ROUTE_ACHIEVEMENT_ID) {
      return
    }

    window.sessionStorage.removeItem(ROUTE_PENDING_TOAST_KEY)
    const result = unlockAchievement(ROUTE_ACHIEVEMENT_ID)

    if (!result.achievement) {
      return
    }

    toast({
      title: result.unlocked
        ? `Achievement Unlocked: ${result.achievement.title}`
        : `${result.achievement.title} Found`,
      description: result.achievement.description,
    })
  }, [toast])

  useEffect(() => {
    if (!activeEasterEgg) {
      return
    }

    const timer = setTimeout(() => {
      setActiveEasterEgg(null)
    }, activeEasterEgg.durationMs)

    return () => clearTimeout(timer)
  }, [activeEasterEgg])

  useEffect(() => {
    if (!activePerfectCelebration) {
      return
    }

    const timer = setTimeout(() => {
      setActivePerfectCelebration(null)
    }, activePerfectCelebration.durationMs)

    return () => clearTimeout(timer)
  }, [activePerfectCelebration])

  useEffect(() => {
    setShowVersusWinnerBanner(winner !== null)
    setShowVersusSummaryDetails(false)
  }, [winner])

  useEffect(() => {
    if (
      mode !== 'versus' ||
      !isCurrentOnlineMatch ||
      !onlineVersus.room ||
      onlineVersus.myRole !== 'x' ||
      !puzzle ||
      winner === null ||
      finishedOnlineRoomIdRef.current === onlineVersus.room.id
    ) {
      return
    }

    finishedOnlineRoomIdRef.current = onlineVersus.room.id

    const finalSnapshot: OnlineVersusSnapshot = {
      puzzleId: puzzle.id,
      guesses,
      guessesRemaining,
      currentPlayer,
      winner,
      stealableCell,
      pendingFinalSteal,
      objectionsUsed: versusObjectionsUsed,
      turnDeadlineAt,
      turnDurationSeconds: typeof versusTimerOption === 'number' ? versusTimerOption : null,
    }

    enqueueSaveSnapshot(finalSnapshot, () => {
      void onlineVersus.markFinished().then((result) => {
        if (!result.ok) {
          finishedOnlineRoomIdRef.current = null
          toast({
            title: 'Failed to finish online match',
            description: result.error ?? undefined,
            variant: 'destructive',
          })
        }
      })
    })
  }, [
    currentPlayer,
    enqueueSaveSnapshot,
    guesses,
    guessesRemaining,
    isCurrentOnlineMatch,
    mode,
    onlineVersus,
    pendingFinalSteal,
    puzzle,
    stealableCell,
    toast,
    turnDeadlineAt,
    versusObjectionsUsed,
    versusTimerOption,
    winner,
  ])

  useEffect(() => {
    return () => {
      activePuzzleLoadControllerRef.current?.abort()
    }
  }, [])

  const triggerLockImpact = useCallback(
    (cell: number) => {
      setLockImpactCell(cell)
      window.setTimeout(() => {
        setLockImpactCell((current) => (current === cell ? null : current))
      }, 550)
    },
    [setLockImpactCell]
  )

  const applyStealActions = useCallback(
    (actions: StealAction[]) => {
      for (const action of actions) {
        switch (action.kind) {
          case 'clearSelection':
            setSelectedCell(null)
            break
          case 'clearStealable':
            setStealableCell(null)
            break
          case 'clearPendingSteal':
            setPendingFinalSteal(null)
            break
          case 'setLockImpact':
            triggerLockImpact(action.cell)
            break
          case 'setNextPlayer':
            setCurrentPlayer(action.player)
            break
          case 'setWinner':
            setWinner(action.player)
            break
        }
      }
    },
    [
      setCurrentPlayer,
      setPendingFinalSteal,
      setSelectedCell,
      setStealableCell,
      setWinner,
      triggerLockImpact,
    ]
  )

  useTimedOverlayDismiss(activeStealShowdown, () => setActiveStealShowdown(null))
  useTimedOverlayDismiss(activeStealMissSplash, () => setActiveStealMissSplash(null))
  useTimedOverlayDismiss(activeDoubleKoSplash, () => setActiveDoubleKoSplash(null))
  useTimedOverlayDismiss(activeObjectionSplash, () => setActiveObjectionSplash(null))
  useTimedOverlayDismiss(activeJudgmentVerdict, () => setActiveJudgmentVerdict(null))

  const activeDetailCell = pendingVersusObjectionReview?.cellIndex ?? detailCell
  const detailGuess =
    pendingVersusObjectionReview?.guess ?? (detailCell !== null ? guesses[detailCell] : null)
  const { row: storedDetailRowCategory, col: storedDetailColCategory } = getCategoriesForCell(
    puzzle,
    detailCell
  )
  const detailRowCategory = pendingVersusObjectionReview?.rowCategory ?? storedDetailRowCategory
  const detailColCategory = pendingVersusObjectionReview?.colCategory ?? storedDetailColCategory
  const activeObjectionLimit = getVersusObjectionLimit(versusObjectionRule)
  const showVersusObjectionModal =
    mode === 'versus' &&
    !objectionPending &&
    (pendingVersusObjectionReview !== null || detailGuess?.objectionUsed === true)
  const objectionDisabled = pendingVersusObjectionReview
    ? versusObjectionsUsed[pendingVersusObjectionReview.player] >= activeObjectionLimit
    : Boolean(detailGuess?.objectionUsed)
  const objectionDisabledLabel =
    pendingVersusObjectionReview && objectionVerdict === null
      ? activeObjectionLimit === 0
        ? 'Objections off'
        : versusObjectionsUsed[pendingVersusObjectionReview.player] >= activeObjectionLimit
          ? 'No objections left'
          : null
      : null

  useEffect(() => {
    setObjectionPending(false)
    setObjectionVerdict(detailGuess?.objectionVerdict ?? null)
    setObjectionExplanation(detailGuess?.objectionExplanation ?? null)
    setActiveObjectionSplash(null)
    setActiveJudgmentPending(null)
  }, [activeDetailCell, detailGuess?.objectionExplanation, detailGuess?.objectionVerdict])

  const resolveVersusRejectedGuess = useCallback(
    (
      invalidGuessResolution: ReturnType<typeof getVersusInvalidGuessResolution>,
      nextVersusObjectionsUsed: VersusObjectionsUsed = versusObjectionsUsed,
      options?: {
        fromOverruledObjection?: boolean
      }
    ) => {
      setPendingVersusObjectionReview(null)
      setDetailCell(null)

      if (!puzzle) {
        return
      }

      const nextGuessesRemaining = Math.max(0, guessesRemaining - 1)
      setGuessesRemaining(nextGuessesRemaining)
      setStealableCell(null)
      setLockImpactCell(null)

      if (invalidGuessResolution.kind === 'defender-wins') {
        setWinner(invalidGuessResolution.defender)
        setPendingFinalSteal(null)
        const persistedState = buildPersistedVersusState({
          guessesRemaining: nextGuessesRemaining,
          isComplete: true,
          stealableCell: null,
          winner: invalidGuessResolution.defender,
          pendingFinalSteal: null,
          versusObjectionsUsed: nextVersusObjectionsUsed,
        })
        if (persistedState) {
          saveGameState(persistedState, mode)
        }
      } else {
        setCurrentPlayer(invalidGuessResolution.nextPlayer)
        const persistedState = buildPersistedVersusState({
          guessesRemaining: nextGuessesRemaining,
          currentPlayer: invalidGuessResolution.nextPlayer,
          stealableCell: null,
          versusObjectionsUsed: nextVersusObjectionsUsed,
        })
        if (persistedState) {
          saveGameState(persistedState, mode)
        }
      }

      if (isCurrentOnlineMatch) {
        void sendOnlineEventWithRecovery('miss', {
          cellIndex: pendingVersusObjectionReview?.cellIndex ?? selectedCell,
          guessesRemaining: nextGuessesRemaining,
          resolutionKind: invalidGuessResolution.kind,
          nextPlayer:
            invalidGuessResolution.kind === 'next-player'
              ? invalidGuessResolution.nextPlayer
              : undefined,
          defender:
            invalidGuessResolution.kind === 'defender-wins'
              ? invalidGuessResolution.defender
              : undefined,
        })
      }

      toast({
        variant: 'destructive',
        title: options?.fromOverruledObjection
          ? 'Objection overruled'
          : invalidGuessResolution.title,
        description: options?.fromOverruledObjection
          ? `Judge Gemini overruled the objection. ${invalidGuessResolution.description}`
          : invalidGuessResolution.description,
      })
    },
    [
      currentPlayer,
      guesses,
      guessesRemaining,
      isComplete,
      mode,
      onlineVersus,
      pendingFinalSteal,
      pendingVersusObjectionReview,
      puzzle,
      selectedCell,
      toast,
      turnTimeLeft,
      buildPersistedVersusState,
      versusObjectionsUsed,
    ]
  )

  const handleCloseDetailModal = useCallback(() => {
    if (objectionPending) {
      return
    }

    if (pendingVersusObjectionReview) {
      resolveVersusRejectedGuess(pendingVersusObjectionReview.invalidGuessResolution)
      return
    }

    setDetailCell(null)
  }, [objectionPending, pendingVersusObjectionReview, resolveVersusRejectedGuess])

  const handleObjection = useCallback(async () => {
    if (
      !detailGuess ||
      !detailRowCategory ||
      !detailColCategory ||
      detailGuess.isCorrect ||
      detailGuess.objectionUsed ||
      activeDetailCell === null ||
      !puzzle
    ) {
      return
    }

    const objectionPlayer = pendingVersusObjectionReview?.player
    if (
      objectionPlayer &&
      versusObjectionsUsed[objectionPlayer] >= getVersusObjectionLimit(versusObjectionRule)
    ) {
      return
    }

    setObjectionPending(true)
    setObjectionVerdict(null)
    setObjectionExplanation(null)
    setActiveObjectionSplash({
      burstId: Date.now(),
      durationMs: 900,
    })
    setActiveJudgmentPending({ burstId: Date.now() })

    try {
      const response = await fetch('/api/objection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guess: detailGuess,
          rowCategory: detailRowCategory,
          colCategory: detailColCategory,
        }),
      })

      const payload = (await response.json()) as {
        error?: string
        verdict?: 'sustained' | 'overruled'
        confidence?: 'low' | 'medium' | 'high'
        explanation?: string
      }

      if (!response.ok || !payload.verdict) {
        throw new Error(payload.error ?? 'Judgment failed.')
      }

      const nextVersusObjectionsUsed =
        objectionPlayer !== undefined
          ? {
              ...versusObjectionsUsed,
              [objectionPlayer]: versusObjectionsUsed[objectionPlayer] + 1,
            }
          : versusObjectionsUsed
      let nextGuess = {
        ...detailGuess,
        objectionUsed: true,
        objectionVerdict: payload.verdict,
        objectionExplanation: payload.explanation ?? null,
        objectionOriginalMatchedRow:
          detailGuess.objectionOriginalMatchedRow ?? detailGuess.matchedRow ?? false,
        objectionOriginalMatchedCol:
          detailGuess.objectionOriginalMatchedCol ?? detailGuess.matchedCol ?? false,
        ...(payload.verdict === 'sustained'
          ? {
              isCorrect: true,
              matchedRow: true,
              matchedCol: true,
            }
          : null),
      }

      const nextGuesses = guesses.map((guess, index) =>
        index === activeDetailCell ? nextGuess : guess
      )

      const shouldCommitGuessToBoard =
        !pendingVersusObjectionReview || payload.verdict === 'sustained'

      if (shouldCommitGuessToBoard) {
        setGuesses(nextGuesses)
      }
      setObjectionVerdict(payload.verdict)
      setObjectionExplanation(payload.explanation ?? null)
      setVersusObjectionsUsed(nextVersusObjectionsUsed)
      setActiveJudgmentVerdict({
        burstId: Date.now(),
        durationMs: 2200,
        verdict: payload.verdict,
      })

      if (mode === 'versus' && pendingVersusObjectionReview) {
        appendVersusEvent({
          type: 'objection',
          player: pendingVersusObjectionReview.player,
          cellIndex: activeDetailCell,
          gameName: nextGuess.gameName,
          verdict: payload.verdict,
          onSteal: pendingVersusObjectionReview.isVersusSteal,
        })

        if (isCurrentOnlineMatch) {
          const overruledResolution =
            payload.verdict === 'overruled'
              ? pendingVersusObjectionReview.invalidGuessResolution
              : null
          const overruledGuessesRemaining =
            payload.verdict === 'overruled' ? Math.max(0, guessesRemaining - 1) : undefined

          void sendOnlineEventWithRecovery('objection', {
            cellIndex: activeDetailCell,
            verdict: payload.verdict,
            updatedGuess: nextGuess,
            isSteal: pendingVersusObjectionReview.isVersusSteal,
            guessesRemaining: overruledGuessesRemaining,
            resolutionKind: overruledResolution?.kind,
            nextPlayer:
              overruledResolution?.kind === 'next-player'
                ? overruledResolution.nextPlayer
                : undefined,
            defender:
              overruledResolution?.kind === 'defender-wins'
                ? overruledResolution.defender
                : undefined,
          })
        }

        if (payload.verdict === 'sustained') {
          const objectionCellIndex = activeDetailCell
          const objectionPlayer = pendingVersusObjectionReview.player

          if (pendingVersusObjectionReview.isVersusSteal) {
            const effectiveStealRule = versusStealRule === 'off' ? 'lower' : versusStealRule
            const defendingGuess = guesses[objectionCellIndex]

            if (defendingGuess) {
              const stealOutcome = resolveStealOutcome({
                currentPlayer: objectionPlayer,
                defendingGuess,
                attackingGuess: nextGuess,
                rule: effectiveStealRule,
                pendingFinalSteal: pendingFinalSteal as PendingVersusSteal | null,
                selectedCell: objectionCellIndex,
              })
              const showdownDuration =
                animationsEnabled && stealOutcome.hasShowdownScores ? STEAL_SHOWDOWN_DURATION_MS : 0
              const defendingScore = getStealShowdownMetric(defendingGuess, effectiveStealRule)
              const attackingScore = getStealShowdownMetric(nextGuess, effectiveStealRule)

              if (stealOutcome.hasShowdownScores) {
                setActiveStealShowdown({
                  burstId: Date.now(),
                  durationMs: showdownDuration,
                  defenderName: defendingGuess.gameName,
                  defenderScore: defendingScore!,
                  attackerName: nextGuess.gameName,
                  attackerScore: attackingScore!,
                  rule: effectiveStealRule,
                  successful: stealOutcome.successful,
                })
              }

              appendVersusEvent({
                type: 'steal',
                player: objectionPlayer,
                cellIndex: objectionCellIndex,
                gameName: nextGuess.gameName,
                successful: stealOutcome.successful,
                viaObjection: true,
                hadShowdownScores: stealOutcome.hasShowdownScores,
                finalSteal: pendingFinalSteal?.cellIndex === objectionCellIndex,
                attackingScore,
                defendingGameName: defendingGuess.gameName,
                defendingScore,
              })

              setPendingVersusObjectionReview(null)
              setDetailCell(null)
              setObjectionVerdict(null)
              setObjectionExplanation(null)

              if (!stealOutcome.successful) {
                const failureDescription = buildStealFailureDescription({
                  pendingFinalSteal,
                  selectedCell: objectionCellIndex,
                  hasShowdownScores: stealOutcome.hasShowdownScores,
                  gameName: nextGuess.gameName,
                  attackingScore,
                  defendingGameName: defendingGuess.gameName,
                  defendingScore,
                  versusStealRule: effectiveStealRule,
                  currentPlayer: objectionPlayer,
                })

                const resolveFailedSustainedSteal = () => {
                  const revealedGuesses = stealOutcome.hasShowdownScores
                    ? guesses.map((guess, index) =>
                        index === objectionCellIndex && guess
                          ? {
                              ...guess,
                              showdownScoreRevealed: true,
                            }
                          : guess
                      )
                    : guesses
                  let persistedCurrentPlayer = currentPlayer
                  let persistedWinner = winner
                  let persistedPendingFinalSteal = pendingFinalSteal

                  if (stealOutcome.hasShowdownScores) {
                    setGuesses(revealedGuesses)
                  }

                  for (const action of stealOutcome.actions) {
                    if (action.kind === 'setNextPlayer') {
                      persistedCurrentPlayer = action.player
                    } else if (action.kind === 'setWinner') {
                      persistedWinner = action.player
                    } else if (action.kind === 'clearPendingSteal') {
                      persistedPendingFinalSteal = null
                    }
                  }

                  applyStealActions(stealOutcome.actions)
                  const persistedState = buildPersistedVersusState({
                    guesses: revealedGuesses,
                    currentPlayer: persistedCurrentPlayer,
                    stealableCell: null,
                    winner: persistedWinner,
                    pendingFinalSteal: persistedPendingFinalSteal,
                    versusObjectionsUsed: nextVersusObjectionsUsed,
                  })
                  if (persistedState) {
                    saveGameState(persistedState, mode)
                  }
                  toast({
                    variant: 'destructive',
                    title: 'Steal failed',
                    description: failureDescription,
                  })
                }

                if (showdownDuration > 0) {
                  window.setTimeout(resolveFailedSustainedSteal, showdownDuration)
                } else {
                  resolveFailedSustainedSteal()
                }

                return
              }

              nextGuess = {
                ...nextGuess,
                ...(stealOutcome.hasShowdownScores ? { showdownScoreRevealed: true } : null),
              }
              const successfulStealGuesses = guesses.map((guess, index) =>
                index === objectionCellIndex ? nextGuess : guess
              )

              setGuesses(successfulStealGuesses)
              setPendingFinalSteal(null)
              setLockImpactCell(null)
              setStealableCell(stealsEnabled ? objectionCellIndex : null)

              const placementResolution = getVersusPlacementResolution({
                newGuesses: successfulStealGuesses,
                currentPlayer: objectionPlayer,
                selectedCell: objectionCellIndex,
                isVersusSteal: true,
                stealsEnabled,
                disableDraws: versusDisableDraws,
              })

              let persistedCurrentPlayer = currentPlayer
              let persistedWinner = winner
              let persistedStealableCell = stealsEnabled ? objectionCellIndex : null
              let persistedPendingFinalSteal = null

              if (placementResolution.kind === 'final-steal') {
                setPendingFinalSteal({
                  defender: placementResolution.defender,
                  cellIndex: placementResolution.cellIndex,
                })
                setCurrentPlayer(placementResolution.nextPlayer)
                persistedCurrentPlayer = placementResolution.nextPlayer
                persistedPendingFinalSteal = {
                  defender: placementResolution.defender,
                  cellIndex: placementResolution.cellIndex,
                }
              } else if (placementResolution.kind === 'winner') {
                setWinner(placementResolution.winner)
                setStealableCell(null)
                persistedWinner = placementResolution.winner
                persistedStealableCell = null
              } else if (placementResolution.kind === 'claims-win') {
                setWinner(placementResolution.winner)
                setStealableCell(null)
                persistedWinner = placementResolution.winner
                persistedStealableCell = null
              } else if (placementResolution.kind === 'draw') {
                setActiveDoubleKoSplash({
                  burstId: Date.now(),
                  durationMs: 1400,
                })
                setWinner('draw')
                setStealableCell(null)
                persistedWinner = 'draw'
                persistedStealableCell = null
              } else {
                setCurrentPlayer(placementResolution.nextPlayer)
                persistedCurrentPlayer = placementResolution.nextPlayer
              }

              const persistedState = buildPersistedVersusState({
                guesses: successfulStealGuesses,
                currentPlayer: persistedCurrentPlayer,
                stealableCell: persistedStealableCell,
                winner: persistedWinner,
                pendingFinalSteal: persistedPendingFinalSteal,
                versusObjectionsUsed: nextVersusObjectionsUsed,
              })
              if (persistedState) {
                saveGameState(persistedState, mode)
              }

              return
            }
          }

          appendVersusEvent({
            type: 'claim',
            player: objectionPlayer,
            cellIndex: objectionCellIndex,
            gameName: nextGuess.gameName,
            viaObjection: true,
          })

          setPendingVersusObjectionReview(null)
          setDetailCell(null)
          setObjectionVerdict(null)
          setObjectionExplanation(null)
          setPendingFinalSteal(null)
          setLockImpactCell(null)
          setStealableCell(stealsEnabled ? objectionCellIndex : null)

          const placementResolution = getVersusPlacementResolution({
            newGuesses: nextGuesses,
            currentPlayer: objectionPlayer,
            selectedCell: objectionCellIndex,
            isVersusSteal: pendingVersusObjectionReview.isVersusSteal,
            stealsEnabled,
            disableDraws: versusDisableDraws,
          })

          let persistedCurrentPlayer = currentPlayer
          let persistedWinner = winner
          let persistedStealableCell = stealsEnabled ? objectionCellIndex : null
          let persistedPendingFinalSteal = null

          if (placementResolution.kind === 'final-steal') {
            setPendingFinalSteal({
              defender: placementResolution.defender,
              cellIndex: placementResolution.cellIndex,
            })
            setCurrentPlayer(placementResolution.nextPlayer)
            persistedCurrentPlayer = placementResolution.nextPlayer
            persistedPendingFinalSteal = {
              defender: placementResolution.defender,
              cellIndex: placementResolution.cellIndex,
            }
          } else if (placementResolution.kind === 'winner') {
            setWinner(placementResolution.winner)
            setStealableCell(null)
            persistedWinner = placementResolution.winner
            persistedStealableCell = null
          } else if (placementResolution.kind === 'claims-win') {
            setWinner(placementResolution.winner)
            setStealableCell(null)
            persistedWinner = placementResolution.winner
            persistedStealableCell = null
          } else if (placementResolution.kind === 'draw') {
            setActiveDoubleKoSplash({
              burstId: Date.now(),
              durationMs: 1400,
            })
            setWinner('draw')
            setStealableCell(null)
            persistedWinner = 'draw'
            persistedStealableCell = null
          } else {
            setCurrentPlayer(placementResolution.nextPlayer)
            persistedCurrentPlayer = placementResolution.nextPlayer
          }

          const persistedState = buildPersistedVersusState({
            guesses: nextGuesses,
            currentPlayer: persistedCurrentPlayer,
            stealableCell: persistedStealableCell,
            winner: persistedWinner,
            pendingFinalSteal: persistedPendingFinalSteal,
            versusObjectionsUsed: nextVersusObjectionsUsed,
          })
          if (persistedState) {
            saveGameState(persistedState, mode)
          }
        } else {
          setObjectionVerdict(null)
          setObjectionExplanation(null)
          resolveVersusRejectedGuess(
            pendingVersusObjectionReview.invalidGuessResolution,
            nextVersusObjectionsUsed,
            { fromOverruledObjection: true }
          )
        }

        return
      }

      if (payload.verdict === 'sustained') {
        const correctedScore = nextGuesses.filter((guess) => guess?.isCorrect).length
        const correctedRemaining = MAX_GUESSES - correctedScore
        setGuessesRemaining(correctedRemaining)
        saveGameState(
          {
            puzzleId: puzzle.id,
            puzzle,
            guesses: nextGuesses,
            guessesRemaining: correctedRemaining,
            isComplete: correctedRemaining === 0 || nextGuesses.every((guess) => guess !== null),
            versusObjectionsUsed: nextVersusObjectionsUsed,
          },
          mode
        )
      } else {
        saveGameState(
          {
            puzzleId: puzzle.id,
            puzzle,
            guesses: nextGuesses,
            guessesRemaining,
            isComplete,
            ...(mode === 'versus'
              ? {
                  currentPlayer,
                  stealableCell,
                  winner,
                  pendingFinalSteal,
                  versusCategoryFilters,
                  versusMinimumValidOptions,
                  versusStealRule,
                  versusTimerOption,
                  versusDisableDraws,
                  versusObjectionRule,
                  versusObjectionsUsed: nextVersusObjectionsUsed,
                  turnTimeLeft,
                  turnDeadlineAt,
                }
              : {}),
          },
          mode
        )
      }

      if (mode === 'daily' && activeDetailCell !== null) {
        void persistDailyObjectionResult(fetch, {
          puzzleId: puzzle.id,
          cellIndex: activeDetailCell,
          gameId: nextGuess.gameId,
          verdict: payload.verdict,
          explanation: payload.explanation ?? null,
          isCorrect: nextGuess.isCorrect,
          objectionOriginalMatchedRow: nextGuess.objectionOriginalMatchedRow ?? null,
          objectionOriginalMatchedCol: nextGuess.objectionOriginalMatchedCol ?? null,
        }).catch((error) => {
          console.error('Failed to persist objection result:', error)
        })
      }

      toast({
        title: payload.verdict === 'sustained' ? 'Objection sustained' : 'Objection overruled',
        description:
          payload.explanation ??
          (payload.verdict === 'overruled'
            ? 'Judge Gemini overruled the objection.'
            : 'Judge Gemini sustained the objection.'),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Judgment failed.'
      toast({
        variant: 'destructive',
        title: 'Objection failed',
        description: message,
      })
    } finally {
      setObjectionPending(false)
      setActiveJudgmentPending(null)
    }
  }, [
    activeDetailCell,
    appendVersusEvent,
    buildPersistedVersusState,
    currentPlayer,
    detailColCategory,
    detailGuess,
    detailRowCategory,
    guesses,
    guessesRemaining,
    isComplete,
    mode,
    pendingVersusObjectionReview,
    pendingFinalSteal,
    puzzle,
    toast,
    versusDisableDraws,
    versusObjectionRule,
    versusObjectionsUsed,
    versusStealRule,
    stealsEnabled,
    winner,
  ])

  useVersusTurnTimer({
    isVersusMode,
    isOnlineMatch: isCurrentOnlineMatch,
    isLoading,
    loadedPuzzleMode,
    puzzleId: puzzle?.id ?? null,
    currentPlayer,
    winner,
    versusTimerOption,
    turnTimeLeft,
    turnDeadlineAt,
    pendingFinalSteal,
    animationsEnabled,
    audioEnabled: versusAudioEnabled,
    activeTurnTimerKeyRef,
    setTurnTimeLeft,
    setTurnDeadlineAt,
    onTurnExpired: (nextPlayer) => {
      setSelectedCell(null)
      setStealableCell(null)

      const expirationResolution = getVersusTurnExpiredResolution({
        currentPlayer,
        pendingFinalSteal,
      })

      if (expirationResolution.kind === 'defender-wins') {
        setPendingFinalSteal(null)
        setWinner(expirationResolution.defender)

        if (isCurrentOnlineMatch && pendingFinalSteal) {
          void sendOnlineEventWithRecovery('miss', {
            cellIndex: pendingFinalSteal.cellIndex,
            guessesRemaining,
            resolutionKind: 'defender-wins',
            defender: pendingFinalSteal.defender,
          })
        }

        toast({
          variant: 'destructive',
          title: expirationResolution.title,
          description: expirationResolution.description,
        })
        return
      }

      setCurrentPlayer(nextPlayer)
      toast({
        variant: 'destructive',
        title: expirationResolution.title,
        description: expirationResolution.description,
      })
    },
  })

  // Load puzzle
  const loadPuzzle = useCallback(
    async (
      gameMode: GameMode,
      customFilters?: VersusCategoryFilters,
      requestedDailyDate?: string,
      customMinimumValidOptions?: number | null
    ) => {
      if (isPuzzleLoadInFlightRef.current) {
        return
      }

      isPuzzleLoadInFlightRef.current = true
      const shouldPersist = true
      const streamMode = gameMode === 'daily' ? 'daily' : 'practice'
      const resolvedDailyDate =
        gameMode === 'daily' ? (requestedDailyDate ?? activeDailyDate) : undefined
      const savedState = loadGameState(gameMode, resolvedDailyDate)
      const shouldIgnoreSavedVersusState =
        gameMode === 'versus' && skipNextVersusSavedStateRestoreRef.current
      const effectiveFilters =
        gameMode === 'versus'
          ? (customFilters ?? versusCategoryFilters)
          : gameMode === 'practice'
            ? (customFilters ?? practiceCategoryFilters)
            : undefined
      const effectiveMinimumValidOptions =
        gameMode === 'versus'
          ? (customMinimumValidOptions ?? versusMinimumValidOptions)
          : gameMode === 'practice'
            ? (customMinimumValidOptions ?? practiceMinimumValidOptions)
            : null
      const sanitizedEffectiveMinimumValidOptions = sanitizeMinimumValidOptions(
        effectiveMinimumValidOptions
      )

      if (shouldIgnoreSavedVersusState) {
        clearGameState('versus')
        skipNextVersusSavedStateRestoreRef.current = false
      }

      if (!shouldIgnoreSavedVersusState && savedState?.puzzle) {
        recordedVersusWinnerKeyRef.current =
          gameMode === 'versus' && savedState.winner
            ? `${savedState.puzzle.id}:${savedState.winner}`
            : null
        activeTurnTimerKeyRef.current =
          gameMode === 'versus' && savedState.currentPlayer
            ? `${savedState.puzzle.id}:${savedState.currentPlayer}`
            : null
        setLoadedPuzzleMode(gameMode)
        setPuzzle(savedState.puzzle)
        if (gameMode === 'daily' && savedState.puzzle?.date) {
          setActiveDailyDate(savedState.puzzle.date)
        }
        setGuesses(savedState.guesses as (CellGuess | null)[])
        setGuessesRemaining(savedState.guessesRemaining)
        setSelectedCell(savedState.selectedCell ?? null)
        setSearchQueryDraft(savedState.searchQuery ?? '')
        setCurrentPlayer(savedState.currentPlayer ?? 'x')
        setStealableCell(savedState.stealableCell ?? null)
        setWinner(savedState.winner ?? null)
        setPendingFinalSteal(savedState.pendingFinalSteal ?? null)
        setVersusCategoryFilters((savedState.versusCategoryFilters as VersusCategoryFilters) ?? {})
        setPracticeMinimumValidOptions(
          sanitizeMinimumValidOptions(savedState.practiceMinimumValidOptions ?? null)
        )
        setVersusMinimumValidOptions(
          sanitizeMinimumValidOptions(savedState.versusMinimumValidOptions ?? null)
        )
        setVersusStealRule(savedState.versusStealRule ?? DEFAULT_VERSUS_STEAL_RULE)
        setVersusTimerOption(savedState.versusTimerOption ?? 300)
        setVersusDisableDraws(savedState.versusDisableDraws ?? true)
        setVersusObjectionRule(savedState.versusObjectionRule ?? 'one')
        setVersusObjectionsUsed({
          x: savedState.versusObjectionsUsed?.x ?? 0,
          o: savedState.versusObjectionsUsed?.o ?? 0,
        })
        commitVersusEventLog(savedState.versusEventLog ?? [])
        setTurnTimeLeft(savedState.turnTimeLeft ?? null)
        setTurnDeadlineAt(savedState.turnDeadlineAt ?? null)
        setLockImpactCell(null)
        setShowResults(savedState.isComplete)
        setDetailCell(null)
        setIsLoading(false)
        isPuzzleLoadInFlightRef.current = false
        suppressVersusStatePersistenceRef.current = false
        return
      }

      setIsLoading(true)
      activeTurnTimerKeyRef.current = null
      recordedVersusWinnerKeyRef.current = null
      setGuesses(Array(9).fill(null))
      setGuessesRemaining(gameMode === 'versus' ? MAX_GUESSES : MAX_GUESSES)
      setTurnDeadlineAt(null)
      if (gameMode === 'versus') {
        setCurrentPlayer('x')
      } else {
        setCurrentPlayer('x')
      }
      setStealableCell(null)
      setWinner(null)
      setPendingFinalSteal(null)
      if (gameMode !== 'versus') {
        setVersusObjectionRule('off')
      }
      setVersusObjectionsUsed({ x: 0, o: 0 })
      commitVersusEventLog([])
      setPendingVersusObjectionReview(null)
      setLockImpactCell(null)
      setSelectedCell(null)
      setSearchQueryDraft('')
      setShowResults(false)
      setDetailCell(null)

      setLoadingProgress(8)
      setLoadingStage(
        gameMode === 'daily' ? "Loading today's board..." : 'Warming up the puzzle generator...'
      )
      setLoadingAttempts([])
      const controller = new AbortController()
      activePuzzleLoadControllerRef.current?.abort()
      activePuzzleLoadControllerRef.current = controller

      try {
        let puzzleData: Puzzle | null = null
        let archivedUserState: {
          guesses: (CellGuess | null)[]
          guessesRemaining: number
          isComplete: boolean
        } | null = null

        const isArchivedDaily =
          gameMode === 'daily' &&
          typeof resolvedDailyDate === 'string' &&
          resolvedDailyDate !== new Date().toISOString().split('T')[0]

        if (isArchivedDaily) {
          const archiveParams = new URLSearchParams({ mode: 'daily', date: resolvedDailyDate! })
          const archiveResponse = await fetch(`/api/puzzle?${archiveParams.toString()}`, {
            signal: controller.signal,
            headers: buildLegacySessionHeaders(sessionId),
          })
          const archivePayload = await archiveResponse.json()

          if (!archiveResponse.ok) {
            throw new Error(archivePayload.error ?? 'Failed to load archived daily puzzle')
          }

          setLoadingProgress(100)
          setLoadingStage(`Loading archived board from ${resolvedDailyDate}...`)
          puzzleData = archivePayload as Puzzle
          if (archivePayload.user_state) {
            archivedUserState = {
              guesses: archivePayload.user_state.guesses ?? Array(9).fill(null),
              guessesRemaining: archivePayload.user_state.guessesRemaining ?? MAX_GUESSES,
              isComplete: Boolean(archivePayload.user_state.isComplete),
            }
            setGuesses(archivedUserState.guesses)
            setGuessesRemaining(archivedUserState.guessesRemaining)
            setShowResults(archivedUserState.isComplete)
          }
        } else {
          const params = new URLSearchParams({ mode: streamMode })
          if (gameMode === 'versus' || gameMode === 'practice') {
            if (effectiveFilters && Object.keys(effectiveFilters).length > 0) {
              params.set('filters', JSON.stringify(effectiveFilters))
            }
            if (typeof sanitizedEffectiveMinimumValidOptions === 'number') {
              params.set('minValidOptions', String(sanitizedEffectiveMinimumValidOptions))
            }
          }

          const response = await fetch(`/api/puzzle-stream?${params.toString()}`, {
            signal: controller.signal,
            headers: buildLegacySessionHeaders(sessionId),
          })
          if (!response.ok || !response.body) {
            throw new Error('Failed to open puzzle stream')
          }

          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { value, done } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const events = buffer.split('\n\n')
            buffer = events.pop() ?? ''

            for (const eventChunk of events) {
              const dataLine = eventChunk.split('\n').find((line) => line.startsWith('data: '))

              if (!dataLine) {
                continue
              }

              const event = JSON.parse(dataLine.slice(6)) as PuzzleStreamMessage

              if (event.type === 'progress') {
                if (typeof event.pct === 'number') {
                  setLoadingProgress((current) => Math.max(current, event.pct!))
                }
                if (event.message) {
                  setLoadingStage(event.message)
                }
                if (event.stage === 'attempt' && event.attempt && event.rows && event.cols) {
                  setLoadingAttempts((current) => {
                    const nextAttempt: LoadingAttempt = {
                      attempt: event.attempt!,
                      rows: event.rows!,
                      cols: event.cols!,
                      intersections: buildAttemptIntersections(event.rows!, event.cols!),
                    }
                    const filtered = current.filter((entry) => entry.attempt !== event.attempt)
                    return [...filtered, nextAttempt].slice(-4)
                  })
                }
                if (
                  event.stage === 'cell' &&
                  typeof event.attempt === 'number' &&
                  typeof event.cellIndex === 'number'
                ) {
                  setLoadingAttempts((current) =>
                    current.map((entry) => {
                      if (entry.attempt !== event.attempt) {
                        return entry
                      }

                      const intersections = entry.intersections.map((intersection, index) =>
                        index === event.cellIndex
                          ? {
                              ...intersection,
                              status: (event.passed
                                ? 'passed'
                                : 'failed') as LoadingIntersection['status'],
                              validOptionCount: event.passed ? undefined : event.validOptionCount,
                            }
                          : intersection
                      )

                      return { ...entry, intersections }
                    })
                  )
                }
                if (
                  event.stage === 'metadata' &&
                  typeof event.attempt === 'number' &&
                  typeof event.cellIndex === 'number'
                ) {
                  setLoadingAttempts((current) =>
                    current.map((entry) => {
                      if (entry.attempt !== event.attempt) {
                        return entry
                      }

                      const intersections = entry.intersections.map((intersection, index) =>
                        index === event.cellIndex
                          ? {
                              ...intersection,
                              status: 'passed' as LoadingIntersection['status'],
                              validOptionCount: event.validOptionCount,
                            }
                          : intersection
                      )

                      return { ...entry, intersections }
                    })
                  )
                }
                if (event.stage === 'rejected' && typeof event.attempt === 'number') {
                  setLoadingAttempts((current) =>
                    current.map((entry) =>
                      entry.attempt === event.attempt
                        ? { ...entry, rejectedMessage: event.message ?? 'Rejected' }
                        : entry
                    )
                  )
                }
              } else if (event.type === 'puzzle' && event.puzzle) {
                puzzleData = event.puzzle
              } else if (event.type === 'error') {
                throw new Error(event.message ?? 'Failed to generate puzzle')
              }
            }
          }
        }

        if (!puzzleData) {
          throw new Error('Puzzle stream completed without a puzzle')
        }

        setLoadingProgress(100)
        setLoadingStage('Board ready.')
        setLoadedPuzzleMode(gameMode)
        setPuzzle(puzzleData)
        if (gameMode === 'versus') {
          suppressVersusStatePersistenceRef.current = false
        }
        if (gameMode === 'daily' && puzzleData.date) {
          setActiveDailyDate(puzzleData.date)
        }

        if (shouldPersist) {
          saveGameState(
            {
              puzzleId: puzzleData.id,
              puzzle: puzzleData,
              guesses: archivedUserState?.guesses ?? Array(9).fill(null),
              guessesRemaining: archivedUserState?.guessesRemaining ?? MAX_GUESSES,
              isComplete: archivedUserState?.isComplete ?? false,
              ...(gameMode === 'versus'
                ? {
                    currentPlayer: 'x' as const,
                    stealableCell: null,
                    winner: null,
                    pendingFinalSteal: null,
                    versusCategoryFilters: effectiveFilters ?? {},
                    versusMinimumValidOptions: sanitizedEffectiveMinimumValidOptions ?? null,
                    versusStealRule: versusStealRuleRef.current,
                    versusTimerOption: versusTimerOptionRef.current,
                    versusDisableDraws: versusDisableDrawsRef.current,
                    versusObjectionRule: versusObjectionRuleRef.current,
                    versusObjectionsUsed: { x: 0, o: 0 },
                    versusEventLog: [],
                    turnTimeLeft:
                      versusTimerOptionRef.current === 'none' ? null : versusTimerOptionRef.current,
                    turnDeadlineAt:
                      typeof versusTimerOptionRef.current === 'number'
                        ? new Date(Date.now() + versusTimerOptionRef.current * 1000).toISOString()
                        : null,
                  }
                : {}),
            },
            gameMode
          )
        }

        if (savedState && savedState.puzzleId === puzzleData.id) {
          setGuesses(savedState.guesses as (CellGuess | null)[])
          setGuessesRemaining(savedState.guessesRemaining)
          setTurnDeadlineAt(savedState.turnDeadlineAt ?? null)
          if (savedState.isComplete) setShowResults(true)
        }
      } catch (error) {
        if (gameMode === 'versus') {
          suppressVersusStatePersistenceRef.current = false
          skipNextVersusSavedStateRestoreRef.current = false
        }
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }

        console.error('Failed to load puzzle:', error)
        const hadCustomFilters = Boolean(
          effectiveFilters && Object.keys(effectiveFilters).length > 0
        )
        const generationErrorMessage =
          error instanceof Error && error.message
            ? error.message
            : 'No valid board could be generated from that combination. Try widening a category family or enabling more options.'

        if (gameMode === 'practice' && hadCustomFilters) {
          setPracticeSetupError(generationErrorMessage)
          setShowPracticeStartOptions(false)
          setShowPracticeSetup(true)
        } else if (gameMode === 'versus' && hadCustomFilters) {
          setVersusSetupError(generationErrorMessage)
          setShowVersusStartOptions(false)
          setShowVersusSetup(true)
        } else {
          toast({
            variant: 'destructive',
            title: 'Puzzle generation failed',
            description: 'Please try again.',
          })
        }
      } finally {
        if (activePuzzleLoadControllerRef.current === controller) {
          activePuzzleLoadControllerRef.current = null
        }
        isPuzzleLoadInFlightRef.current = false
        setIsLoading(false)
      }
    },
    [
      activeDailyDate,
      minimumValidOptionsDefault,
      practiceCategoryFilters,
      practiceMinimumValidOptions,
      sanitizeMinimumValidOptions,
      toast,
      versusCategoryFilters,
      versusMinimumValidOptions,
    ]
  )

  const handleDailyArchiveSelect = useCallback(
    (entry: DailyArchiveEntry) => {
      setShowDailyHistory(false)
      setActiveDailyDate(entry.date)
      setLoadedPuzzleMode(null)
      setPuzzle(null)
      setGuesses(Array(9).fill(null))
      setSelectedCell(null)
      setShowResults(false)
      setDetailCell(null)
      void loadPuzzle('daily', undefined, entry.date)
    },
    [loadPuzzle]
  )

  useEffect(() => {
    if (mode !== 'versus' || !puzzle || loadedPuzzleMode !== 'versus') {
      return
    }

    if (suppressVersusStatePersistenceRef.current) {
      return
    }

    const persistedState = buildPersistedVersusState({})
    if (!persistedState) {
      return
    }

    saveGameState(persistedState, 'versus')
  }, [
    buildPersistedVersusState,
    currentPlayer,
    guesses,
    guessesRemaining,
    isComplete,
    mode,
    loadedPuzzleMode,
    pendingFinalSteal,
    puzzle,
    stealableCell,
    turnTimeLeft,
    versusCategoryFilters,
    versusStealRule,
    versusTimerOption,
    versusDisableDraws,
    versusEventLog,
    versusObjectionRule,
    versusObjectionsUsed,
    winner,
  ])

  useEffect(() => {
    const isOnlineResumeInFlight =
      shouldForegroundOnlineSession &&
      (onlineVersus.isResuming ||
        onlineVersus.phase === 'joining' ||
        onlineVersus.phase === 'creating')

    const hasInviteJoinCode =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('join')?.length === 6

    if (hasStableOnlineBoardLoaded) {
      setIsLoading(false)
      return
    }

    if (isOnlineResumeInFlight || (hasInviteJoinCode && onlineVersus.phase === 'idle')) {
      setIsLoading(true)
      return
    }

    if (shouldForegroundOnlineSession && isWaitingForOnlinePuzzle) {
      setIsLoading(true)
      return
    }

    if (mode === 'practice' && showPracticeStartOptions) {
      setIsLoading(false)
      return
    }

    if (mode === 'versus' && showVersusStartOptions) {
      setIsLoading(false)
      return
    }

    if (mode === 'practice' && skipNextPracticeAutoLoadRef.current) {
      skipNextPracticeAutoLoadRef.current = false
      return
    }

    if (mode === 'versus' && skipNextVersusAutoLoadRef.current) {
      skipNextVersusAutoLoadRef.current = false
      return
    }

    if (isPuzzleLoadInFlightRef.current) {
      return
    }

    if (
      loadedPuzzleMode === mode &&
      puzzle &&
      (mode !== 'daily' || puzzle.date === activeDailyDate)
    ) {
      return
    }

    loadPuzzle(mode, undefined, mode === 'daily' ? activeDailyDate : undefined)
  }, [
    activeDailyDate,
    loadPuzzle,
    loadedPuzzleMode,
    mode,
    hasStableOnlineBoardLoaded,
    onlineVersus.isResuming,
    onlineVersus.phase,
    isWaitingForOnlinePuzzle,
    puzzle,
    showPracticeStartOptions,
    showVersusStartOptions,
    shouldForegroundOnlineSession,
  ])

  // Handle mode change
  const handleModeChange = (newMode: GameMode) => {
    if (newMode !== mode) {
      activePuzzleLoadControllerRef.current?.abort()

      if (newMode !== 'versus') {
        setShowOnlineLobby(false)
      }

      if (newMode === 'practice') {
        const hasSavedPracticeState = Boolean(loadGameState('practice')?.puzzle)
        setShowVersusStartOptions(false)
        setShowVersusSetup(false)
        setVersusSetupError(null)
        setShowPracticeSetup(false)
        setPracticeSetupError(null)

        if (!hasSavedPracticeState) {
          setPracticeCategoryFilters({})
          setPracticeMinimumValidOptions(null)
          setLoadedPuzzleMode(null)
          setPuzzle(null)
          setGuesses(Array(9).fill(null))
          setSelectedCell(null)
          setShowResults(false)
          setWinner(null)
          setStealableCell(null)
          setShowPracticeStartOptions(true)
        } else {
          setShowPracticeStartOptions(false)
        }
      } else if (newMode === 'versus') {
        setShowPracticeStartOptions(false)
        setShowPracticeSetup(false)
        setPracticeSetupError(null)
        setVersusSetupError(null)
        const hasSavedVersusState = hasRestorableVersusState({
          hasSavedVersusPuzzle: Boolean(loadGameState('versus')?.puzzle),
          hasOnlineRoom: Boolean(onlineVersus.room),
        })

        if (!hasSavedVersusState) {
          setVersusCategoryFilters({})
          setVersusMinimumValidOptions(null)
          versusStealRuleRef.current = DEFAULT_VERSUS_STEAL_RULE
          versusTimerOptionRef.current = 300
          versusDisableDrawsRef.current = true
          versusObjectionRuleRef.current = 'one'
          setVersusStealRule(DEFAULT_VERSUS_STEAL_RULE)
          setVersusTimerOption(300)
          setVersusDisableDraws(true)
          setVersusObjectionRule('one')
          setVersusObjectionsUsed({ x: 0, o: 0 })
          setLoadedPuzzleMode(null)
          setPuzzle(null)
          setGuesses(Array(9).fill(null))
          setSelectedCell(null)
          setShowResults(false)
          setWinner(null)
          setStealableCell(null)
          setShowVersusStartOptions(true)
        } else {
          setShowVersusStartOptions(false)
        }
      } else {
        setShowPracticeStartOptions(false)
        setShowPracticeSetup(false)
        setPracticeSetupError(null)
        setShowVersusStartOptions(false)
        setShowVersusSetup(false)
        setVersusSetupError(null)
        setActiveDailyDate(new Date().toISOString().split('T')[0])
      }
      setMode(newMode)
    }
  }

  const handleApplyPracticeFilters = (
    filters: VersusCategoryFilters,
    stealRule: VersusStealRule,
    timerOption: VersusTurnTimerOption,
    disableDraws: boolean,
    objectionRule: VersusObjectionRule,
    minimumValidOptionsOverride: number | null
  ) => {
    void stealRule
    void timerOption
    void disableDraws
    void objectionRule
    const sanitizedMinimumValidOptionsOverride = sanitizeMinimumValidOptions(
      minimumValidOptionsOverride
    )
    setPracticeCategoryFilters(filters)
    setPracticeMinimumValidOptions(sanitizedMinimumValidOptionsOverride)
    setPracticeSetupError(null)
    setShowPracticeSetup(false)
    setShowPracticeStartOptions(false)
    skipNextPracticeAutoLoadRef.current = true
    clearGameState('practice')
    loadPuzzle('practice', filters, undefined, sanitizedMinimumValidOptionsOverride)
  }

  const handleApplyVersusFilters = (
    filters: VersusCategoryFilters,
    stealRule: VersusStealRule,
    timerOption: VersusTurnTimerOption,
    disableDraws: boolean,
    objectionRule: VersusObjectionRule,
    minimumValidOptionsOverride: number | null
  ) => {
    const sanitizedMinimumValidOptionsOverride = sanitizeMinimumValidOptions(
      minimumValidOptionsOverride
    )
    setVersusCategoryFilters(filters)
    setVersusMinimumValidOptions(sanitizedMinimumValidOptionsOverride)
    setVersusSetupError(null)
    versusStealRuleRef.current = stealRule
    versusTimerOptionRef.current = timerOption
    versusDisableDrawsRef.current = disableDraws
    versusObjectionRuleRef.current = objectionRule
    setVersusStealRule(stealRule)
    setVersusTimerOption(timerOption)
    setVersusDisableDraws(disableDraws)
    setVersusObjectionRule(objectionRule)
    setShowVersusSetup(false)
    const setupIntent = pendingVersusSetupIntentRef.current
    pendingVersusSetupIntentRef.current = null

    if (setupIntent === 'online-host') {
      activePuzzleLoadControllerRef.current?.abort()
      clearGameState('versus')
      resetOnlineVersusSession()
      setLoadedPuzzleMode(null)
      setPuzzle(null)
      setGuesses(Array(9).fill(null))
      setGuessesRemaining(MAX_GUESSES)
      setCurrentPlayer('x')
      setStealableCell(null)
      setWinner(null)
      setPendingFinalSteal(null)
      setLockImpactCell(null)
      setSelectedCell(null)
      setSearchQueryDraft('')
      setDetailCell(null)
      setShowResults(false)
      setShowVersusStartOptions(false)
      setTurnTimeLeft(null)
      setTurnDeadlineAt(null)
      setPendingVersusObjectionReview(null)
      setVersusObjectionsUsed({ x: 0, o: 0 })
      commitVersusEventLog([])
      setShowOnlineLobby(true)
      onlineVersus.createRoom({
        categoryFilters: filters,
        stealRule,
        timerOption,
        disableDraws,
        objectionRule,
        minimumValidOptionsOverride: sanitizedMinimumValidOptionsOverride,
      })
      return
    }

    resetOnlineVersusSession()
    setShowVersusStartOptions(false)
    skipNextVersusAutoLoadRef.current = true
    clearGameState('versus')
    loadPuzzle('versus', filters, undefined, sanitizedMinimumValidOptionsOverride)
  }

  const hydrateGuessDetails = useCallback(
    async (cellIndex: number) => {
      if (!puzzle) return

      const guess = guesses[cellIndex]
      if (!guess) return

      if (isGuessHydrated(guess)) {
        return
      }

      const { row: rowCategory, col: colCategory } = getCategoriesForCell(puzzle, cellIndex)
      if (!rowCategory || !colCategory) {
        return
      }

      try {
        const result = await lookupGuessDetails(fetch, {
          gameId: guess.gameId,
          rowCategory,
          colCategory,
        })
        if (!result.game) {
          return
        }

        setGuesses((current) =>
          current.map((existingGuess, index) => {
            if (index !== cellIndex || !existingGuess) {
              return existingGuess
            }

            return hydrateStoredGuess(existingGuess, result)
          })
        )
      } catch (error) {
        console.error('Failed to hydrate guess details:', error)
      }
    },
    [guesses, puzzle]
  )

  // Handle cell click
  const handleCellClick = async (index: number) => {
    if (activeStealShowdown) {
      return
    }

    if (mode === 'versus') {
      if (isComplete) return
      // In online matches, only the active player may interact
      if (isCurrentOnlineMatch && onlineVersus.myRole !== currentPlayer) return
      if (pendingFinalSteal && index !== pendingFinalSteal.cellIndex) {
        return
      }

      const existingGuess = guesses[index]
      const canSteal =
        stealsEnabled &&
        existingGuess !== null &&
        existingGuess.owner !== currentPlayer &&
        stealableCell === index

      if (existingGuess && !canSteal) {
        return
      }

      setSelectedCell(index)
      setSearchQueryDraft('')
      return
    }

    if (guesses[index] !== null) {
      await hydrateGuessDetails(index)
      setDetailCell(index)
      return
    }
    if (isComplete) return
    setSelectedCell(index)
    setSearchQueryDraft('')
  }

  // Handle game selection
  const handleGameSelect = async (game: Game) => {
    if (selectedCell === null || !puzzle) return
    // In online matches, only the active player may submit
    if (mode === 'versus' && isCurrentOnlineMatch && onlineVersus.myRole !== currentPlayer) return

    const existingGuess = guesses[selectedCell]
    const isVersusSteal =
      mode === 'versus' &&
      stealsEnabled &&
      existingGuess !== null &&
      existingGuess.owner !== currentPlayer &&
      stealableCell === selectedCell

    if (isDuplicateGuessSelection(guesses, game.id, mode, selectedCell)) {
      toast({
        variant: 'destructive',
        title: 'Game already used',
        description: 'Each game can only be used once per grid.',
      })
      return
    }

    const rowIndex = Math.floor(selectedCell / 3)
    const colIndex = selectedCell % 3
    const rowCategory = puzzle.row_categories[rowIndex]
    const colCategory = puzzle.col_categories[colIndex]

    try {
      const result = await submitGuessSelection(fetch, {
        puzzleId: puzzle.id,
        cellIndex: selectedCell,
        gameId: game.id,
        gameName: game.name,
        gameImage: game.background_image,
        rowCategory,
        colCategory,
        isDaily: mode === 'daily',
      })

      if (result.duplicate) {
        toast({
          variant: 'destructive',
          title: 'Game already used',
          description: 'Each game can only be used once per grid.',
        })
        return
      }

      let newGuess = buildGuessFromSelection({
        game,
        result,
        mode,
        currentPlayer,
      })

      if (mode === 'versus' && !result.valid) {
        setSelectedCell(null)
        setStealableCell(null)
        setLockImpactCell(null)
        const missReason = buildMissReason(
          rowCategory,
          colCategory,
          result.matchesRow,
          result.matchesCol
        )
        if (isVersusSteal) {
          setActiveStealMissSplash({
            burstId: Date.now(),
            durationMs: 900,
          })
        }

        const invalidGuessResolution = getVersusInvalidGuessResolution({
          currentPlayer,
          pendingFinalSteal,
          selectedCell,
          missReason,
        })

        const availableObjectionCount =
          getVersusObjectionLimit(versusObjectionRule) - versusObjectionsUsed[currentPlayer]

        if (availableObjectionCount <= 0) {
          resolveVersusRejectedGuess(invalidGuessResolution)
          return
        }

        setPendingVersusObjectionReview({
          cellIndex: selectedCell,
          player: currentPlayer,
          isVersusSteal,
          guess: newGuess,
          rowCategory,
          colCategory,
          invalidGuessResolution,
        })
        setDetailCell(selectedCell)
        return
      }

      if (mode === 'versus' && isVersusSteal) {
        const outcome = resolveStealOutcome({
          currentPlayer,
          defendingGuess: existingGuess,
          attackingGuess: newGuess,
          rule: versusStealRule,
          pendingFinalSteal: pendingFinalSteal as PendingVersusSteal | null,
          selectedCell,
        })
        const effectiveStealRule = versusStealRule
        const defendingScore = getStealShowdownMetric(existingGuess, effectiveStealRule)
        const attackingScore = getStealShowdownMetric(newGuess, effectiveStealRule)
        const showdownDuration =
          animationsEnabled && outcome.hasShowdownScores ? STEAL_SHOWDOWN_DURATION_MS : 0
        const clientEventId = isCurrentOnlineMatch ? createOnlineVersusStealClientEventId() : null

        if (outcome.hasShowdownScores) {
          if (clientEventId) {
            locallyRenderedOnlineStealClientEventIdsRef.current.add(clientEventId)
          }
          setActiveStealShowdown({
            burstId: Date.now(),
            durationMs: showdownDuration,
            defenderName: existingGuess.gameName,
            defenderScore: defendingScore!,
            attackerName: game.name,
            attackerScore: attackingScore!,
            rule: effectiveStealRule,
            successful: outcome.successful,
          })
        }

        // Close the search sheet immediately so the showdown can take over the screen on mobile.
        setSelectedCell(null)
        setSearchQueryDraft('')

        appendVersusEvent({
          type: 'steal',
          player: currentPlayer,
          cellIndex: selectedCell,
          gameName: newGuess.gameName,
          successful: outcome.successful,
          viaObjection: false,
          hadShowdownScores: outcome.hasShowdownScores,
          finalSteal: pendingFinalSteal?.cellIndex === selectedCell,
          attackingScore,
          defendingGameName: existingGuess.gameName,
          defendingScore,
        })

        if (isCurrentOnlineMatch) {
          const failedStealResolution =
            !outcome.successful && pendingFinalSteal?.cellIndex === selectedCell
              ? { resolutionKind: 'defender-wins' as const, defender: pendingFinalSteal.defender }
              : !outcome.successful
                ? {
                    resolutionKind: 'next-player' as const,
                    nextPlayer: getNextPlayer(currentPlayer),
                  }
                : null
          void sendOnlineEventWithRecovery('steal', {
            cellIndex: selectedCell,
            attackingGuess: newGuess,
            clientEventId: clientEventId ?? undefined,
            successful: outcome.successful,
            resolutionKind: failedStealResolution?.resolutionKind,
            nextPlayer: failedStealResolution?.nextPlayer,
            defender: failedStealResolution?.defender,
            hadShowdownScores: outcome.hasShowdownScores,
            attackingGameName: newGuess.gameName,
            attackingScore,
            defendingGameName: existingGuess.gameName,
            defendingScore,
          }).then((result) => {
            if (!result.ok && clientEventId) {
              locallyRenderedOnlineStealClientEventIdsRef.current.delete(clientEventId)
            }
          })
        }

        if (!outcome.successful) {
          const failureDescription = buildStealFailureDescription({
            pendingFinalSteal,
            selectedCell,
            hasShowdownScores: outcome.hasShowdownScores,
            gameName: game.name,
            attackingScore,
            defendingGameName: existingGuess.gameName,
            defendingScore,
            versusStealRule: effectiveStealRule,
            currentPlayer,
          })

          const resolveFailedSteal = () => {
            if (outcome.hasShowdownScores) {
              setGuesses((current) =>
                current.map((guess, index) =>
                  index === selectedCell && guess
                    ? {
                        ...guess,
                        showdownScoreRevealed: true,
                      }
                    : guess
                )
              )
            }
            applyStealActions(outcome.actions)
            toast({
              variant: 'destructive',
              title: 'Steal failed',
              description: failureDescription,
            })
          }

          if (showdownDuration > 0) {
            window.setTimeout(resolveFailedSteal, showdownDuration)
          } else {
            resolveFailedSteal()
          }
          return
        }

        if (outcome.hasShowdownScores) {
          newGuess = {
            ...newGuess,
            showdownScoreRevealed: true,
          }
        }
      }

      const postGuessState = getPostGuessState({
        mode,
        puzzle,
        guesses,
        selectedCell,
        guessesRemaining,
        newGuess,
      })
      const newGuesses = postGuessState.nextGuesses
      setGuesses(newGuesses)

      if (newGuess.isCorrect) {
        const easterEggDefinition = getEasterEggDefinition(game.id)

        if (easterEggDefinition) {
          triggerEasterEggCelebration(game.id)

          if (easterEggDefinition.achievementId) {
            unlockAchievementWithToast(easterEggDefinition.achievementId, {
              imageUrl: game.background_image,
            })
          }
        }

        if (shouldUnlockRealStinker(game)) {
          triggerRealStinkerCelebration()
          unlockAchievementWithToast('real-stinker')
        }
      }

      const newGuessesRemaining = postGuessState.nextGuessesRemaining
      setGuessesRemaining(newGuessesRemaining)
      setSelectedCell(null)
      setSearchQueryDraft('')

      if (postGuessState.persistedState) {
        if (mode === 'versus') {
          const persistedState = buildPersistedVersusState(postGuessState.persistedState)
          if (persistedState) {
            saveGameState(persistedState, mode)
          }
        } else {
          saveGameState(postGuessState.persistedState, mode)
        }
      }

      if (mode === 'versus') {
        if (!isVersusSteal) {
          appendVersusEvent({
            type: 'claim',
            player: currentPlayer,
            cellIndex: selectedCell,
            gameName: newGuess.gameName,
            viaObjection: false,
          })
          if (isCurrentOnlineMatch) {
            void sendOnlineEventWithRecovery('claim', {
              cellIndex: selectedCell,
              guess: newGuess,
            })
          }
        }

        setPendingFinalSteal(null)
        setLockImpactCell(null)
        setStealableCell(stealsEnabled ? selectedCell : null)

        const placementResolution = getVersusPlacementResolution({
          newGuesses,
          currentPlayer,
          selectedCell,
          isVersusSteal,
          stealsEnabled,
          disableDraws: versusDisableDraws,
        })

        if (placementResolution.kind === 'final-steal') {
          setPendingFinalSteal({
            defender: placementResolution.defender,
            cellIndex: placementResolution.cellIndex,
          })
          setCurrentPlayer(placementResolution.nextPlayer)
          toast({
            title: placementResolution.title,
            description: placementResolution.description,
          })
          return
        }

        if (placementResolution.kind === 'winner') {
          setWinner(placementResolution.winner)
          setStealableCell(null)
          toast({
            title: placementResolution.title,
            description: placementResolution.description,
          })
          return
        }

        if (placementResolution.kind === 'claims-win') {
          setWinner(placementResolution.winner)
          setStealableCell(null)
          toast({
            title: placementResolution.title,
            description: placementResolution.description,
          })
          return
        }

        if (placementResolution.kind === 'draw') {
          setActiveDoubleKoSplash({
            burstId: Date.now(),
            durationMs: 1400,
          })
          setWinner('draw')
          setStealableCell(null)
          toast({
            title: placementResolution.title,
            description: placementResolution.description,
          })
          return
        }

        setCurrentPlayer(placementResolution.nextPlayer)
        toast({
          title: placementResolution.title,
          description: placementResolution.description,
        })
        return
      }

      const completionEffects = getPostGuessCompletionEffects({
        mode,
        isComplete: postGuessState.isComplete,
        finalScore: postGuessState.finalScore,
      })

      if (completionEffects.shouldUnlockPerfectGrid) {
        unlockAchievementWithToast('perfect-grid')
        triggerPerfectCelebration()
      }

      if (completionEffects.shouldPostDailyStats && postGuessState.finalScore !== null) {
        await postDailyStats(
          fetch,
          buildDailyStatsPayload({
            puzzleId: puzzle.id,
            score: postGuessState.finalScore,
          })
        )
      }

      if (completionEffects.shouldShowResults) {
        setTimeout(() => setShowResults(true), 500)
      }
    } catch (error) {
      console.error('Guess error:', error)
      toast({
        variant: 'destructive',
        title: 'Guess failed',
        description: 'Something went wrong while checking that game.',
      })
    }
  }

  const handleEndOnlineMatch = useCallback(() => {
    activePuzzleLoadControllerRef.current?.abort()

    void (async () => {
      if (onlineVersus.room && onlineVersus.phase !== 'idle' && onlineVersus.phase !== 'error') {
        const result = await onlineVersus.markFinished()
        if (!result.ok) {
          toast({
            title: 'Failed to end online match',
            description: result.error ?? undefined,
            variant: 'destructive',
          })
          return
        }
      }

      clearGameState('versus')
      resetOnlineVersusSession()
      setLoadedPuzzleMode(null)
      setPuzzle(null)
      setGuesses(Array(9).fill(null))
      setGuessesRemaining(MAX_GUESSES)
      setCurrentPlayer('x')
      setStealableCell(null)
      setWinner(null)
      setPendingFinalSteal(null)
      setLockImpactCell(null)
      setSelectedCell(null)
      setSearchQueryDraft('')
      setDetailCell(null)
      setShowResults(false)
      setShowVersusSetup(false)
      setShowOnlineLobby(false)
      setShowVersusStartOptions(true)
      setIsLoading(false)
      setTurnTimeLeft(null)
      setTurnDeadlineAt(null)
      setPendingVersusObjectionReview(null)
      setVersusObjectionsUsed({ x: 0, o: 0 })
      commitVersusEventLog([])
    })()
  }, [onlineVersus, resetOnlineVersusSession, toast, commitVersusEventLog])

  const handleContinueOnlineRoom = useCallback(() => {
    activePuzzleLoadControllerRef.current?.abort()
    skipNextVersusSavedStateRestoreRef.current = true
    suppressVersusStatePersistenceRef.current = true

    void (async () => {
      const result = await onlineVersus.continueRoom()
      if (!result.ok) {
        skipNextVersusSavedStateRestoreRef.current = false
        suppressVersusStatePersistenceRef.current = false
        toast({
          title: 'Failed to continue in this room',
          description: result.error ?? undefined,
          variant: 'destructive',
        })
        return
      }

      setShowVersusWinnerBanner(false)
      setShowVersusSummaryDetails(false)
      setShowOnlineLobby(false)
      clearGameState('versus')
      setLoadedPuzzleMode(null)
      setPuzzle(null)
      setGuesses(Array(9).fill(null))
      setGuessesRemaining(MAX_GUESSES)
      setCurrentPlayer('x')
      setStealableCell(null)
      setWinner(null)
      setPendingFinalSteal(null)
      setLockImpactCell(null)
      setSelectedCell(null)
      setSearchQueryDraft('')
      setDetailCell(null)
      setShowResults(false)
      setTurnTimeLeft(null)
      setTurnDeadlineAt(null)
      setVersusObjectionsUsed({ x: 0, o: 0 })
      commitVersusEventLog([])
      publishedPuzzleRoomIdRef.current = null
      appliedOnlineEventIdsRef.current = new Set()
      shownOnlineStealShowdownIdsRef.current = new Set()
      processedOnlineEventSourcesRef.current = new Map()
      locallyRenderedOnlineStealClientEventIdsRef.current = new Set()
      finishedOnlineRoomIdRef.current = null
      preparedOnlineRoomKeyRef.current = null
      lastSavedOnlineSnapshotRef.current = null
      lastAppliedOnlineSnapshotRef.current = null
      snapshotSaveInFlightRef.current = false
      pendingSnapshotQueueRef.current = null
      setIsLoading(true)
      setLoadingProgress(8)
      setLoadingAttempts([])
      setLoadingStage(
        onlineVersus.myRole === 'x'
          ? 'Preparing the shared board...'
          : 'Waiting for the host to finish preparing the board...'
      )
      setPendingVersusObjectionReview(null)
      setActiveStealShowdown(null)
      setActiveStealMissSplash(null)
      setActiveDoubleKoSplash(null)
      setActiveObjectionSplash(null)
      setActiveJudgmentPending(null)
      setActiveJudgmentVerdict(null)
      setObjectionPending(false)
      setObjectionVerdict(null)
      setObjectionExplanation(null)
    })()
  }, [commitVersusEventLog, onlineVersus, toast])

  const handleStartFreshOnlineMatch = useCallback(() => {
    activePuzzleLoadControllerRef.current?.abort()

    void (async () => {
      if (
        onlineVersus.room &&
        onlineVersus.phase !== 'idle' &&
        onlineVersus.phase !== 'error' &&
        onlineVersus.phase !== 'finished'
      ) {
        const result = await onlineVersus.markFinished()
        if (!result.ok) {
          toast({
            title: 'Failed to start a fresh online match',
            description: result.error ?? undefined,
            variant: 'destructive',
          })
          return
        }
      }

      clearGameState('versus')
      resetOnlineVersusSession()
      setLoadedPuzzleMode(null)
      setPuzzle(null)
      setGuesses(Array(9).fill(null))
      setGuessesRemaining(MAX_GUESSES)
      setCurrentPlayer('x')
      setStealableCell(null)
      setWinner(null)
      setPendingFinalSteal(null)
      setLockImpactCell(null)
      setSelectedCell(null)
      setSearchQueryDraft('')
      setDetailCell(null)
      setShowResults(false)
      setShowVersusSetup(false)
      setShowVersusStartOptions(false)
      setShowVersusWinnerBanner(false)
      setShowVersusSummaryDetails(false)
      setShowOnlineLobby(true)
      setIsLoading(false)
      setTurnTimeLeft(null)
      setTurnDeadlineAt(null)
      setPendingVersusObjectionReview(null)
      setVersusObjectionsUsed({ x: 0, o: 0 })
      commitVersusEventLog([])
      onlineVersus.createRoom({
        categoryFilters: versusCategoryFilters,
        stealRule: versusStealRule,
        timerOption: versusTimerOption,
        disableDraws: versusDisableDraws,
        objectionRule: versusObjectionRule,
        minimumValidOptionsOverride: versusMinimumValidOptions,
      })
    })()
  }, [
    commitVersusEventLog,
    onlineVersus,
    resetOnlineVersusSession,
    toast,
    versusCategoryFilters,
    versusDisableDraws,
    versusMinimumValidOptions,
    versusObjectionRule,
    versusStealRule,
    versusTimerOption,
  ])

  // Handle starting a fresh non-daily board
  const handleNewGame = () => {
    activePuzzleLoadControllerRef.current?.abort()

    if (mode === 'practice') {
      clearGameState('practice')
      skipNextPracticeAutoLoadRef.current = true
      loadPuzzle('practice', practiceCategoryFilters, undefined, practiceMinimumValidOptions)
      return
    }

    if (onlineVersus.myRole) {
      if (winner !== null && onlineVersus.myRole === 'x') {
        handleContinueOnlineRoom()
      } else {
        handleStartFreshOnlineMatch()
      }
      return
    }

    if (!isCurrentOnlineMatch) {
      resetOnlineVersusSession()
    }

    clearGameState('versus')
    setShowVersusStartOptions(false)
    skipNextVersusAutoLoadRef.current = true
    loadPuzzle('versus', versusCategoryFilters, undefined, versusMinimumValidOptions)
  }

  const prepareForOnlineMatchStart = useCallback(() => {
    activePuzzleLoadControllerRef.current?.abort()
    clearGameState('versus')
    resetOnlineVersusSession()
    setLoadedPuzzleMode(null)
    setPuzzle(null)
    setGuesses(Array(9).fill(null))
    setGuessesRemaining(MAX_GUESSES)
    setCurrentPlayer('x')
    setStealableCell(null)
    setWinner(null)
    setPendingFinalSteal(null)
    setLockImpactCell(null)
    setSelectedCell(null)
    setSearchQueryDraft('')
    setDetailCell(null)
    setShowResults(false)
    setShowVersusSetup(false)
    setShowVersusStartOptions(false)
    setTurnTimeLeft(null)
    setTurnDeadlineAt(null)
    setPendingVersusObjectionReview(null)
    setVersusObjectionsUsed({ x: 0, o: 0 })
    commitVersusEventLog([])
  }, [commitVersusEventLog, resetOnlineVersusSession])

  const hostOnlineMatchWithSettings = useCallback(
    (
      categoryFilters: VersusCategoryFilters,
      stealRule: VersusStealRule,
      timerOption: VersusTurnTimerOption,
      disableDraws: boolean,
      objectionRule: VersusObjectionRule,
      minimumValidOptionsOverride: number | null
    ) => {
      const sanitizedMinimumValidOptionsOverride = sanitizeMinimumValidOptions(
        minimumValidOptionsOverride
      )
      setVersusCategoryFilters(categoryFilters)
      setVersusMinimumValidOptions(sanitizedMinimumValidOptionsOverride)
      setVersusSetupError(null)
      versusStealRuleRef.current = stealRule
      versusTimerOptionRef.current = timerOption
      versusDisableDrawsRef.current = disableDraws
      versusObjectionRuleRef.current = objectionRule
      setVersusStealRule(stealRule)
      setVersusTimerOption(timerOption)
      setVersusDisableDraws(disableDraws)
      setVersusObjectionRule(objectionRule)
      prepareForOnlineMatchStart()
      setShowOnlineLobby(true)
      onlineVersus.createRoom({
        categoryFilters,
        stealRule,
        timerOption,
        disableDraws,
        objectionRule,
        minimumValidOptionsOverride: sanitizedMinimumValidOptionsOverride,
      })
    },
    [onlineVersus, prepareForOnlineMatchStart, sanitizeMinimumValidOptions]
  )

  const handleHostStandardOnlineMatch = useCallback(() => {
    pendingVersusSetupIntentRef.current = null
    hostOnlineMatchWithSettings(
      {},
      DEFAULT_VERSUS_STEAL_RULE,
      DEFAULT_VERSUS_TIMER_OPTION,
      DEFAULT_VERSUS_DISABLE_DRAWS,
      DEFAULT_VERSUS_OBJECTION_RULE,
      null
    )
  }, [hostOnlineMatchWithSettings])

  const handleHostCustomOnlineMatch = useCallback(() => {
    pendingVersusSetupIntentRef.current = 'online-host'
    setShowVersusSetup(true)
  }, [])

  const handleStartOnlineMatch = useCallback(() => {
    pendingVersusSetupIntentRef.current = null
    setShowVersusSetup(false)
    setShowVersusStartOptions(false)
    setShowOnlineLobby(true)
  }, [])

  // Get categories for selected cell
  const { row: selectedRowCategory, col: selectedColCategory } = getCategoriesForCell(
    puzzle,
    selectedCell
  )
  const minimumCellOptions = puzzle?.cell_metadata?.reduce(
    (lowest, cell) => Math.min(lowest, cell.validOptionCount),
    Number.POSITIVE_INFINITY
  )
  const resolvedMinimumCellOptions: number | null = Number.isFinite(
    minimumCellOptions ?? Number.NaN
  )
    ? (minimumCellOptions ?? null)
    : null
  const turnTimerLabel =
    isVersusMode && turnTimeLeft !== null
      ? `Turn: ${Math.floor(turnTimeLeft / 60)}:${String(turnTimeLeft % 60).padStart(2, '0')}`
      : null
  const activeCategoryTypes = puzzle
    ? Array.from(
        new Set([
          ...puzzle.row_categories.map((category) => category.type),
          ...puzzle.col_categories.map((category) => category.type),
        ])
      )
    : []

  // Single canonical mount — Dialog is portaled so it works regardless of which branch renders
  const onlineLobbyEl = (
    <OnlineVersusLobby
      isOpen={showOnlineLobby}
      phase={onlineVersus.phase}
      room={onlineVersus.room}
      myRole={onlineVersus.myRole}
      errorMessage={onlineVersus.errorMessage}
      onCreateRoom={() => {
        prepareForOnlineMatchStart()
        setShowOnlineLobby(true)
        onlineVersus.createRoom({
          categoryFilters: versusCategoryFilters,
          stealRule: versusStealRule,
          timerOption: versusTimerOption,
          disableDraws: versusDisableDraws,
          objectionRule: versusObjectionRule,
          minimumValidOptionsOverride: versusMinimumValidOptions,
        })
      }}
      onJoinRoom={(code) => {
        prepareForOnlineMatchStart()
        setShowOnlineLobby(true)
        onlineVersus.joinRoom(code)
      }}
      onDismiss={() => {
        setShowOnlineLobby(false)
        if (onlineVersus.phase === 'idle' || onlineVersus.phase === 'error') {
          resetOnlineVersusSession()
        }
      }}
    />
  )

  const onlineLoadingCopy = (() => {
    if (onlineVersus.phase === 'joining') {
      return {
        title: 'Joining Match',
        description: 'Connecting you to the room and restoring the shared board state.',
        showProgress: false,
        showAttempts: false,
      }
    }

    if (onlineVersus.phase === 'creating') {
      return {
        title: 'Creating Match',
        description: 'Setting up the room so you can share the invite.',
        showProgress: false,
        showAttempts: false,
      }
    }

    if (hasActiveOnlineRoom && (!onlineVersus.room?.puzzle_id || !onlineVersus.room?.puzzle_data)) {
      return {
        title: 'Waiting For Board',
        description:
          onlineVersus.myRole === 'x'
            ? 'Preparing the shared board for your online match.'
            : 'Waiting for the host to finish preparing the shared board.',
        showProgress: onlineVersus.myRole === 'x',
        showAttempts: onlineVersus.myRole === 'x',
      }
    }

    return null
  })()
  const showOnlineSyncBanner =
    isVersusMode &&
    onlineVersus.myRole !== null &&
    puzzle !== null &&
    hasStableOnlineBoardLoaded &&
    (onlineVersus.isResuming ||
      onlineVersus.phase === 'joining' ||
      onlineVersus.phase === 'creating' ||
      isWaitingForOnlinePuzzle)
  const onlineSyncBannerText = (() => {
    if (onlineVersus.phase === 'joining' || onlineVersus.isResuming) {
      return 'Reconnecting to your online match...'
    }

    if (onlineVersus.phase === 'creating') {
      return 'Finishing room setup...'
    }

    if (hasActiveOnlineRoom && (!onlineVersus.room?.puzzle_id || !onlineVersus.room?.puzzle_data)) {
      return onlineVersus.myRole === 'x'
        ? 'Preparing the shared board...'
        : 'Waiting for the host to finish preparing the board...'
    }

    return 'Syncing match state...'
  })()

  if (isLoading && !showOnlineLobby) {
    return (
      <PuzzleLoadingScreen
        mode={mode}
        loadingStage={loadingStage}
        loadingProgress={loadingProgress}
        loadingAttempts={loadingAttempts}
        titleOverride={onlineLoadingCopy?.title}
        descriptionOverride={onlineLoadingCopy?.description}
        showProgress={onlineLoadingCopy?.showProgress}
        showAttempts={onlineLoadingCopy?.showAttempts}
      />
    )
  }

  if (!puzzle) {
    if (showOnlineLobby) {
      return (
        <>
          <main id="top" className="min-h-screen px-4 py-6" />
          {onlineLobbyEl}
        </>
      )
    }

    if (
      (mode === 'versus' && showVersusStartOptions) ||
      (mode === 'practice' && showPracticeStartOptions)
    ) {
      return (
        <>
          <ModeStartScreen
            mode={mode}
            guessesRemaining={guessesRemaining}
            score={score}
            currentPlayer={currentPlayer}
            winner={winner}
            versusRecord={versusRecord}
            versusObjectionsUsed={versusObjectionsUsed}
            isHowToPlayOpen={showHowToPlay}
            isAchievementsOpen={showAchievements}
            hasActiveCustomSetup={hasActiveCustomSetup}
            minimumCellOptions={resolvedMinimumCellOptions}
            dailyResetLabel={dailyResetLabel}
            showPracticeSetup={showPracticeSetup}
            showVersusSetup={showVersusSetup}
            practiceSetupError={practiceSetupError}
            versusSetupError={versusSetupError}
            practiceCategoryFilters={practiceCategoryFilters}
            practiceMinimumValidOptions={practiceMinimumValidOptions}
            versusCategoryFilters={versusCategoryFilters}
            versusMinimumValidOptions={versusMinimumValidOptions}
            minimumValidOptionsDefault={minimumValidOptionsDefault}
            versusStealRule={versusStealRule}
            versusTimerOption={versusTimerOption}
            versusDisableDraws={versusDisableDraws}
            versusObjectionRule={versusObjectionRule}
            onModeChange={handleModeChange}
            onAchievementsOpen={() => setShowAchievements(true)}
            onAchievementsClose={() => setShowAchievements(false)}
            onHowToPlayOpen={() => setShowHowToPlay(true)}
            onHowToPlayClose={() => setShowHowToPlay(false)}
            onOpenPracticeSetup={() => setShowPracticeSetup(true)}
            onOpenVersusSetup={() => {
              pendingVersusSetupIntentRef.current = 'local'
              setShowVersusSetup(true)
            }}
            onClosePracticeSetup={() => setShowPracticeSetup(false)}
            onCloseVersusSetup={() => {
              pendingVersusSetupIntentRef.current = null
              setShowVersusSetup(false)
            }}
            onHostOnlineStandardMatch={
              mode === 'versus' ? handleHostStandardOnlineMatch : undefined
            }
            onHostOnlineCustomMatch={mode === 'versus' ? handleHostCustomOnlineMatch : undefined}
            onJoinOnlineMatch={mode === 'versus' ? handleStartOnlineMatch : undefined}
            onStartStandard={() => {
              if (mode === 'practice') {
                setPracticeCategoryFilters({})
                setPracticeMinimumValidOptions(null)
                setPracticeSetupError(null)
                setShowPracticeStartOptions(false)
                skipNextPracticeAutoLoadRef.current = true
                clearGameState('practice')
                loadPuzzle('practice', {}, undefined, null)
                return
              }

              resetOnlineVersusSession()
              setVersusCategoryFilters({})
              setVersusMinimumValidOptions(null)
              setVersusSetupError(null)
              versusStealRuleRef.current = DEFAULT_VERSUS_STEAL_RULE
              versusTimerOptionRef.current = DEFAULT_VERSUS_TIMER_OPTION
              versusDisableDrawsRef.current = DEFAULT_VERSUS_DISABLE_DRAWS
              versusObjectionRuleRef.current = DEFAULT_VERSUS_OBJECTION_RULE
              setVersusStealRule(DEFAULT_VERSUS_STEAL_RULE)
              setVersusTimerOption(DEFAULT_VERSUS_TIMER_OPTION)
              setVersusDisableDraws(DEFAULT_VERSUS_DISABLE_DRAWS)
              setVersusObjectionRule(DEFAULT_VERSUS_OBJECTION_RULE)
              setShowVersusStartOptions(false)
              skipNextVersusAutoLoadRef.current = true
              clearGameState('versus')
              loadPuzzle('versus', {}, undefined, null)
            }}
            onApplyPracticeFilters={handleApplyPracticeFilters}
            onApplyVersusFilters={handleApplyVersusFilters}
          />
          {onlineLobbyEl}
        </>
      )
    }

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load puzzle</p>
          <button onClick={() => loadPuzzle(mode)} className="text-primary hover:underline">
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <main id="top" className="min-h-screen py-6 px-4">
      <DevReloadBadge />
      {animationsEnabled && activeEasterEgg && <EasterEggCelebration {...activeEasterEgg} />}
      {animationsEnabled && activePerfectCelebration && (
        <PerfectGridCelebration {...activePerfectCelebration} />
      )}
      {animationsEnabled && activeStealShowdown && (
        <StealShowdownOverlay {...activeStealShowdown} lowEffects={animationQuality === 'low'} />
      )}
      {animationsEnabled && activeStealMissSplash && <StealMissSplash {...activeStealMissSplash} />}
      {animationsEnabled && activeDoubleKoSplash && <DoubleKoSplash {...activeDoubleKoSplash} />}
      {activeObjectionSplash && <ObjectionSplash {...activeObjectionSplash} />}
      {activeJudgmentPending && <JudgmentPendingOverlay {...activeJudgmentPending} />}
      {activeJudgmentVerdict && <JudgmentVerdictSplash {...activeJudgmentVerdict} />}

      <div className="mx-auto w-full max-w-xl">
        <GameHeader
          mode={mode}
          guessesRemaining={guessesRemaining}
          score={score}
          currentPlayer={isVersusMode ? currentPlayer : null}
          myOnlineRole={onlineVersus.myRole}
          winner={isVersusMode ? winner : null}
          versusRecord={versusRecord}
          versusObjectionRule={versusObjectionRule}
          versusObjectionsUsed={versusObjectionsUsed}
          dailyResetLabel={mode === 'daily' ? dailyResetLabel : null}
          isHowToPlayOpen={showHowToPlay}
          isAchievementsOpen={showAchievements}
          isDailyHistoryOpen={showDailyHistory}
          hasActiveCustomSetup={hasActiveCustomSetup}
          onModeChange={handleModeChange}
          onAchievements={() => setShowAchievements(true)}
          onHowToPlay={() => setShowHowToPlay(true)}
          onDailyHistory={mode === 'daily' ? openDailyHistory : undefined}
          onNewGame={mode === 'practice' || mode === 'versus' ? handleNewGame : undefined}
          onStartOnlineMatch={
            mode === 'versus' && !onlineVersus.myRole ? handleStartOnlineMatch : undefined
          }
          onEndOnlineMatch={
            mode === 'versus' && onlineVersus.myRole ? handleEndOnlineMatch : undefined
          }
          onCustomizeGame={
            mode === 'practice'
              ? () => setShowPracticeSetup(true)
              : mode === 'versus'
                ? () => {
                    pendingVersusSetupIntentRef.current = 'local'
                    setShowVersusSetup(true)
                  }
                : undefined
          }
        />
      </div>

      {showOnlineSyncBanner && (
        <div className="mx-auto mb-4 flex w-full max-w-lg items-center gap-3 rounded-xl border border-sky-400/25 bg-sky-500/8 px-4 py-3 text-sm text-sky-100 shadow-sm">
          <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-sky-300/40 border-t-sky-300" />
          <p className="leading-snug text-sky-100/90">{onlineSyncBannerText}</p>
        </div>
      )}

      {puzzle.validation_status && puzzle.validation_status !== 'validated' && (
        <div className="max-w-lg mx-auto mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium text-amber-200">Cross-sections are not fully validated</p>
          <p className="mt-1 text-amber-100/90">
            {puzzle.validation_message ??
              'This puzzle may contain weaker or less certain intersections than usual.'}
          </p>
        </div>
      )}

      <div className="relative mx-auto w-full max-w-xl">
        <GameGrid
          rowCategories={puzzle.row_categories}
          colCategories={puzzle.col_categories}
          guesses={guesses}
          cellMetadata={puzzle.cell_metadata}
          selectedCell={selectedCell}
          stealableCell={isVersusMode ? stealableCell : null}
          finalStealCell={isVersusMode ? (pendingFinalSteal?.cellIndex ?? null) : null}
          currentPlayer={isVersusMode ? currentPlayer : null}
          myOnlineRole={isVersusMode ? onlineVersus.myRole : null}
          score={!isVersusMode ? score : undefined}
          guessesRemaining={!isVersusMode ? guessesRemaining : undefined}
          winner={isVersusMode ? winner : null}
          turnTimerLabel={isVersusMode ? turnTimerLabel : null}
          turnTimerSeconds={isVersusMode ? turnTimeLeft : null}
          turnTimerMaxSeconds={
            isVersusMode && versusTimerOption !== 'none' ? versusTimerOption : null
          }
          versusRecord={versusRecord}
          alarmsEnabled={!isVersusMode || versusAlarmsEnabled}
          animationsEnabled={animationsEnabled}
          lockImpactCell={isVersusMode ? lockImpactCell : null}
          stealRule={isVersusMode ? versusStealRule : 'off'}
          isGameOver={isComplete}
          onCellClick={handleCellClick}
        />
      </div>

      <Dialog
        open={isVersusMode && winner !== null && showVersusWinnerBanner}
        onOpenChange={(open) => {
          if (!open) {
            setShowVersusWinnerBanner(false)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-border bg-card/95 p-5 text-center shadow-xl backdrop-blur-sm">
          <DialogTitle className="sr-only">
            {winner === 'draw'
              ? 'Versus match ended in a draw'
              : `${getPlayerLabel(winner ?? 'x')} wins the match`}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {winner === 'draw'
              ? onlineVersus.myRole
                ? onlineVersus.myRole === 'x'
                  ? 'The online match ended in a draw. Close this dialog to review the finished board, continue in this room, or start a fresh online room.'
                  : 'The online match ended in a draw. Close this dialog to review the finished board or start a fresh online room.'
                : 'The versus match ended in a draw. Close this dialog to review the finished board or start a new match.'
              : onlineVersus.myRole
                ? onlineVersus.myRole === 'x'
                  ? 'The online match is over. Close this dialog to review the finished board, continue in this room, or start a fresh online room.'
                  : 'The online match is over. Close this dialog to review the finished board or start a fresh online room.'
                : 'The versus match is over. Close this dialog to review the finished board or start a new match.'}
          </DialogDescription>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Match Over
          </p>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {winner === 'draw' ? 'Draw game' : `${getPlayerLabel(winner ?? 'x')} wins`}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {winner === 'draw'
              ? onlineVersus.myRole
                ? onlineVersus.myRole === 'x'
                  ? 'No line was completed before the board filled up. Continue in this room or start a fresh online room to play again.'
                  : 'No line was completed before the board filled up. Wait for the host to continue this room or start a fresh online room.'
                : 'No line was completed before the board filled up.'
              : onlineVersus.myRole
                ? onlineVersus.myRole === 'x'
                  ? 'Click outside to review the finished board, continue in this room, or start a fresh online room.'
                  : 'Click outside to review the finished board, or wait for the host to continue this room.'
                : 'Click outside to review the finished board, or start a new match.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setShowVersusWinnerBanner(false)}
              className="rounded-lg border border-border bg-secondary/40 px-4 py-2.5 font-medium text-foreground transition-colors hover:bg-secondary/65"
            >
              Hide
            </button>
            {onlineVersus.myRole === 'x' && (
              <button
                onClick={handleContinueOnlineRoom}
                className="rounded-lg border border-sky-500/35 bg-sky-500/10 px-5 py-2.5 font-medium text-sky-100 transition-colors hover:bg-sky-500/15"
              >
                Continue In Room
              </button>
            )}
            <button
              onClick={onlineVersus.myRole === 'x' ? handleStartFreshOnlineMatch : handleNewGame}
              className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {onlineVersus.myRole ? 'New Online Room' : 'New Match'}
            </button>
          </div>
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => setShowVersusSummaryDetails((current) => !current)}
              className="rounded-lg border border-border bg-secondary/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/65"
            >
              {showVersusSummaryDetails ? 'Hide Summary' : 'View Summary'}
            </button>
          </div>
          {showVersusSummaryDetails && (
            <VersusSummaryPanel
              guesses={guesses}
              eventLog={versusEventLog}
              winner={winner ?? 'draw'}
              stealRule={versusStealRule}
              timerOption={versusTimerOption}
              disableDraws={versusDisableDraws}
              objectionRule={versusObjectionRule}
              objectionsUsed={versusObjectionsUsed}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Show results button when complete */}
      {!isVersusMode && isComplete && !showResults && (
        <div className="max-w-lg mx-auto mt-6 text-center">
          <button
            onClick={() => setShowResults(true)}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            View Results
          </button>
        </div>
      )}

      <GameSearch
        isOpen={selectedCell !== null}
        initialQuery={searchQueryDraft}
        puzzleId={mode === 'daily' ? puzzle.id : undefined}
        hideScores={mode === 'versus'}
        confirmBeforeSelect={confirmBeforeSelect}
        lowEffects={animationQuality === 'low'}
        turnTimerLabel={isVersusMode ? turnTimerLabel : null}
        turnTimerSeconds={isVersusMode ? turnTimeLeft : null}
        activeCategoryTypes={activeCategoryTypes}
        rowCategory={selectedRowCategory}
        colCategory={selectedColCategory}
        onSelect={handleGameSelect}
        onQueryChange={setSearchQueryDraft}
        onClose={() => {
          setSelectedCell(null)
          setSearchQueryDraft('')
        }}
      />

      {!isVersusMode && showResults && (
        <ResultsModal
          isOpen={showResults}
          onClose={() => setShowResults(false)}
          guesses={guesses}
          puzzleId={puzzle.id}
          puzzleDate={puzzle.date}
          rowCategories={puzzle.row_categories}
          colCategories={puzzle.col_categories}
          isDaily={mode === 'daily'}
          onPlayAgain={handleNewGame}
        />
      )}

      {mode === 'daily' && showDailyHistory && (
        <DailyHistoryModal
          isOpen
          onClose={() => setShowDailyHistory(false)}
          entries={dailyArchiveEntries}
          isLoading={dailyArchiveLoading}
          errorMessage={dailyArchiveError}
          currentDate={puzzle.date}
          onSelect={handleDailyArchiveSelect}
        />
      )}

      {showHowToPlay && (
        <HowToPlayModal
          isOpen
          onClose={() => setShowHowToPlay(false)}
          mode={mode}
          minimumCellOptions={resolvedMinimumCellOptions}
          validationStatus={puzzle.validation_status}
          dailyResetLabel={dailyResetLabel}
        />
      )}

      {showAchievements && <AchievementsModal isOpen onClose={() => setShowAchievements(false)} />}

      {showPracticeSetup && (
        <VersusSetupModal
          mode="practice"
          isOpen
          onClose={() => setShowPracticeSetup(false)}
          errorMessage={practiceSetupError}
          filters={practiceCategoryFilters}
          stealRule="off"
          timerOption="none"
          disableDraws={false}
          objectionRule="off"
          minimumValidOptionsDefault={minimumValidOptionsDefault}
          minimumValidOptionsOverride={practiceMinimumValidOptions}
          onApply={handleApplyPracticeFilters}
        />
      )}

      {showVersusSetup && (
        <VersusSetupModal
          isOpen
          onClose={() => {
            pendingVersusSetupIntentRef.current = null
            setShowVersusSetup(false)
          }}
          mode="versus"
          errorMessage={versusSetupError}
          filters={versusCategoryFilters}
          stealRule={versusStealRule}
          timerOption={versusTimerOption}
          disableDraws={versusDisableDraws}
          objectionRule={versusObjectionRule}
          minimumValidOptionsDefault={minimumValidOptionsDefault}
          minimumValidOptionsOverride={versusMinimumValidOptions}
          onApply={handleApplyVersusFilters}
        />
      )}

      {showVersusObjectionModal ? (
        <VersusObjectionModal
          isOpen
          onClose={handleCloseDetailModal}
          guess={detailGuess}
          rowCategory={detailRowCategory}
          colCategory={detailColCategory}
          onObjection={handleObjection}
          objectionPending={objectionPending}
          objectionVerdict={objectionVerdict}
          objectionExplanation={objectionExplanation}
          objectionDisabled={objectionDisabled}
          objectionDisabledLabel={objectionDisabledLabel}
        />
      ) : (
        <GuessDetailsModal
          isOpen={
            (detailCell !== null && detailGuess !== null) || pendingVersusObjectionReview !== null
          }
          onClose={handleCloseDetailModal}
          guess={detailGuess}
          rowCategory={detailRowCategory}
          colCategory={detailColCategory}
          onObjection={handleObjection}
          objectionPending={objectionPending}
          objectionVerdict={objectionVerdict}
          objectionExplanation={objectionExplanation}
          objectionDisabled={objectionDisabled}
          objectionDisabledLabel={objectionDisabledLabel}
        />
      )}

      {onlineLobbyEl}

      {/* Footer */}
      <footer className="max-w-lg mx-auto mt-8 text-center text-xs text-muted-foreground">
        <p>
          Game data from{' '}
          <a
            href="https://www.igdb.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            IGDB
          </a>
        </p>
      </footer>
    </main>
  )
}
