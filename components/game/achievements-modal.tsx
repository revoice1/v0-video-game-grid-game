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
import { getIndexBadge, ROUTE_ACHIEVEMENT_ID } from '@/lib/route-index'
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
  const achievementsClue = getIndexBadge('achievements')

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
              const isSecretRouteAchievement = achievement.id === ROUTE_ACHIEVEMENT_ID
              const isHiddenLocked = achievement.hidden && !isUnlocked
              const displayTitle = isHiddenLocked ? '???' : achievement.title
              const displayDescription = isHiddenLocked ? null : achievement.description
              const showDescription = isUnlocked && Boolean(displayDescription)

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
                        ) : isSecretRouteAchievement && !isUnlocked ? (
                          <div
                            className={cn(
                              'flex h-9 min-w-[38px] items-center justify-center rounded-md border px-1 font-mono text-[15px] font-black uppercase tracking-[0.08em]',
                              isUnlocked
                                ? 'border-primary/35 bg-primary/14 text-primary'
                                : 'border-border/80 bg-background/75 text-muted-foreground'
                            )}
                            aria-label={`Secret clue ${achievementsClue.index}${achievementsClue.letter}`}
                          >
                            {`${achievementsClue.index}${achievementsClue.letter}`}
                          </div>
                        ) : isSecretRouteAchievement ? (
                          <div
                            className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-md border border-primary/35 bg-[radial-gradient(circle_at_30%_30%,rgba(34,197,94,0.18),transparent_40%),radial-gradient(circle_at_72%_70%,rgba(59,130,246,0.2),transparent_38%),linear-gradient(180deg,rgba(17,24,39,0.98),rgba(10,14,23,0.96))] text-primary shadow-[0_0_24px_rgba(34,197,94,0.16)]"
                            aria-label="Hidden route unlocked"
                          >
                            <div className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-white/10" />
                            <svg
                              viewBox="0 0 24 24"
                              className="relative h-8 w-8 drop-shadow-[0_0_10px_rgba(34,197,94,0.28)]"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M12 3.5 18.5 7v10L12 20.5 5.5 17V7Z" />
                              <path d="M12 3.5V20.5" className="opacity-70" />
                              <path d="M5.5 7 12 10.5 18.5 7" className="opacity-70" />
                              <path d="M9.6 12.2h4.8" />
                              <path d="M10.4 14.9h3.2" />
                              <circle cx="12" cy="8.2" r="1.05" fill="currentColor" stroke="none" />
                            </svg>
                          </div>
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
                            {displayTitle.slice(0, 2)}
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
                          {displayTitle}
                        </p>
                        {showDescription && (
                          <p className="mt-1 text-xs text-muted-foreground">{displayDescription}</p>
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
