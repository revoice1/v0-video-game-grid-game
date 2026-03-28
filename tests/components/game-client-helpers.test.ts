import { describe, expect, it } from 'vitest'
import {
  buildGuessFromSelection,
  buildPersistedGuessSnapshot,
  getCategoriesForCell,
  hydrateStoredGuess,
  isDuplicateGuessSelection,
  isGuessHydrated,
  type GuessLookupResult,
} from '@/components/game/game-client-helpers'
import type { CellGuess, Game, Puzzle } from '@/lib/types'

const baseGame: Game = {
  id: 7,
  name: 'Test Game',
  slug: 'test-game',
  gameUrl: 'https://example.com/test-game',
  background_image: 'https://example.com/cover.png',
  released: '1997-01-31',
  metacritic: 91,
  genres: [{ id: 1, name: 'Role-playing (RPG)', slug: 'rpg' }],
  platforms: [{ platform: { id: 6, name: 'PC (Microsoft Windows)', slug: 'pc' } }],
}

const puzzle: Puzzle = {
  id: 'test-puzzle',
  date: null,
  is_daily: false,
  created_at: '2026-03-25T00:00:00.000Z',
  row_categories: [
    { type: 'genre', id: 'rpg', name: 'RPG' },
    { type: 'theme', id: 'horror', name: 'Horror' },
    { type: 'platform', id: 'pc', name: 'PC' },
  ],
  col_categories: [
    { type: 'platform', id: 'ps1', name: 'PlayStation (Original)' },
    { type: 'decade', id: '1990', name: '1990s' },
    { type: 'game_mode', id: 'single', name: 'Single player' },
  ],
}

const lookupResult: GuessLookupResult = {
  valid: true,
  matchesRow: true,
  matchesCol: false,
  game: {
    slug: 'resolved-slug',
    url: 'https://example.com/resolved',
    released: '1998-02-03',
    metacritic: 88,
    stealRating: 86,
    genres: ['Role-playing (RPG)'],
    platforms: ['PS1'],
    developers: ['Square'],
    publishers: ['Sony'],
    tags: ['classic'],
    gameModes: ['Single player'],
    themes: ['Drama'],
    perspectives: ['Side view'],
    companies: ['Sony'],
  },
}

