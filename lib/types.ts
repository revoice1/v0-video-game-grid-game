// Shared game and puzzle types
export interface Game {
  id: number
  name: string
  slug: string
  gameUrl?: string | null
  background_image: string | null
  released: string | null
  releaseDates?: string[]
  metacritic: number | null
  stealRating?: number | null
  gameTypeLabel?: string | null
  originalPlatformName?: string | null
  hasSameNamePortFamily?: boolean
  genres: { id: number; name: string; slug: string }[]
  platforms: { platform: { id: number; name: string; slug: string } }[]
  developers?: { id: number; name: string; slug: string }[]
  publishers?: { id: number; name: string; slug: string }[]
  tags?: { id: number; name: string; slug: string }[]
  igdb?: {
    id: number
    rating?: number | null
    aggregated_rating?: number | null
    total_rating?: number | null
    total_rating_count?: number | null
    game_modes: string[]
    themes: string[]
    player_perspectives: string[]
    companies: string[]
    keywords: string[]
  }
}

// Category types for the grid
export type CategoryType =
  | 'platform'
  | 'genre'
  | 'developer'
  | 'publisher'
  | 'decade'
  | 'tag'
  | 'company'
  | 'game_mode'
  | 'theme'
  | 'perspective'

export interface Category {
  type: CategoryType
  id: string | number
  name: string
  slug?: string
  platformIds?: number[]
  companyIds?: number[]
  companyNamePatterns?: string[]
}

// Puzzle types
export interface Puzzle {
  id: string
  date: string | null
  is_daily: boolean
  row_categories: Category[]
  col_categories: Category[]
  created_at: string
  validation_status?: 'validated' | 'relaxed' | 'unvalidated'
  validation_message?: string | null
  cell_metadata?: PuzzleCellMetadata[]
}

export interface PuzzleCellMetadata {
  cellIndex: number
  validOptionCount: number
  isCapped?: boolean
  difficulty: 'brutal' | 'spicy' | 'tricky' | 'fair' | 'cozy' | 'feast'
  difficultyLabel: string
}

export interface CellGuess {
  gameId: number
  gameName: string
  owner?: 'x' | 'o'
  gameSlug?: string | null
  gameUrl?: string | null
  gameImage: string | null
  isCorrect: boolean
  released?: string | null
  releaseDates?: string[]
  metacritic?: number | null
  stealRating?: number | null
  genres?: string[]
  platforms?: string[]
  developers?: string[]
  publishers?: string[]
  tags?: string[]
  gameModes?: string[]
  themes?: string[]
  perspectives?: string[]
  companies?: string[]
  matchedRow?: boolean
  matchedCol?: boolean
  objectionUsed?: boolean
  objectionVerdict?: 'sustained' | 'overruled' | null
  objectionExplanation?: string | null
  objectionOriginalMatchedRow?: boolean | null
  objectionOriginalMatchedCol?: boolean | null
  showdownScoreRevealed?: boolean
}

export interface GameState {
  puzzle: Puzzle | null
  guesses: (CellGuess | null)[]
  guessesRemaining: number
  isComplete: boolean
  selectedCell: number | null
}

// Stats types
export interface AnswerStat {
  puzzle_id: string
  cell_index: number
  game_id: number
  game_name: string
  game_image: string | null
  count: number
}

export interface CellStats {
  totalGuesses: number
  topAnswers: AnswerStat[]
  bottomAnswers: AnswerStat[]
  userAnswerRarity: number | null
  userAnswerRank: number | null
}

export interface CompletionStats {
  score: number
  rarityScore: number
  cellStats: (CellStats | null)[]
  totalCompletions: number
}
