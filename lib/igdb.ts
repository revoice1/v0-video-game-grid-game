import type { Category, Game, PuzzleCellMetadata } from './types'

const TWITCH_IGDB_CLIENT_ID = process.env.TWITCH_IGDB_CLIENT_ID
const TWITCH_IGDB_CLIENT_SECRET = process.env.TWITCH_IGDB_CLIENT_SECRET

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
}

export interface IGDBGame {
  id: number
  name: string
  slug?: string
  url?: string
  category?: number | null
  game_type?: number | null
  parent_game?: number | null
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
}

interface IGDBTokenCache {
  token: string
  expiresAt: number
}

let tokenCache: IGDBTokenCache | null = null
const igdbGameCache = new Map<number, Game | null>()
let categoryFamiliesCache:
  | {
      expiresAt: number
      families: CategoryFamily[]
    }
  | null = null
const DEFAULT_CELL_SAMPLE_SIZE = 40
const DEFAULT_MIN_VALID_OPTIONS = 3
const DEFAULT_MAX_GENERATION_ATTEMPTS = 12
const DEFAULT_CELL_VALIDATION_CACHE_TTL_MS = 1000 * 60 * 60 * 6
const DEFAULT_CATEGORY_FAMILY_CACHE_TTL_MS = 1000 * 60 * 60 * 12
const DEFAULT_IGDB_MIN_REQUEST_INTERVAL_MS = 350
const DEFAULT_IGDB_MAX_RETRIES = 3
const ALLOWED_GAME_TYPES = [0, 8, 9, 10, 11] as const
const ALLOWED_GAME_TYPE_SET = new Set<number>(ALLOWED_GAME_TYPES)
const REJECTED_GAME_TYPE_SET = new Set<number>([1, 2, 3, 4, 5, 6, 7, 12, 13, 14])
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

interface CategoryFamily {
  key: 'platform' | 'genre' | 'decade' | 'game_mode' | 'theme' | 'perspective'
  source: 'dynamic' | 'fallback'
  categories: Category[]
}

