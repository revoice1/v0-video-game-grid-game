'use client'

import { cn } from '@/lib/utils'
import type { Category } from '@/lib/types'

interface CategoryHeaderProps {
  category: Category
  orientation: 'row' | 'col'
}

const categoryIcons: Record<string, string> = {
  platform: '🎮',
  genre: '🏷️',
  developer: '👨‍💻',
  publisher: '🏢',
  decade: '📅',
  tag: '🔖',
}

export function CategoryHeader({ category, orientation }: CategoryHeaderProps) {
  return (
    <div
      className={cn(
        'category-header flex items-center justify-center p-2 rounded-lg',
        'border border-border/50 backdrop-blur-sm',
        orientation === 'col' && 'flex-col gap-1'
      )}
    >
      <span className="text-xs text-muted-foreground capitalize">
        {category.type}
      </span>
      <span 
        className={cn(
          'font-semibold text-foreground text-center leading-tight',
          orientation === 'col' ? 'text-sm' : 'text-sm ml-1.5'
        )}
      >
        {category.name}
      </span>
    </div>
  )
}

// Simple header without icons (cleaner look)
export function CategoryHeaderSimple({ category, orientation }: CategoryHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center p-3 rounded-lg',
        'bg-secondary/50 border border-border/30',
        orientation === 'col' && 'flex-col gap-0.5'
      )}
    >
      <span 
        className={cn(
          'font-bold text-foreground text-center leading-tight text-balance',
          orientation === 'col' ? 'text-sm' : 'text-sm'
        )}
      >
        {category.name}
      </span>
      <span className="text-[10px] text-muted-foreground capitalize">
        {category.type}
      </span>
    </div>
  )
}
