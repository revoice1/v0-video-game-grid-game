import type { Game, RAWGResponse, Category, CategoryType } from './types'

const RAWG_API_KEY = process.env.RAWG_API_KEY
const BASE_URL = 'https://api.rawg.io/api'

// Predefined category pools for variety
export const PLATFORMS: Category[] = [
  { type: 'platform', id: 4, name: 'PC', slug: 'pc' },
  { type: 'platform', id: 187, name: 'PlayStation 5', slug: 'playstation5' },
  { type: 'platform', id: 18, name: 'PlayStation 4', slug: 'playstation4' },
  { type: 'platform', id: 1, name: 'Xbox One', slug: 'xbox-one' },
  { type: 'platform', id: 186, name: 'Xbox Series S/X', slug: 'xbox-series-x' },
  { type: 'platform', id: 7, name: 'Nintendo Switch', slug: 'nintendo-switch' },
  { type: 'platform', id: 83, name: 'Nintendo 64', slug: 'nintendo-64' },
  { type: 'platform', id: 24, name: 'Game Boy Advance', slug: 'game-boy-advance' },
  { type: 'platform', id: 3, name: 'iOS', slug: 'ios' },
  { type: 'platform', id: 21, name: 'Android', slug: 'android' },
]

export const GENRES: Category[] = [
  { type: 'genre', id: 4, name: 'Action', slug: 'action' },
  { type: 'genre', id: 51, name: 'Indie', slug: 'indie' },
  { type: 'genre', id: 3, name: 'Adventure', slug: 'adventure' },
  { type: 'genre', id: 5, name: 'RPG', slug: 'role-playing-games-rpg' },
  { type: 'genre', id: 10, name: 'Strategy', slug: 'strategy' },
  { type: 'genre', id: 2, name: 'Shooter', slug: 'shooter' },
  { type: 'genre', id: 40, name: 'Casual', slug: 'casual' },
  { type: 'genre', id: 14, name: 'Simulation', slug: 'simulation' },
  { type: 'genre', id: 7, name: 'Puzzle', slug: 'puzzle' },
  { type: 'genre', id: 11, name: 'Arcade', slug: 'arcade' },
  { type: 'genre', id: 83, name: 'Platformer', slug: 'platformer' },
  { type: 'genre', id: 1, name: 'Racing', slug: 'racing' },
  { type: 'genre', id: 15, name: 'Sports', slug: 'sports' },
  { type: 'genre', id: 6, name: 'Fighting', slug: 'fighting' },
  { type: 'genre', id: 59, name: 'Massively Multiplayer', slug: 'massively-multiplayer' },
]

export const DECADES: Category[] = [
  { type: 'decade', id: '1990', name: '1990s', slug: '1990-01-01,1999-12-31' },
  { type: 'decade', id: '2000', name: '2000s', slug: '2000-01-01,2009-12-31' },
  { type: 'decade', id: '2010', name: '2010s', slug: '2010-01-01,2019-12-31' },
  { type: 'decade', id: '2020', name: '2020s', slug: '2020-01-01,2029-12-31' },
]

export const POPULAR_TAGS: Category[] = [
  { type: 'tag', id: 31, name: 'Singleplayer', slug: 'singleplayer' },
  { type: 'tag', id: 7, name: 'Multiplayer', slug: 'multiplayer' },
  { type: 'tag', id: 18, name: 'Co-op', slug: 'co-op' },
  { type: 'tag', id: 36, name: 'Open World', slug: 'open-world' },
  { type: 'tag', id: 69, name: 'Story Rich', slug: 'story-rich' },
  { type: 'tag', id: 37, name: 'Sandbox', slug: 'sandbox' },
  { type: 'tag', id: 1, name: 'Survival', slug: 'survival' },
  { type: 'tag', id: 6, name: 'Exploration', slug: 'exploration' },
  { type: 'tag', id: 42, name: 'Horror', slug: 'horror' },
  { type: 'tag', id: 149, name: 'Third Person', slug: 'third-person' },
  { type: 'tag', id: 8, name: 'First-Person', slug: 'first-person' },
]

