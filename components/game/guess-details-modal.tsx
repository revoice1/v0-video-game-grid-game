'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Category, CellGuess } from '@/lib/types'
import Image from 'next/image'

interface GuessDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  guess: CellGuess | null
  rowCategory: Category | null
  colCategory: Category | null
}

function MetadataList({
  label,
  values,
}: {
  label: string
  values: string[] | undefined
}) {
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
}: GuessDetailsModalProps) {
  if (!guess) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle>{guess.gameName}</DialogTitle>
          <DialogDescription>
            {guess.isCorrect ? 'This pick counted for the cell.' : 'This pick was rejected for the cell.'}
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
              <p className={`mt-2 text-sm font-medium ${guess.matchedRow ? 'text-primary' : 'text-destructive'}`}>
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
              <p className={`mt-2 text-sm font-medium ${guess.matchedCol ? 'text-primary' : 'text-destructive'}`}>
                {guess.matchedCol ? 'Matched' : 'Did not match'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Released</p>
              <p className="mt-1 text-sm text-foreground">{guess.released || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Metacritic</p>
              <p className="mt-1 text-sm text-foreground">
                {guess.metacritic !== null && guess.metacritic !== undefined ? guess.metacritic : 'N/A'}
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
