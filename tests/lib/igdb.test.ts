import { describe, expect, it } from 'vitest'
import {
  buildIGDBWhereClause,
  buildPuzzleCellMetadata,
  getIntrinsicPairRejectionReason,
  getPairRejectionReason,
  igdbGameMatchesCategory,
} from '@/lib/igdb-validation'
import {
  buildSearchGameWhereClause,
  mergePortFamilyGameDetails,
  resolveGenerationCategoryFamilies,
  shouldHideSameNamePortResult,
} from '@/lib/igdb'
import { buildGenerationPlans } from '@/lib/puzzle-generation-plans'
import type { IGDBGame } from '@/lib/igdb'
import type { Category, Game } from '@/lib/types'

const CURATED_LOW_COUNT_REASON = '3 or fewer catalog matches in curated pair table'

const baseGame: Game = {
  id: 1,
  name: 'Test Game',
  slug: 'test-game',
  background_image: null,
  released: '2004-11-09',
  metacritic: 90,
  genres: [{ id: 5, name: 'Shooter', slug: 'shooter' }],
  platforms: [{ platform: { id: 11, name: 'Xbox (Original)', slug: 'xbox' } }],
  igdb: {
    id: 1,
    game_modes: ['Single player'],
    themes: ['Horror'],
    player_perspectives: ['First person'],
    companies: ['Bungie'],
    keywords: [],
  },
}

const sonyGame: Game = {
  ...baseGame,
  id: 2,
  name: 'Sony Game',
  slug: 'sony-game',
  igdb: {
    ...baseGame.igdb!,
    companies: ['Sony Computer Entertainment'],
    keywords: [],
  },
}

const marioOriginalRaw: IGDBGame = {
  id: 48135,
  name: 'Mario Is Missing!',
  game_type: 0,
  first_release_date: 724377600,
}

