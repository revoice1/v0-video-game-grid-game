import { describe, expect, it } from 'vitest'
import {
  buildIGDBWhereClause,
  buildPuzzleCellMetadata,
  explainIGDBGameMatch,
  getIntrinsicPairRejectionReason,
  getPairRejectionReason,
  igdbGameMatchesCategory,
} from '@/lib/igdb-validation'
import {
  buildAlternativeNameMatchWhereClause,
  buildSearchGameWhereClause,
  pickBetterAlternativeNameMatch,
  resolveGenerationCategoryFamilies,
  mergePortFamilyGameDetails,
  shouldHideSameNamePortResult,
} from '@/lib/igdb'
import {
  CURATED_STANDARD_CATEGORY_FAMILIES,
  CURATED_VERSUS_CATEGORY_FAMILIES,
} from '@/lib/versus-category-options'
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
    const gameModeFamily = families.find((family) => family.key === 'game_mode')

    expect(companyFamily?.categories.map((category) => category.name)).toContain('Microsoft')
    expect(companyFamily?.categories.map((category) => category.name)).toContain(
      'Activision / Blizzard'
    )
    expect(companyFamily?.categories.map((category) => category.name)).not.toContain('THQ / Nordic')
    expect(companyFamily?.categories.map((category) => category.name)).not.toContain('Atlus')
    expect(gameModeFamily?.categories.map((category) => category.name)).not.toContain(
      'Battle Royale'
    )
  })
})

