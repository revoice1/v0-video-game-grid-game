import type {
  Category,
  CategoryMatchExplanation,
  Game,
  GuessValidationExplanation,
  PuzzleCellMetadata,
} from './types'
import {
  buildIGDBWhereClause,
  buildPuzzleCellMetadata,
  explainIGDBGameMatch,
  getIntrinsicPairRejectionReason,
  getPairRejectionReason,
  igdbGameMatchesCategory,
} from './igdb-validation'
import {
  CURATED_STANDARD_CATEGORY_FAMILIES,
  CURATED_VERSUS_DEFAULT_SELECTIONS,
  CURATED_VERSUS_GENERATION_CATEGORY_FAMILIES,
} from './versus-category-options'
import { logError, logInfo, logWarn } from './logging'
export {
  buildIGDBWhereClause,
  buildPuzzleCellMetadata,
  getPairRejectionReason,
  igdbGameMatchesCategory,
} from './igdb-validation'

// These are read at module load. Inside Next/Vercel that is fine, but ad hoc
// Node/tsx scripts must load the project env first (for example via
// `@next/env`) or the helpers in this module will quietly behave like IGDB
// credentials are missing and return empty results.
const TWITCH_IGDB_CLIENT_ID = process.env.TWITCH_IGDB_CLIENT_ID
const TWITCH_IGDB_CLIENT_SECRET = process.env.TWITCH_IGDB_CLIENT_SECRET
const USING_TEST_IGDB_CREDENTIALS =
  TWITCH_IGDB_CLIENT_ID === 'test-client-id' || TWITCH_IGDB_CLIENT_SECRET === 'test-client-secret'

interface IGDBNamedEntity {
  id: number
  name: string
}

interface IGDBCover {
  image_id: string
}

interface IGDBPlatform {
  id: number
  name: string
  slug?: string
  summary?: string
}

interface IGDBReleaseDate {
  date?: number | null
  platform?: IGDBPlatform | null
}

interface IGDBGenre {
  id: number
  name: string
  slug?: string
}

interface IGDBCompany {
  id: number
  name: string
}

interface IGDBInvolvedCompany {
  id: number
  company?: IGDBCompany | null
  developer?: boolean | null
  publisher?: boolean | null
}

export interface IGDBGame {
  id: number
  name: string
  slug?: string
  url?: string
  category?: number | null
  game_type?: number | null
  parent_game?: number | null
  version_parent?: number | null
  first_release_date?: number | null
  rating?: number | null
  aggregated_rating?: number | null
  total_rating?: number | null
  total_rating_count?: number | null
  cover?: IGDBCover | null
  platforms?: IGDBPlatform[]
  release_dates?: IGDBReleaseDate[]
  genres?: IGDBGenre[]
  game_modes?: IGDBNamedEntity[]
  themes?: IGDBNamedEntity[]
  player_perspectives?: IGDBNamedEntity[]
  involved_companies?: IGDBInvolvedCompany[]
  keywords?: IGDBNamedEntity[]
  hasSameNamePortFamily?: boolean
}

interface IGDBTokenCache {
  token: string
  expiresAt: number
}

interface ResolvedIGDBGameDetails {
  selectedGame: Game
  game: Game
}

interface IGDBAlternativeName {
  game?: number | null
  name: string
  comment?: string | null
}

export type SearchDebugEvent =
  | {
      stage: 'primary-search'
      requireRating: boolean
      query: string
      gameCount: number
      alternativeNameCount: number
      alternativeMatchCount: number
      altGameFetchCount: number
      visibleResultCount: number
    }
  | {
      stage: 'fallback-search'
      requireRating: boolean
      query: string
      fallbackTerm: string
      gameCount: number
    }
  | {
      stage: 'final-results'
      query: string
      resultCount: number
      altMatchCount: number
    }

// These caches are intentionally in-memory, so they help on warm Node instances
// but are not shared across serverless cold starts or between regions.
let tokenCache: IGDBTokenCache | null = null
const igdbGameCache = new Map<number, Game | null>()
const igdbRawGameCache = new Map<number, IGDBGame | null>()
const igdbResolvedPortFamilyCache = new Map<number, ResolvedIGDBGameDetails | null>()
const DEFAULT_CELL_SAMPLE_SIZE = 40
const DEFAULT_MIN_VALID_OPTIONS = 3
const DEFAULT_MAX_GENERATION_ATTEMPTS = 12
const DEFAULT_CELL_VALIDATION_CACHE_TTL_MS = 1000 * 60 * 60 * 6
const DEFAULT_PLATFORM_SUMMARY_CACHE_TTL_MS = 1000 * 60 * 60 * 12
const DEFAULT_IGDB_MIN_REQUEST_INTERVAL_MS = 350
const DEFAULT_IGDB_MAX_RETRIES = 3
const DEFAULT_IGDB_ALT_NAME_SEARCH_LIMIT = 40
const ALLOWED_GAME_TYPES = [0, 4, 8, 9, 10, 11] as const
const ALLOWED_GAME_TYPE_SET = new Set<number>(ALLOWED_GAME_TYPES)
const REJECTED_GAME_TYPE_SET = new Set<number>([1, 2, 3, 5, 6, 7, 12, 13, 14])
const UNOFFICIAL_NAME_PATTERNS = [
  /\bgoogle translated\b/i,
  /\bchapter\s+\d+\b/i,
  /\bfan ?game\b/i,
  /\brom ?hack\b/i,
  /\bmod\b/i,
  /\bprototype\b/i,
  /\bdemake\b/i,
  /\bbootleg\b/i,
]
const DISQUALIFYING_KEYWORDS = new Set([
  'unofficial',
  'fangame',
  'fanmade',
  'rom hack',
  'character mod',
  'complete overhaul mod',
  'challenge mod',
  'super mario odyssey mod',
])

export interface CategoryFamily {
  key: 'platform' | 'genre' | 'decade' | 'company' | 'game_mode' | 'theme' | 'perspective'
  source: 'curated'
  categories: Category[]
}

export type CategoryFamilyKey = CategoryFamily['key']
export type PuzzleCategoryFilters = Partial<Record<CategoryFamilyKey, Array<string>>>

export type PuzzleProgressCallback = (event: {
  stage: 'families' | 'attempt' | 'cell' | 'metadata' | 'rejected' | 'done'
  attempt?: number
  maxAttempts?: number
  cellIndex?: number // 0-8 within current attempt
  totalCells?: number
  message?: string
  rows?: string[]
  cols?: string[]
  rowCategory?: string
  colCategory?: string
  validOptionCount?: number
  passed?: boolean
}) => void

interface PuzzleGenerationOptions {
  minValidOptionsPerCell?: number
  maxAttempts?: number
  sampleSize?: number
  onProgress?: PuzzleProgressCallback
  allowedCategoryIds?: PuzzleCategoryFilters
}

interface CellValidationCacheEntry {
  expiresAt: number
  games: Game[]
}

interface CellCountCacheEntry {
  expiresAt: number
  count: number
}

export interface CellValidationResult {
  cellIndex: number
  rowCategory: Category
  colCategory: Category
  validOptionCount: number
}

export interface PuzzleValidationResult {
  valid: boolean
  minValidOptionCount: number
  cellResults: CellValidationResult[]
  failedCells: CellValidationResult[]
}

export interface PuzzleGenerationResult {
  rows: Category[]
  cols: Category[]
  rowFamilies: CategoryFamily[]
  colFamilies: CategoryFamily[]
  validation: PuzzleValidationResult
  cellMetadata: PuzzleCellMetadata[]
}

