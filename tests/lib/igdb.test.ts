import { describe, expect, it } from 'vitest'
import {
  buildIGDBWhereClause,
  buildPuzzleCellMetadata,
  getPairRejectionReason,
  igdbGameMatchesCategory,
} from '@/lib/igdb'
import { buildGenerationPlans } from '@/lib/puzzle-generation-plans'
import type { Category, Game } from '@/lib/types'

const baseGame: Game = {
  id: 1,
  name: 'Test Game',
  slug: 'test-game',
  background_image: null,
  released: '2004-11-09',
  metacritic: 90,
  genres: [{ id: 5, name: 'Shooter', slug: 'shooter' }],
  platforms: [{ platform: { id: 11, name: 'Xbox (Original)', slug: 'xbox' } }],
  tags: [{ id: 2071, name: 'Sequel', slug: 'sequel' }],
  igdb: {
    id: 1,
    game_modes: ['Single player'],
    themes: ['Horror'],
    player_perspectives: ['First person'],
    companies: ['Bungie'],
    keywords: ['Sequel'],
  },
}

describe('buildGenerationPlans', () => {
  it('relaxes thresholds instead of making them stricter', () => {
    expect(buildGenerationPlans(3, 12)).toEqual([
      { minValidOptionsPerCell: 3, maxAttempts: 12 },
      { minValidOptionsPerCell: 2, maxAttempts: 6 },
    ])
  })

  it('deduplicates repeated fallback thresholds', () => {
    expect(buildGenerationPlans(2, 12)).toEqual([{ minValidOptionsPerCell: 2, maxAttempts: 12 }])
  })
})

describe('buildIGDBWhereClause', () => {
  it('builds native where clauses for direct IGDB categories', () => {
    expect(buildIGDBWhereClause({ type: 'genre', id: 5, name: 'Shooter' })).toBe('genres = (5)')
    expect(buildIGDBWhereClause({ type: 'theme', id: 19, name: 'Horror' })).toBe('themes = (19)')
  })

  it('returns null for platform aliases that need post-filtering', () => {
    expect(
      buildIGDBWhereClause({
        type: 'platform',
        id: 18,
        name: 'Nintendo Entertainment System',
      })
    ).toBeNull()
  })

  it('builds a decade release-date clause', () => {
    expect(buildIGDBWhereClause({ type: 'decade', id: '2000', name: '2000s' })).toContain(
      'first_release_date != null'
    )
  })
})

describe('getPairRejectionReason', () => {
  it('rejects conflicting solo and multiplayer pairings', () => {
    expect(
      getPairRejectionReason(
        { type: 'game_mode', id: 1, name: 'Single player' },
        { type: 'game_mode', id: 2, name: 'Multiplayer' }
      )
    ).toBe('conflicting solo and multiplayer categories')
  })

  it('rejects incompatible platform and decade pairings', () => {
    expect(
      getPairRejectionReason(
        { type: 'platform', id: 130, name: 'Nintendo Switch' },
        { type: 'decade', id: '1990', name: '1990s' }
      )
    ).toBe('platform is outside its supported decades')
  })

  it('allows reasonable mixed pairings', () => {
    expect(
      getPairRejectionReason(
        { type: 'genre', id: 5, name: 'Shooter' },
        { type: 'theme', id: 19, name: 'Horror' }
      )
    ).toBeNull()
  })
})

describe('igdbGameMatchesCategory', () => {
  it('matches direct platform and genre categories', () => {
    expect(
      igdbGameMatchesCategory(baseGame, { type: 'platform', id: 11, name: 'Xbox (Original)' })
    ).toBe(true)
    expect(igdbGameMatchesCategory(baseGame, { type: 'genre', id: 5, name: 'Shooter' })).toBe(true)
  })

  it('matches categories that rely on IGDB arrays', () => {
    expect(
      igdbGameMatchesCategory(baseGame, { type: 'game_mode', id: 1, name: 'Single player' })
    ).toBe(true)
    expect(igdbGameMatchesCategory(baseGame, { type: 'theme', id: 19, name: 'Horror' })).toBe(true)
    expect(
      igdbGameMatchesCategory(baseGame, { type: 'perspective', id: 1, name: 'First person' })
    ).toBe(true)
  })

  it('matches curated tag categories by keyword id', () => {
    expect(
      igdbGameMatchesCategory(baseGame, {
        type: 'tag',
        id: 'tag-sequel',
        name: 'Sequel',
        slug: 'sequel',
      })
    ).toBe(true)
  })

  it('rejects categories the game does not satisfy', () => {
    expect(igdbGameMatchesCategory(baseGame, { type: 'theme', id: 1, name: 'Action' })).toBe(false)
  })
})

describe('buildPuzzleCellMetadata', () => {
  it('derives difficulty labels from exact option counts', () => {
    const metadata = buildPuzzleCellMetadata(
      {
        valid: true,
        minValidOptionCount: 1,
        cellResults: [
          {
            cellIndex: 0,
            rowCategory: { type: 'genre', id: 1, name: 'A' } as Category,
            colCategory: { type: 'genre', id: 2, name: 'B' } as Category,
            validOptionCount: 1,
          },
          {
            cellIndex: 1,
            rowCategory: { type: 'genre', id: 1, name: 'A' } as Category,
            colCategory: { type: 'genre', id: 2, name: 'B' } as Category,
            validOptionCount: 650,
          },
        ],
        failedCells: [],
      },
      3,
      40,
      false
    )

    expect(metadata).toEqual([
      expect.objectContaining({
        cellIndex: 0,
        validOptionCount: 1,
        difficulty: 'brutal',
        difficultyLabel: 'Brutal',
        isCapped: false,
      }),
      expect.objectContaining({
        cellIndex: 1,
        validOptionCount: 650,
        difficulty: 'cozy',
        difficultyLabel: 'Cozy',
        isCapped: false,
      }),
    ])
  })
})
