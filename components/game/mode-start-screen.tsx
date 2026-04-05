'use client'

import { useEffect, useState } from 'react'
import { GameHeader } from './game-header'
import { HowToPlayModal } from './how-to-play-modal'
import { AchievementsModal } from './achievements-modal'
import {
  VersusSetupModal,
  type VersusCategoryFilters,
  type VersusObjectionRule,
  type VersusStealRule,
  type VersusTurnTimerOption,
} from './versus-setup-modal'

type GameMode = 'practice' | 'versus'
type TicTacToePlayer = 'x' | 'o'
type VersusStartSurface = 'local' | 'online'
type OnlineStartAction = 'host' | 'join'

interface ModeStartScreenProps {
  mode: GameMode
  guessesRemaining: number
  score: number
  currentPlayer: TicTacToePlayer
  winner: TicTacToePlayer | 'draw' | null
  versusRecord: { xWins: number; oWins: number }
  isHowToPlayOpen: boolean
  isAchievementsOpen: boolean
  hasActiveCustomSetup: boolean
  minimumCellOptions: number | null
  dailyResetLabel: string
  showPracticeSetup: boolean
  showVersusSetup: boolean
  practiceSetupError: string | null
  versusSetupError: string | null
  practiceCategoryFilters: VersusCategoryFilters
  practiceMinimumValidOptions: number | null
  versusCategoryFilters: VersusCategoryFilters
  versusMinimumValidOptions: number | null
  minimumValidOptionsDefault: number
  versusStealRule: VersusStealRule
  versusTimerOption: VersusTurnTimerOption
  versusDisableDraws: boolean
  versusObjectionRule: VersusObjectionRule
  versusObjectionsUsed?: { x: number; o: number }
  onModeChange: (mode: 'daily' | 'practice' | 'versus') => void
  onAchievementsOpen: () => void
  onAchievementsClose: () => void
  onHowToPlayOpen: () => void
  onHowToPlayClose: () => void
  onOpenPracticeSetup: () => void
  onOpenVersusSetup: () => void
  onClosePracticeSetup: () => void
  onCloseVersusSetup: () => void
  onStartStandard: () => void
  onHostOnlineStandardMatch?: () => void
  onHostOnlineCustomMatch?: () => void
  onJoinOnlineMatch?: () => void
  onApplyPracticeFilters: (
    filters: VersusCategoryFilters,
    stealRule: VersusStealRule,
    timerOption: VersusTurnTimerOption,
    disableDraws: boolean,
    objectionRule: VersusObjectionRule,
    minimumValidOptionsOverride: number | null
  ) => void
  onApplyVersusFilters: (
    filters: VersusCategoryFilters,
    stealRule: VersusStealRule,
    timerOption: VersusTurnTimerOption,
    disableDraws: boolean,
    objectionRule: VersusObjectionRule,
    minimumValidOptionsOverride: number | null
  ) => void
}