// Combined developer/publisher - matches if the company developed OR published the game
// This handles cases like Nintendo where they publish games developed by others (Game Freak, HAL, etc.)
export const COMPANIES: Category[] = [
  { type: 'company', id: 354, name: 'Nintendo', slug: 'nintendo', developerId: 290, publisherId: 354 },
  { type: 'company', id: 2155, name: 'Rockstar Games', slug: 'rockstar-games', developerId: 3524, publisherId: 2155 },
  { type: 'company', id: 339, name: 'Electronic Arts', slug: 'electronic-arts', developerId: 10482, publisherId: 339 },
  { type: 'company', id: 308, name: 'Square Enix', slug: 'square-enix', developerId: 308, publisherId: 308 },
  { type: 'company', id: 3408, name: 'Ubisoft', slug: 'ubisoft', developerId: 405, publisherId: 3408 },
  { type: 'company', id: 918, name: 'Bethesda', slug: 'bethesda-softworks', developerId: 10681, publisherId: 918 },
  { type: 'company', id: 2150, name: 'Activision', slug: 'activision', developerId: 2150, publisherId: 2150 },
  { type: 'company', id: 20987, name: 'Microsoft', slug: 'microsoft-studios', developerId: 20987, publisherId: 20987 },
  { type: 'company', id: 10212, name: 'Sony', slug: 'sony-interactive-entertainment', developerId: 16215, publisherId: 10212 },
  { type: 'company', id: 4003, name: 'Capcom', slug: 'capcom', developerId: 4556, publisherId: 4003 },
  { type: 'company', id: 4, name: 'Sega', slug: 'sega', developerId: 4, publisherId: 4 },
  { type: 'company', id: 405, name: 'Bandai Namco', slug: 'bandai-namco-entertainment', developerId: 405, publisherId: 405 },
  { type: 'company', id: 9023, name: 'FromSoftware', slug: 'fromsoftware', developerId: 9023, publisherId: 9023 },
  { type: 'company', id: 18893, name: 'CD Projekt RED', slug: 'cd-projekt-red', developerId: 18893, publisherId: 7411 },
  { type: 'company', id: 3399, name: 'Valve', slug: 'valve-software', developerId: 3399, publisherId: 3399 },
  { type: 'company', id: 7683, name: 'Blizzard', slug: 'blizzard-entertainment', developerId: 7683, publisherId: 7683 },
]

// Get a random selection from an array
function getRandomItems<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

// Generate random categories for a puzzle
export function generatePuzzleCategories(): { rows: Category[], cols: Category[] } {
  const allCategories: Category[][] = [
    PLATFORMS,
    GENRES,
    DECADES,
    POPULAR_TAGS,
    COMPANIES,
  ]
  
  // Pick 2-3 random category types for rows and cols
  const shuffledTypes = [...allCategories].sort(() => Math.random() - 0.5)
  
  // Ensure we get good variety - pick from different pools
  const rowPool1 = getRandomItems(shuffledTypes[0], 2)
  const rowPool2 = getRandomItems(shuffledTypes[1], 1)
  const rows = [...rowPool1, ...rowPool2].sort(() => Math.random() - 0.5).slice(0, 3)
  
  const colPool1 = getRandomItems(shuffledTypes[2], 2)
  const colPool2 = getRandomItems(shuffledTypes[3], 1)
  const cols = [...colPool1, ...colPool2].sort(() => Math.random() - 0.5).slice(0, 3)
  
  return { rows, cols }
}

// Build RAWG API query params based on categories
function buildQueryParams(rowCat: Category, colCat: Category): URLSearchParams {
  const params = new URLSearchParams({
    key: RAWG_API_KEY || '',
    page_size: '40',
    ordering: '-metacritic,-added',
  })
  
  // Add filters based on category types
  const addFilter = (cat: Category) => {
    switch (cat.type) {
      case 'platform':
        params.append('platforms', String(cat.id))
        break
      case 'genre':
        params.append('genres', String(cat.id))
        break
      case 'decade':
        params.set('dates', cat.slug || '')
        break
      case 'tag':
        params.append('tags', String(cat.id))
        break
      case 'developer':
        params.append('developers', String(cat.id))
        break
      case 'publisher':
        params.append('publishers', String(cat.id))
        break
      case 'company':
        // For company, search by publisher (more inclusive than developer)
        if (cat.publisherId) {
          params.append('publishers', String(cat.publisherId))
        }
        break
    }
  }
  
  addFilter(rowCat)
  addFilter(colCat)
  
  return params
}