describe('curated category defaults', () => {
  it('keeps MMO and Battle Royale as default-off fun modes in versus only', () => {
    const standardGameModeFamily = CURATED_STANDARD_CATEGORY_FAMILIES.find(
      (family) => family.key === 'game_mode'
    )
    const versusGameModeFamily = CURATED_VERSUS_CATEGORY_FAMILIES.find(
      (family) => family.key === 'game_mode'
    )

    expect(standardGameModeFamily?.categories.map((category) => category.name)).not.toContain(
      'Massively Multiplayer Online (MMO)'
    )
    expect(standardGameModeFamily?.categories.map((category) => category.name)).not.toContain(
      'Battle Royale'
    )
    expect(versusGameModeFamily?.categories.slice(-2)).toEqual([
      expect.objectContaining({
        id: '5',
        name: 'Massively Multiplayer Online (MMO)',
        defaultChecked: false,
      }),
      expect.objectContaining({
        id: '6',
        name: 'Battle Royale',
        defaultChecked: false,
      }),
    ])
  })

  it('moves handheld platforms into default-off fun slots at the bottom of the versus list', () => {
    const standardPlatformFamily = CURATED_STANDARD_CATEGORY_FAMILIES.find(
      (family) => family.key === 'platform'
    )
    const versusPlatformFamily = CURATED_VERSUS_CATEGORY_FAMILIES.find(
      (family) => family.key === 'platform'
    )

    expect(standardPlatformFamily?.categories.map((category) => category.name)).not.toContain(
      'Game Boy'
    )
    expect(standardPlatformFamily?.categories.map((category) => category.name)).not.toContain(
      'Nintendo DS'
    )
    expect(standardPlatformFamily?.categories.map((category) => category.name)).not.toContain(
      'PlayStation Portable'
    )

    expect(versusPlatformFamily?.categories.slice(-6).map((category) => category.name)).toEqual([
      'GB',
      'GBA',
      'DS',
      '3DS',
      'PSP',
      'VITA',
    ])

    expect(
      versusPlatformFamily?.categories
        .filter((category) => ['33', '24', '20', '37', '38', '46'].includes(category.id))
        .every((category) => category.defaultChecked === false)
    ).toBe(true)
  })

  it('moves Strategy and Tactical into default-off fun genre slots in versus only', () => {
    const standardGenreFamily = CURATED_STANDARD_CATEGORY_FAMILIES.find(
      (family) => family.key === 'genre'
    )
    const versusGenreFamily = CURATED_VERSUS_CATEGORY_FAMILIES.find(
      (family) => family.key === 'genre'
    )

    expect(standardGenreFamily?.categories.map((category) => category.name)).not.toContain(
      'Strategy'
    )
    expect(standardGenreFamily?.categories.map((category) => category.name)).not.toContain(
      'Tactical'
    )

    expect(versusGenreFamily?.categories.slice(-2).map((category) => category.name)).toEqual([
      'Strategy',
      'Tactical',
    ])
    expect(
      versusGenreFamily?.categories
        .filter((category) => ['15', '24'].includes(category.id))
        .every((category) => category.defaultChecked === false)
    ).toBe(true)
  })

  it('moves Warfare into a default-off fun theme slot in versus only', () => {
    const standardThemeFamily = CURATED_STANDARD_CATEGORY_FAMILIES.find(
      (family) => family.key === 'theme'
    )
    const versusThemeFamily = CURATED_VERSUS_CATEGORY_FAMILIES.find(
      (family) => family.key === 'theme'
    )

    expect(standardThemeFamily?.categories.map((category) => category.name)).not.toContain(
      'Warfare'
    )
    expect(versusThemeFamily?.categories.at(-1)).toEqual(
      expect.objectContaining({
        id: '39',
        name: 'Warfare',
        defaultChecked: false,
      })
    )
  })

  it('moves Survival into a default-off fun theme slot in versus only', () => {
    const standardThemeFamily = CURATED_STANDARD_CATEGORY_FAMILIES.find(
      (family) => family.key === 'theme'
    )
    const versusThemeFamily = CURATED_VERSUS_CATEGORY_FAMILIES.find(
      (family) => family.key === 'theme'
    )

    expect(standardThemeFamily?.categories.map((category) => category.name)).not.toContain(
      'Survival'
    )
    expect(versusThemeFamily?.categories.at(-2)).toEqual(
      expect.objectContaining({
        id: '21',
        name: 'Survival',
        defaultChecked: false,
      })
    )
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

  it('builds native where clauses for custom retro platform buckets', () => {
    expect(
      buildIGDBWhereClause({
        type: 'platform',
        id: 86,
        name: 'PC-Engine / TG16',
        platformIds: [86, 150],
      })
    ).toBe('platforms = (86,150)')
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
    expect(buildSearchGameWhereClause()).toContain('total_rating != null')
    expect(buildSearchGameWhereClause()).toContain('involved_companies != null')
    expect(buildSearchGameWhereClause()).toContain('game_type = (0,4,8,9,10,11)')
  })
})

describe('buildAlternativeNameMatchWhereClause', () => {
  it('builds wildcard match clause for alternative names', () => {
    expect(buildAlternativeNameMatchWhereClause('MGS "Ground Zeroes"')).toBe(
      'name ~ *"MGS \\"Ground Zeroes\\""* & game != null'
    )
  })
})

describe('pickBetterAlternativeNameMatch', () => {
  it('keeps the alias that best matches the original query', () => {
    expect(
      pickBetterAlternativeNameMatch('final fantasy vi', 'Final Fantasy VI', 'FINAL FANTASY III')
    ).toBe('Final Fantasy VI')
  })

  it('accepts a stronger later alias when it matches better', () => {
    expect(pickBetterAlternativeNameMatch('ffiii', 'Final Fantasy III', 'FFIII')).toBe('FFIII')
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

  it('matches merged retro platform buckets by alias group', () => {
    expect(
      igdbGameMatchesCategory(
        {
          ...baseGame,
          platforms: [
            { platform: { id: 150, name: 'TurboGrafx-16/PC Engine CD', slug: 'pce-cd' } },
          ],
        },
        {
          type: 'platform',
          id: 86,
          name: 'PC-Engine / TG16',
          slug: 'tg16-slash-pce-slash-pce-cd',
        }
      )
    ).toBe(true)

    expect(
      igdbGameMatchesCategory(
        {
          ...baseGame,
          platforms: [{ platform: { id: 80, name: 'Neo Geo AES', slug: 'neo-geo-aes' } }],
        },
        {
          type: 'platform',
          id: 79,
          name: 'Neo Geo / AES / MVS',
          slug: 'neo-geo-slash-aes-slash-mvs',
        }
      )
    ).toBe(true)
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

  it('matches EA Sports under the Electronic Arts company bucket', () => {
    expect(
      igdbGameMatchesCategory(
        {
          ...baseGame,
          developers: [],
          publishers: [],
          igdb: {
            ...baseGame.igdb!,
            companies: ['EA Sports'],
            keywords: [],
          },
        },
        {
          type: 'company',
          id: 'electronic-arts',
          name: 'Electronic Arts',
          slug: 'electronic-arts',
        }
      )
    ).toBe(true)
  })

  it('matches EA Tiburon under the Electronic Arts company bucket', () => {
    expect(
      igdbGameMatchesCategory(
        {
          ...baseGame,
          developers: [],
          publishers: [],
          igdb: {
            ...baseGame.igdb!,
            companies: ['EA Tiburon'],
            keywords: [],
          },
        },
        {
          type: 'company',
          id: 'electronic-arts',
          name: 'Electronic Arts',
          slug: 'electronic-arts',
        }
      )
    ).toBe(true)
  })

  it('matches Square under the Square Enix company bucket', () => {
    expect(
      igdbGameMatchesCategory(
        {
          ...baseGame,
          developers: [],
          publishers: [],
          igdb: {
            ...baseGame.igdb!,
            companies: ['Square'],
            keywords: [],
          },
        },
        {
          type: 'company',
          id: 'square-enix',
          name: 'Square Enix',
          slug: 'square-enix',
        }
      )
    ).toBe(true)
  })

  it('matches Xbox Game Studios under the Microsoft company bucket', () => {
    expect(
      igdbGameMatchesCategory(
        {
          ...baseGame,
          developers: [],
          publishers: [],
          igdb: {
            ...baseGame.igdb!,
            companies: ['Xbox Game Studios'],
            keywords: [],
          },
        },
        {
          type: 'company',
          id: 'microsoft-xbox',
          name: 'Microsoft',
          slug: 'microsoft-xbox',
        }
      )
    ).toBe(true)
  })

  it('rejects categories the game does not satisfy', () => {
    expect(igdbGameMatchesCategory(baseGame, { type: 'theme', id: 1, name: 'Action' })).toBe(false)
  })
})

describe('explainIGDBGameMatch', () => {
  it('explains merged retro platform bucket matches', () => {
    expect(
      explainIGDBGameMatch(
        {
          ...baseGame,
          platforms: [
            { platform: { id: 150, name: 'TurboGrafx-16/PC Engine CD', slug: 'pce-cd' } },
          ],
        },
        {
          type: 'platform',
          id: 86,
          name: 'PC-Engine / TG16',
          slug: 'tg16-slash-pce-slash-pce-cd',
        }
      )
    ).toEqual({
      matched: true,
      categoryType: 'platform',
      categoryName: 'PC-Engine / TG16',
      matchSource: 'merged-platform-bucket',
      matchedValues: ['TurboGrafx-16/PC Engine CD'],
      note: 'Matched via the PC-Engine / TG16 platform family.',
    })
  })

  it('explains decade matches using release-family dates', () => {
    expect(
      explainIGDBGameMatch(
        { ...baseGame, released: '2004-11-09', releaseDates: ['1992-01-01', '2004-11-09'] },
        { type: 'decade', id: '1990', name: '1990s' }
      )
    ).toEqual({
      matched: true,
      categoryType: 'decade',
      categoryName: '1990s',
      matchSource: 'release-date-family',
      matchedValues: ['1992-01-01'],
      note: null,
    })
  })

  it('explains company alias and prefix matches', () => {
    expect(
      explainIGDBGameMatch(
        {
          ...baseGame,
          developers: [],
          publishers: [],
          igdb: {
            ...baseGame.igdb!,
            companies: ['Square'],
            keywords: [],
          },
        },
        {
          type: 'company',
          id: 'square-enix',
          name: 'Square Enix',
          slug: 'square-enix',
        }
      )
    ).toEqual({
      matched: true,
      categoryType: 'company',
      categoryName: 'Square Enix',
      matchSource: 'company-alias',
      matchedValues: ['Square'],
      note: null,
    })

    expect(
      explainIGDBGameMatch(
        {
          ...baseGame,
          developers: [],
          publishers: [],
          igdb: {
            ...baseGame.igdb!,
            companies: ['EA Tiburon'],
            keywords: [],
          },
        },
        {
          type: 'company',
          id: 'electronic-arts',
          name: 'Electronic Arts',
          slug: 'electronic-arts',
        }
      )
    ).toEqual({
      matched: true,
      categoryType: 'company',
      categoryName: 'Electronic Arts',
      matchSource: 'company-prefix',
      matchedValues: ['EA Tiburon'],
      note: 'Matched via the Electronic Arts company family.',
    })
  })

  it('returns an explicit no-match explanation when the category fails', () => {
    expect(explainIGDBGameMatch(baseGame, { type: 'theme', id: 1, name: 'Action' })).toEqual({
      matched: false,
      categoryType: 'theme',
      categoryName: 'Action',
      matchSource: 'no-match',
      matchedValues: [],
      note: null,
    })
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
