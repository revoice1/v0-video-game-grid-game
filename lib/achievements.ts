import { EASTER_EGGS } from './easter-eggs'

export interface AchievementDefinition {
  id: string
  title: string
  description: string
}

export interface UnlockedAchievementEntry {
  id: string
  imageUrl?: string | null
}

const ACHIEVEMENTS_STORAGE_KEY = 'gamegrid_achievements'

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'perfect-grid',
    title: 'Perfect Grid',
    description: 'Finish a board with a flawless 9/9.',
  },
  ...EASTER_EGGS.map(({ achievementId, achievementTitle, achievementDescription }) => ({
    id: achievementId,
    title: achievementTitle,
    description: achievementDescription,
  })),
]

function normalizeUnlockedAchievements(parsed: unknown): UnlockedAchievementEntry[] {
  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed.flatMap((value) => {
    if (typeof value === 'string') {
      return [{ id: value }]
    }

    if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
      return [
        {
          id: value.id,
          imageUrl:
            'imageUrl' in value && typeof value.imageUrl === 'string' ? value.imageUrl : null,
        },
      ]
    }

    return []
  })
}

export function loadUnlockedAchievementEntries(): UnlockedAchievementEntry[] {
  if (typeof window === 'undefined') {
    return []
  }

  const stored = window.localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY)

  if (!stored) {
    return []
  }

  try {
    const parsed = JSON.parse(stored) as unknown
    return normalizeUnlockedAchievements(parsed)
  } catch {
    return []
  }
}

export function saveUnlockedAchievementEntries(entries: UnlockedAchievementEntry[]): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(entries))
}

export function mergeUnlockedAchievementImages(
  images: Record<string, string | null>
): UnlockedAchievementEntry[] {
  const entries = loadUnlockedAchievementEntries()
  if (entries.length === 0) {
    return entries
  }

  const updated = entries.map((entry) => {
    const nextImage = images[entry.id]
    if (typeof nextImage === 'string' && nextImage.length > 0) {
      return { ...entry, imageUrl: nextImage }
    }
    return entry
  })

  saveUnlockedAchievementEntries(updated)
  return updated
}

export function loadUnlockedAchievementIds(): string[] {
  return loadUnlockedAchievementEntries().map((entry) => entry.id)
}

export function loadUnlockedAchievementImageMap(): Map<string, string> {
  return new Map(
    loadUnlockedAchievementEntries()
      .filter(
        (entry): entry is UnlockedAchievementEntry & { imageUrl: string } =>
          typeof entry.imageUrl === 'string' && entry.imageUrl.length > 0
      )
      .map((entry) => [entry.id, entry.imageUrl])
  )
}

export function loadUnlockedAchievements(): AchievementDefinition[] {
  const unlockedIds = new Set(loadUnlockedAchievementIds())
  return ACHIEVEMENTS.filter((achievement) => unlockedIds.has(achievement.id))
}

export function unlockAchievement(
  id: string,
  options?: { imageUrl?: string | null }
): {
  unlocked: boolean
  achievement?: AchievementDefinition
} {
  const achievement = ACHIEVEMENTS.find((entry) => entry.id === id)

  if (!achievement || typeof window === 'undefined') {
    return { unlocked: false }
  }

  const unlockedEntries = loadUnlockedAchievementEntries()
  const unlockedIds = new Set(unlockedEntries.map((entry) => entry.id))

  if (unlockedIds.has(id)) {
    return { unlocked: false, achievement }
  }

  unlockedEntries.push({
    id,
    imageUrl: options?.imageUrl ?? null,
  })
  window.localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(unlockedEntries))

  return { unlocked: true, achievement }
}
