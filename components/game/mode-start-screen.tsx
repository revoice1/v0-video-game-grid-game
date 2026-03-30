'use client'

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
  versusCategoryFilters: VersusCategoryFilters
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
  onHostOnlineMatch?: () => void
  onJoinOnlineMatch?: () => void
  onApplyPracticeFilters: (
    filters: VersusCategoryFilters,
    stealRule: VersusStealRule,
    timerOption: VersusTurnTimerOption,
    disableDraws: boolean,
    objectionRule: VersusObjectionRule
  ) => void
  onApplyVersusFilters: (
    filters: VersusCategoryFilters,
    stealRule: VersusStealRule,
    timerOption: VersusTurnTimerOption,
    disableDraws: boolean,
    objectionRule: VersusObjectionRule
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
  versusCategoryFilters,
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
  onHostOnlineMatch,
  onJoinOnlineMatch,
  onApplyPracticeFilters,
  onApplyVersusFilters,
}: ModeStartScreenProps) {
  const isPracticeStart = mode === 'practice'

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
        <p className="mt-2 text-sm text-muted-foreground">
          {isPracticeStart
            ? 'Launch a standard solo board right away, or customize the category pool first.'
            : 'Play locally on one device, or challenge a friend online.'}
        </p>

        {/* Local match options */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            onClick={onStartStandard}
            className="rounded-2xl border border-border bg-secondary/40 px-4 py-4 text-left transition-colors hover:bg-secondary/65"
          >
            <p className="text-sm font-semibold text-foreground">
              {isPracticeStart ? 'Standard Puzzle' : 'Local Match'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isPracticeStart
                ? 'Use the default solo category pool and jump right in.'
                : 'Both players on this device, default rules.'}
            </p>
          </button>
          <button
            onClick={isPracticeStart ? onOpenPracticeSetup : onOpenVersusSetup}
            className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-4 text-left transition-colors hover:bg-primary/15"
          >
            <p className="text-sm font-semibold text-foreground">
              {isPracticeStart ? 'Custom Puzzle' : 'Custom Local Match'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isPracticeStart
                ? 'Pick the families you want in the solo category pool before generating.'
                : 'Choose category families, steal rules, and turn timer.'}
            </p>
          </button>
        </div>

        {/* Online match options — only shown for versus */}
        {!isPracticeStart && (onHostOnlineMatch || onJoinOnlineMatch) && (
          <>
            <div className="relative my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                online
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {onHostOnlineMatch && (
                <button
                  onClick={onHostOnlineMatch}
                  className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-4 text-left transition-colors hover:bg-sky-500/15"
                >
                  <p className="text-sm font-semibold text-foreground">Host Online Match</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create a match and share an invite link with a friend.
                  </p>
                </button>
              )}
              {onJoinOnlineMatch && (
                <button
                  onClick={onJoinOnlineMatch}
                  className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-4 text-left transition-colors hover:bg-sky-500/15"
                >
                  <p className="text-sm font-semibold text-foreground">Join Online Match</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enter a match code from a friend&apos;s invite.
                  </p>
                </button>
              )}
            </div>
          </>
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