describe('game client helpers', () => {
  it('detects whether a guess already has hydrated metadata', () => {
    expect(
      isGuessHydrated({
        gameId: 1,
        gameName: 'Bare Guess',
        gameImage: null,
        isCorrect: true,
      })
    ).toBe(false)

    expect(
      isGuessHydrated({
        gameId: 1,
        gameName: 'Hydrated Guess',
        gameImage: null,
        isCorrect: true,
        platforms: ['PS1'],
      })
    ).toBe(true)
  })

  it('hydrates stored guesses while preserving existing fallback fields', () => {
    const existingGuess: CellGuess = {
      gameId: 7,
      gameName: 'Test Game',
      gameImage: 'https://example.com/cover.png',
      isCorrect: true,
      gameSlug: 'local-slug',
      gameUrl: null,
      stealRating: 92,
    }

    expect(hydrateStoredGuess(existingGuess, lookupResult)).toEqual({
      ...existingGuess,
      gameSlug: 'resolved-slug',
      gameUrl: 'https://example.com/resolved',
      released: '1998-02-03',
      metacritic: 88,
      stealRating: 86,
      genres: ['Role-playing (RPG)'],
      platforms: ['PS1'],
      developers: ['Square'],
      publishers: ['Sony'],
      tags: ['classic'],
      gameModes: ['Single player'],
      themes: ['Drama'],
      perspectives: ['Side view'],
      companies: ['Sony'],
      matchedRow: true,
      matchedCol: false,
    })
  })

  it('keeps existing hydrated metadata when a later lookup returns sparse values', () => {
    const existingGuess: CellGuess = {
      gameId: 7,
      gameName: 'Test Game',
      gameImage: 'https://example.com/cover.png',
      isCorrect: false,
      gameSlug: 'test-game',
      gameUrl: 'https://example.com/test-game',
      released: '1997-01-31',
      metacritic: 91,
      genres: ['Role-playing (RPG)'],
      platforms: ['Super Famicom'],
      developers: ['Hudson Soft'],
      publishers: ['Imagineer'],
      tags: ['sanrio'],
      gameModes: ['Single player'],
      themes: ['Comedy'],
      perspectives: ['Bird view / Isometric'],
      companies: ['Hudson Soft', 'Imagineer'],
    }

    expect(
      hydrateStoredGuess(existingGuess, {
        valid: false,
        matchesRow: false,
        matchesCol: false,
        game: {
          slug: null,
          url: null,
          released: null,
          metacritic: null,
          genres: [],
          platforms: [],
          developers: [],
          publishers: [],
          tags: [],
          gameModes: [],
          themes: [],
          perspectives: [],
          companies: [],
        },
      })
    ).toEqual({
      ...existingGuess,
      stealRating: null,
      matchedRow: false,
      matchedCol: false,
    })
  })

  it('detects duplicate guesses while allowing a versus replacement in the same cell', () => {
    const guesses: Array<CellGuess | null> = [
      { gameId: 7, gameName: 'Test Game', gameImage: null, isCorrect: true, owner: 'x' },
      null,
      { gameId: 8, gameName: 'Other Game', gameImage: null, isCorrect: true, owner: 'o' },
    ]

    expect(isDuplicateGuessSelection(guesses, 7, 'daily', 1)).toBe(true)
    expect(isDuplicateGuessSelection(guesses, 7, 'versus', 0)).toBe(false)
    expect(isDuplicateGuessSelection(guesses, 8, 'versus', 0)).toBe(true)
  })

  it('treats same-family variants as distinct picks when their game ids differ', () => {
    const guesses: Array<CellGuess | null> = [
      {
        gameId: 97,
        gameName: 'Final Fantasy VII',
        gameImage: null,
        isCorrect: true,
      },
      null,
      null,
    ]

    expect(isDuplicateGuessSelection(guesses, 98, 'daily', 1)).toBe(false)
  })

  it('builds a selected guess from API validation data', () => {
    expect(
      buildGuessFromSelection({
        game: baseGame,
        result: lookupResult,
        mode: 'versus',
        currentPlayer: 'o',
      })
    ).toEqual({
      gameId: 7,
      gameName: 'Test Game',
      owner: 'o',
      gameSlug: 'resolved-slug',
      gameUrl: 'https://example.com/resolved',
      gameImage: 'https://example.com/cover.png',
      isCorrect: true,
      released: '1998-02-03',
      metacritic: 88,
      stealRating: 86,
      genres: ['Role-playing (RPG)'],
      platforms: ['PS1'],
      developers: ['Square'],
      publishers: ['Sony'],
      tags: ['classic'],
      gameModes: ['Single player'],
      themes: ['Drama'],
      perspectives: ['Side view'],
      companies: ['Sony'],
      matchedRow: true,
      matchedCol: false,
      objectionUsed: false,
      objectionVerdict: null,
      objectionExplanation: null,
      objectionOriginalMatchedRow: null,
      objectionOriginalMatchedCol: null,
    })
  })

  it('preserves search-result metadata when validation details are sparse', () => {
    expect(
      buildGuessFromSelection({
        game: {
          ...baseGame,
          developers: [{ id: 2, name: 'Hudson Soft', slug: 'hudson-soft' }],
          publishers: [{ id: 3, name: 'Imagineer', slug: 'imagineer' }],
          tags: [{ id: 4, name: 'sanrio', slug: 'sanrio' }],
          igdb: {
            id: 7,
            game_modes: ['Single player'],
            themes: ['Comedy'],
            player_perspectives: ['Bird view / Isometric'],
            companies: ['Hudson Soft', 'Imagineer'],
            keywords: ['sanrio'],
          },
        },
        result: {
          valid: false,
          matchesRow: false,
          matchesCol: false,
          game: {
            slug: null,
            url: null,
            released: null,
            metacritic: null,
            genres: [],
            platforms: [],
            developers: [],
            publishers: [],
            tags: [],
            gameModes: [],
            themes: [],
            perspectives: [],
            companies: [],
          },
        },
        mode: 'daily',
        currentPlayer: 'x',
      })
    ).toEqual({
      gameId: 7,
      gameName: 'Test Game',
      owner: undefined,
      gameSlug: 'test-game',
      gameUrl: 'https://example.com/test-game',
      gameImage: 'https://example.com/cover.png',
      isCorrect: false,
      released: '1997-01-31',
      metacritic: 91,
      stealRating: null,
      genres: ['Role-playing (RPG)'],
      platforms: ['PC (Microsoft Windows)'],
      developers: ['Hudson Soft'],
      publishers: ['Imagineer'],
      tags: ['sanrio'],
      gameModes: ['Single player'],
      themes: ['Comedy'],
      perspectives: ['Bird view / Isometric'],
      companies: ['Hudson Soft', 'Imagineer'],
      matchedRow: false,
      matchedCol: false,
      objectionUsed: false,
      objectionVerdict: null,
      objectionExplanation: null,
      objectionOriginalMatchedRow: null,
      objectionOriginalMatchedCol: null,
    })
  })

  it('does not fall back to search-result steal ratings for live guess state', () => {
    expect(
      buildGuessFromSelection({
        game: {
          ...baseGame,
          stealRating: 77,
        },
        result: {
          valid: false,
          matchesRow: false,
          matchesCol: false,
          game: {
            slug: null,
            url: null,
            released: null,
            metacritic: null,
            stealRating: null,
            genres: [],
            platforms: [],
            developers: [],
            publishers: [],
            tags: [],
            gameModes: [],
            themes: [],
            perspectives: [],
            companies: [],
          },
        },
        mode: 'versus',
        currentPlayer: 'x',
      }).stealRating
    ).toBeNull()
  })

  it('builds a persisted guess snapshot without heavy metadata', () => {
    expect(
      buildPersistedGuessSnapshot([
        {
          gameId: 7,
          gameName: 'Test Game',
          gameImage: 'https://example.com/cover.png',
          isCorrect: true,
          platforms: ['PS1'],
        },
        null,
      ])
    ).toEqual([
      {
        gameId: 7,
        gameName: 'Test Game',
        gameImage: 'https://example.com/cover.png',
        isCorrect: true,
      },
      null,
    ])
  })

  it('resolves row and column categories for the selected cell', () => {
    expect(getCategoriesForCell(puzzle, 4)).toEqual({
      row: puzzle.row_categories[1],
      col: puzzle.col_categories[1],
    })
    expect(getCategoriesForCell(null, 4)).toEqual({ row: null, col: null })
    expect(getCategoriesForCell(puzzle, null)).toEqual({ row: null, col: null })
  })
})
