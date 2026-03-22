import type { Category } from './types'
import { getFallbackCategoryDefinition } from './category-definition-content'
import { getIGDBPlatformSummary } from './igdb'

export interface CategoryDefinition {
  description: string
  source: 'igdb' | 'fallback'
  sourceLabel: string
}

export async function getCategoryDefinition(category: Category): Promise<CategoryDefinition> {
  const fallbackDefinition = getFallbackCategoryDefinition(category)

  if (category.type === 'platform') {
    const platformId =
      typeof category.id === 'number' ? category.id : Number.parseInt(String(category.id), 10)

    if (Number.isFinite(platformId)) {
      const summary = await getIGDBPlatformSummary(platformId)
      if (summary) {
        return {
          description: summary,
          source: 'igdb',
          sourceLabel: 'IGDB',
        }
      }
    }

    return fallbackDefinition
  }

  return fallbackDefinition
}
