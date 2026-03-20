'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface HowToPlayModalProps {
  isOpen: boolean
  onClose: () => void
  minimumCellOptions?: number | null
  validationStatus?: 'validated' | 'relaxed' | 'unvalidated'
  dailyResetLabel?: string | null
}

export function HowToPlayModal({
  isOpen,
  onClose,
  minimumCellOptions,
  validationStatus,
  dailyResetLabel,
}: HowToPlayModalProps) {
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">
            How to Play
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">1</span>
              </div>
              <div>
                <p className="font-medium">Fill the Grid</p>
                <p className="text-sm text-muted-foreground">
                  Select a cell and search for a video game that matches BOTH the row and column categories.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">2</span>
              </div>
              <div>
                <p className="font-medium">Categories</p>
                <p className="text-sm text-muted-foreground">
                  Categories can include platforms, genres, decades, game modes, themes, and perspectives. Every answer has to satisfy both clues at once.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">3</span>
              </div>
              <div>
                <p className="font-medium">Answer Pools</p>
                <p className="text-sm text-muted-foreground">
                  {answerPoolCopy}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">4</span>
              </div>
              <div>
                <p className="font-medium">Difficulty Hints</p>
                <p className="text-sm text-muted-foreground">
                  Empty cells show a vibe check on how tight the intersection is. Brutal means the pool is thin, while Cozy or Feast means you have room to freestyle.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">5</span>
              </div>
              <div>
                <p className="font-medium">Limited Guesses</p>
                <p className="text-sm text-muted-foreground">
                  You have 9 guesses total, and every miss still burns one. Reusing the same game in multiple cells is not allowed.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">6</span>
              </div>
              <div>
                <p className="font-medium">Daily Reset</p>
                <p className="text-sm text-muted-foreground">
                  {resetCopy}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">7</span>
              </div>
              <div>
                <p className="font-medium">Release Tags</p>
                <p className="text-sm text-muted-foreground">
                  Search results may show a type tag like Original, Re-release, Remake, Remaster, or Port. These are just quick IGDB-based clues about which version you are looking at, not a hint about whether an answer is valid.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">8</span>
              </div>
              <div>
                <p className="font-medium">Rarity Score</p>
                <p className="text-sm text-muted-foreground">
                  After completing, see how unique your answers were compared to other players!
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-center text-xs text-muted-foreground mb-3">
              Game data powered by IGDB
            </p>
            <Button onClick={onClose} className="w-full">
              Got it!
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
