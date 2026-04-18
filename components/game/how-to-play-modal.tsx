'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface HowToPlayModalProps {
  isOpen: boolean
  onClose: () => void
  mode?: 'daily' | 'practice' | 'versus'
  minimumCellOptions?: number | null
  validationStatus?: 'validated' | 'relaxed' | 'unvalidated'
  dailyResetLabel?: string | null
}

function StandardHowToPlay({
  minimumCellOptions,
  validationStatus,
  dailyResetLabel,
}: {
  minimumCellOptions?: number | null
  validationStatus?: 'validated' | 'relaxed' | 'unvalidated'
  dailyResetLabel?: string | null
}) {
  const answerPoolCopy =
    typeof minimumCellOptions === 'number'
      ? validationStatus === 'relaxed'
        ? `We still sanity-check the board, but this one was accepted with a lighter bar. Its thinnest cell currently shows about ${minimumCellOptions} possible answers.`
        : `Every cell is tested before the board goes live. On this puzzle, even the thinnest intersection shows about ${minimumCellOptions} possible answers.`
      : 'Every cell is checked before the board goes live so you are not walking into impossible intersections blind.'
  const resetCopy = dailyResetLabel
    ? `The Daily puzzle refreshes at midnight UTC, which is ${dailyResetLabel} from now in your browser.`
    : 'The Daily puzzle refreshes at midnight UTC.'

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">1</span>
          </div>
          <div>
            <p className="font-medium">Fill the Grid</p>
            <p className="text-sm text-muted-foreground">
              Select a cell and search for a video game that matches BOTH the row and column
              categories.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">2</span>
          </div>
          <div>
            <p className="font-medium">Categories</p>
            <p className="text-sm text-muted-foreground">
              Categories can include platforms, genres, decades, game modes, themes, and
              perspectives. Every answer has to satisfy both clues at once.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">3</span>
          </div>
          <div>
            <p className="font-medium">Answer Pools</p>
            <p className="text-sm text-muted-foreground">{answerPoolCopy}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">4</span>
          </div>
          <div>
            <p className="font-medium">Difficulty Hints</p>
            <p className="text-sm text-muted-foreground">
              Empty cells show a vibe check on how tight the intersection is. Brutal means the pool
              is thin, while Cozy or Feast means you have room to freestyle.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">5</span>
          </div>
          <div>
            <p className="font-medium">Limited Guesses</p>
            <p className="text-sm text-muted-foreground">
              You have 9 guesses total, and every miss still burns one. Reusing the same game in
              multiple cells is not allowed.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">6</span>
          </div>
          <div>
            <p className="font-medium">Objections</p>
            <p className="text-sm text-muted-foreground">
              If a filled square looks wrong, open its details and challenge it with an objection. A
              sustained objection removes the answer; an overruled objection leaves it in place with
              an explanation from the judgment pass.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">7</span>
          </div>
          <div>
            <p className="font-medium">Daily Reset</p>
            <p className="text-sm text-muted-foreground">{resetCopy}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">8</span>
          </div>
          <div>
            <p className="font-medium">Release Tags</p>
            <p className="text-sm text-muted-foreground">
              Search results may show a type tag like Original, Re-release, Remake, Remaster, or
              Port. These are just quick IGDB-based clues about which version you are looking at,
              not a hint about whether an answer is valid.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">9</span>
          </div>
          <div>
            <p className="font-medium">Originals And Ports</p>
            <p className="text-sm text-muted-foreground">
              Same-name ports are often hidden from search to reduce clutter, but a selected game
              can still validate as its original-plus-official-ports family when that helps with
              platform or release-history correctness.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">10</span>
          </div>
          <div>
            <p className="font-medium">Uniqueness Score</p>
            <p className="text-sm text-muted-foreground">
              After completing, see how unique your correct answers were compared to other
              players&apos; correct picks, with misses counting as zero.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function VersusHowToPlay() {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">1</span>
          </div>
          <div>
            <p className="font-medium">Take Turns Claiming Squares</p>
            <p className="text-sm text-muted-foreground">
              X claims squares as X and O claims squares as O. A guess only sticks if the game
              matches both category clues for that cell.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">2</span>
          </div>
          <div>
            <p className="font-medium">Steals Are Limited</p>
            <p className="text-sm text-muted-foreground">
              You can always target a blank square. You can only target an occupied square if it was
              the square your opponent claimed on their last turn.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">3</span>
          </div>
          <div>
            <p className="font-medium">Locks and Stealable Cells</p>
            <p className="text-sm text-muted-foreground">
              Locked cells show a lock badge because they are no longer stealable. The only open
              steal target is the opponent's freshest claim.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">4</span>
          </div>
          <div>
            <p className="font-medium">Steal Rating Rules</p>
            <p className="text-sm text-muted-foreground">
              Steals compare each game's hidden rating. Depending on the custom rule, either the
              lower-rated or higher-rated game wins the square.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              When steals are enabled, versus search favors games with rating or review data so
              those tiebreaks stay meaningful. With steals off, obscure unrated titles can still
              appear.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">5</span>
          </div>
          <div>
            <p className="font-medium">Final Square Tiebreak</p>
            <p className="text-sm text-muted-foreground">
              If X wins by taking the final blank square, O gets one last steal chance on that
              square to even out the first-move advantage.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">6</span>
          </div>
          <div>
            <p className="font-medium">Objections</p>
            <p className="text-sm text-muted-foreground">
              Some versus matches allow a limited number of objections per player. Use one when you
              think a claimed answer does not really fit the square. If the objection is sustained,
              that claim is removed. If it is overruled, the claim stands and the objection is
              spent.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">7</span>
          </div>
          <div>
            <p className="font-medium">Optional Turn Timer</p>
            <p className="text-sm text-muted-foreground">
              If your custom match uses a timer, it shows in the versus HUD. When the clock hits
              zero, the turn expires and play passes immediately.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">8</span>
          </div>
          <div>
            <p className="font-medium">Disable Draws</p>
            <p className="text-sm text-muted-foreground">
              Custom versus matches can disable draws. When that toggle is on, a filled board with
              no line resolves in favor of the player who claimed more cells.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <span className="font-bold text-primary">9</span>
          </div>
          <div>
            <p className="font-medium">Win Condition</p>
            <p className="text-sm text-muted-foreground">
              First to complete any row, column, or diagonal wins the match. If no line appears, the
              match is either a draw or a cell-count tiebreak depending on your custom rules.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function HowToPlayModal({
  isOpen,
  onClose,
  mode = 'daily',
  minimumCellOptions,
  validationStatus,
  dailyResetLabel,
}: HowToPlayModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">
            {mode === 'versus' ? 'How to Play Versus' : 'How to Play'}
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            {mode === 'versus'
              ? 'Rules and reminders for local head-to-head play.'
              : 'Rules and reminders for daily and practice boards.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'versus' ? (
          <VersusHowToPlay />
        ) : (
          <StandardHowToPlay
            minimumCellOptions={minimumCellOptions}
            validationStatus={validationStatus}
            dailyResetLabel={dailyResetLabel}
          />
        )}

        <div className="border-t border-border pt-4">
          <p className="mb-3 text-center text-xs text-muted-foreground">
            Game data powered by IGDB
          </p>
          <div className="mb-4 flex flex-wrap justify-center gap-2">
            <a
              href="/changelog"
              className="inline-flex items-center rounded-full border border-border bg-secondary/30 px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
            >
              Changelog
            </a>
            <a
              href="https://github.com/revoice1/gamegrid/issues/new?template=bug_report.yml"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-border bg-secondary/30 px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
            >
              Report a bug
            </a>
            <a
              href="https://github.com/revoice1/gamegrid/issues/new?template=feature_request.yml"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-border bg-secondary/30 px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
            >
              Request a feature
            </a>
          </div>
          <Button onClick={onClose} className="w-full">
            Got it!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