// Search games from RAWG API
export async function searchGames(query: string): Promise<Game[]> {
  if (!RAWG_API_KEY) {
    console.error('RAWG_API_KEY not set')
    return []
  }
  
  const params = new URLSearchParams({
    key: RAWG_API_KEY,
    search: query,
    page_size: '15',
    search_precise: 'true',
  })
  
  try {
    const response = await fetch(`${BASE_URL}/games?${params}`, {
      next: { revalidate: 300 } // Cache search results for 5 minutes
    })
    if (!response.ok) throw new Error('Failed to search games')
    const data: RAWGResponse = await response.json()
    return data.results
  } catch (error) {
    console.error('Error searching games:', error)
    return []
  }
}

// Get game details with developers/publishers
export async function getGameDetails(gameId: number): Promise<Game | null> {
  if (!RAWG_API_KEY) return null
  
  try {
    const response = await fetch(`${BASE_URL}/games/${gameId}?key=${RAWG_API_KEY}`, {
      next: { revalidate: 86400 } // Game metadata doesn't change day-to-day
    })
    if (!response.ok) throw new Error('Failed to get game details')
    return await response.json()
  } catch (error) {
    console.error('Error getting game details:', error)
    return null
  }
}

// Validate if a game matches a category
export function gameMatchesCategory(game: Game, category: Category): boolean {
  switch (category.type) {
    case 'platform':
      return game.platforms?.some(p => p.platform.id === category.id) || false
    case 'genre':
      return game.genres?.some(g => g.id === category.id) || false
    case 'decade':
      if (!game.released) return false
      const year = parseInt(game.released.split('-')[0])
      const decadeStart = parseInt(String(category.id))
      return year >= decadeStart && year < decadeStart + 10
    case 'tag':
      return game.tags?.some(t => t.id === category.id) || false
    case 'developer':
      return game.developers?.some(d => d.id === category.id) || false
    case 'publisher':
      return game.publishers?.some(p => p.id === category.id) || false
    case 'company':
      // Company matches if either developed OR published by them
      const devId = category.developerId
      const pubId = category.publisherId
      const matchesDev = devId ? game.developers?.some(d => d.id === devId) : false
      const matchesPub = pubId ? game.publishers?.some(p => p.id === pubId) : false
      return matchesDev || matchesPub || false
    default:
      return false
  }
}

// Check if a game is valid for a specific cell
export async function validateGameForCell(
  gameId: number,
  rowCategory: Category,
  colCategory: Category
): Promise<{ valid: boolean; game: Game | null }> {
  const game = await getGameDetails(gameId)
  if (!game) return { valid: false, game: null }
  
  const matchesRow = gameMatchesCategory(game, rowCategory)
  const matchesCol = gameMatchesCategory(game, colCategory)
  
  return { valid: matchesRow && matchesCol, game }
}

// Get valid games for a cell (for pre-verification that answers exist)
export async function getValidGamesForCell(
  rowCategory: Category,
  colCategory: Category
): Promise<Game[]> {
  if (!RAWG_API_KEY) {
    console.log('[v0] RAWG_API_KEY not set, returning empty array')
    return []
  }
  
  const params = buildQueryParams(rowCategory, colCategory)
  const url = `${BASE_URL}/games?${params}`
  
  try {
    const response = await fetch(url, { 
      next: { revalidate: 3600 } // Cache for 1 hour
    })
    if (!response.ok) {
      console.log(`[v0] RAWG API error: ${response.status} ${response.statusText}`)
      return []
    }
    const data: RAWGResponse = await response.json()
    return data.results || []
  } catch (error) {
    console.error('[v0] Error getting valid games:', error)
    return []
  }
}
