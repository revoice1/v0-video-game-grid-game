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
        'flex rounded-xl border border-border/30 bg-secondary/50 p-3',
        orientation === 'col'
          ? 'flex-col items-center justify-center gap-1 text-center'
          : 'flex-col items-start justify-center gap-1.5 text-left'
      )}
    >
      <span className="text-sm font-bold leading-snug text-foreground text-balance">
        {category.name}
      </span>
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/90">
        {category.type}
      </span>
    </div>
  )
}
