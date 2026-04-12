import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { GuessValidationExplanation } from '@/lib/types'

const {
  createClientMock,
  createAdminClientMock,
  validateIGDBGameForCellMock,
  logErrorMock,
  logWarnMock,
  applyAnonymousSessionCookieMock,
  resolveAnonymousSessionMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  validateIGDBGameForCellMock: vi.fn(),
  logErrorMock: vi.fn(),
  logWarnMock: vi.fn(),
  applyAnonymousSessionCookieMock: vi.fn((response: Response) => response),
  resolveAnonymousSessionMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/igdb', () => ({
  validateIGDBGameForCell: validateIGDBGameForCellMock,
}))

vi.mock('@/lib/logging', () => ({
  logError: logErrorMock,
  logWarn: logWarnMock,
  createRequestLogger: () => ({
    requestId: 'test-id',
    info: vi.fn(),
    warn: logWarnMock,
    error: logErrorMock,
  }),
}))

vi.mock('@/lib/server-session', () => ({
  applyAnonymousSessionCookie: applyAnonymousSessionCookieMock,
  resolveAnonymousSession: resolveAnonymousSessionMock,
}))

import { POST } from '@/app/api/guess/route'

const validationExplanation: GuessValidationExplanation = {
  row: {
    matched: true,
    categoryType: 'genre',
    categoryName: 'RPG',
    matchSource: 'igdb-array',
    matchedValues: ['Role-playing (RPG)'],
    note: null,
  },
  col: {
    matched: false,
    categoryType: 'platform',
    categoryName: 'PlayStation (Original)',
    matchSource: 'no-match',
    matchedValues: [],
    note: null,
  },
  familyResolution: {
    used: true,
    selectedGameId: 7,
    selectedGameName: 'Test Game',
    note: 'Validated using merged original + official port family metadata.',
  },
}

describe('/api/guess route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createClientMock.mockResolvedValue({ from: vi.fn() })
    createAdminClientMock.mockReturnValue({ from: vi.fn() })
    resolveAnonymousSessionMock.mockReturnValue({
      sessionId: 'session-1',
      shouldSetCookie: false,
    })
  })

  it('returns validationExplanation for lookupOnly requests', async () => {
    validateIGDBGameForCellMock.mockResolvedValue({
      valid: false,
      game: {
        id: 7,
        name: 'Test Game',
        slug: 'test-game',
        gameUrl: 'https://example.com/test-game',
        background_image: 'https://example.com/test.png',
        released: '1998-02-03',
        releaseDates: ['1997-01-31', '1998-02-03'],
        metacritic: 88,
        stealRating: 86,
        stealRatingCount: 245,
        genres: [{ id: 1, name: 'Role-playing (RPG)', slug: 'rpg' }],
        platforms: [{ platform: { id: 6, name: 'PC (Microsoft Windows)', slug: 'pc' } }],
        developers: [{ id: 10, name: 'Square', slug: 'square' }],
        publishers: [{ id: 11, name: 'Sony', slug: 'sony' }],
        tags: [{ id: 12, name: 'classic', slug: 'classic' }],
        igdb: {
          id: 7,
          game_modes: ['Single player'],
          themes: ['Drama'],
          player_perspectives: ['Side view'],
          companies: ['Sony'],
          keywords: ['classic'],
        },
      },
      selectedGame: {
        id: 700,
        name: 'Test Game (Official)',
        slug: 'test-game-official',
        gameUrl: 'https://example.com/test-game-official',
        background_image: 'https://example.com/test-official.png',
        released: '1998-02-03',
        metacritic: 88,
        genres: [{ id: 1, name: 'Role-playing (RPG)', slug: 'rpg' }],
        platforms: [{ platform: { id: 6, name: 'PC (Microsoft Windows)', slug: 'pc' } }],
      },
      matchesRow: true,
      matchesCol: false,
      explanation: validationExplanation,
    })

    const request = new NextRequest('http://localhost/api/guess', {
      method: 'POST',
      body: JSON.stringify({
        gameId: 7,
        rowCategory: { type: 'genre', id: 'rpg', name: 'RPG' },
        colCategory: { type: 'platform', id: 'ps1', name: 'PlayStation (Original)' },
        lookupOnly: true,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual(
      expect.objectContaining({
        valid: false,
        duplicate: false,
        matchesRow: true,
        matchesCol: false,
        validationExplanation,
        game: expect.objectContaining({
          id: 7,
          name: 'Test Game',
          slug: 'test-game',
          gameModes: ['Single player'],
          companies: ['Sony'],
        }),
        selectedGame: {
          id: 700,
          name: 'Test Game (Official)',
          slug: 'test-game-official',
          url: 'https://example.com/test-game-official',
          background_image: 'https://example.com/test-official.png',
        },
      })
    )
    expect(applyAnonymousSessionCookieMock).toHaveBeenCalledOnce()
  })
})
