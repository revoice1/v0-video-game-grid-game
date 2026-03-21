'use client'

import { cn } from '@/lib/utils'
import type { Category } from '@/lib/types'

interface CategoryHeaderProps {
  category: Category
  orientation: 'row' | 'col'
}

export function CategoryHeader({ category, orientation }: CategoryHeaderProps) {
  return (
    <div
      className={cn(
        'category-header flex rounded-lg border border-border/50 p-3 backdrop-blur-sm',
        orientation === 'col'
          ? 'flex-col items-center justify-center gap-1 text-center'
          : 'flex-col items-start justify-center gap-1.5 text-left'
      )}
    >
      <span className="text-xs text-muted-foreground capitalize">
        {category.type}
      </span>
      <span className="text-sm font-semibold leading-snug text-foreground text-balance">
        {category.name}
      </span>
    </div>
  )
}

export function CategoryHeaderSimple({ category, orientation }: CategoryHeaderProps) {
  return (
    <div
      className={cn(
        'min-w-0 overflow-hidden rounded-xl border border-border/30 bg-secondary/50 p-3',
        orientation === 'col'
          ? 'flex-col items-center justify-center gap-1 text-center max-sm:gap-0.5 max-sm:px-2 max-sm:py-2'
          : 'flex-col items-start justify-center gap-1.5 text-left max-sm:gap-1 max-sm:px-2 max-sm:py-2'
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
        {category.name}
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
