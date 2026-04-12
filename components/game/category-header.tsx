'use client'

import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getCategoryTypeLabel,
  getFallbackCategoryDefinition,
} from '@/lib/category-definition-content'
import { getCategoryDisplayName } from '@/lib/category-display'
import { IndexBadge } from '@/components/index-badge'
import type { IndexBadgeSlot } from '@/lib/route-index'
import { cn } from '@/lib/utils'
import type { Category } from '@/lib/types'

interface CategoryHeaderProps {
  category: Category
  orientation: 'row' | 'col'
  clueSlot?: IndexBadgeSlot
}

interface CategoryDefinitionResponse {
  title: string
  typeLabel: string
  description: string
  source: 'fallback'
  sourceLabel: string
}

function CategoryDefinitionDialog({
  category,
  displayName,
  clueSlot,
  open,
  onOpenChange,
}: {
  category: Category
  displayName: string
  clueSlot?: IndexBadgeSlot
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const definition = useMemo<CategoryDefinitionResponse>(
    () => ({
      title: displayName,
      typeLabel: getCategoryTypeLabel(category.type),
      ...getFallbackCategoryDefinition(category),
    }),
    [category, displayName]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-3 text-left">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {definition.typeLabel}
            </span>
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              {definition.sourceLabel}
            </span>
          </div>
          <DialogTitle className="text-xl">{displayName}</DialogTitle>
          <DialogDescription className="sr-only">
            Definition for the {category.type} category {displayName}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-border/70 bg-secondary/35 p-4">
          <p className="text-sm leading-6 text-foreground/90">{definition.description}</p>
          {clueSlot && (
            <div className="mt-4 flex justify-end">
              <IndexBadge slot={clueSlot} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function CategoryHeader({ category, orientation }: CategoryHeaderProps) {
  const displayName = getCategoryDisplayName(category)

  return (
    <div
      className={cn(
        'category-header flex rounded-lg border border-border/50 p-3 backdrop-blur-sm',
        orientation === 'col'
          ? 'flex-col items-center justify-center gap-1 text-center'
          : 'flex-col items-start justify-center gap-1.5 text-left'
      )}
    >
      <span className="text-xs text-muted-foreground capitalize">{category.type}</span>
      <span className="text-sm font-semibold leading-snug text-foreground text-balance">
        {displayName}
      </span>
    </div>
  )
}

export function CategoryHeaderSimple({ category, orientation, clueSlot }: CategoryHeaderProps) {
  const displayName = getCategoryDisplayName(category)
  const typeLabel = getCategoryTypeLabel(category.type)
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title={`View definition for ${displayName}`}
        className={cn(
          'flex h-full min-w-0 w-full overflow-hidden rounded-xl border border-slate-300/55 bg-secondary/60 p-3 transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:border-slate-600/55',
          orientation === 'col'
            ? 'border-b-0 flex-col items-center justify-center gap-1 text-center max-sm:gap-0.5 max-sm:px-2 max-sm:py-2'
            : 'border-r-0 flex-col items-start justify-center gap-1.5 text-left max-sm:gap-1 max-sm:px-2 max-sm:py-2'
        )}
      >
        <span
          className={cn(
            'block w-full font-bold text-sm leading-snug text-foreground text-balance',
            orientation === 'col'
              ? 'max-sm:text-[10px] max-sm:leading-tight max-sm:text-pretty'
              : 'max-sm:text-[9px] max-sm:leading-[1.15] max-sm:text-pretty'
          )}
        >
          {displayName}
        </span>
        <span
          className={cn(
            'block w-full text-[10px] uppercase tracking-[0.16em] text-muted-foreground/90',
            orientation === 'col'
              ? 'max-sm:text-[8px] max-sm:tracking-[0.08em]'
              : 'max-sm:text-[8px] max-sm:tracking-[0.04em]'
          )}
        >
          {typeLabel}
        </span>
      </button>
      <CategoryDefinitionDialog
        category={category}
        displayName={displayName}
        clueSlot={clueSlot}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  )
}
