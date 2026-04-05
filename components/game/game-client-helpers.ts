import type { Category, CellGuess, Game, Puzzle } from '@/lib/types'

type GuessLookupResultGame = {
  slug?: string | null
  url?: string | null
  released?: string | null
  metacritic?: number | null
  stealRating?: number | null
  stealRatingCount?: number | null
  genres?: string[]
  platforms?: string[]
  developers?: string[]
  publishers?: string[]
  tags?: string[]
  gameModes?: string[]
  themes?: string[]
  perspectives?: string[]
  companies?: string[]
}

export interface GuessLookupResult {
  valid?: boolean
  matchesRow?: boolean
  matchesCol?: boolean
  game?: GuessLookupResultGame | null
}

function getGameFallbackMetadata(game: Game): Required<GuessLookupResultGame> {
  return {
    slug: game.slug ?? null,
    url: game.gameUrl ?? null,
    released: game.released ?? null,
    metacritic: game.metacritic ?? null,
    stealRating: game.stealRating ?? null,
    stealRatingCount: game.stealRatingCount ?? null,
    genres: game.genres.map((genre) => genre.name),
    platforms: game.platforms.map(({ platform }) => platform.name),
    developers: game.developers?.map((developer) => developer.name) ?? [],
    publishers: game.publishers?.map((publisher) => publisher.name) ?? [],
    tags: game.tags?.map((tag) => tag.name) ?? [],
    gameModes: game.igdb?.game_modes ?? [],
    themes: game.igdb?.themes ?? [],
    perspectives: game.igdb?.player_perspectives ?? [],
    companies: game.igdb?.companies ?? [],
  }
}

function pickResolvedValue<T>(resolved: T | null | undefined, fallback: T): T {
  return resolved ?? fallback
}

function pickResolvedArray(resolved: string[] | undefined, fallback: string[]): string[] {
  return resolved && resolved.length > 0 ? resolved : fallback
}

export function isGuessHydrated(guess: CellGuess): boolean {
  return (
    guess.released !== undefined ||
    guess.metacritic !== undefined ||
    guess.genres !== undefined ||
    guess.platforms !== undefined ||
    guess.developers !== undefined ||
    guess.publishers !== undefined ||
    guess.tags !== undefined ||
    guess.gameModes !== undefined ||
    guess.themes !== undefined ||
    guess.perspectives !== undefined ||
    guess.companies !== undefined
  )
}

export function hydrateStoredGuess(existingGuess: CellGuess, result: GuessLookupResult): CellGuess {
  return {
    ...existingGuess,
    gameSlug: pickResolvedValue(result.game?.slug, existingGuess.gameSlug ?? null),
    gameUrl: pickResolvedValue(result.game?.url, existingGuess.gameUrl ?? null),
    released: pickResolvedValue(result.game?.released, existingGuess.released ?? null),
    metacritic: pickResolvedValue(result.game?.metacritic, existingGuess.metacritic ?? null),
    stealRating: pickResolvedValue(result.game?.stealRating, existingGuess.stealRating ?? null),
    stealRatingCount: pickResolvedValue(
      result.game?.stealRatingCount,
      existingGuess.stealRatingCount ?? null
    ),
    genres: pickResolvedArray(result.game?.genres, existingGuess.genres ?? []),
    platforms: pickResolvedArray(result.game?.platforms, existingGuess.platforms ?? []),
    developers: pickResolvedArray(result.game?.developers, existingGuess.developers ?? []),
    publishers: pickResolvedArray(result.game?.publishers, existingGuess.publishers ?? []),
    tags: pickResolvedArray(result.game?.tags, existingGuess.tags ?? []),
    gameModes: pickResolvedArray(result.game?.gameModes, existingGuess.gameModes ?? []),
    themes: pickResolvedArray(result.game?.themes, existingGuess.themes ?? []),
    perspectives: pickResolvedArray(result.game?.perspectives, existingGuess.perspectives ?? []),
    companies: pickResolvedArray(result.game?.companies, existingGuess.companies ?? []),
    matchedRow: result.matchesRow,
    matchedCol: result.matchesCol,
  }
}

