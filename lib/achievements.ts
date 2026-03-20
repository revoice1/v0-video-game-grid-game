export interface AchievementDefinition {
  id: string
  title: string
  description: string
}

const ACHIEVEMENTS_STORAGE_KEY = 'gamegrid_achievements'

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'perfect-grid',
    title: 'Perfect Grid',
    description: 'Finish a board with a flawless 9/9.',
  },
  {
    id: 'chex-mix',
    title: 'Breakfast Defender',
    description: 'Trigger the Chex Quest easter egg.',
  },
  {
    id: 'golden-path',
    title: 'Golden Path',
    description: 'Trigger the Tunic easter egg.',
  },
  {
    id: 'dust-to-dust',
    title: 'Scraps of Memory',
    description: 'Trigger the Phantom Dust easter egg.',
  },
  {
    id: 'snap-happy',
    title: 'You Were Close!',
    description: 'Trigger the Pokemon Snap easter egg.',
  },
]

export function loadUnlockedAchievementIds(): string[] {
  if (typeof window === 'undefined') {
    return []
  }

  const stored = window.localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY)

  if (!stored) {
    return []
  }

  try {
    const parsed = JSON.parse(stored) as unknown
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

export function loadUnlockedAchievements(): AchievementDefinition[] {
  const unlockedIds = new Set(loadUnlockedAchievementIds())
  return ACHIEVEMENTS.filter(achievement => unlockedIds.has(achievement.id))
}

export function unlockAchievement(id: string): { unlocked: boolean; achievement?: AchievementDefinition } {
  const achievement = ACHIEVEMENTS.find(entry => entry.id === id)

  if (!achievement || typeof window === 'undefined') {
    return { unlocked: false }
  }

  const unlockedIds = new Set(loadUnlockedAchievementIds())

  if (unlockedIds.has(id)) {
    return { unlocked: false, achievement }
  }

  unlockedIds.add(id)
  window.localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify([...unlockedIds]))

  return { unlocked: true, achievement }
}
