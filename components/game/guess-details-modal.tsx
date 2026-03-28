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

interface GuessDetailsModalProps {
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

function MetadataList({ label, values }: { label: string; values: string[] | undefined }) {
  if (!values || values.length === 0) {
    return null
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{values.join(', ')}</p>
    </div>
  )
}

function formatCategoryType(type: Category['type'] | undefined) {
  if (!type) {
    return ''
  }

  return type.replace(/_/g, ' ')
}

export function GuessDetailsModal({
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
}: GuessDetailsModalProps) {
  if (!guess) {
    return null
  }

  const isSustainedObjection = guess.objectionVerdict === 'sustained'
  const shouldShowObjectionPanel =
    !guess.isCorrect || isSustainedObjection || guess.objectionVerdict === 'overruled'
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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-card border-border">
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
                sizes="(max-width: 768px) 100vw, 500px"
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

          {shouldShowObjectionPanel && (
            <div className="rounded-2xl border border-[#f5b94e]/28 bg-[linear-gradient(180deg,rgba(245,185,78,0.12),rgba(245,185,78,0.04))] px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#ffd46f]">
                    Objection
                  </p>
                  <p className="mt-1 text-sm text-foreground/82">
                    Ask the courtroom judge to review this rejected intersection.
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
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Released</p>
              <p className="mt-1 text-sm text-foreground">{guess.released || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Metacritic
              </p>
              <p className="mt-1 text-sm text-foreground">
                {guess.metacritic !== null && guess.metacritic !== undefined
                  ? guess.metacritic
                  : 'N/A'}
              </p>
            </div>
          </div>

          {guess.gameUrl && (
            <div className="flex justify-start">
              <a
                href={guess.gameUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                View on IGDB
              </a>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <MetadataList label="Platforms" values={guess.platforms} />
            <MetadataList label="Genres" values={guess.genres} />
            <MetadataList label="Developers" values={guess.developers} />
            <MetadataList label="Publishers" values={guess.publishers} />
            <MetadataList label="Keywords" values={guess.tags} />
            <MetadataList label="Game Modes" values={guess.gameModes} />
            <MetadataList label="Perspectives" values={guess.perspectives} />
            <MetadataList label="Themes" values={guess.themes} />
            <MetadataList label="Companies" values={guess.companies} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
