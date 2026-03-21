'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ACHIEVEMENTS,
  loadUnlockedAchievementEntries,
  mergeUnlockedAchievementImages,
} from '@/lib/achievements'
import { EASTER_EGGS } from '@/lib/easter-eggs'
import { useEffect, useState } from 'react'

interface AchievementsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AchievementsModal({ isOpen, onClose }: AchievementsModalProps) {
  const [unlockedAchievementIds, setUnlockedAchievementIds] = useState<string[]>([])
  const [achievementImageMap, setAchievementImageMap] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const entries = loadUnlockedAchievementEntries()
    const unlockedIds = entries.map((entry) => entry.id)
    setUnlockedAchievementIds(unlockedIds)
    setAchievementImageMap(
      new Map(
        entries
          .filter((entry): entry is { id: string; imageUrl: string } => Boolean(entry.imageUrl))
          .map((entry) => [entry.id, entry.imageUrl])
      )
    )

    const eeIds = new Set(EASTER_EGGS.map((egg) => egg.achievementId))
    const needsImages = entries
      .filter((entry) => eeIds.has(entry.id) && !entry.imageUrl)
      .map((entry) => entry.id)

    if (needsImages.length === 0) {
      return
    }

    const controller = new AbortController()

    fetch('/api/achievement-covers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achievementIds: needsImages }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const images = (payload?.images ?? {}) as Record<string, string | null>
        const updatedEntries = mergeUnlockedAchievementImages(images)
        setUnlockedAchievementIds(updatedEntries.map((entry) => entry.id))
        setAchievementImageMap(
          new Map(
            updatedEntries
              .filter((entry): entry is { id: string; imageUrl: string } => Boolean(entry.imageUrl))
              .map((entry) => [entry.id, entry.imageUrl])
          )
        )
      })
      .catch(() => undefined)

    return () => controller.abort()
  }, [isOpen])

  const unlockedAchievementSet = new Set(unlockedAchievementIds)
  const unlockedCount = ACHIEVEMENTS.filter((achievement) =>
    unlockedAchievementSet.has(achievement.id)
  ).length

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">Achievements</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-xl border border-border bg-secondary/20 p-4 text-center">
            <p className="text-3xl font-bold text-primary">
              {unlockedCount}/{ACHIEVEMENTS.length}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Unlock easter eggs and perfect runs to grow your collection.
            </p>
          </div>

          <div className="grid gap-2">
            {ACHIEVEMENTS.map((achievement) => {
              const isUnlocked = unlockedAchievementSet.has(achievement.id)
              const imageUrl = achievementImageMap.get(achievement.id)
              const isPerfectGrid = achievement.id === 'perfect-grid'

              return (
                <div
                  key={achievement.id}
                  className={cn(
                    'rounded-lg border px-3 py-3 transition-colors',
                    isUnlocked
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-border bg-background/40'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={cn(
                          'flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border',
                          isUnlocked
                            ? 'border-primary/30 bg-primary/15'
                            : 'border-border bg-background/70'
                        )}
                      >
                        {isUnlocked && imageUrl ? (
                          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : isUnlocked && isPerfectGrid ? (
                          <svg
                            viewBox="0 0 24 24"
                            className={cn(
                              'h-8 w-8',
                              isUnlocked ? 'text-primary' : 'text-muted-foreground'
                            )}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          >
                            <path d="M7 6h10v2a5 5 0 01-10 0V6Z" />
                            <path d="M5 6H3c0 3 1.5 5 4 5" />
                            <path d="M19 6h2c0 3-1.5 5-4 5" />
                            <path d="M10 13h4v3h-4z" />
                            <path d="M8 19h8" />
                          </svg>
                        ) : (
                          <span
                            className={cn(
                              'text-lg font-black uppercase',
                              isUnlocked ? 'text-primary' : 'text-muted-foreground'
                            )}
                          >
                            {achievement.title.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium',
                            isUnlocked ? 'text-foreground' : 'text-muted-foreground'
                          )}
                        >
                          {achievement.title}
                        </p>
                        {isUnlocked && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {achievement.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div
                      className={cn(
                        'rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-[0.14em]',
                        isUnlocked
                          ? 'border-primary/30 bg-primary/15 text-primary'
                          : 'border-border bg-background/70 text-muted-foreground'
                      )}
                    >
                      {isUnlocked ? 'Unlocked' : 'Locked'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