export type PuzzleProgressCallback = (event: {
  stage: 'families' | 'attempt' | 'cell' | 'metadata' | 'rejected' | 'done'
  attempt?: number
  maxAttempts?: number
  cellIndex?: number    // 0-8 within current attempt
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
const CATEGORY_FAMILY_CACHE_TTL_MS = Number(
  process.env.PUZZLE_CATEGORY_FAMILY_CACHE_TTL_MS ?? DEFAULT_CATEGORY_FAMILY_CACHE_TTL_MS
)
const IGDB_MIN_REQUEST_INTERVAL_MS = Number(
  process.env.IGDB_MIN_REQUEST_INTERVAL_MS ?? DEFAULT_IGDB_MIN_REQUEST_INTERVAL_MS
)
const IGDB_MAX_RETRIES = Number(process.env.IGDB_MAX_RETRIES ?? DEFAULT_IGDB_MAX_RETRIES)
const cellValidationCache = new Map<string, CellValidationCacheEntry>()
const cellCountCache = new Map<string, CellCountCacheEntry>()
let igdbRequestQueue = Promise.resolve()
let igdbNextRequestAt = 0

const FALLBACK_DECADES: Category[] = [
  { type: 'decade', id: '1990', name: '1990s', slug: '1990-01-01,1999-12-31' },
  { type: 'decade', id: '2000', name: '2000s', slug: '2000-01-01,2009-12-31' },
  { type: 'decade', id: '2010', name: '2010s', slug: '2010-01-01,2019-12-31' },
  { type: 'decade', id: '2020', name: '2020s', slug: '2020-01-01,2029-12-31' },
]

const FALLBACK_GAME_MODES: Category[] = [
  { type: 'game_mode', id: 1, name: 'Single player', slug: 'single-player' },
  { type: 'game_mode', id: 2, name: 'Multiplayer', slug: 'multiplayer' },
  { type: 'game_mode', id: 3, name: 'Co-operative', slug: 'co-operative' },
  { type: 'game_mode', id: 4, name: 'Split screen', slug: 'split-screen' },
  { type: 'game_mode', id: 5, name: 'Massively Multiplayer Online (MMO)', slug: 'mmo' },
  { type: 'game_mode', id: 6, name: 'Battle Royale', slug: 'battle-royale' },
]

const FALLBACK_THEMES: Category[] = [
  { type: 'theme', id: 1, name: 'Action', slug: 'action' },
  { type: 'theme', id: 17, name: 'Fantasy', slug: 'fantasy' },
  { type: 'theme', id: 18, name: 'Science fiction', slug: 'science-fiction' },
  { type: 'theme', id: 19, name: 'Horror', slug: 'horror' },
  { type: 'theme', id: 21, name: 'Survival', slug: 'survival' },
  { type: 'theme', id: 38, name: 'Open world', slug: 'open-world' },
  { type: 'theme', id: 39, name: 'Warfare', slug: 'warfare' },
  { type: 'theme', id: 43, name: 'Mystery', slug: 'mystery' },
]

const FALLBACK_PERSPECTIVES: Category[] = [
  { type: 'perspective', id: 1, name: 'First person', slug: 'first-person' },
  { type: 'perspective', id: 2, name: 'Third person', slug: 'third-person' },
  { type: 'perspective', id: 3, name: 'Bird view / Isometric', slug: 'isometric' },
  { type: 'perspective', id: 4, name: 'Side view', slug: 'side-view' },
]

const FALLBACK_PLATFORMS: Category[] = [
  { type: 'platform', id: 59, name: 'Atari 2600', slug: 'atari2600' },
  { type: 'platform', id: 18, name: 'Nintendo Entertainment System', slug: 'nes' },
  { type: 'platform', id: 19, name: 'Super Nintendo Entertainment System', slug: 'snes' },
  { type: 'platform', id: 29, name: 'Sega Mega Drive/Genesis', slug: 'genesis-slash-megadrive' },
  { type: 'platform', id: 32, name: 'Sega Saturn', slug: 'saturn' },
  { type: 'platform', id: 23, name: 'Dreamcast', slug: 'dc' },
  { type: 'platform', id: 33, name: 'Game Boy', slug: 'gb' },
  { type: 'platform', id: 24, name: 'Game Boy Advance', slug: 'gba' },
  { type: 'platform', id: 20, name: 'Nintendo DS', slug: 'nds' },
  { type: 'platform', id: 37, name: 'Nintendo 3DS', slug: '3ds' },
  { type: 'platform', id: 4, name: 'Nintendo 64', slug: 'n64' },
  { type: 'platform', id: 21, name: 'Nintendo GameCube', slug: 'ngc' },
  { type: 'platform', id: 5, name: 'Wii', slug: 'wii' },
  { type: 'platform', id: 41, name: 'Wii U', slug: 'wiiu' },
  { type: 'platform', id: 130, name: 'Nintendo Switch', slug: 'switch' },
  { type: 'platform', id: 508, name: 'Nintendo Switch 2', slug: 'switch-2' },
  { type: 'platform', id: 7, name: 'PlayStation (Original)', slug: 'ps' },
  { type: 'platform', id: 8, name: 'PlayStation 2', slug: 'ps2' },
  { type: 'platform', id: 9, name: 'PlayStation 3', slug: 'ps3' },
  { type: 'platform', id: 6, name: 'PC (Windows/DOS)', slug: 'pc' },
  { type: 'platform', id: 48, name: 'PlayStation 4', slug: 'ps4--1' },
  { type: 'platform', id: 167, name: 'PlayStation 5', slug: 'ps5' },
  { type: 'platform', id: 38, name: 'PlayStation Portable', slug: 'psp' },
  { type: 'platform', id: 46, name: 'PlayStation Vita', slug: 'psvita' },
  { type: 'platform', id: 11, name: 'Xbox (Original)', slug: 'xbox' },
  { type: 'platform', id: 12, name: 'Xbox 360', slug: 'xbox360' },
  { type: 'platform', id: 49, name: 'Xbox One', slug: 'xboxone' },
  { type: 'platform', id: 169, name: 'Xbox Series X|S', slug: 'series-x-s' },
]

const FALLBACK_GENRES: Category[] = [
  { type: 'genre', id: 4, name: 'Fighting', slug: 'fighting' },
  { type: 'genre', id: 5, name: 'Shooter', slug: 'shooter' },
  { type: 'genre', id: 8, name: 'Platform', slug: 'platform' },
  { type: 'genre', id: 9, name: 'Puzzle', slug: 'puzzle' },
  { type: 'genre', id: 10, name: 'Racing', slug: 'racing' },
  { type: 'genre', id: 12, name: 'Role-playing (RPG)', slug: 'rpg' },
  { type: 'genre', id: 13, name: 'Simulator', slug: 'simulator' },
  { type: 'genre', id: 14, name: 'Sport', slug: 'sport' },
  { type: 'genre', id: 15, name: 'Strategy', slug: 'strategy' },
  { type: 'genre', id: 24, name: 'Tactical', slug: 'tactical' },
  { type: 'genre', id: 31, name: 'Adventure', slug: 'adventure' },
]

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
}

const PLATFORM_ALIAS_GROUPS: Record<string, string[]> = {
  'pc microsoft windows': ['pc microsoft windows', 'dos'],
  'pc windows dos': ['pc microsoft windows', 'dos'],
}

const GAME_TYPE_LABELS: Record<number, string> = {
  0: 'Original',
  8: 'Remake',
  9: 'Remaster',
  10: 'Expanded Game',
  11: 'Port',
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
  return normalizeName(value).replace(
    /\b(entertainment|interactive|studios|studio|games|game|software|softworks|inc|llc|ltd|corp|corporation|co)\b/g,
    ''
  ).replace(/\s+/g, ' ').trim()
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

function getCategoryCacheKey(category: Category): string {
  return [
    category.type,
    String(category.id),
    category.slug ?? '',
    normalizeName(category.name),
  ].join(':')
}

function getCellCacheKey(rowCategory: Category, colCategory: Category, sampleSize: number): string {
  const [left, right] = [getCategoryCacheKey(rowCategory), getCategoryCacheKey(colCategory)].sort()
  return `${left}|${right}|${sampleSize}`
}

function escapeIGDBSearch(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
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
    .filter((releaseDate): releaseDate is IGDBReleaseDate & { date: number; platform: IGDBPlatform } =>
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
  return new Promise(resolve => setTimeout(resolve, ms))
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

async function getIGDBAccessToken(): Promise<string | null> {
  if (!TWITCH_IGDB_CLIENT_ID || !TWITCH_IGDB_CLIENT_SECRET) {
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
    console.error(`[v0] Failed to get IGDB token: ${response.status}`)
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

async function queryIGDB<T>(endpoint: string, body: string): Promise<T[]> {
  const accessToken = await getIGDBAccessToken()
  if (!accessToken || !TWITCH_IGDB_CLIENT_ID) {
    return []
  }

  for (let attempt = 1; attempt <= IGDB_MAX_RETRIES; attempt += 1) {
    await scheduleIGDBRequest()

    const response = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': TWITCH_IGDB_CLIENT_ID,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      body,
      next: { revalidate: 86400 },
    })

    if (response.ok) {
      return (await response.json()) as T[]
    }

    if (response.status === 429 && attempt < IGDB_MAX_RETRIES) {
      const retryDelayMs = 1000 * attempt
      console.warn(`[v0] IGDB rate limited on ${endpoint}, retrying in ${retryDelayMs}ms`)
      await sleep(retryDelayMs)
      continue
    }

    console.error(`[v0] IGDB query failed (${endpoint}): ${response.status}`)
    return []
  }

  return []
}

async function queryIGDBCount(endpoint: string, whereClause: string): Promise<number | null> {
  const accessToken = await getIGDBAccessToken()
  if (!accessToken || !TWITCH_IGDB_CLIENT_ID) return null

  for (let attempt = 1; attempt <= IGDB_MAX_RETRIES; attempt += 1) {
    await scheduleIGDBRequest()

    const response = await fetch(`https://api.igdb.com/v4/${endpoint}/count`, {
      method: 'POST',
      headers: {
        'Client-ID': TWITCH_IGDB_CLIENT_ID,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      body: `where ${whereClause};`,
      next: { revalidate: 86400 },
    })

    if (response.ok) {
      const data = await response.json() as { count: number }
      return data.count
    }

    if (response.status === 429 && attempt < IGDB_MAX_RETRIES) {
      await sleep(1000 * attempt)
      continue
    }

    console.error(`[v0] IGDB count query failed (${endpoint}): ${response.status}`)
    return null
  }

  return null
}

async function fetchIGDBCategories(
  endpoint: 'platforms' | 'genres' | 'game_modes' | 'themes' | 'player_perspectives',
  allowedNames?: Set<string>
): Promise<Category[]> {
  const query = [
    'fields id,name,slug;',
    'limit 100;',
  ].join(' ')

  const results = await queryIGDB<{ id: number; name: string; slug?: string }>(endpoint, query)

  return results
    .filter(item => !allowedNames || allowedNames.has(item.name))
    .map(item => ({
      type:
        endpoint === 'game_modes'
          ? 'game_mode'
          : endpoint === 'player_perspectives'
            ? 'perspective'
            : endpoint === 'themes'
              ? 'theme'
              : endpoint === 'genres'
                ? 'genre'
                : 'platform',
      id: item.id,
      name: item.name,
      slug: item.slug ?? normalizeName(item.name).replace(/\s+/g, '-'),
    }))
}

function buildFamily(
  key: CategoryFamily['key'],
  dynamic: Category[],
  fallback: Category[],
  minimumDynamic = 4
): CategoryFamily {
  return {
    key,
    source: dynamic.length >= minimumDynamic ? 'dynamic' : 'fallback',
    categories: dynamic.length >= minimumDynamic ? dynamic : fallback,
  }
}

function buildDifficultyMetadata(
  validOptionCount: number,
  minValidOptionsPerCell: number,
  sampleSize = DEFAULT_CELL_SAMPLE_SIZE
): Pick<PuzzleCellMetadata, 'difficulty' | 'difficultyLabel'> {
  // Fixed absolute cutoffs tuned to real IGDB intersection counts.
  // These reflect what players will actually encounter across category pairs.
  //   Brutal : < 20    — almost no valid answers, very hard
  //   Spicy  : < 50    — handful of answers, challenging
  //   Tricky : < 150   — limited options, requires knowledge
  //   Fair   : < 400   — decent pool, fair game
  //   Cozy   : < 1000  — lots of options, approachable
  //   Feast  : 1000+   — huge pool, easy
  const brutalCutoff = 20
  const spicyCutoff  = 50
  const trickyCutoff = 150
  const fairCutoff   = 400
  const cozyCutoff   = 1000

  if (validOptionCount <= brutalCutoff) {
    return { difficulty: 'brutal', difficultyLabel: 'Brutal' }
  }

  if (validOptionCount <= spicyCutoff) {
    return { difficulty: 'spicy', difficultyLabel: 'Spicy' }
  }

  if (validOptionCount <= trickyCutoff) {
    return { difficulty: 'tricky', difficultyLabel: 'Tricky' }
  }

  if (validOptionCount <= fairCutoff) {
    return { difficulty: 'fair', difficultyLabel: 'Fair' }
  }

  if (validOptionCount <= cozyCutoff) {
    return { difficulty: 'cozy', difficultyLabel: 'Cozy' }
  }

  return { difficulty: 'feast', difficultyLabel: 'Feast' }
}

export function buildPuzzleCellMetadata(
  validation: PuzzleValidationResult,
  minValidOptionsPerCell: number,
  sampleSize = DEFAULT_CELL_SAMPLE_SIZE,
  treatSampleSizeAsCap = true
): PuzzleCellMetadata[] {
  return validation.cellResults.map(cell => ({
    cellIndex: cell.cellIndex,
    validOptionCount: cell.validOptionCount,
    isCapped: false, // counts are exact via /count endpoint, never capped
    ...buildDifficultyMetadata(cell.validOptionCount, minValidOptionsPerCell, sampleSize),
  }))
}

async function queryValidGamesForCell(
  rowCategory: Category,
  colCategory: Category,
  limit: number,
  offset = 0,
  fields =
    'name,slug,url,category,game_type,parent_game,first_release_date,rating,aggregated_rating,total_rating,total_rating_count,cover.image_id,platforms.name,platforms.slug,release_dates.date,release_dates.platform.name,release_dates.platform.slug,genres.name,genres.slug,game_modes.name,themes.name,player_perspectives.name,involved_companies.company.name,keywords.name'
): Promise<Game[]> {
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

  const query = [
    `fields ${fields};`,
    `where ${baseWhereParts.join(' & ')};`,
    `limit ${needsPostFilter ? limit * 3 : limit};`,
    `offset ${offset};`,
  ].join(' ')

  const results = await queryIGDB<IGDBGame>('games', query)
  const mappedGames = results.map(mapIGDBGameToGame)
  const filteredGames = needsPostFilter
    ? mappedGames.filter(
        game => igdbGameMatchesCategory(game, rowCategory) && igdbGameMatchesCategory(game, colCategory)
      )
    : mappedGames

  return Array.from(new Map(filteredGames.map(game => [game.id, game])).values())
}

async function getCategoryFamilies(): Promise<CategoryFamily[]> {
  if (categoryFamiliesCache && categoryFamiliesCache.expiresAt > Date.now()) {
    return categoryFamiliesCache.families
  }

  const allowedGameModes = new Set(FALLBACK_GAME_MODES.map(category => category.name))
  const allowedThemes = new Set(FALLBACK_THEMES.map(category => category.name))
  const allowedPerspectives = new Set(FALLBACK_PERSPECTIVES.map(category => category.name))
  const allowedPlatforms = new Set(FALLBACK_PLATFORMS.map(category => category.name))
  const allowedGenres = new Set(FALLBACK_GENRES.map(category => category.name))

  const [platforms, genres, gameModes, themes, perspectives] = await Promise.all([
    fetchIGDBCategories('platforms', allowedPlatforms),
    fetchIGDBCategories('genres', allowedGenres),
    fetchIGDBCategories('game_modes', allowedGameModes),
    fetchIGDBCategories('themes', allowedThemes),
    fetchIGDBCategories('player_perspectives', allowedPerspectives),
  ])

  const families: CategoryFamily[] = [
    buildFamily('platform', platforms, FALLBACK_PLATFORMS),
    buildFamily('genre', genres, FALLBACK_GENRES),
    { key: 'decade', source: 'fallback', categories: FALLBACK_DECADES },
    buildFamily('game_mode', gameModes, FALLBACK_GAME_MODES, 3),
    buildFamily('theme', themes, FALLBACK_THEMES, 4),
    buildFamily('perspective', perspectives, FALLBACK_PERSPECTIVES, 3),
  ]

  categoryFamiliesCache = {
    expiresAt: Date.now() + CATEGORY_FAMILY_CACHE_TTL_MS,
    families,
  }

  return families
}

function buildIGDBWhereClause(category: Category): string | null {
  switch (category.type) {
    case 'platform':
      return getPlatformAliases(category.name).size > 1 ? null : `platforms = (${category.id})`
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
    default:
      return null
  }
}

function getPairRejectionReason(rowCategory: Category, colCategory: Category): string | null {
  const leftName = normalizeName(rowCategory.name)
  const rightName = normalizeName(colCategory.name)
  const names = new Set([leftName, rightName])

  if (rowCategory.type === colCategory.type && String(rowCategory.id) === String(colCategory.id)) {
    return 'duplicate category pairing'
  }

  if (names.has('single player') && (names.has('multiplayer') || names.has('massively multiplayer online mmo'))) {
    return 'conflicting solo and multiplayer categories'
  }

  if (names.has('single player') && (names.has('co operative') || names.has('split screen'))) {
    return 'conflicting solo and co-operative categories'
  }

  const platformCategory = rowCategory.type === 'platform' ? rowCategory : colCategory.type === 'platform' ? colCategory : null
  const decadeCategory = rowCategory.type === 'decade' ? rowCategory : colCategory.type === 'decade' ? colCategory : null
  if (platformCategory && decadeCategory) {
    const normalizedPlatformName = normalizeName(platformCategory.name)
    const compatibleDecades = PLATFORM_VALID_DECADES[normalizedPlatformName]
    const decadeStart = Number(decadeCategory.id)
    if (compatibleDecades && !compatibleDecades.includes(String(decadeCategory.id))) {
      return 'platform is outside its supported decades'
    }

    const platformYear = PLATFORM_RELEASE_YEAR[normalizedPlatformName]
    if (!compatibleDecades && platformYear && Number.isFinite(decadeStart) && platformYear > decadeStart + 9) {
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

function buildAxisCategories(
  primary: CategoryFamily,
  secondary: CategoryFamily,
  oppositeAxisCategories: Category[]
): Category[] | null {
  const primaryPairs = shuffle(
    primary.categories.flatMap((first, firstIndex) =>
      primary.categories.slice(firstIndex + 1).map(second => [first, second] as const)
    )
  )
  const secondaryOptions = shuffle(secondary.categories)

  for (const [firstPrimary, secondPrimary] of primaryPairs) {
    for (const secondaryCategory of secondaryOptions) {
      const candidateAxis = shuffle([firstPrimary, secondPrimary, secondaryCategory]).slice(0, 3)
      const hasInvalidCrossSection = candidateAxis.some(axisCategory =>
        oppositeAxisCategories.some(oppositeCategory => getPairRejectionReason(axisCategory, oppositeCategory))
      )

      if (!hasInvalidCrossSection) {
        return candidateAxis
      }
    }
  }

  return null
}

function mapIGDBGameToGame(game: IGDBGame): Game {
  const platforms = (game.platforms ?? []).map(platform => ({
    platform: {
      id: platform.id,
      name: platform.name,
      slug: platform.slug ?? normalizeName(platform.name).replace(/\s+/g, '-'),
    },
  }))

  const genres = (game.genres ?? []).map(genre => ({
    id: genre.id,
    name: genre.name,
    slug: genre.slug ?? normalizeName(genre.name).replace(/\s+/g, '-'),
  }))

  const companies = (game.involved_companies ?? [])
    .map(entry => entry.company)
    .filter((company): company is IGDBCompany => Boolean(company))

  return {
    id: game.id,
    name: game.name,
    slug: game.slug ?? normalizeName(game.name).replace(/\s+/g, '-'),
    gameUrl: game.url ?? null,
    background_image: buildCoverUrl(game.cover?.image_id),
    released: formatIGDBDate(game.first_release_date),
    metacritic: getMetacriticScore(game.total_rating),
    gameTypeLabel: getGameTypeLabel(game.game_type),
    originalPlatformName: getOriginalPlatformName(game),
    genres,
    platforms,
    developers: companies.map(company => ({
      id: company.id,
      name: company.name,
      slug: normalizeName(company.name).replace(/\s+/g, '-'),
    })),
    publishers: companies.map(company => ({
      id: company.id,
      name: company.name,
      slug: normalizeName(company.name).replace(/\s+/g, '-'),
    })),
    tags: (game.keywords ?? []).map(keyword => ({
      id: keyword.id,
      name: keyword.name,
      slug: normalizeName(keyword.name).replace(/\s+/g, '-'),
    })),
    igdb: {
      id: game.id,
      game_modes: game.game_modes?.map(mode => mode.name) ?? [],
      themes: game.themes?.map(theme => theme.name) ?? [],
      player_perspectives: game.player_perspectives?.map(perspective => perspective.name) ?? [],
      companies: companies.map(company => company.name),
      keywords: game.keywords?.map(keyword => keyword.name) ?? [],
    },
  }
}

function hasOfficialCompanyData(game: IGDBGame): boolean {
  return (game.involved_companies ?? []).some(entry => Boolean(entry.company?.name?.trim()))
}

function hasDisqualifyingKeywords(game: IGDBGame): boolean {
  return (game.keywords ?? []).some(keyword => DISQUALIFYING_KEYWORDS.has(normalizeName(keyword.name)))
}

function hasRecognizedRating(game: IGDBGame): boolean {
  return game.rating != null || game.aggregated_rating != null
}

function isOfficialCatalogGame(game: IGDBGame): boolean {
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

  if (!hasRecognizedRating(game)) {
    return false
  }

  if (hasDisqualifyingKeywords(game)) {
    return false
  }

  return !UNOFFICIAL_NAME_PATTERNS.some(pattern => pattern.test(game.name))
}

function buildOfficialGameWhereClause(): string {
  return [
    'version_parent = null',
    'first_release_date != null',
    'involved_companies != null',
    '(rating != null | aggregated_rating != null)',
    `game_type = (${ALLOWED_GAME_TYPES.join(',')})`,
  ].join(' & ')
}

function buildSearchGameWhereClause(): string {
  return [
    'version_parent = null',
    'first_release_date != null',
    'involved_companies != null',
    '(rating != null | aggregated_rating != null)',
  ].join(' & ')
}

function tokenizeNormalized(value: string): string[] {
  return normalizeName(value)
    .split(' ')
    .map(token => token.trim())
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

  const matrix = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0))

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

  return Array.from(new Set(fallbackTerms.filter(term => term && term !== normalizedQuery)))
}

function scoreSearchCandidate(candidate: IGDBGame, query: string): number {
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

  if (candidate.first_release_date) {
    score += 10
  }

  score += Math.min(candidate.total_rating_count ?? 0, 50)

  if (UNOFFICIAL_NAME_PATTERNS.some(pattern => pattern.test(candidate.name))) {
    score -= 200
  }

  return score
}

export async function searchIGDBGames(query: string): Promise<Game[]> {
  if (!query.trim()) {
    return []
  }

  const runSearch = async (searchTerm: string, limit = 30) => {
    const searchQuery = [
      'fields name,slug,url,category,game_type,parent_game,first_release_date,rating,aggregated_rating,total_rating,total_rating_count,cover.image_id,platforms.name,platforms.slug,release_dates.date,release_dates.platform.name,release_dates.platform.slug,genres.name,genres.slug,game_modes.name,themes.name,player_perspectives.name,involved_companies.company.name,keywords.name;',
      `where ${buildSearchGameWhereClause()};`,
      `search "${escapeIGDBSearch(searchTerm)}";`,
      `limit ${limit};`,
    ].join(' ')

    return queryIGDB<IGDBGame>('games', searchQuery)
  }

  const primaryResults = await runSearch(query)
  let mergedResults = [...primaryResults]

  if (primaryResults.length < 5) {
    const fallbackTerms = getFallbackSearchTerms(query)
    for (const fallbackTerm of fallbackTerms.slice(0, 2)) {
      const fallbackResults = await runSearch(fallbackTerm, 40)
      mergedResults = [...mergedResults, ...fallbackResults]
      if (mergedResults.length >= 30) {
        break
      }
    }
  }

  const filteredResults = Array.from(new Map(mergedResults.map(result => [result.id, result])).values())
    .filter(isOfficialCatalogGame)
    .sort((left, right) => scoreSearchCandidate(right, query) - scoreSearchCandidate(left, query))

  return filteredResults.slice(0, 15).map(mapIGDBGameToGame)
}

export async function getIGDBGameDetails(gameId: number): Promise<Game | null> {
  if (igdbGameCache.has(gameId)) {
    return igdbGameCache.get(gameId) ?? null
  }

  const query = [
    'fields name,slug,url,category,game_type,parent_game,first_release_date,rating,aggregated_rating,total_rating,total_rating_count,cover.image_id,platforms.name,platforms.slug,release_dates.date,release_dates.platform.name,release_dates.platform.slug,genres.name,genres.slug,game_modes.name,themes.name,player_perspectives.name,involved_companies.company.name,keywords.name;',
    `where id = ${gameId} & ${buildOfficialGameWhereClause()};`,
    'limit 1;',
  ].join(' ')

  const [result] = await queryIGDB<IGDBGame>('games', query)
  if (!result) {
    igdbGameCache.set(gameId, null)
    return null
  }

  if (!isOfficialCatalogGame(result)) {
    igdbGameCache.set(gameId, null)
    return null
  }

  const mapped = mapIGDBGameToGame(result)
  igdbGameCache.set(gameId, mapped)
  return mapped
}

function matchesByName(values: string[] | undefined, target: string): boolean {
  return values?.some(value => normalizeName(value) === normalizeName(target)) || false
}

function matchesGameMode(values: string[] | undefined, target: string): boolean {
  const normalizedTarget = normalizeName(target)
  const normalizedValues = values?.map(normalizeName) ?? []

  if (normalizedValues.includes(normalizedTarget)) {
    return true
  }

  // Treat co-op as a valid subset of multiplayer, but keep co-op itself stricter.
  if (normalizedTarget === 'multiplayer') {
    return normalizedValues.includes('co operative')
  }

  return false
}

function matchesTagBucket(game: Game, categoryName: string): boolean {
  const aliases = getTagAliases(categoryName)
  const sources = [
    ...(game.igdb?.game_modes ?? []),
    ...(game.igdb?.themes ?? []),
    ...(game.igdb?.player_perspectives ?? []),
    ...(game.igdb?.keywords ?? []),
  ].map(normalizeName)

  return sources.some(source => aliases.has(source))
}

export function igdbGameMatchesCategory(game: Game, category: Category): boolean {
  switch (category.type) {
    case 'platform':
      return (
        game.platforms?.some(platform =>
          getPlatformAliases(category.name).has(normalizeName(platform.platform.name))
        ) || false
      )
    case 'genre':
      return game.genres?.some(genre => normalizeName(genre.name) === normalizeName(category.name)) || false
    case 'decade': {
      if (!game.released) {
        return false
      }

      const year = Number(game.released.split('-')[0])
      const decadeStart = Number(category.id)
      return Number.isFinite(year) && year >= decadeStart && year < decadeStart + 10
    }
    case 'company':
      return game.igdb?.companies?.some(company => normalizeCompanyName(company) === normalizeCompanyName(category.name)) || false
    case 'game_mode':
      return matchesGameMode(game.igdb?.game_modes, category.name)
    case 'theme':
      return matchesByName(game.igdb?.themes, category.name)
    case 'perspective':
      return matchesByName(game.igdb?.player_perspectives, category.name)
    case 'tag':
      return matchesTagBucket(game, category.name)
    default:
      return false
  }
}

export async function validateIGDBGameForCell(
  gameId: number,
  rowCategory: Category,
  colCategory: Category
): Promise<{ valid: boolean; game: Game | null; matchesRow: boolean; matchesCol: boolean }> {
  const game = await getIGDBGameDetails(gameId)
  if (!game) {
    return { valid: false, game: null, matchesRow: false, matchesCol: false }
  }

  const matchesRow = igdbGameMatchesCategory(game, rowCategory)
  const matchesCol = igdbGameMatchesCategory(game, colCategory)

  return {
    valid: matchesRow && matchesCol,
    game,
    matchesRow,
    matchesCol,
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
    const games = (await queryValidGamesForCell(rowCategory, colCategory, sampleSize, 0)).slice(0, sampleSize)
    cellValidationCache.set(cacheKey, {
      expiresAt: Date.now() + CELL_VALIDATION_CACHE_TTL_MS,
      games,
    })
    return games
  } catch (error) {
    console.error('[v0] Error getting IGDB valid games:', error)
    cellValidationCache.set(cacheKey, {
      expiresAt: Date.now() + Math.min(CELL_VALIDATION_CACHE_TTL_MS, 1000 * 60 * 5),
      games: [],
    })
    return []
  }
}

export async function getValidGameCountForCell(
  rowCategory: Category,
  colCategory: Category
): Promise<number> {
  const pairRejectionReason = getPairRejectionReason(rowCategory, colCategory)
  if (pairRejectionReason) {
    cellCountCache.set(getCellCacheKey(rowCategory, colCategory, -1), {
      expiresAt: Date.now() + CELL_VALIDATION_CACHE_TTL_MS,
      count: 0,
    })
    return 0
  }

  const cacheKey = getCellCacheKey(rowCategory, colCategory, -1)
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

    while (true) {
      const games = await queryValidGamesForCell(
        rowCategory,
        colCategory,
        pageSize,
        offset,
        'id,name,slug,url,category,game_type,parent_game,first_release_date,rating,aggregated_rating,total_rating,total_rating_count,cover.image_id,platforms.name,platforms.slug,release_dates.date,release_dates.platform.name,release_dates.platform.slug,genres.name,genres.slug,game_modes.name,themes.name,player_perspectives.name,involved_companies.company.name,keywords.name'
      )
      for (const game of games) seenGameIds.add(game.id)
      if (games.length < pageSize) break
      offset += pageSize
    }

    const count = seenGameIds.size
    cellCountCache.set(cacheKey, {
      expiresAt: Date.now() + CELL_VALIDATION_CACHE_TTL_MS,
      count,
    })
    return count
  } catch (error) {
    console.error('[v0] Error getting IGDB valid game count:', error)
    const fallbackCount = (await getValidGamesForCell(rowCategory, colCategory, DEFAULT_CELL_SAMPLE_SIZE)).length
    cellCountCache.set(cacheKey, {
      expiresAt: Date.now() + Math.min(CELL_VALIDATION_CACHE_TTL_MS, 1000 * 60 * 5),
      count: fallbackCount,
    })
    return fallbackCount
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
        validOptionCount: new Set(validGames.map(game => game.id)).size,
      }
      cellResults.push(result)
      onCellValidated?.({
        ...result,
        totalCells,
        passed: result.validOptionCount >= minValidOptionsPerCell,
      })
    }
  }

  const failedCells = cellResults.filter(cell => cell.validOptionCount < minValidOptionsPerCell)
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
  const families = (await getCategoryFamilies()).filter(family => family.categories.length >= 3)
  if (families.length < 4) {
    throw new Error('Not enough IGDB category families available to generate a puzzle')
  }

  let bestAttempt: { rows: Category[]; cols: Category[]; validation: PuzzleValidationResult } | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    onProgress?.({ stage: 'attempt', attempt, maxAttempts, message: `Attempt ${attempt} of ${maxAttempts}: picking categories...` })
    const selectedFamilies = pickRandomItems(families, 4)
    const cols = buildAxisCategories(selectedFamilies[2], selectedFamilies[3], [])
    if (!cols) {
      continue
    }

    const rows = buildAxisCategories(selectedFamilies[0], selectedFamilies[1], cols)
    if (!rows) {
      continue
    }
    onProgress?.({
      stage: 'attempt',
      attempt,
      maxAttempts,
      rows: rows.map(category => category.name),
      cols: cols.map(category => category.name),
      message: `Attempt ${attempt}/${maxAttempts}: testing ${rows[0].name} x ${cols[0].name}...`,
    })
    const validation = await validatePuzzleCategories(rows, cols, {
      minValidOptionsPerCell,
      sampleSize,
    }, (event) => {
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
    })

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
        valid: exactCellResults.every(cell => cell.validOptionCount >= minValidOptionsPerCell),
        minValidOptionCount: exactCellResults.reduce(
          (lowest, cell) => Math.min(lowest, cell.validOptionCount),
          Number.POSITIVE_INFINITY
        ),
        cellResults: exactCellResults,
        failedCells: exactCellResults.filter(cell => cell.validOptionCount < minValidOptionsPerCell),
      }
      const cellMetadata = buildPuzzleCellMetadata(
        exactValidation,
        minValidOptionsPerCell,
        sampleSize,
        false
      )

      console.log(
        `[v0] Generated validated IGDB puzzle on attempt ${attempt} with min ${validation.minValidOptionCount} valid options per cell`
      )
      console.log(
        `[v0] Family sources - rows: ${selectedFamilies[0].key}:${selectedFamilies[0].source}, ${selectedFamilies[1].key}:${selectedFamilies[1].source}; cols: ${selectedFamilies[2].key}:${selectedFamilies[2].source}, ${selectedFamilies[3].key}:${selectedFamilies[3].source}`
      )
      return {
        rows,
        cols,
        rowFamilies: [selectedFamilies[0], selectedFamilies[1]],
        colFamilies: [selectedFamilies[2], selectedFamilies[3]],
        validation: exactValidation,
        cellMetadata,
      }
    }

    console.log(
      `[v0] Rejected IGDB puzzle attempt ${attempt}: ` +
        validation.failedCells
          .map(cell => `[${cell.rowCategory.name} x ${cell.colCategory.name}: ${cell.validOptionCount}]`)
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
        .map(cell => `${cell.rowCategory.name} x ${cell.colCategory.name} (${cell.validOptionCount})`)
        .join(', ')
    : 'no candidate puzzle could be evaluated'

  throw new Error(
    `Unable to generate an IGDB puzzle with at least ${minValidOptionsPerCell} valid options per cell after ${maxAttempts} attempts. Best attempt failed on: ${failureSummary}`
  )
}