const CELL_VALIDATION_CACHE_TTL_MS = Number(
  process.env.PUZZLE_VALIDATION_CACHE_TTL_MS ?? DEFAULT_CELL_VALIDATION_CACHE_TTL_MS
)
const IGDB_MIN_REQUEST_INTERVAL_MS = Number(
  process.env.IGDB_MIN_REQUEST_INTERVAL_MS ?? DEFAULT_IGDB_MIN_REQUEST_INTERVAL_MS
)
const IGDB_MAX_RETRIES = Number(process.env.IGDB_MAX_RETRIES ?? DEFAULT_IGDB_MAX_RETRIES)
const IGDB_ALT_NAME_SEARCH_LIMIT = Number(
  process.env.IGDB_ALT_NAME_SEARCH_LIMIT ?? DEFAULT_IGDB_ALT_NAME_SEARCH_LIMIT
)
const PLATFORM_SUMMARY_CACHE_TTL_MS = Number(
  process.env.IGDB_PLATFORM_SUMMARY_CACHE_TTL_MS ?? DEFAULT_PLATFORM_SUMMARY_CACHE_TTL_MS
)
const cellValidationCache = new Map<string, CellValidationCacheEntry>()
const cellCountCache = new Map<string, CellCountCacheEntry>()
const platformSummaryCache = new Map<number, { expiresAt: number; summary: string | null }>()
let igdbRequestQueue = Promise.resolve()
let igdbNextRequestAt = 0

const GAME_TYPE_LABELS: Record<number, string> = {
  0: 'Original',
  4: 'Standalone Expansion',
  8: 'Remake',
  9: 'Remaster',
  10: 'Expanded Game',
  11: 'Port',
}

const IGDB_GAME_FIELDS =
  'fields name,slug,url,category,game_type,parent_game,version_parent,first_release_date,rating,aggregated_rating,total_rating,total_rating_count,cover.image_id,platforms.id,platforms.name,platforms.slug,release_dates.date,release_dates.platform.id,release_dates.platform.name,release_dates.platform.slug,genres.id,genres.name,genres.slug,game_modes.name,themes.name,player_perspectives.name,involved_companies.company.id,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,keywords.id,keywords.name;'

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

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function pickRandomItems<T>(items: T[], count: number): T[] {
  return shuffle(items).slice(0, count)
}

function uniqueByKey<T>(items: T[], getKey: (item: T) => string | number): T[] {
  return Array.from(new Map(items.map((item) => [getKey(item), item])).values())
}

function getCategoryCacheKey(category: Category): string {
  return [
    category.type,
    String(category.id),
    category.slug ?? '',
    normalizeName(category.name),
  ].join(':')
}

function getCellCacheKey(
  rowCategory: Category,
  colCategory: Category,
  sampleSize: number,
  scope: 'default' | 'intrinsic-only' = 'default'
): string {
  const [left, right] = [getCategoryCacheKey(rowCategory), getCategoryCacheKey(colCategory)].sort()
  return `${left}|${right}|${sampleSize}|${scope}`
}

function escapeIGDBSearch(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function buildAlternativeNameMatchWhereClause(query: string): string {
  return `name ~ *"${escapeIGDBSearch(query.trim())}"* & game != null`
}

export function shouldHideSameNamePortResult(
  portGame: IGDBGame,
  parentGame: IGDBGame | null
): boolean {
  if (portGame.game_type !== 11 || !parentGame) {
    return false
  }

  return normalizeName(portGame.name) === normalizeName(parentGame.name)
}

function formatIGDBDate(timestamp?: number | null): string | null {
  if (!timestamp) {
    return null
  }

  return new Date(timestamp * 1000).toISOString().split('T')[0]
}

function getMetacriticScore(totalRating?: number | null): number | null {
  if (typeof totalRating !== 'number') {
    return null
  }

  return Math.round(totalRating)
}

function buildCoverUrl(imageId?: string): string | null {
  if (!imageId) {
    return null
  }

  return `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`
}

function getOriginalPlatformName(game: IGDBGame): string | null {
  const datedReleasePlatforms = (game.release_dates ?? [])
    .filter(
      (releaseDate): releaseDate is IGDBReleaseDate & { date: number; platform: IGDBPlatform } =>
        typeof releaseDate.date === 'number' && Boolean(releaseDate.platform?.name)
    )
    .sort((left, right) => left.date - right.date)

  return datedReleasePlatforms[0]?.platform.name ?? null
}

function getGameTypeLabel(gameType?: number | null): string | null {
  if (typeof gameType !== 'number') {
    return null
  }

  return GAME_TYPE_LABELS[gameType] ?? null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function scheduleIGDBRequest(): Promise<void> {
  const run = async () => {
    const waitMs = Math.max(0, igdbNextRequestAt - Date.now())
    if (waitMs > 0) {
      await sleep(waitMs)
    }
    igdbNextRequestAt = Date.now() + IGDB_MIN_REQUEST_INTERVAL_MS
  }

  igdbRequestQueue = igdbRequestQueue.then(run, run)
  await igdbRequestQueue
}

async function getIGDBAccessToken(): Promise<string | null> {
  if (!TWITCH_IGDB_CLIENT_ID || !TWITCH_IGDB_CLIENT_SECRET) {
    return null
  }

  if (USING_TEST_IGDB_CREDENTIALS) {
    return null
  }

  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token
  }

  const tokenUrl =
    `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_IGDB_CLIENT_ID}` +
    `&client_secret=${TWITCH_IGDB_CLIENT_SECRET}&grant_type=client_credentials`

  const response = await fetch(tokenUrl, {
    method: 'POST',
    cache: 'no-store',
  })

  if (!response.ok) {
    logError(`Failed to get IGDB token: ${response.status}`)
    return null
  }

  const data = (await response.json()) as {
    access_token: string
    expires_in: number
  }

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max((data.expires_in - 60) * 1000, 60_000),
  }

  return tokenCache.token
}

async function fetchIGDBWithToken(
  accessToken: string,
  endpoint: string,
  body: string
): Promise<Response> {
  return fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': TWITCH_IGDB_CLIENT_ID!,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    body,
    cache: 'no-store',
  })
}

async function queryIGDB<T>(endpoint: string, body: string): Promise<T[]> {
  const accessToken = await getIGDBAccessToken()
  if (!accessToken || !TWITCH_IGDB_CLIENT_ID) {
    return []
  }

  for (let attempt = 1; attempt <= IGDB_MAX_RETRIES; attempt += 1) {
    try {
      await scheduleIGDBRequest()

      const response = await fetchIGDBWithToken(accessToken, endpoint, body)

      if (response.ok) {
        return (await response.json()) as T[]
      }

      if (response.status === 429 && attempt < IGDB_MAX_RETRIES) {
        const retryDelayMs = 1000 * attempt
        logWarn(`IGDB rate limited on ${endpoint}, retrying in ${retryDelayMs}ms`)
        await sleep(retryDelayMs)
        continue
      }

      logError(`IGDB query failed (${endpoint}): ${response.status}`)
      return []
    } catch (error) {
      if (attempt < IGDB_MAX_RETRIES) {
        const retryDelayMs = 1000 * attempt
        logWarn(`IGDB query transport error on ${endpoint}, retrying in ${retryDelayMs}ms`)
        await sleep(retryDelayMs)
        continue
      }

      throw error
    }
  }

  return []
}

async function queryIGDBConcurrent(
  queries: Array<{ key: string; endpoint: string; body: string }>
): Promise<Map<string, unknown[]>> {
  const accessToken = await getIGDBAccessToken()
  if (!accessToken || !TWITCH_IGDB_CLIENT_ID || queries.length === 0) {
    return new Map()
  }

  for (let attempt = 1; attempt <= IGDB_MAX_RETRIES; attempt += 1) {
    try {
      await scheduleIGDBRequest()

      const responses = await Promise.all(
        queries.map(async (query) => ({
          key: query.key,
          endpoint: query.endpoint,
          response: await fetchIGDBWithToken(accessToken, query.endpoint, query.body),
        }))
      )

      const rateLimited = responses.some(({ response }) => response.status === 429)
      if (rateLimited && attempt < IGDB_MAX_RETRIES) {
        const retryDelayMs = 1000 * attempt
        logWarn(`IGDB concurrent query rate limited, retrying in ${retryDelayMs}ms`)
        await sleep(retryDelayMs)
        continue
      }

      const results = new Map<string, unknown[]>()
      for (const { key, endpoint, response } of responses) {
        if (response.ok) {
          results.set(key, (await response.json()) as unknown[])
          continue
        }

        logError(`IGDB query failed (${endpoint}): ${response.status}`)
        results.set(key, [])
      }

      return results
    } catch (error) {
      if (attempt < IGDB_MAX_RETRIES) {
        const retryDelayMs = 1000 * attempt
        logWarn(`IGDB concurrent transport error, retrying in ${retryDelayMs}ms`)
        await sleep(retryDelayMs)
        continue
      }

      throw error
    }
  }

  return new Map()
}