export function ModeStartScreen({
  mode,
  guessesRemaining,
  score,
  currentPlayer,
  winner,
  versusRecord,
  isHowToPlayOpen,
  isAchievementsOpen,
  hasActiveCustomSetup,
  minimumCellOptions,
  dailyResetLabel,
  showPracticeSetup,
  showVersusSetup,
  practiceSetupError,
  versusSetupError,
  practiceCategoryFilters,
  practiceMinimumValidOptions,
  versusCategoryFilters,
  versusMinimumValidOptions,
  minimumValidOptionsDefault,
  versusStealRule,
  versusTimerOption,
  versusDisableDraws,
  versusObjectionRule,
  versusObjectionsUsed = { x: 0, o: 0 },
  onModeChange,
  onAchievementsOpen,
  onAchievementsClose,
  onHowToPlayOpen,
  onHowToPlayClose,
  onOpenPracticeSetup,
  onOpenVersusSetup,
  onClosePracticeSetup,
  onCloseVersusSetup,
  onStartStandard,
  onHostOnlineStandardMatch,
  onHostOnlineCustomMatch,
  onJoinOnlineMatch,
  onApplyPracticeFilters,
  onApplyVersusFilters,
}: ModeStartScreenProps) {
  const isPracticeStart = mode === 'practice'
  const [versusSurface, setVersusSurface] = useState<VersusStartSurface | null>(null)
  const [onlineAction, setOnlineAction] = useState<OnlineStartAction | null>(null)

  useEffect(() => {
    if (!isPracticeStart) return
    setVersusSurface(null)
    setOnlineAction(null)
  }, [isPracticeStart])

  const showVersusBranchChooser = !isPracticeStart && versusSurface === null
  const showLocalVersusChoices = !isPracticeStart && versusSurface === 'local'
  const showOnlineRoleChoices =
    !isPracticeStart && versusSurface === 'online' && onlineAction === null
  const showOnlineHostChoices =
    !isPracticeStart && versusSurface === 'online' && onlineAction === 'host'
  const showBackButton = !isPracticeStart && (versusSurface !== null || onlineAction !== null)

  const headerDescription = (() => {
    if (isPracticeStart) {
      return 'Launch a standard solo board right away, or customize the category pool first.'
    }
    if (showVersusBranchChooser) {
      return 'Start with local or online, then we will guide you through the rest.'
    }
    if (showOnlineRoleChoices) {
      return 'Choose whether you are creating a room or joining one from a friend.'
    }
    if (showOnlineHostChoices) {
      return 'Pick the default rules or tune a custom setup before hosting your room.'
    }
    return 'Pick a standard local match or customize the rules first.'
  })()

  const handleBack = () => {
    if (onlineAction !== null) {
      setOnlineAction(null)
      return
    }

    if (versusSurface !== null) {
      setVersusSurface(null)
    }
  }

  return (
    <main id="top" className="min-h-screen px-4 py-6">
      <div className="mx-auto w-full max-w-xl">
        <GameHeader
          mode={mode}
          guessesRemaining={guessesRemaining}
          score={score}
          currentPlayer={currentPlayer}
          winner={winner}
          versusRecord={versusRecord}
          versusObjectionRule={versusObjectionRule}
          versusObjectionsUsed={versusObjectionsUsed}
          isHowToPlayOpen={isHowToPlayOpen}
          isAchievementsOpen={isAchievementsOpen}
          hasActiveCustomSetup={hasActiveCustomSetup}
          onModeChange={onModeChange}
          onAchievements={onAchievementsOpen}
          onHowToPlay={onHowToPlayOpen}
          onNewGame={undefined}
          onCustomizeGame={isPracticeStart ? onOpenPracticeSetup : onOpenVersusSetup}
        />
      </div>

      <div className="mx-auto mt-16 max-w-lg rounded-3xl border border-border bg-card/80 p-6 text-center shadow-xl backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          {isPracticeStart ? 'Practice Mode' : 'Versus Mode'}
        </p>
        <h2 className="mt-3 text-2xl font-bold text-foreground">How do you want to play?</h2>
        <p className="mt-2 text-sm text-muted-foreground">{headerDescription}</p>

        {showBackButton && (
          <div className="mt-5 flex justify-center">
            <button
              onClick={handleBack}
              className="rounded-full border border-border bg-secondary/30 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:bg-secondary/55 hover:text-foreground"
            >
              Back
            </button>
          </div>
        )}

        {isPracticeStart && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              onClick={onStartStandard}
              className="rounded-2xl border border-border bg-secondary/40 px-4 py-4 text-left transition-colors hover:bg-secondary/65"
            >
              <p className="text-sm font-semibold text-foreground">Standard Puzzle</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Use the default solo category pool and jump right in.
              </p>
            </button>
            <button
              onClick={onOpenPracticeSetup}
              className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-4 text-left transition-colors hover:bg-primary/15"
            >
              <p className="text-sm font-semibold text-foreground">Custom Puzzle</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick the families you want in the solo category pool before generating.
              </p>
            </button>
          </div>
        )}

        {showVersusBranchChooser && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setVersusSurface('local')}
              className="rounded-2xl border border-border bg-secondary/40 px-4 py-4 text-left transition-colors hover:bg-secondary/65"
            >
              <p className="text-sm font-semibold text-foreground">Local</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Both players on this device with quick pass-and-play turns.
              </p>
            </button>
            <button
              onClick={() => setVersusSurface('online')}
              className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-4 text-left transition-colors hover:bg-sky-500/15"
            >
              <p className="text-sm font-semibold text-foreground">Online</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Challenge a friend in a shared room and sync the same board live.
              </p>
            </button>
          </div>
        )}

        {showLocalVersusChoices && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              onClick={onStartStandard}
              className="rounded-2xl border border-border bg-secondary/40 px-4 py-4 text-left transition-colors hover:bg-secondary/65"
            >
              <p className="text-sm font-semibold text-foreground">Standard Local Match</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Default local rules and category pool.
              </p>
            </button>
            <button
              onClick={onOpenVersusSetup}
              className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-4 text-left transition-colors hover:bg-primary/15"
            >
              <p className="text-sm font-semibold text-foreground">Custom Local Match</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose category families, steal rules, objections, and timer settings.
              </p>
            </button>
          </div>
        )}

        {showOnlineRoleChoices && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {onHostOnlineStandardMatch && (
              <button
                onClick={() => setOnlineAction('host')}
                className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-4 text-left transition-colors hover:bg-sky-500/15"
              >
                <p className="text-sm font-semibold text-foreground">Host Match</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create a room, then decide whether you want standard or custom rules.
                </p>
              </button>
            )}
            {onJoinOnlineMatch && (
              <button
                onClick={onJoinOnlineMatch}
                className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-4 text-left transition-colors hover:bg-sky-500/15"
              >
                <p className="text-sm font-semibold text-foreground">Join Match</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter a friend&apos;s room code and use the host&apos;s current rules.
                </p>
              </button>
            )}
          </div>
        )}

        {showOnlineHostChoices && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {onHostOnlineStandardMatch && (
              <button
                onClick={onHostOnlineStandardMatch}
                className="rounded-2xl border border-border bg-secondary/40 px-4 py-4 text-left transition-colors hover:bg-secondary/65"
              >
                <p className="text-sm font-semibold text-foreground">Standard Online Match</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Host a room with the default online rules and start sharing right away.
                </p>
              </button>
            )}
            {onHostOnlineCustomMatch && (
              <button
                onClick={onHostOnlineCustomMatch}
                className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-4 text-left transition-colors hover:bg-primary/15"
              >
                <p className="text-sm font-semibold text-foreground">Custom Online Match</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tune the rule set first, then create the room with that setup.
                </p>
              </button>
            )}
          </div>
        )}
      </div>

      <VersusSetupModal
        isOpen={showPracticeSetup}
        onClose={onClosePracticeSetup}
        mode="practice"
        errorMessage={practiceSetupError}
        filters={practiceCategoryFilters}
        stealRule="off"
        timerOption="none"
        disableDraws={false}
        objectionRule="off"
        minimumValidOptionsDefault={minimumValidOptionsDefault}
        minimumValidOptionsOverride={practiceMinimumValidOptions}
        onApply={onApplyPracticeFilters}
      />

      <VersusSetupModal
        isOpen={showVersusSetup}
        onClose={onCloseVersusSetup}
        mode="versus"
        errorMessage={versusSetupError}
        filters={versusCategoryFilters}
        stealRule={versusStealRule}
        timerOption={versusTimerOption}
        disableDraws={versusDisableDraws}
        objectionRule={versusObjectionRule}
        minimumValidOptionsDefault={minimumValidOptionsDefault}
        minimumValidOptionsOverride={versusMinimumValidOptions}
        onApply={onApplyVersusFilters}
      />

      <AchievementsModal isOpen={isAchievementsOpen} onClose={onAchievementsClose} />

      <HowToPlayModal
        isOpen={isHowToPlayOpen}
        onClose={onHowToPlayClose}
        mode={mode}
        minimumCellOptions={minimumCellOptions}
        validationStatus={undefined}
        dailyResetLabel={dailyResetLabel}
      />
    </main>
  )
}
