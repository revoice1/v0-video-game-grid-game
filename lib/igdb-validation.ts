import type { Category, Game, PuzzleCellMetadata } from './types'
import { getCuratedStandardPairBanReason } from './curated-standard-pair-bans'

const CURATED_TAG_KEYWORD_IDS: Partial<Record<string, number[]>> = {
  metroidvania: [477],
  'female-protagonist': [962],
  'platform-exclusive': [4239],
  roguex: [416, 17292, 26332, 41781, 46224, 27419, 27688, 26705],
  sequel: [2071],
}

const PLATFORM_RELEASE_YEAR: Record<string, number> = {
  'atari 2600': 1977,
  'nintendo entertainment system': 1983,
  'super nintendo entertainment system': 1990,
  'sega mega drive genesis': 1988,
  'sega saturn': 1994,
  dreamcast: 1998,
  'game boy': 1989,
  'game boy advance': 2001,
  'nintendo ds': 2004,
  'nintendo 3ds': 2011,
  'nintendo 64': 1996,
  'nintendo gamecube': 2001,
  wii: 2006,
  'wii u': 2012,
  'nintendo switch': 2017,
  'nintendo switch 2': 2025,
  playstation: 1994,
  'playstation 2': 2000,
  'playstation 3': 2006,
  'pc windows dos': 1985,
  'playstation 4': 2013,
  'playstation 5': 2020,
  'playstation portable': 2004,
  'playstation vita': 2011,
  xbox: 2001,
  'xbox 360': 2005,
  'xbox one': 2013,
  'xbox series x s': 2020,
}

const PLATFORM_VALID_DECADES: Record<string, string[]> = {
  'atari 2600': ['1990'],
  'nintendo entertainment system': ['1990'],
  'super nintendo entertainment system': ['1990'],
  'sega mega drive genesis': ['1990'],
  'sega saturn': ['1990'],
  dreamcast: ['1990', '2000'],
  'game boy': ['1990'],
  'game boy advance': ['2000'],
  'nintendo ds': ['2000', '2010'],
  'nintendo 3ds': ['2010'],
  'nintendo 64': ['1990'],
  'nintendo gamecube': ['2000'],
  wii: ['2000', '2010'],
  'wii u': ['2010'],
  'nintendo switch': ['2010', '2020'],
  'nintendo switch 2': ['2020'],
  playstation: ['1990'],
  'playstation 2': ['2000'],
  'playstation 3': ['2000', '2010'],
  'pc windows dos': ['1990', '2000', '2010', '2020'],
  'playstation 4': ['2010', '2020'],
  'playstation 5': ['2020'],
  'playstation portable': ['2000', '2010'],
  'playstation vita': ['2010'],
  xbox: ['2000'],
  'xbox 360': ['2000', '2010'],
  'xbox one': ['2010', '2020'],
  'xbox series x s': ['2020'],
}

const TAG_ALIAS_GROUPS: Record<string, string[]> = {
  singleplayer: ['single player', 'singleplayer'],
  multiplayer: ['multiplayer'],
  'co op': ['co operative', 'co op', 'coop', 'split screen'],
  'open world': ['open world', 'sandbox'],
  'story rich': ['story rich', 'drama', 'narrative'],
  survival: ['survival'],
  horror: ['horror'],
  exploration: ['exploration', 'open world'],
  'third person': ['third person'],
  'first person': ['first person'],
  'female protagonist': ['female protagonist'],
  metroidvania: ['metroidvania'],
  'platform exclusive': ['platform exclusive'],
  roguex: [
    'roguelike',
    'rogue like',
    'rogue-lite',
    'rogue lite',
    'roguelite',
    'action roguelike',
    'action roguelite',
    'traditional roguelike',
    'roguelike deckbuilder',
    'roguelike horror',
    'roguelike platform',
    'roguevania',
  ],
  sequel: ['sequel'],
}

const PLATFORM_ALIAS_GROUPS: Record<string, string[]> = {
  'nintendo entertainment system': [
    'nintendo entertainment system',
    'family computer',
    'family computer disk system',
  ],
  'family computer': [
    'nintendo entertainment system',
    'family computer',
    'family computer disk system',
  ],
  'family computer disk system': [
    'nintendo entertainment system',
    'family computer',
    'family computer disk system',
  ],
  'super nintendo entertainment system': ['super nintendo entertainment system', 'super famicom'],
  'super famicom': ['super nintendo entertainment system', 'super famicom'],
  'pc microsoft windows': ['pc microsoft windows', 'dos'],
  'pc windows dos': ['pc microsoft windows', 'dos'],
  'playstation original': ['playstation original', 'playstation'],
  playstation: ['playstation original', 'playstation'],
  'xbox original': ['xbox original', 'xbox'],
  xbox: ['xbox original', 'xbox'],
}