export async function getIGDBPlatformSummary(platformId: number): Promise<string | null> {
  if (!Number.isFinite(platformId)) {
    return null
  }

  const cached = platformSummaryCache.get(platformId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.summary
  }

  const [platform] = await queryIGDB<Pick<IGDBPlatform, 'summary'>>(
    'platforms',
    `fields summary; where id = ${platformId}; limit 1;`
  )
  const summary = platform?.summary?.trim() || null

  platformSummaryCache.set(platformId, {
    expiresAt: Date.now() + PLATFORM_SUMMARY_CACHE_TTL_MS,
    summary,
  })

  return summary
}

async function queryIGDBCount(endpoint: string, whereClause: string): Promise<number | null> {
  const accessToken = await getIGDBAccessToken()
  if (!accessToken || !TWITCH_IGDB_CLIENT_ID) return null

  for (let attempt = 1; attempt <= IGDB_MAX_RETRIES; attempt += 1) {
    try {
      await scheduleIGDBRequest()

      const response = await fetch(`https://api.igdb.com/v4/${endpoint}/count`, {
        method: 'POST',
        headers: {
          'Client-ID': TWITCH_IGDB_CLIENT_ID,
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        body: `where ${whereClause};`,
        cache: 'no-store',
      })

      if (response.ok) {
        const data = (await response.json()) as { count: number }
        return data.count
      }

      if (response.status === 429 && attempt < IGDB_MAX_RETRIES) {
        await sleep(1000 * attempt)
        continue
      }

      logError(`IGDB count query failed (${endpoint}): ${response.status}`)
      return null
    } catch (error) {
      if (attempt < IGDB_MAX_RETRIES) {
        await sleep(1000 * attempt)
        continue
      }

      throw error
    }
  }

  return null
}

function cloneCategoryFamilies(families: ReadonlyArray<CategoryFamily>): CategoryFamily[] {
  return families.map((family) => ({
    key: family.key,
    source: family.source,
    categories: family.categories.map((category) => ({ ...category })),
  }))
}

export function resolveGenerationCategoryFamilies(
  allowedCategoryIds?: PuzzleCategoryFilters
): CategoryFamily[] {
  const familySource = cloneCategoryFamilies(
    allowedCategoryIds
      ? CURATED_VERSUS_GENERATION_CATEGORY_FAMILIES
      : CURATED_STANDARD_CATEGORY_FAMILIES
  )

  return familySource
    .map((family) => {
      const allowedIds = allowedCategoryIds?.[family.key]

      if (!allowedCategoryIds) {
        return family
      }

      const effectiveIds = allowedIds ?? CURATED_VERSUS_DEFAULT_SELECTIONS[family.key] ?? []

      return {
        ...family,
        categories: family.categories.filter((category) =>
          effectiveIds.includes(String(category.id))
        ),
      }
    })
    .filter((family) => family.categories.length > 0)
}

async function queryCellGamesPage(
  rowCategory: Category,
  colCategory: Category,
  limit: number,
  offset = 0,
  fields = 'name,slug,url,category,game_type,parent_game,first_release_date,rating,aggregated_rating,total_rating,total_rating_count,cover.image_id,platforms.name,platforms.slug,release_dates.date,release_dates.platform.name,release_dates.platform.slug,genres.name,genres.slug,game_modes.name,themes.name,player_perspectives.name,involved_companies.company.id,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,keywords.name',
  overfetchMultiplier = 3
): Promise<{ games: Game[]; rawCount: number; fetchLimit: number }> {
  const rowClause = buildIGDBWhereClause(rowCategory)
  const colClause = buildIGDBWhereClause(colCategory)
  const needsPostFilter = !rowClause || !colClause

  const baseWhereParts = [buildOfficialGameWhereClause()]
  if (rowClause) {
    baseWhereParts.push(rowClause)
  }
  if (colClause) {
    baseWhereParts.push(colClause)
  }

  const fetchLimit = needsPostFilter ? Math.min(limit * overfetchMultiplier, 500) : limit
  const query = [
    `fields ${fields};`,
    `where ${baseWhereParts.join(' & ')};`,
    `limit ${fetchLimit};`,
    `offset ${offset};`,
  ].join(' ')

  const results = await queryIGDB<IGDBGame>('games', query)
  const mappedGames = results.map(mapIGDBGameToGame)
  const filteredGames = needsPostFilter
    ? mappedGames.filter(
        (game) =>
          igdbGameMatchesCategory(game, rowCategory) && igdbGameMatchesCategory(game, colCategory)
      )
    : mappedGames

  return {
    games: Array.from(new Map(filteredGames.map((game) => [game.id, game])).values()),
    rawCount: results.length,
    fetchLimit,
  }
}

function buildAxisCategories(
  primary: CategoryFamily,
  secondary: CategoryFamily,
  oppositeAxisCategories: Category[]
): Category[] | null {
  const primaryPairs = shuffle(
    primary.categories.flatMap((first, firstIndex) =>
      primary.categories.slice(firstIndex + 1).map((second) => [first, second] as const)
    )
  )
  const secondaryOptions = shuffle(secondary.categories)

  for (const [firstPrimary, secondPrimary] of primaryPairs) {
    for (const secondaryCategory of secondaryOptions) {
      const candidateAxis = shuffle([firstPrimary, secondPrimary, secondaryCategory]).slice(0, 3)
      const hasInvalidCrossSection = candidateAxis.some((axisCategory) =>
        oppositeAxisCategories.some((oppositeCategory) =>
          getPairRejectionReason(axisCategory, oppositeCategory)
        )
      )

      if (!hasInvalidCrossSection) {
        return candidateAxis
      }
    }
  }

  return null
}

function permuteFamilies<T>(items: T[]): T[][] {
  if (items.length <= 1) {
    return [items]
  }

  const permutations: T[][] = []

  items.forEach((item, index) => {
    const remaining = [...items.slice(0, index), ...items.slice(index + 1)]
    permuteFamilies(remaining).forEach((permutation) => {
      permutations.push([item, ...permutation])
    })
  })

  return permutations
}

function buildBoardFromSelectedFamilies(selectedFamilies: CategoryFamily[]): {
  rows: Category[]
  cols: Category[]
  rowFamilies: [CategoryFamily, CategoryFamily]
  colFamilies: [CategoryFamily, CategoryFamily]
} | null {
  for (const permutation of shuffle(permuteFamilies(selectedFamilies))) {
    const [rowPrimary, rowSecondary, colPrimary, colSecondary] = permutation

    const cols = buildAxisCategories(colPrimary, colSecondary, [])
    if (!cols) {
      continue
    }

    const rows = buildAxisCategories(rowPrimary, rowSecondary, cols)
    if (!rows) {
      continue
    }

    return {
      rows,
      cols,
      rowFamilies: [rowPrimary, rowSecondary],
      colFamilies: [colPrimary, colSecondary],
    }
  }

  return null
}

function mapIGDBGameToGame(game: IGDBGame): Game {
  const platforms = (game.platforms ?? []).map((platform) => ({
    platform: {
      id: platform.id,
      name: platform.name,
      slug: platform.slug ?? normalizeName(platform.name).replace(/\s+/g, '-'),
    },
  }))

  const genres = (game.genres ?? []).map((genre) => ({
    id: genre.id,
    name: genre.name,
    slug: genre.slug ?? normalizeName(genre.name).replace(/\s+/g, '-'),
  }))

  const involvedCompanies = (game.involved_companies ?? []).filter(
    (entry): entry is IGDBInvolvedCompany & { company: IGDBCompany } => Boolean(entry.company)
  )
  const companies = involvedCompanies.map((entry) => entry.company)
  const developers = involvedCompanies
    .filter((entry) => entry.developer)
    .map((entry) => entry.company)
  const publishers = involvedCompanies
    .filter((entry) => entry.publisher)
    .map((entry) => entry.company)
  const getCompanyKey = (company: IGDBCompany) => company.id ?? normalizeName(company.name)
  const uniqueCompanies = uniqueByKey(companies, getCompanyKey)
  const uniqueDevelopers = uniqueByKey(developers, getCompanyKey)
  const uniquePublishers = uniqueByKey(publishers, getCompanyKey)
  const releaseDates = uniqueByKey(
    [
      formatIGDBDate(game.first_release_date),
      ...(game.release_dates ?? []).map((entry) => formatIGDBDate(entry.date)),
    ].filter((date): date is string => Boolean(date)),
    (date) => date
  )
  const stealRating = typeof game.total_rating === 'number' ? Math.round(game.total_rating) : null
  const stealRatingCount =
    typeof game.total_rating_count === 'number' ? game.total_rating_count : null

  return {
    id: game.id,
    name: game.name,
    slug: game.slug ?? normalizeName(game.name).replace(/\s+/g, '-'),
    gameUrl: game.url ?? null,
    background_image: buildCoverUrl(game.cover?.image_id),
    released: formatIGDBDate(game.first_release_date),
    releaseDates,
    metacritic: getMetacriticScore(game.total_rating),
    stealRating,
    stealRatingCount,
    gameTypeLabel: getGameTypeLabel(game.game_type),
    originalPlatformName: getOriginalPlatformName(game),
    hasSameNamePortFamily: game.hasSameNamePortFamily === true,
    genres,
    platforms,
    developers: uniqueDevelopers.map((company) => ({
      id: company.id,
      name: company.name,
      slug: normalizeName(company.name).replace(/\s+/g, '-'),
    })),
    publishers: uniquePublishers.map((company) => ({
      id: company.id,
      name: company.name,
      slug: normalizeName(company.name).replace(/\s+/g, '-'),
    })),
    tags: (game.keywords ?? []).map((keyword) => ({
      id: keyword.id,
      name: keyword.name,
      slug: normalizeName(keyword.name).replace(/\s+/g, '-'),
    })),
    igdb: {
      id: game.id,
      rating: game.rating ?? null,
      aggregated_rating: game.aggregated_rating ?? null,
      total_rating: game.total_rating ?? null,
      total_rating_count: game.total_rating_count ?? null,
      game_modes: game.game_modes?.map((mode) => mode.name) ?? [],
      themes: game.themes?.map((theme) => theme.name) ?? [],
      player_perspectives: game.player_perspectives?.map((perspective) => perspective.name) ?? [],
      companies: uniqueCompanies.map((company) => company.name),
      keywords: game.keywords?.map((keyword) => keyword.name) ?? [],
    },
  }
}

function hasOfficialCompanyData(game: IGDBGame): boolean {
  return (game.involved_companies ?? []).some((entry) => Boolean(entry.company?.name?.trim()))
}

function hasDisqualifyingKeywords(game: IGDBGame): boolean {
  return (game.keywords ?? []).some((keyword) =>
    DISQUALIFYING_KEYWORDS.has(normalizeName(keyword.name))
  )
}

function hasRecognizedRating(game: IGDBGame): boolean {
  return game.total_rating != null
}

function isOfficialCatalogGame(game: IGDBGame, options?: { requireRating?: boolean }): boolean {
  const requireRating = options?.requireRating ?? true

  if (!game.first_release_date) {
    return false
  }

  if (typeof game.game_type === 'number' && REJECTED_GAME_TYPE_SET.has(game.game_type)) {
    return false
  }

  if (typeof game.game_type === 'number' && !ALLOWED_GAME_TYPE_SET.has(game.game_type)) {
    return false
  }

  if (!hasOfficialCompanyData(game)) {
    return false
  }

  if (requireRating && !hasRecognizedRating(game)) {
    return false
  }

  if (hasDisqualifyingKeywords(game)) {
    return false
  }

  return !UNOFFICIAL_NAME_PATTERNS.some((pattern) => pattern.test(game.name))
}

function isSupplementalPortFamilyGame(game: IGDBGame): boolean {
  if (!game.first_release_date) {
    return false
  }

  if (game.game_type !== 11) {
    return false
  }

  if (!hasOfficialCompanyData(game)) {
    return false
  }

  if (hasDisqualifyingKeywords(game)) {
    return false
  }

  return !UNOFFICIAL_NAME_PATTERNS.some((pattern) => pattern.test(game.name))
}

function buildOfficialGameWhereClause(): string {
  return [
    'version_parent = null',
    'first_release_date != null',
    'involved_companies != null',
    'total_rating != null',
    `game_type = (${ALLOWED_GAME_TYPES.join(',')})`,
  ].join(' & ')
}

export function buildSearchGameWhereClause(options?: { requireRating?: boolean }): string {
  const requireRating = options?.requireRating ?? true

  return [
    'version_parent = null',
    'first_release_date != null',
    'involved_companies != null',
    ...(requireRating ? ['total_rating != null'] : []),
    `game_type = (${ALLOWED_GAME_TYPES.join(',')})`,
  ].join(' & ')
}

function buildSupplementalPortFamilyWhereClause(parentId: number): string {
  return [
    `parent_game = ${parentId}`,
    'version_parent = null',
    'first_release_date != null',
    'involved_companies != null',
    'game_type = 11',
  ].join(' & ')
}

function tokenizeNormalized(value: string): string[] {
  return normalizeName(value)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0
  }

  if (left.length === 0) {
    return right.length
  }

  if (right.length === 0) {
    return left.length
  }

  const matrix = Array.from({ length: left.length + 1 }, () =>
    new Array<number>(right.length + 1).fill(0)
  )

  for (let i = 0; i <= left.length; i += 1) {
    matrix[i][0] = i
  }

  for (let j = 0; j <= right.length; j += 1) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[left.length][right.length]
}

