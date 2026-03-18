// Game and RAWG API types
export interface Game {
  id: number
  name: string
  slug: string
  background_image: string | null
  released: string | null
  metacritic: number | null
  genres: { id: number; name: string; slug: string }[]
  platforms: { platform: { id: number; name: string; slug: string } }[]
  developers?: { id: number; name: string; slug: string }[]
  publishers?: { id: number; name: string; slug: string }[]
  tags?: { id: number; name: string; slug: string }[]
}

export interface RAWGResponse {
  count: number
  next: string | null
  previous: string | null
  results: Game[]
}

// Category types for the grid
export type CategoryType = 
  | 'platform'
  | 'genre'
  | 'developer'
  | 'publisher'
  | 'decade'
  | 'tag'

export interface Category {
  type: CategoryType
  id: string | number
  name: string
  slug?: string
}

// Puzzle types
export interface Puzzle {
  id: string
  date: string | null
  is_daily: boolean
  row_categories: Category[]
  col_categories: Category[]
  created_at: string
}

export interface CellGuess {
  gameId: number
  gameName: string
  gameImage: string | null
  isCorrect: boolean
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
