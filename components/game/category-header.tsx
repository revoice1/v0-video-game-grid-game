'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { cn } from '@/lib/utils'
import type { Category } from '@/lib/types'

interface CategoryHeaderProps {
  category: Category
  orientation: 'row' | 'col'
}

function getCategoryDisplayName(category: Category) {
  if (category.type === 'game_mode' && category.name === 'Massively Multiplayer Online (MMO)') {
    return 'MMO'
  }

  if (category.type === 'genre' && category.name === 'Role-playing (RPG)') {
    return 'RPG'
  }

  return category.name
}

interface CategoryDefinitionResponse {
  title: string
  typeLabel: string
  description: string
  source: 'igdb' | 'fallback'
  sourceLabel: string
}

function buildCategoryDefinitionUrl(category: Category) {
  const params = new URLSearchParams({
    type: category.type,
    id: String(category.id),
    name: category.name,
  })

  if (category.slug) {
    params.set('slug', category.slug)
  }

  return `/api/category-definition?${params.toString()}`
}

function CategoryDefinitionDialog({
  category,
  displayName,
  open,
  onOpenChange,
}: {
  category: Category
  displayName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const initialDefinition = useMemo<CategoryDefinitionResponse>(
    () => ({
      title: category.name,
      typeLabel: getCategoryTypeLabel(category.type),
      ...getFallbackCategoryDefinition(category),
    }),
    [category]
  )
  const [definition, setDefinition] = useState<CategoryDefinitionResponse>(initialDefinition)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const definitionUrl = useMemo(() => buildCategoryDefinitionUrl(category), [category])
  const shouldHydrateFromApi = category.type === 'platform'

  useEffect(() => {
    setDefinition(initialDefinition)
    setError(null)
    setIsLoading(false)
  }, [initialDefinition])

  useEffect(() => {
    if (!open || isLoading || !shouldHydrateFromApi) {
      return
    }

    let isCancelled = false

    const loadDefinition = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(definitionUrl)
        if (!response.ok) {
          throw new Error('Failed to load definition')
        }

        const payload = (await response.json()) as CategoryDefinitionResponse
        if (!isCancelled) {
          setDefinition(payload)
          setError(null)
        }
      } catch (loadError) {
        if (!isCancelled) {
          console.error('Failed to load category definition:', loadError)
          setError('Showing local definition.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadDefinition()

    return () => {
      isCancelled = true
    }
  }, [definitionUrl, isLoading, open, shouldHydrateFromApi])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-3 text-left">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {definition.typeLabel}
            </span>
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              {isLoading && shouldHydrateFromApi ? 'Loading' : definition.sourceLabel}
            </span>
          </div>
          <DialogTitle className="text-xl">{displayName}</DialogTitle>
          <DialogDescription className="sr-only">
            Definition for the {category.type} category {displayName}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-border/70 bg-secondary/35 p-4">
          <p className="text-sm leading-6 text-foreground/90">{definition.description}</p>
          {error && <p className="mt-3 text-xs text-muted-foreground">{error}</p>}
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

export function CategoryHeaderSimple({ category, orientation }: CategoryHeaderProps) {
  const displayName = getCategoryDisplayName(category)
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
              ? 'max-sm:text-[10px] max-sm:leading-tight max-sm:[text-wrap:pretty]'
              : 'max-sm:text-[9px] max-sm:leading-[1.15] max-sm:[text-wrap:pretty]'
          )}
        >
          {displayName}
        </span>
        <span
          className={cn(
            'block w-full text-[10px] uppercase tracking-[0.16em] text-muted-foreground/90',
            orientation === 'col'
              ? 'max-sm:text-[9px] max-sm:tracking-[0.08em]'
              : 'max-sm:text-[9px] max-sm:tracking-[0.06em]'
          )}
        >
          {category.type}
        </span>
      </button>
      <CategoryDefinitionDialog
        category={category}
        displayName={displayName}
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  )
}

export function CategoryHeaderStaticLabel({ category, orientation }: CategoryHeaderProps) {
  const displayName = getCategoryDisplayName(category)

  return (
    <div
      className={cn(
        'min-w-0 overflow-hidden rounded-xl border border-slate-300/55 dark:border-slate-600/55 bg-secondary/60 p-3',
        orientation === 'col'
          ? 'border-b-0 flex-col items-center justify-center gap-1 text-center max-sm:gap-0.5 max-sm:px-2 max-sm:py-2'
          : 'border-r-0 flex-col items-start justify-center gap-1.5 text-left max-sm:gap-1 max-sm:px-2 max-sm:py-2'
      )}
    >
      <span
        className={cn(
          'block w-full font-bold text-sm leading-snug text-foreground text-balance',
          orientation === 'col'
            ? 'max-sm:text-[10px] max-sm:leading-tight max-sm:[text-wrap:pretty]'
            : 'max-sm:text-[9px] max-sm:leading-[1.15] max-sm:[text-wrap:pretty]'
        )}
      >
        {displayName}
      </span>
      <span
        className={cn(
          'block w-full text-[10px] uppercase tracking-[0.16em] text-muted-foreground/90',
          orientation === 'col'
            ? 'max-sm:text-[9px] max-sm:tracking-[0.08em]'
            : 'max-sm:text-[9px] max-sm:tracking-[0.06em]'
        )}
      >
        {category.type}
      </span>
    </div>
  )
}