function getTokenSimilarityScore(queryToken: string, candidateToken: string): number {
  if (queryToken === candidateToken) {
    return 1
  }

  if (candidateToken.startsWith(queryToken) || queryToken.startsWith(candidateToken)) {
    return 0.9
  }

  const distance = levenshteinDistance(queryToken, candidateToken)
  const normalizedDistance = distance / Math.max(queryToken.length, candidateToken.length, 1)

  if (normalizedDistance <= 0.2) {
    return 0.8
  }

  if (normalizedDistance <= 0.34) {
    return 0.55
  }

  return 0
}

function getQueryTokenCoverageScore(query: string, candidateName: string): number {
  const queryTokens = tokenizeNormalized(query)
  const candidateTokens = tokenizeNormalized(candidateName)

  if (queryTokens.length === 0 || candidateTokens.length === 0) {
    return 0
  }

  let totalScore = 0

  for (const queryToken of queryTokens) {
    let bestTokenScore = 0

    for (const candidateToken of candidateTokens) {
      bestTokenScore = Math.max(bestTokenScore, getTokenSimilarityScore(queryToken, candidateToken))
      if (bestTokenScore === 1) {
        break
      }
    }

    totalScore += bestTokenScore
  }

  return totalScore / queryTokens.length
}

function getFallbackSearchTerms(query: string): string[] {
  const normalizedQuery = normalizeName(query)
  const tokens = tokenizeNormalized(query)
  const fallbackTerms: string[] = []

  if (tokens.length >= 2) {
    fallbackTerms.push(tokens.slice(0, -1).join(' '))
  }

  const longestToken = [...tokens].sort((left, right) => right.length - left.length)[0]
  if (longestToken && longestToken.length >= 4) {
    fallbackTerms.push(longestToken)
  }

  return Array.from(new Set(fallbackTerms.filter((term) => term && term !== normalizedQuery)))
}