const COMPANY_ALIAS_GROUPS: Record<string, { aliases?: string[]; prefixes?: string[] }> = {
  nintendo: { aliases: ['Nintendo'], prefixes: ['nintendo'] },
  sega: { aliases: ['Sega'], prefixes: ['sega'] },
  'electronic-arts': { aliases: ['Electronic Arts'] },
  konami: { aliases: ['Konami'], prefixes: ['konami'] },
  activision: { aliases: ['Activision'], prefixes: ['activision'] },
  capcom: { aliases: ['Capcom'], prefixes: ['capcom'] },
  'square-enix': { aliases: ['Square Enix', 'Square', 'Enix'] },
  ubisoft: { aliases: ['Ubisoft'], prefixes: ['ubisoft'] },
  thq: { aliases: ['THQ'] },
  'bandai-namco': { aliases: ['Bandai Namco', 'Namco'] },
  'microsoft-xbox': {
    aliases: ['Microsoft', 'Microsoft Game Studios', 'Microsoft Studios', 'Xbox Game Studios'],
    prefixes: ['xbox'],
  },
  atlus: { aliases: ['Atlus'] },
  sony: {
    aliases: [
      'Sony Interactive Entertainment',
      'Sony Computer Entertainment',
      'Sony Computer Entertainment America',
      'Sony Computer Entertainment Europe',
      'Sony Computer Entertainment Inc.',
    ],
    prefixes: ['sony'],
  },
  taito: { aliases: ['Taito'] },
  snk: { aliases: ['SNK'] },
  'koei-tecmo': { aliases: ['Koei Tecmo', 'Koei', 'Tecmo'] },
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/-/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\bcooperative\b/g, 'co operative')
    .replace(/\bcoop\b/g, 'co op')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeCompanyName(value: string): string {
  return normalizeName(value)
    .replace(
      /\b(entertainment|interactive|studios|studio|games|game|software|softworks|inc|llc|ltd|corp|corporation|co)\b/g,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim()
}

function getCategoryIdentity(category: Category): string {
  return `${category.type}:${String(category.slug ?? category.id)}`
}

export function getCanonicalCategoryPairKey(left: Category, right: Category): string {
  return [getCategoryIdentity(left), getCategoryIdentity(right)].sort().join('|')
}

function getTagAliases(name: string): Set<string> {
  const normalized = normalizeName(name)
  const aliases = TAG_ALIAS_GROUPS[normalized] ?? [normalized]
  return new Set(aliases.map(normalizeName))
}

function getPlatformAliases(name: string): Set<string> {
  const normalized = normalizeName(name)
  const aliases = PLATFORM_ALIAS_GROUPS[normalized] ?? [normalized]
  return new Set(aliases.map(normalizeName))
}

function getPlatformIds(category: Category): number[] {
  const explicitIds = (category.platformIds ?? []).filter((id): id is number => Number.isFinite(id))
  if (explicitIds.length > 0) {
    return explicitIds
  }

  return typeof category.id === 'number' && Number.isFinite(category.id) ? [category.id] : []
}

function getCompanyAliases(category: Category): Set<string> {
  const normalized = normalizeName(category.slug ?? category.name)
  const aliases = COMPANY_ALIAS_GROUPS[normalized]?.aliases ?? [category.name]
  return new Set(aliases.map(normalizeCompanyName))
}

function getCompanyPrefixes(category: Category): string[] {
  const normalized = normalizeName(category.slug ?? category.name)
  return (COMPANY_ALIAS_GROUPS[normalized]?.prefixes ?? []).map(normalizeName)
}

function getCompanyIds(category: Category): number[] {
  return (category.companyIds ?? []).filter((id): id is number => Number.isFinite(id))
}

function buildDifficultyMetadata(validOptionCount: number) {
  const brutalCutoff = 20
  const spicyCutoff = 50
  const trickyCutoff = 150
  const fairCutoff = 400
  const cozyCutoff = 1000

  if (validOptionCount <= brutalCutoff) {
    return { difficulty: 'brutal' as const, difficultyLabel: 'Brutal' }
  }
  if (validOptionCount <= spicyCutoff) {
    return { difficulty: 'spicy' as const, difficultyLabel: 'Spicy' }
  }
  if (validOptionCount <= trickyCutoff) {
    return { difficulty: 'tricky' as const, difficultyLabel: 'Tricky' }
  }
  if (validOptionCount <= fairCutoff) {
    return { difficulty: 'fair' as const, difficultyLabel: 'Fair' }
  }
  if (validOptionCount <= cozyCutoff) {
    return { difficulty: 'cozy' as const, difficultyLabel: 'Cozy' }
  }
  return { difficulty: 'feast' as const, difficultyLabel: 'Feast' }
}

function matchesByName(values: string[] | undefined, target: string): boolean {
  return values?.some((value) => normalizeName(value) === normalizeName(target)) || false
}

function matchesGameMode(values: string[] | undefined, target: string): boolean {
  const normalizedTarget = normalizeName(target)
  const normalizedValues = values?.map(normalizeName) ?? []
  if (normalizedValues.includes(normalizedTarget)) {
    return true
  }
  if (normalizedTarget === 'multiplayer') {
    return normalizedValues.includes('co operative')
  }
  return false
}

function getNormalizedTagSources(game: Game): string[] {
  return [
    ...(game.tags?.flatMap((tag) => [tag.name, tag.slug.replace(/-/g, ' ')]) ?? []),
    ...(game.igdb?.game_modes ?? []),
    ...(game.igdb?.themes ?? []),
    ...(game.igdb?.player_perspectives ?? []),
    ...(game.igdb?.keywords ?? []),
  ].map(normalizeName)
}

function matchesTagBucket(game: Game, category: Category): boolean {
  const keywordIds = CURATED_TAG_KEYWORD_IDS[category.slug ?? '']
  if (keywordIds?.length) {
    const gameKeywordIds = new Set((game.tags ?? []).map((tag) => tag.id))
    if (keywordIds.some((keywordId) => gameKeywordIds.has(keywordId))) {
      return true
    }
  }

  const normalizedCategorySlug = normalizeName(category.slug ?? category.name)
  const sources = getNormalizedTagSources(game)

  if (normalizedCategorySlug === 'sequel') {
    return sources.some((source) => /\bsequel\b/.test(source))
  }

  const aliases = getTagAliases(category.name)
  return sources.some((source) => aliases.has(source))
}

export function buildPuzzleCellMetadata(
  validation: {
    valid?: boolean
    minValidOptionCount?: number
    failedCells?: unknown[]
    cellResults: Array<{
      cellIndex: number
      validOptionCount: number
      rowCategory?: Category
      colCategory?: Category
    }>
  },
  minValidOptionsPerCell: number,
  sampleSize = 40,
  treatSampleSizeAsCap = true
): PuzzleCellMetadata[] {
  void minValidOptionsPerCell
  void sampleSize
  void treatSampleSizeAsCap
  return validation.cellResults.map((cell) => ({
    cellIndex: cell.cellIndex,
    validOptionCount: cell.validOptionCount,
    isCapped: false,
    ...buildDifficultyMetadata(cell.validOptionCount),
  }))
}

export function buildIGDBWhereClause(category: Category): string | null {
  switch (category.type) {
    case 'platform':
      return `platforms = (${getPlatformIds(category).join(',')})`
    case 'genre':
      return `genres = (${category.id})`
    case 'game_mode':
      return `game_modes = (${category.id})`
    case 'theme':
      return `themes = (${category.id})`
    case 'perspective':
      return `player_perspectives = (${category.id})`
    case 'decade': {
      const startYear = Number(category.id)
      if (!Number.isFinite(startYear)) {
        return null
      }
      const start = `${startYear}-01-01`
      const end = `${startYear + 9}-12-31`
      return `first_release_date != null & first_release_date >= ${Math.floor(
        Date.parse(start) / 1000
      )} & first_release_date <= ${Math.floor(Date.parse(end) / 1000)}`
    }
    case 'company': {
      const clauses: string[] = []
      const companyIds = getCompanyIds(category)
      if (companyIds.length > 0) {
        clauses.push(`involved_companies.company = (${companyIds.join(',')})`)
      }
      for (const pattern of category.companyNamePatterns ?? []) {
        const escapedPattern = pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        clauses.push(`involved_companies.company.name ~ *"${escapedPattern}"*`)
      }
      if (clauses.length === 0) {
        return null
      }
      return `(${clauses.join(' | ')}) & (involved_companies.developer = true | involved_companies.publisher = true)`
    }
    default:
      return null
  }
}

export function getIntrinsicPairRejectionReason(
  rowCategory: Category,
  colCategory: Category
): string | null {
  const leftName = normalizeName(rowCategory.name)
  const rightName = normalizeName(colCategory.name)
  const names = new Set([leftName, rightName])

  if (rowCategory.type === colCategory.type && String(rowCategory.id) === String(colCategory.id)) {
    return 'duplicate category pairing'
  }
  if (
    names.has('single player') &&
    (names.has('multiplayer') || names.has('massively multiplayer online mmo'))
  ) {
    return 'conflicting solo and multiplayer categories'
  }
  if (names.has('single player') && (names.has('co operative') || names.has('split screen'))) {
    return 'conflicting solo and co-operative categories'
  }

  const platformCategory =
    rowCategory.type === 'platform'
      ? rowCategory
      : colCategory.type === 'platform'
        ? colCategory
        : null
  const decadeCategory =
    rowCategory.type === 'decade' ? rowCategory : colCategory.type === 'decade' ? colCategory : null

  if (platformCategory && decadeCategory) {
    const normalizedPlatformName = normalizeName(platformCategory.name)
    const compatibleDecades = PLATFORM_VALID_DECADES[normalizedPlatformName]
    const decadeStart = Number(decadeCategory.id)
    if (compatibleDecades && !compatibleDecades.includes(String(decadeCategory.id))) {
      return 'platform is outside its supported decades'
    }

    const platformYear = PLATFORM_RELEASE_YEAR[normalizedPlatformName]
    if (
      !compatibleDecades &&
      platformYear &&
      Number.isFinite(decadeStart) &&
      platformYear > decadeStart + 9
    ) {
      return 'platform released after the decade'
    }
  }

  if (
    (names.has('battle royale') || names.has('massively multiplayer online mmo')) &&
    decadeCategory &&
    Number(decadeCategory.id) < 2000
  ) {
    return 'modern online mode paired with an early decade'
  }

  return null
}

export function getPairRejectionReason(
  rowCategory: Category,
  colCategory: Category
): string | null {
  const intrinsicReason = getIntrinsicPairRejectionReason(rowCategory, colCategory)
  if (intrinsicReason) {
    return intrinsicReason
  }

  const curatedBanReason = getCuratedStandardPairBanReason(
    getCanonicalCategoryPairKey(rowCategory, colCategory)
  )
  if (curatedBanReason) {
    return curatedBanReason
  }

  return null
}

export function igdbGameMatchesCategory(game: Game, category: Category): boolean {
  switch (category.type) {
    case 'platform':
      return (
        game.platforms?.some(
          (platform) =>
            getPlatformIds(category).includes(platform.platform.id) ||
            getPlatformAliases(category.name).has(normalizeName(platform.platform.name))
        ) || false
      )
    case 'genre':
      return (
        game.genres?.some((genre) => normalizeName(genre.name) === normalizeName(category.name)) ||
        false
      )
    case 'decade': {
      const releaseDates =
        game.releaseDates && game.releaseDates.length > 0
          ? game.releaseDates
          : game.released
            ? [game.released]
            : []

      if (releaseDates.length === 0) {
        return false
      }
      const decadeStart = Number(category.id)
      return releaseDates.some((releaseDate) => {
        const year = Number(releaseDate.split('-')[0])
        return Number.isFinite(year) && year >= decadeStart && year < decadeStart + 10
      })
    }
    case 'company':
      return (
        game.developers?.some((company) => getCompanyIds(category).includes(company.id)) ||
        game.publishers?.some((company) => getCompanyIds(category).includes(company.id)) ||
        game.igdb?.companies?.some((company) => {
          const normalizedCompany = normalizeCompanyName(company)
          const fullNormalizedCompany = normalizeName(company)
          return (
            getCompanyAliases(category).has(normalizedCompany) ||
            getCompanyPrefixes(category).some((prefix) => fullNormalizedCompany.startsWith(prefix))
          )
        }) ||
        false
      )
    case 'game_mode':
      return matchesGameMode(game.igdb?.game_modes, category.name)
    case 'theme':
      return matchesByName(game.igdb?.themes, category.name)
    case 'perspective':
      return matchesByName(game.igdb?.player_perspectives, category.name)
    case 'tag':
      return matchesTagBucket(game, category)
    default:
      return false
  }
}