export function isDuplicateGuessSelection(
  guesses: Array<CellGuess | null>,
  gameId: number,
  mode: 'daily' | 'practice' | 'versus',
  selectedCell: number
): boolean {
  return guesses.some(
    (guess, index) => guess?.gameId === gameId && (mode !== 'versus' || index !== selectedCell)
  )
}

export function buildGuessFromSelection(options: {
  game: Game
  result: GuessLookupResult
  mode: 'daily' | 'practice' | 'versus'
  currentPlayer: 'x' | 'o'
}): CellGuess {
  const { game, result, mode, currentPlayer } = options
  const fallbackMetadata = getGameFallbackMetadata(game)
  const resolvedMetadata = {
    slug: pickResolvedValue(result.game?.slug, fallbackMetadata.slug),
    url: pickResolvedValue(result.game?.url, fallbackMetadata.url),
    released: pickResolvedValue(result.game?.released, fallbackMetadata.released),
    metacritic: pickResolvedValue(result.game?.metacritic, fallbackMetadata.metacritic),
    // Keep steal/showdown scoring tied to the authoritative validation payload.
    stealRating: result.game?.stealRating ?? null,
    stealRatingCount: result.game?.stealRatingCount ?? null,
    genres: pickResolvedArray(result.game?.genres, fallbackMetadata.genres),
    platforms: pickResolvedArray(result.game?.platforms, fallbackMetadata.platforms),
    developers: pickResolvedArray(result.game?.developers, fallbackMetadata.developers),
    publishers: pickResolvedArray(result.game?.publishers, fallbackMetadata.publishers),
    tags: pickResolvedArray(result.game?.tags, fallbackMetadata.tags),
    gameModes: pickResolvedArray(result.game?.gameModes, fallbackMetadata.gameModes),
    themes: pickResolvedArray(result.game?.themes, fallbackMetadata.themes),
    perspectives: pickResolvedArray(result.game?.perspectives, fallbackMetadata.perspectives),
    companies: pickResolvedArray(result.game?.companies, fallbackMetadata.companies),
  }

  return {
    gameId: game.id,
    gameName: game.name,
    owner: mode === 'versus' ? currentPlayer : undefined,
    gameSlug: resolvedMetadata.slug,
    gameUrl: resolvedMetadata.url,
    gameImage: game.background_image,
    isCorrect: Boolean(result.valid),
    released: resolvedMetadata.released,
    metacritic: resolvedMetadata.metacritic,
    stealRating: resolvedMetadata.stealRating,
    stealRatingCount: resolvedMetadata.stealRatingCount,
    genres: resolvedMetadata.genres,
    platforms: resolvedMetadata.platforms,
    developers: resolvedMetadata.developers,
    publishers: resolvedMetadata.publishers,
    tags: resolvedMetadata.tags,
    gameModes: resolvedMetadata.gameModes,
    themes: resolvedMetadata.themes,
    perspectives: resolvedMetadata.perspectives,
    companies: resolvedMetadata.companies,
    matchedRow: result.matchesRow,
    matchedCol: result.matchesCol,
    objectionUsed: false,
    objectionVerdict: null,
    objectionExplanation: null,
    objectionOriginalMatchedRow: null,
    objectionOriginalMatchedCol: null,
  }
}

export function buildPersistedGuessSnapshot(guesses: Array<CellGuess | null>) {
  return guesses.map((guess) =>
    guess
      ? {
          gameId: guess.gameId,
          gameName: guess.gameName,
          gameImage: guess.gameImage,
          isCorrect: guess.isCorrect,
          objectionUsed: guess.objectionUsed ?? false,
          objectionVerdict: guess.objectionVerdict ?? null,
          objectionExplanation: guess.objectionExplanation ?? null,
          objectionOriginalMatchedRow: guess.objectionOriginalMatchedRow ?? null,
          objectionOriginalMatchedCol: guess.objectionOriginalMatchedCol ?? null,
        }
      : null
  )
}

export function getCategoriesForCell(
  puzzle: Puzzle | null,
  cellIndex: number | null
): { row: Category | null; col: Category | null } {
  if (cellIndex === null || !puzzle) {
    return { row: null, col: null }
  }

  return {
    row: puzzle.row_categories[Math.floor(cellIndex / 3)] ?? null,
    col: puzzle.col_categories[cellIndex % 3] ?? null,
  }
}