function scoreSearchCandidate(
  candidate: IGDBGame,
  query: string,
  altMatchIds = new Set<number>()
): number {
  const normalizedQuery = normalizeName(query)
  const normalizedName = normalizeName(candidate.name)
  const hasCompanies = hasOfficialCompanyData(candidate)
  const tokenCoverage = getQueryTokenCoverageScore(query, candidate.name)

  let score = 0

  if (normalizedName === normalizedQuery) {
    score += 120
  } else if (normalizedName.startsWith(normalizedQuery)) {
    score += 80
  } else if (normalizedName.includes(normalizedQuery)) {
    score += 40
  }

  score += Math.round(tokenCoverage * 80)

  if (typeof candidate.game_type === 'number' && ALLOWED_GAME_TYPE_SET.has(candidate.game_type)) {
    score += 20
  }

  if (hasCompanies) {
    score += 20
  }

  if (altMatchIds.has(candidate.id)) {
    score += 70
  }

  if (candidate.first_release_date) {
    score += 10
  }

  score += Math.min(candidate.total_rating_count ?? 0, 50)

  if (UNOFFICIAL_NAME_PATTERNS.some((pattern) => pattern.test(candidate.name))) {
    score -= 200
  }

  return score
}

function scoreAlternativeNameMatch(query: string, alternativeName: string): number {
  const normalizedQuery = normalizeName(query)
  const normalizedAlternativeName = normalizeName(alternativeName)
  const tokenCoverage = getQueryTokenCoverageScore(query, alternativeName)

  let score = 0

  if (normalizedAlternativeName === normalizedQuery) {
    score += 120
  } else if (normalizedAlternativeName.startsWith(normalizedQuery)) {
    score += 80
  } else if (normalizedAlternativeName.includes(normalizedQuery)) {
    score += 40
  }

  score += Math.round(tokenCoverage * 80)

  return score
}

export function pickBetterAlternativeNameMatch(
  query: string,
  currentAlternativeName: string | null | undefined,
  nextAlternativeName: string | null | undefined
): string | null {
  const currentName = currentAlternativeName?.trim() ?? ''
  const nextName = nextAlternativeName?.trim() ?? ''

  if (!nextName) return currentName || null
  if (!currentName) return nextName

  return scoreAlternativeNameMatch(query, nextName) > scoreAlternativeNameMatch(query, currentName)
    ? nextName
    : currentName
}

async function queryIGDBGamesByIds(gameIds: number[]): Promise<IGDBGame[]> {
  const uniqueIds = Array.from(new Set(gameIds.filter((id) => Number.isFinite(id))))
  if (uniqueIds.length === 0) {
    return []
  }

  const query = [
    IGDB_GAME_FIELDS,
    `where id = (${uniqueIds.join(',')}) & ${buildOfficialGameWhereClause()};`,
    `limit ${Math.max(uniqueIds.length, 1)};`,
  ].join(' ')

  const results = await queryIGDB<IGDBGame>('games', query)
  const officialResults = results.filter((game) => isOfficialCatalogGame(game))
  const resultMap = new Map(officialResults.map((game) => [game.id, game]))

  for (const gameId of uniqueIds) {
    igdbRawGameCache.set(gameId, resultMap.get(gameId) ?? null)
  }

  return officialResults
}

async function getRawIGDBGameDetails(gameId: number): Promise<IGDBGame | null> {
  if (igdbRawGameCache.has(gameId)) {
    return igdbRawGameCache.get(gameId) ?? null
  }

  const [result] = await queryIGDBGamesByIds([gameId])
  const cachedResult = result ?? null
  igdbRawGameCache.set(gameId, cachedResult)
  return cachedResult
}

async function getParentLookupMap(gameIds: number[]): Promise<Map<number, IGDBGame>> {
  const parentGames = await queryIGDBGamesByIds(gameIds)
  return new Map(parentGames.map((game) => [game.id, game]))
}

async function hideSameNamePortResults(results: IGDBGame[]): Promise<IGDBGame[]> {
  const parentIds = Array.from(
    new Set(
      results
        .filter((result) => result.game_type === 11 && typeof result.parent_game === 'number')
        .map((result) => result.parent_game as number)
    )
  )

  if (parentIds.length === 0) {
    return results
  }

  const parentLookup = await getParentLookupMap(parentIds)
  const hiddenParentIds = new Set<number>()
  const visibleResults = results.filter((result) => {
    if (result.game_type !== 11 || typeof result.parent_game !== 'number') {
      return true
    }

    const shouldHide = shouldHideSameNamePortResult(
      result,
      parentLookup.get(result.parent_game) ?? null
    )
    if (shouldHide) {
      hiddenParentIds.add(result.parent_game)
    }
    return !shouldHide
  })

  return visibleResults.map((result) =>
    hiddenParentIds.has(result.id) ? { ...result, hasSameNamePortFamily: true } : result
  )
}

function mergeNamedItems<T extends { id: number; name: string; slug?: string }>(
  groups: Array<T[] | undefined>
): T[] {
  return uniqueByKey(
    groups.flatMap((group) => group ?? []),
    (item) => item.id ?? `${normalizeName(item.name)}:${item.slug ?? ''}`
  )
}

function mergeStringArrays(groups: Array<string[] | undefined>): string[] {
  return uniqueByKey(
    groups.flatMap((group) => group ?? []),
    (value) => normalizeName(value)
  )
}

export function mergePortFamilyGameDetails(
  selectedGame: Game,
  familyGames: Game[],
  canonicalGame: Game | null
): Game {
  const mergedFamily = uniqueByKey([selectedGame, ...familyGames], (game) => game.id)
  const mergedPlatforms = uniqueByKey(
    mergedFamily.flatMap((game) => game.platforms ?? []),
    (platform) => platform.platform.id
  )
  const mergedReleaseDates = uniqueByKey(
    mergedFamily.flatMap((game) =>
      game.releaseDates && game.releaseDates.length > 0
        ? game.releaseDates
        : game.released
          ? [game.released]
          : []
    ),
    (date) => date
  )

  return {
    ...selectedGame,
    gameUrl: canonicalGame?.gameUrl ?? selectedGame.gameUrl,
    releaseDates: mergedReleaseDates,
    genres: mergeNamedItems(mergedFamily.map((game) => game.genres)),
    platforms: mergedPlatforms,
    developers: mergeNamedItems(mergedFamily.map((game) => game.developers)),
    publishers: mergeNamedItems(mergedFamily.map((game) => game.publishers)),
    tags: mergeNamedItems(mergedFamily.map((game) => game.tags)),
    igdb: selectedGame.igdb
      ? {
          ...selectedGame.igdb,
          game_modes: mergeStringArrays(mergedFamily.map((game) => game.igdb?.game_modes)),
          themes: mergeStringArrays(mergedFamily.map((game) => game.igdb?.themes)),
          player_perspectives: mergeStringArrays(
            mergedFamily.map((game) => game.igdb?.player_perspectives)
          ),
          companies: mergeStringArrays(mergedFamily.map((game) => game.igdb?.companies)),
          keywords: mergeStringArrays(mergedFamily.map((game) => game.igdb?.keywords)),
        }
      : undefined,
  }
}

async function getPortFamilyGames(
  game: IGDBGame
): Promise<{ selected: Game; canonical: Game | null; family: Game[] }> {
  const selected = mapIGDBGameToGame(game)
  const canonicalRaw =
    typeof game.parent_game === 'number' ? await getRawIGDBGameDetails(game.parent_game) : game
  const canonical = canonicalRaw ? mapIGDBGameToGame(canonicalRaw) : null
  const parentId =
    canonicalRaw?.id ??
    (game.game_type === 11 && typeof game.parent_game === 'number' ? game.parent_game : null)

  if (!parentId) {
    return { selected, canonical, family: [selected] }
  }

  const childQuery = [
    IGDB_GAME_FIELDS,
    `where ${buildSupplementalPortFamilyWhereClause(parentId)};`,
    'limit 100;',
  ].join(' ')

  const childPorts = (await queryIGDB<IGDBGame>('games', childQuery)).filter(
    isSupplementalPortFamilyGame
  )
  const familyRawGames = uniqueByKey(
    [game, ...(canonicalRaw ? [canonicalRaw] : []), ...childPorts],
    (entry) => entry.id
  )

  return {
    selected,
    canonical,
    family: familyRawGames.map(mapIGDBGameToGame),
  }
}