const marioPortRaw: IGDBGame = {
  id: 210223,
  name: 'Mario Is Missing!',
  game_type: 11,
  parent_game: 48135,
  first_release_date: 749260800,
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

describe('resolveGenerationCategoryFamilies', () => {
  it('uses versus default selections for untouched families when custom filters are present', () => {
    const families = resolveGenerationCategoryFamilies({
      company: ['nintendo', 'sega'],
    })

    const companyFamily = families.find((family) => family.key === 'company')
    const perspectiveFamily = families.find((family) => family.key === 'perspective')

    expect(companyFamily?.categories.map((category) => String(category.id))).toEqual([
      'nintendo',
      'sega',
    ])
    expect(perspectiveFamily?.categories.map((category) => String(category.id))).toEqual([
      '1',
      '2',
      '3',
      '4',
    ])
    expect(perspectiveFamily?.categories.some((category) => String(category.id) === '5')).toBe(
      false
    )
  })

  it('uses the tighter standard curated families when no custom filters are provided', () => {
    const families = resolveGenerationCategoryFamilies()
    const companyFamily = families.find((family) => family.key === 'company')

    expect(companyFamily?.categories.map((category) => category.name)).toContain('Microsoft')
    expect(companyFamily?.categories.map((category) => category.name)).toContain(
      'Activision / Blizzard'
    )
    expect(companyFamily?.categories.map((category) => category.name)).toContain('THQ / Nordic')
    expect(companyFamily?.categories.map((category) => category.name)).not.toContain('Atlus')
  })
})

describe('buildIGDBWhereClause', () => {
  it('builds native where clauses for direct IGDB categories', () => {
    expect(buildIGDBWhereClause({ type: 'genre', id: 5, name: 'Shooter' })).toBe('genres = (5)')
    expect(buildIGDBWhereClause({ type: 'theme', id: 19, name: 'Horror' })).toBe('themes = (19)')
  })

  it('builds native where clauses for merged platform buckets', () => {
    expect(
      buildIGDBWhereClause({
        type: 'platform',
        id: 18,
        name: 'Nintendo Entertainment System',
        platformIds: [18, 99, 51],
      })
    ).toBe('platforms = (18,99,51)')
  })

  it('builds native where clauses for merged company buckets', () => {
    expect(
      buildIGDBWhereClause({
        type: 'company',
        id: 'sony',
        name: 'Sony',
        slug: 'sony',
        companyIds: [10100, 13634],
      })
    ).toBe(
      '(involved_companies.company = (10100,13634)) & (involved_companies.developer = true | involved_companies.publisher = true)'
    )
  })

  it('matches THQ / Nordic through aliases when no direct company ids are provided', () => {
    expect(
      igdbGameMatchesCategory(
        {
          ...baseGame,
          igdb: {
            ...baseGame.igdb!,
            companies: ['THQ Nordic'],
            keywords: [],
          },
        },
        {
          type: 'company',
          id: 'thq',
          name: 'THQ / Nordic',
          slug: 'thq',
        }
      )
    ).toBe(true)
  })

  it('matches Blizzard through the Activision / Blizzard alias group', () => {
    expect(
      igdbGameMatchesCategory(
        {
          ...baseGame,
          igdb: {
            ...baseGame.igdb!,
            companies: ['Blizzard Entertainment'],
            keywords: [],
          },
        },
        {
          type: 'company',
          id: 'activision',
          name: 'Activision / Blizzard',
          slug: 'activision',
        }
      )
    ).toBe(true)
  })

  it('builds a decade release-date clause', () => {
    expect(buildIGDBWhereClause({ type: 'decade', id: '2000', name: '2000s' })).toContain(
      'first_release_date != null'
    )
  })
})

describe('buildSearchGameWhereClause', () => {
  it('requires recognized ratings by default', () => {
    expect(buildSearchGameWhereClause()).toContain('(rating != null | aggregated_rating != null)')
    expect(buildSearchGameWhereClause()).toContain('involved_companies != null')
  })
})

describe('getPairRejectionReason', () => {
  it('keeps intrinsic rejection separate from curated bans', () => {
    const sony = {
      type: 'company' as const,
      id: 'sony',
      name: 'Sony',
      slug: 'sony',
      companyIds: [10100],
    }
    const nes = {
      type: 'platform' as const,
      id: 18,
      name: 'Nintendo Entertainment System',
      slug: 'nes',
      platformIds: [18, 99, 51],
    }

    expect(getIntrinsicPairRejectionReason(sony, nes)).toBeNull()
    expect(getPairRejectionReason(sony, nes)).toBe(CURATED_LOW_COUNT_REASON)
  })

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

  it('uses curated zero-pair bans symmetrically', () => {
    const left = {
      type: 'company' as const,
      id: 'sony',
      name: 'Sony',
      slug: 'sony',
      companyIds: [10100],
    }
    const right = {
      type: 'platform' as const,
      id: 18,
      name: 'Nintendo Entertainment System',
      slug: 'nes',
    }

    expect(getPairRejectionReason(left, right)).toBe(CURATED_LOW_COUNT_REASON)
    expect(getPairRejectionReason(right, left)).toBe(CURATED_LOW_COUNT_REASON)
  })

  it('uses curated structural bans for known empty platform-theme pairs', () => {
    expect(
      getPairRejectionReason(
        { type: 'platform', id: 59, name: 'Atari 2600', slug: 'atari2600' },
        { type: 'theme', id: 38, name: 'Open world', slug: 'open-world' }
      )
    ).toBe(CURATED_LOW_COUNT_REASON)
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

  it('matches decades across merged family release dates', () => {
    expect(
      igdbGameMatchesCategory(
        { ...baseGame, released: '1993-10-01', releaseDates: ['1992-01-01', '1993-10-01'] },
        { type: 'decade', id: '1990', name: '1990s' }
      )
    ).toBe(true)
  })

  it('matches merged company buckets by alias group', () => {
    expect(
      igdbGameMatchesCategory(sonyGame, { type: 'company', id: 'sony', name: 'Sony', slug: 'sony' })
    ).toBe(true)
  })

  it('rejects categories the game does not satisfy', () => {
    expect(igdbGameMatchesCategory(baseGame, { type: 'theme', id: 1, name: 'Action' })).toBe(false)
  })
})

describe('shouldHideSameNamePortResult', () => {
  it('hides same-name ports when the parent has the same title', () => {
    expect(shouldHideSameNamePortResult(marioPortRaw, marioOriginalRaw)).toBe(true)
  })

  it('keeps ports with distinct titles visible', () => {
    expect(
      shouldHideSameNamePortResult(
        { ...marioPortRaw, name: 'Super Mario All-Stars + Super Mario World' },
        marioOriginalRaw
      )
    ).toBe(false)
  })
})

describe('mergePortFamilyGameDetails', () => {
  it('unions family metadata while preserving the selected game identity', () => {
    const selectedGame: Game = {
      ...baseGame,
      id: 210223,
      name: 'Mario Is Missing!',
      slug: 'mario-is-missing-snes',
      released: '1993-10-01',
      releaseDates: ['1993-10-01'],
      platforms: [
        { platform: { id: 19, name: 'Super Nintendo Entertainment System', slug: 'snes' } },
      ],
      developers: [{ id: 1, name: 'Software Toolworks', slug: 'software-toolworks' }],
      publishers: [{ id: 2, name: 'Nintendo', slug: 'nintendo' }],
      igdb: {
        ...baseGame.igdb!,
        game_modes: ['Single player'],
        themes: ['Educational'],
        player_perspectives: ['Side view'],
        companies: ['Nintendo'],
        keywords: ['Mario'],
      },
    }

    const originalGame: Game = {
      ...selectedGame,
      id: 48135,
      slug: 'mario-is-missing',
      gameUrl: 'https://www.igdb.com/games/mario-is-missing',
      released: '1992-01-01',
      releaseDates: ['1992-01-01'],
      platforms: [{ platform: { id: 13, name: 'DOS', slug: 'dos' } }],
      genres: [{ id: 10, name: 'Puzzle', slug: 'puzzle' }],
      developers: [{ id: 3, name: 'The Software Toolworks', slug: 'the-software-toolworks' }],
      publishers: [{ id: 4, name: 'Mindscape', slug: 'mindscape' }],
      igdb: {
        ...selectedGame.igdb!,
        themes: ['Comedy'],
        companies: ['Mindscape'],
        keywords: ['Missing person'],
      },
    }

    const merged = mergePortFamilyGameDetails(
      selectedGame,
      [selectedGame, originalGame],
      originalGame
    )

    expect(merged.id).toBe(selectedGame.id)
    expect(merged.slug).toBe(selectedGame.slug)
    expect(merged.gameUrl).toBe(originalGame.gameUrl)
    expect(merged.releaseDates).toEqual(['1993-10-01', '1992-01-01'])
    expect(merged.platforms.map((platform) => platform.platform.name)).toEqual([
      'Super Nintendo Entertainment System',
      'DOS',
    ])
    expect(merged.publishers?.map((publisher) => publisher.name)).toEqual(['Nintendo', 'Mindscape'])
    expect(merged.igdb?.themes).toEqual(['Educational', 'Comedy'])
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
