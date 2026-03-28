'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Category, CellGuess } from '@/lib/types'
import Image from 'next/image'

interface VersusObjectionModalProps {
  isOpen: boolean
  onClose: () => void
  guess: CellGuess | null
  rowCategory: Category | null
  colCategory: Category | null
  onObjection?: () => void
  objectionPending?: boolean
  objectionVerdict?: 'sustained' | 'overruled' | null
  objectionExplanation?: string | null
  objectionDisabled?: boolean
  objectionDisabledLabel?: string | null
}

function formatCategoryType(type: Category['type'] | undefined) {
  if (!type) {
    return ''
  }

  return type.replace(/_/g, ' ')
}

export function VersusObjectionModal({
  isOpen,
  onClose,
  guess,
  rowCategory,
  colCategory,
  onObjection,
  objectionPending = false,
  objectionVerdict = null,
  objectionExplanation = null,
  objectionDisabled = false,
  objectionDisabledLabel = null,
}: VersusObjectionModalProps) {
  if (!guess) {
    return null
  }

  const isSustainedObjection = guess.objectionVerdict === 'sustained'
  const rowCorrectedByObjection =
    isSustainedObjection && guess.objectionOriginalMatchedRow === false && Boolean(guess.matchedRow)
  const colCorrectedByObjection =
    isSustainedObjection && guess.objectionOriginalMatchedCol === false && Boolean(guess.matchedCol)
  const matchTextClass = (matched: boolean, correctedByObjection: boolean) =>
    matched ? (correctedByObjection ? 'text-[#fb923c]' : 'text-primary') : 'text-destructive'
  const objectionButtonLabel = objectionPending
    ? 'Awaiting judgment...'
    : objectionVerdict === 'sustained'
      ? 'Objection sustained'
      : objectionVerdict === 'overruled'
        ? 'Objection overruled'
        : objectionDisabled
          ? (objectionDisabledLabel ?? 'Objection used')
          : 'Objection!'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle>{guess.gameName}</DialogTitle>
          <DialogDescription>
            {guess.isCorrect
              ? isSustainedObjection
                ? 'This pick counted for the cell after review.'
                : 'This pick counted for the cell.'
              : 'This pick was rejected for the cell.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {guess.gameImage && (
            <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-border">
              <Image
                src={guess.gameImage}
                alt={guess.gameName}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 480px"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {rowCategory?.name}
              </p>
              {rowCategory?.type && (
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
                  {formatCategoryType(rowCategory.type)}
                </p>
              )}
              <p
                className={`mt-2 text-sm font-medium ${matchTextClass(
                  Boolean(guess.matchedRow),
                  rowCorrectedByObjection
                )}`}
              >
                {guess.matchedRow ? 'Matched' : 'Did not match'}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {colCategory?.name}
              </p>
              {colCategory?.type && (
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
                  {formatCategoryType(colCategory.type)}
                </p>
              )}
              <p
                className={`mt-2 text-sm font-medium ${matchTextClass(
                  Boolean(guess.matchedCol),
                  colCorrectedByObjection
                )}`}
              >
                {guess.matchedCol ? 'Matched' : 'Did not match'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#f5b94e]/28 bg-[linear-gradient(180deg,rgba(245,185,78,0.12),rgba(245,185,78,0.04))] px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#ffd46f]">
                  Objection
                </p>
                <p className="mt-1 text-sm text-foreground/82">
                  Review this intersection without exposing the full IGDB metadata during the match.
                </p>
              </div>
              <Button
                type="button"
                onClick={onObjection}
                disabled={objectionPending || objectionDisabled || !onObjection}
                className="bg-[#c46a2d] text-[#fff6ea] hover:bg-[#d97a36]"
              >
                {objectionButtonLabel}
              </Button>
            </div>

            {(objectionVerdict || objectionExplanation) && (
              <div className="mt-3 rounded-xl border border-border/60 bg-background/55 px-3 py-3">
                {objectionVerdict && (
                  <p
                    className={`text-[11px] font-semibold uppercase tracking-[0.26em] ${
                      objectionVerdict === 'sustained' ? 'text-[#fb923c]' : 'text-destructive'
                    }`}
                  >
                    {objectionVerdict === 'sustained' ? 'Sustained' : 'Overruled'}
                  </p>
                )}
                {objectionExplanation && (
                  <p className="mt-1 text-sm text-foreground/78">{objectionExplanation}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