export async function getIGDBFamilyNames(gameId: number): Promise<string[]> {
  const game = await getRawIGDBGameDetails(gameId)
  if (!game) {
    return []
  }

  const parentId =
    typeof game.parent_game === 'number'
      ? game.parent_game
      : typeof game.version_parent === 'number'
        ? game.version_parent
        : game.id

  const parentGame = await getRawIGDBGameDetails(parentId)
  const siblingQuery = [
    IGDB_GAME_FIELDS,
    `where parent_game = ${parentId} | version_parent = ${parentId};`,
    'limit 100;',
  ].join(' ')

  const siblings = (await queryIGDB<IGDBGame>('games', siblingQuery)).filter(
    (entry) =>
      typeof entry.first_release_date === 'number' &&
      !hasDisqualifyingKeywords(entry) &&
      !UNOFFICIAL_NAME_PATTERNS.some((pattern) => pattern.test(entry.name)) &&
      !REJECTED_GAME_TYPE_SET.has(entry.game_type ?? -1)
  )

  return uniqueByKey(
    [game, ...(parentGame ? [parentGame] : []), ...siblings]
      .map((entry) => entry.name)
      .filter((name): name is string => Boolean(name?.trim())),
    (name) => normalizeName(name)
  )
}

export async function searchIGDBGames(
  query: string,
  options?: { allowUnratedFallback?: boolean; onDebugEvent?: (event: SearchDebugEvent) => void }
): Promise<Game[]> {
  if (!query.trim()) {
    return []
  }

  const allowUnratedFallback = options?.allowUnratedFallback ?? false
  const onDebugEvent = options?.onDebugEvent
  const primarySearchOptions = allowUnratedFallback ? { requireRating: false } : undefined

  const runSearch = async (
    searchTerm: string,
    limit = 30,
    searchOptions?: { requireRating?: boolean },
    requestOptions?: { includeAlternativeNames?: boolean }
  ) => {
    const includeAlternativeNames = requestOptions?.includeAlternativeNames ?? true
    const queryResults = await queryIGDBConcurrent(
      [
        {
          key: 'games',
          endpoint: 'games',
          body: [
            IGDB_GAME_FIELDS,
            `where ${buildSearchGameWhereClause(searchOptions)};`,
            `search "${escapeIGDBSearch(searchTerm)}";`,
            `limit ${limit};`,
          ].join(' '),
        },
        includeAlternativeNames
          ? {
              key: 'alternativeNames',
              endpoint: 'alternative_names',
              body: [
                'fields game,name,comment;',
                `where ${buildAlternativeNameMatchWhereClause(searchTerm)};`,
                `limit ${Math.max(limit, IGDB_ALT_NAME_SEARCH_LIMIT)};`,
              ].join(' '),
            }
          : null,
      ].filter(
        (queryDef): queryDef is { key: string; endpoint: string; body: string } => queryDef !== null
      )
    )

    const games = (queryResults.get('games') as IGDBGame[] | undefined) ?? []
    const alternativeNames =
      (queryResults.get('alternativeNames') as IGDBAlternativeName[] | undefined) ?? []

    return { games, alternativeNames }
  }

  const gatherVisibleResults = async (
    searchOptions?: { requireRating?: boolean },
    gatherOptions?: { allowFallbackTerms?: boolean }
  ) => {
    const requireRating = searchOptions?.requireRating ?? true
    const primarySearch = await runSearch(query, 30, searchOptions)
    let mergedResults = [...primarySearch.games]
    const altMatchedNames = new Map<number, string>()
    for (const entry of primarySearch.alternativeNames) {
      if (Number.isFinite(entry.game) && typeof entry.name === 'string' && entry.name.trim()) {
        const gameId = entry.game as number
        const betterName = pickBetterAlternativeNameMatch(
          query,
          altMatchedNames.get(gameId),
          entry.name
        )
        if (betterName) {
          altMatchedNames.set(gameId, betterName)
        }
      }
    }
    const altMatchedGameIds = new Set<number>(
      primarySearch.alternativeNames
        .map((entry) => entry.game)
        .filter((gameId): gameId is number => Number.isFinite(gameId))
    )

    if (altMatchedGameIds.size > 0) {
      const altGames = await queryIGDBGamesByIds([...altMatchedGameIds])
      mergedResults = [...mergedResults, ...altGames]
    }

    const allowFallbackTerms = gatherOptions?.allowFallbackTerms ?? true
    if (allowFallbackTerms && primarySearch.games.length < 5) {
      const fallbackTerms = getFallbackSearchTerms(query)
      for (const fallbackTerm of fallbackTerms.slice(0, 1)) {
        const fallbackSearch = await runSearch(fallbackTerm, 40, searchOptions, {
          includeAlternativeNames: false,
        })
        onDebugEvent?.({
          stage: 'fallback-search',
          requireRating,
          query,
          fallbackTerm,
          gameCount: fallbackSearch.games.length,
        })
        mergedResults = [...mergedResults, ...fallbackSearch.games]

        if (fallbackSearch.games.length > 0 || mergedResults.length >= 30) {
          break
        }
      }
    }

    const filteredResults = Array.from(
      new Map(mergedResults.map((result) => [result.id, result])).values()
    ).filter((result) => isOfficialCatalogGame(result, searchOptions))

    const visibleResults = await hideSameNamePortResults(filteredResults)

    onDebugEvent?.({
      stage: 'primary-search',
      requireRating,
      query,
      gameCount: primarySearch.games.length,
      alternativeNameCount: primarySearch.alternativeNames.length,
      alternativeMatchCount: altMatchedGameIds.size,
      altGameFetchCount: altMatchedGameIds.size,
      visibleResultCount: visibleResults.length,
    })

    return {
      results: visibleResults,
      altMatchedGameIds,
      altMatchedNames,
      primarySearchGameCount: primarySearch.games.length,
    }
  }

  const {
    results: visibleResults,
    altMatchedGameIds,
    altMatchedNames,
  } = await gatherVisibleResults(primarySearchOptions)
  const rankedResults = visibleResults.sort(
    (left, right) =>
      scoreSearchCandidate(right, query, altMatchedGameIds) -
      scoreSearchCandidate(left, query, altMatchedGameIds)
  )

  const finalResults = rankedResults.slice(0, 15).map((game) => {
    const mapped = mapIGDBGameToGame(game)
    const matchedAltName = altMatchedNames.get(game.id) ?? null
    return {
      ...mapped,
      matchedAltName:
        matchedAltName && normalizeName(matchedAltName) !== normalizeName(mapped.name)
          ? matchedAltName
          : null,
    }
  })

  onDebugEvent?.({
    stage: 'final-results',
    query,
    resultCount: finalResults.length,
    altMatchCount: altMatchedNames.size,
  })

  return finalResults
}

export async function getIGDBGameDetails(gameId: number): Promise<Game | null> {
  if (igdbGameCache.has(gameId)) {
    return igdbGameCache.get(gameId) ?? null
  }

  const result = await getRawIGDBGameDetails(gameId)
  if (!result) {
    igdbGameCache.set(gameId, null)
    return null
  }

  const mapped = mapIGDBGameToGame(result)
  igdbGameCache.set(gameId, mapped)
  return mapped
}

export async function getResolvedIGDBGameDetails(
  gameId: number
): Promise<ResolvedIGDBGameDetails | null> {
  if (igdbResolvedPortFamilyCache.has(gameId)) {
    return igdbResolvedPortFamilyCache.get(gameId) ?? null
  }

  const rawGame = await getRawIGDBGameDetails(gameId)
  if (!rawGame) {
    igdbResolvedPortFamilyCache.set(gameId, null)
    return null
  }

  const { selected, canonical, family } = await getPortFamilyGames(rawGame)
  const merged = mergePortFamilyGameDetails(selected, family, canonical)
  const resolvedDetails = {
    selectedGame: selected,
    game: merged,
  }
  igdbResolvedPortFamilyCache.set(gameId, resolvedDetails)
  return resolvedDetails
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  const normalizedLeft = [...left].map((value) => value.toLowerCase()).sort()
  const normalizedRight = [...right].map((value) => value.toLowerCase()).sort()

  return normalizedLeft.every((value, index) => value === normalizedRight[index])
}

function didCategoryExplanationChange(
  before: CategoryMatchExplanation,
  after: CategoryMatchExplanation
): boolean {
  return (
    before.matched !== after.matched ||
    before.matchSource !== after.matchSource ||
    before.note !== after.note ||
    !areStringArraysEqual(before.matchedValues, after.matchedValues)
  )
}

function buildGuessValidationExplanation(options: {
  selectedGame: Game
  resolvedGame: Game
  rowCategory: Category
  colCategory: Category
}): GuessValidationExplanation {
  const { selectedGame, resolvedGame, rowCategory, colCategory } = options
  const row = explainIGDBGameMatch(resolvedGame, rowCategory)
  const col = explainIGDBGameMatch(resolvedGame, colCategory)
  const selectedRow = explainIGDBGameMatch(selectedGame, rowCategory)
  const selectedCol = explainIGDBGameMatch(selectedGame, colCategory)
  const familyResolutionUsed =
    didCategoryExplanationChange(selectedRow, row) || didCategoryExplanationChange(selectedCol, col)

  return {
    row,
    col,
    familyResolution: {
      used: familyResolutionUsed,
      selectedGameId: selectedGame.id,
      selectedGameName: selectedGame.name,
      note: familyResolutionUsed
        ? 'Validated using merged original + official port family metadata.'
        : null,
    },
  }
}

export async function validateIGDBGameForCell(
  gameId: number,
  rowCategory: Category,
  colCategory: Category
): Promise<{
  valid: boolean
  game: Game | null
  selectedGame: Game | null
  matchesRow: boolean
  matchesCol: boolean
  explanation: GuessValidationExplanation | null
}> {
  const resolvedDetails = await getResolvedIGDBGameDetails(gameId)
  if (!resolvedDetails) {
    return {
      valid: false,
      game: null,
      selectedGame: null,
      matchesRow: false,
      matchesCol: false,
      explanation: null,
    }
  }

  const explanation = buildGuessValidationExplanation({
    selectedGame: resolvedDetails.selectedGame,
    resolvedGame: resolvedDetails.game,
    rowCategory,
    colCategory,
  })
  const matchesRow = explanation.row.matched
  const matchesCol = explanation.col.matched

  return {
    valid: matchesRow && matchesCol,
    game: resolvedDetails.game,
    selectedGame: resolvedDetails.selectedGame,
    matchesRow,
    matchesCol,
    explanation,
  }
}

export async function getValidGamesForCell(
  rowCategory: Category,
  colCategory: Category,
  sampleSize = DEFAULT_CELL_SAMPLE_SIZE
): Promise<Game[]> {
  const pairRejectionReason = getPairRejectionReason(rowCategory, colCategory)
  if (pairRejectionReason) {
    cellValidationCache.set(getCellCacheKey(rowCategory, colCategory, sampleSize), {
      expiresAt: Date.now() + CELL_VALIDATION_CACHE_TTL_MS,
      games: [],
    })
    return []
  }

  const cacheKey = getCellCacheKey(rowCategory, colCategory, sampleSize)
  const cachedEntry = cellValidationCache.get(cacheKey)
  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.games
  }

  try {
    const seenGameIds = new Set<number>()
    const collectedGames: Game[] = []
    let offset = 0
    let hasMore = true

    while (hasMore && collectedGames.length < sampleSize) {
      const { games, rawCount, fetchLimit } = await queryCellGamesPage(
        rowCategory,
        colCategory,
        sampleSize,
        offset
      )

      for (const game of games) {
        if (seenGameIds.has(game.id)) {
          continue
        }

        seenGameIds.add(game.id)
        collectedGames.push(game)
        if (collectedGames.length >= sampleSize) {
          break
        }
      }

      hasMore = rawCount === fetchLimit
      offset += fetchLimit
    }

    const games = collectedGames.slice(0, sampleSize)
    cellValidationCache.set(cacheKey, {
      expiresAt: Date.now() + CELL_VALIDATION_CACHE_TTL_MS,
      games,
    })
    return games
  } catch (error) {
    logError('Error getting IGDB valid games:', error)
    if (cachedEntry) {
      return cachedEntry.games
    }
    throw error
  }
}

export async function getValidGameCountForCell(
  rowCategory: Category,
  colCategory: Category,
  options: { ignoreCuratedPairBans?: boolean } = {}
): Promise<number> {
  const pairRejectionReason = options.ignoreCuratedPairBans
    ? getIntrinsicPairRejectionReason(rowCategory, colCategory)
    : getPairRejectionReason(rowCategory, colCategory)
  if (pairRejectionReason) {
    cellCountCache.set(
      getCellCacheKey(
        rowCategory,
        colCategory,
        -1,
        options.ignoreCuratedPairBans ? 'intrinsic-only' : 'default'
      ),
      {
        expiresAt: Date.now() + CELL_VALIDATION_CACHE_TTL_MS,
        count: 0,
      }
    )
    return 0
  }

  const cacheKey = getCellCacheKey(
    rowCategory,
    colCategory,
    -1,
    options.ignoreCuratedPairBans ? 'intrinsic-only' : 'default'
  )
  const cachedEntry = cellCountCache.get(cacheKey)
  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.count
  }

  try {
    const rowClause = buildIGDBWhereClause(rowCategory)
    const colClause = buildIGDBWhereClause(colCategory)

    // If both categories have native IGDB where clauses, use the /count endpoint —
    // a single API call that returns the exact total with no pagination needed.
    if (rowClause && colClause) {
      const whereClause = `${buildOfficialGameWhereClause()} & ${rowClause} & ${colClause}`
      const count = await queryIGDBCount('games', whereClause)
      if (count !== null) {
        cellCountCache.set(cacheKey, {
          expiresAt: Date.now() + CELL_VALIDATION_CACHE_TTL_MS,
          count,
        })
        return count
      }
    }

    // Fallback for categories that need post-filtering (e.g. decade) —
    // paginate through results and count manually.
    const pageSize = 500
    const seenGameIds = new Set<number>()
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { games, rawCount, fetchLimit } = await queryCellGamesPage(
        rowCategory,
        colCategory,
        pageSize,
        offset,
        'id,name,slug,url,category,game_type,parent_game,first_release_date,rating,aggregated_rating,total_rating,total_rating_count,cover.image_id,platforms.name,platforms.slug,release_dates.date,release_dates.platform.name,release_dates.platform.slug,genres.name,genres.slug,game_modes.name,themes.name,player_perspectives.name,involved_companies.company.id,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,keywords.name',
        1
      )
      for (const game of games) seenGameIds.add(game.id)
      hasMore = rawCount === fetchLimit
      offset += fetchLimit
    }

    const count = seenGameIds.size
    cellCountCache.set(cacheKey, {
      expiresAt: Date.now() + CELL_VALIDATION_CACHE_TTL_MS,
      count,
    })
    return count
  } catch (error) {
    logError('Error getting IGDB valid game count:', error)
    if (cachedEntry) {
      return cachedEntry.count
    }
    throw error
  }
}

export async function validatePuzzleCategories(
  rows: Category[],
  cols: Category[],
  options: PuzzleGenerationOptions = {},
  onCellValidated?: (event: CellValidationResult & { totalCells: number; passed: boolean }) => void
): Promise<PuzzleValidationResult> {
  const minValidOptionsPerCell = options.minValidOptionsPerCell ?? DEFAULT_MIN_VALID_OPTIONS
  const sampleSize = options.sampleSize ?? DEFAULT_CELL_SAMPLE_SIZE
  const cellResults: CellValidationResult[] = []
  const totalCells = rows.length * cols.length

  for (const [rowIndex, rowCategory] of rows.entries()) {
    for (const [colIndex, colCategory] of cols.entries()) {
      const cellIndex = rowIndex * 3 + colIndex
      const pairRejectionReason = getPairRejectionReason(rowCategory, colCategory)
      if (pairRejectionReason) {
        const result = {
          cellIndex,
          rowCategory,
          colCategory,
          validOptionCount: 0,
        }
        cellResults.push(result)
        onCellValidated?.({ ...result, totalCells, passed: false })
        continue
      }

      const validGames = await getValidGamesForCell(rowCategory, colCategory, sampleSize)
      const result = {
        cellIndex,
        rowCategory,
        colCategory,
        validOptionCount: new Set(validGames.map((game) => game.id)).size,
      }
      cellResults.push(result)
      onCellValidated?.({
        ...result,
        totalCells,
        passed: result.validOptionCount >= minValidOptionsPerCell,
      })
    }
  }

  const failedCells = cellResults.filter((cell) => cell.validOptionCount < minValidOptionsPerCell)
  const minValidOptionCount = cellResults.reduce(
    (lowest, cell) => Math.min(lowest, cell.validOptionCount),
    Number.POSITIVE_INFINITY
  )

  return {
    valid: failedCells.length === 0,
    minValidOptionCount: Number.isFinite(minValidOptionCount) ? minValidOptionCount : 0,
    cellResults,
    failedCells,
  }
}

export async function generatePuzzleCategories(
  options: PuzzleGenerationOptions = {}
): Promise<PuzzleGenerationResult> {
  const minValidOptionsPerCell = options.minValidOptionsPerCell ?? DEFAULT_MIN_VALID_OPTIONS
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_GENERATION_ATTEMPTS
  const sampleSize = options.sampleSize ?? DEFAULT_CELL_SAMPLE_SIZE

  const onProgress = options.onProgress

  onProgress?.({ stage: 'families', message: 'Loading category data...' })
  const allowedCategoryIds = options.allowedCategoryIds
  const families = resolveGenerationCategoryFamilies(allowedCategoryIds)
  if (families.length < 4) {
    throw new Error('Custom setup needs at least 4 enabled category families to generate a board')
  }

  const pinnedFamilyKeys = families
    .filter((family) => {
      const allowedIds = allowedCategoryIds?.[family.key]
      return Boolean(allowedIds && allowedIds.length > 0)
    })
    .map((family) => family.key)

  let bestAttempt: {
    rows: Category[]
    cols: Category[]
    validation: PuzzleValidationResult
  } | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    onProgress?.({
      stage: 'attempt',
      attempt,
      maxAttempts,
      message: `Attempt ${attempt} of ${maxAttempts}: picking categories...`,
    })
    const pinnedFamilies = families.filter((family) => pinnedFamilyKeys.includes(family.key))
    const remainingFamilies = families.filter((family) => !pinnedFamilyKeys.includes(family.key))
    const selectedFamilies = [
      ...(pinnedFamilies.length > 4 ? pickRandomItems(pinnedFamilies, 4) : shuffle(pinnedFamilies)),
      ...pickRandomItems(remainingFamilies, Math.max(0, 4 - pinnedFamilies.length)),
    ].slice(0, 4)

    if (selectedFamilies.length < 4) {
      continue
    }
    const board = buildBoardFromSelectedFamilies(selectedFamilies)
    if (!board) {
      continue
    }
    const { rows, cols, rowFamilies, colFamilies } = board
    onProgress?.({
      stage: 'attempt',
      attempt,
      maxAttempts,
      rows: rows.map((category) => category.name),
      cols: cols.map((category) => category.name),
      message: `Attempt ${attempt}/${maxAttempts}: testing ${rows[0].name} x ${cols[0].name}...`,
    })
    const validation = await validatePuzzleCategories(
      rows,
      cols,
      {
        minValidOptionsPerCell,
        sampleSize,
      },
      (event) => {
        onProgress?.({
          stage: 'cell',
          attempt,
          maxAttempts,
          cellIndex: event.cellIndex,
          totalCells: event.totalCells,
          rowCategory: event.rowCategory.name,
          colCategory: event.colCategory.name,
          validOptionCount: event.validOptionCount,
          passed: event.passed,
          message: `Attempt ${attempt}: checking intersection ${event.cellIndex + 1}/${event.totalCells}...`,
        })
      }
    )

    if (
      !bestAttempt ||
      validation.minValidOptionCount > bestAttempt.validation.minValidOptionCount
    ) {
      bestAttempt = { rows, cols, validation }
    }

    if (validation.valid) {
      const exactCellResults = await Promise.all(
        rows.flatMap((rowCategory, rowIndex) =>
          cols.map(async (colCategory, colIndex) => {
            const cellIndex = rowIndex * 3 + colIndex
            const validOptionCount = await getValidGameCountForCell(rowCategory, colCategory)
            onProgress?.({
              stage: 'metadata',
              attempt,
              maxAttempts,
              cellIndex,
              totalCells: rows.length * cols.length,
              rowCategory: rowCategory.name,
              colCategory: colCategory.name,
              validOptionCount,
              passed: validOptionCount >= minValidOptionsPerCell,
              message: `Attempt ${attempt}: counting answers for\n${rowCategory.name} x ${colCategory.name}`,
            })

            return {
              cellIndex,
              rowCategory,
              colCategory,
              validOptionCount,
            }
          })
        )
      )
      const exactValidation: PuzzleValidationResult = {
        valid: exactCellResults.every((cell) => cell.validOptionCount >= minValidOptionsPerCell),
        minValidOptionCount: exactCellResults.reduce(
          (lowest, cell) => Math.min(lowest, cell.validOptionCount),
          Number.POSITIVE_INFINITY
        ),
        cellResults: exactCellResults,
        failedCells: exactCellResults.filter(
          (cell) => cell.validOptionCount < minValidOptionsPerCell
        ),
      }
      const cellMetadata = buildPuzzleCellMetadata(
        exactValidation,
        minValidOptionsPerCell,
        sampleSize,
        false
      )

      logInfo(
        `Generated validated IGDB puzzle on attempt ${attempt} with min ${validation.minValidOptionCount} valid options per cell`
      )
      logInfo(
        `Family sources - rows: ${rowFamilies[0].key}:${rowFamilies[0].source}, ${rowFamilies[1].key}:${rowFamilies[1].source}; cols: ${colFamilies[0].key}:${colFamilies[0].source}, ${colFamilies[1].key}:${colFamilies[1].source}`
      )
      return {
        rows,
        cols,
        rowFamilies,
        colFamilies,
        validation: exactValidation,
        cellMetadata,
      }
    }

    logInfo(
      `Rejected IGDB puzzle attempt ${attempt}: ` +
        validation.failedCells
          .map(
            (cell) =>
              `[${cell.rowCategory.name} x ${cell.colCategory.name}: ${cell.validOptionCount}]`
          )
          .join(', ')
    )
    const funniestFailure = validation.failedCells[0]
    if (funniestFailure) {
      onProgress?.({
        stage: 'rejected',
        attempt,
        maxAttempts,
        message:
          `${funniestFailure.rowCategory.name} x ${funniestFailure.colCategory.name} rejected ` +
          `(${funniestFailure.validOptionCount} valid)`,
      })
    }
  }

  const failureSummary = bestAttempt
    ? bestAttempt.validation.failedCells
        .map(
          (cell) => `${cell.rowCategory.name} x ${cell.colCategory.name} (${cell.validOptionCount})`
        )
        .join(', ')
    : 'no candidate puzzle could be evaluated'

  throw new Error(
    `Unable to generate an IGDB puzzle with at least ${minValidOptionsPerCell} valid options per cell after ${maxAttempts} attempts. Best attempt failed on: ${failureSummary}`
  )
}
