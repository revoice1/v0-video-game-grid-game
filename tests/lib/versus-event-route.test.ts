import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { createAdminClientMock, resolveAnonymousSessionMock, validateOnlineVersusEventMock } =
  vi.hoisted(() => ({
    createAdminClientMock: vi.fn(),
    resolveAnonymousSessionMock: vi.fn(),
    validateOnlineVersusEventMock: vi.fn(),
  }))

const { validateIGDBGameForCellMock } = vi.hoisted(() => ({
  validateIGDBGameForCellMock: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/server-session', () => ({
  resolveAnonymousSession: resolveAnonymousSessionMock,
}))

vi.mock('@/lib/online-versus-event-validation', () => ({
  validateOnlineVersusEvent: validateOnlineVersusEventMock,
}))

vi.mock('@/lib/igdb', () => ({
  validateIGDBGameForCell: validateIGDBGameForCellMock,
}))

import { POST } from '@/app/api/versus/event/route'

function buildSupabaseMock(options?: {
  room?: Record<string, unknown>
  existingEvents?: Array<Record<string, unknown>>
  insertError?: { message: string } | null
}) {
  const room =
    options?.room ??
    ({
      host_session_id: 'session-1',
      guest_session_id: 'session-2',
      match_number: 3,
      status: 'active',
      settings: {
        categoryFilters: {},
        stealRule: 'lower',
        timerOption: 'none',
        disableDraws: false,
        objectionRule: 'one',
      },
      puzzle_id: 'puzzle-1',
      puzzle_data: {
        id: 'puzzle-1',
        date: null,
        is_daily: false,
        row_categories: [
          { type: 'genre', id: 1, name: 'RPG' },
          { type: 'genre', id: 2, name: 'Action' },
          { type: 'genre', id: 3, name: 'Puzzle' },
        ],
        col_categories: [
          { type: 'platform', id: 1, name: 'PlayStation' },
          { type: 'platform', id: 2, name: 'Switch' },
          { type: 'platform', id: 3, name: 'PC' },
        ],
        created_at: '2026-04-09T00:00:00.000Z',
      },
      state_data: null,
    } satisfies Record<string, unknown>)

  const existingEvents = options?.existingEvents ?? []
  const insertMock = vi.fn().mockResolvedValue({ error: options?.insertError ?? null })
  const roomSingleMock = vi.fn().mockResolvedValue({ data: room, error: null })
  const orderMock = vi.fn().mockResolvedValue({ data: existingEvents, error: null })

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'versus_rooms') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: roomSingleMock,
            })),
          })),
        }
      }

      if (table === 'versus_events') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: orderMock,
              })),
            })),
          })),
          insert: insertMock,
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  }

  return { supabase, insertMock }
}

describe('/api/versus/event route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveAnonymousSessionMock.mockReturnValue({
      sessionId: 'session-1',
      shouldSetCookie: false,
    })
    validateIGDBGameForCellMock.mockResolvedValue({
      valid: true,
      game: {
        id: 70,
        name: 'Resolved Game',
        slug: 'resolved-game',
        gameUrl: 'https://example.com/resolved-game',
        background_image: 'resolved.png',
        released: '2001-01-01',
        metacritic: 88,
        stealRating: 99,
        stealRatingCount: 240,
        genres: [{ id: 1, name: 'RPG', slug: 'rpg' }],
        platforms: [{ platform: { id: 1, name: 'PlayStation', slug: 'playstation' } }],
        developers: [{ id: 7, name: 'Dev Team', slug: 'dev-team' }],
        publishers: [{ id: 8, name: 'Pub Team', slug: 'pub-team' }],
        tags: [{ id: 9, name: 'Story Rich', slug: 'story-rich' }],
        igdb: {
          game_modes: ['Single player'],
          themes: ['Fantasy'],
          player_perspectives: ['Third person'],
          companies: ['Dev Team'],
          keywords: [],
        },
      },
      selectedGame: {
        id: 7,
        name: 'Chosen Port',
        slug: 'chosen-port',
        gameUrl: 'https://example.com/chosen-port',
        background_image: 'chosen.png',
        released: '2004-01-01',
        metacritic: 75,
        stealRating: 99,
        stealRatingCount: 100,
        genres: [{ id: 1, name: 'RPG', slug: 'rpg' }],
        platforms: [{ platform: { id: 1, name: 'PlayStation', slug: 'playstation' } }],
        developers: [{ id: 7, name: 'Dev Team', slug: 'dev-team' }],
        publishers: [{ id: 8, name: 'Pub Team', slug: 'pub-team' }],
        tags: [{ id: 9, name: 'Story Rich', slug: 'story-rich' }],
        igdb: {
          game_modes: ['Single player'],
          themes: ['Fantasy'],
          player_perspectives: ['Third person'],
          companies: ['Dev Team'],
          keywords: [],
        },
      },
      matchesRow: true,
      matchesCol: true,
      explanation: {
        row: {
          matched: true,
          categoryType: 'genre',
          categoryName: 'RPG',
          matchSource: 'igdb-array',
          matchedValues: ['RPG'],
          note: null,
        },
        col: {
          matched: true,
          categoryType: 'platform',
          categoryName: 'PlayStation',
          matchSource: 'direct-id',
          matchedValues: ['PlayStation'],
          note: null,
        },
        familyResolution: {
          used: true,
          selectedGameId: 7,
          selectedGameName: 'Chosen Port',
          note: 'Validated using merged original + official port family metadata.',
        },
      },
    })
  })

  it('returns the validation rejection code when the event is illegal', async () => {
    const { supabase, insertMock } = buildSupabaseMock()
    createAdminClientMock.mockReturnValue(supabase)
    validateOnlineVersusEventMock.mockReturnValue({
      ok: false,
      error: 'It is not your turn.',
      code: 'wrong_turn',
      status: 409,
    })

    const request = new NextRequest('http://localhost/api/versus/event', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'room-1',
        matchNumber: 3,
        player: 'x',
        type: 'claim',
        payload: { cellIndex: 0 },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload).toEqual({
      error: 'It is not your turn.',
      code: 'wrong_turn',
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('rejects stale-match events before validation or insert', async () => {
    const { supabase, insertMock } = buildSupabaseMock()
    createAdminClientMock.mockReturnValue(supabase)

    const request = new NextRequest('http://localhost/api/versus/event', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'room-1',
        matchNumber: 2,
        player: 'x',
        type: 'claim',
        payload: { cellIndex: 0 },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload).toEqual({
      error: 'This room has moved to a newer match.',
      code: 'stale_match',
    })
    expect(validateOnlineVersusEventMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('authorizes the rematch-assigned guest as player x', async () => {
    resolveAnonymousSessionMock.mockReturnValue({
      sessionId: 'session-2',
      shouldSetCookie: false,
    })
    const { supabase, insertMock } = buildSupabaseMock({
      room: {
        host_session_id: 'session-1',
        guest_session_id: 'session-2',
        match_number: 3,
        status: 'active',
        settings: {
          categoryFilters: {},
          stealRule: 'lower',
          timerOption: 'none',
          disableDraws: false,
          objectionRule: 'one',
        },
        puzzle_id: 'puzzle-1',
        puzzle_data: null,
        state_data: {
          roleAssignments: {
            xSessionId: 'session-2',
            oSessionId: 'session-1',
          },
        },
      },
    })
    createAdminClientMock.mockReturnValue(supabase)
    validateOnlineVersusEventMock.mockReturnValue({
      ok: false,
      error: 'It is not your turn.',
      code: 'wrong_turn',
      status: 409,
    })

    const request = new NextRequest('http://localhost/api/versus/event', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'room-1',
        matchNumber: 3,
        player: 'x',
        type: 'claim',
        payload: { cellIndex: 0 },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload).toEqual({
      error: 'It is not your turn.',
      code: 'wrong_turn',
    })
    expect(validateOnlineVersusEventMock).toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('treats repeated clientEventId submissions as idempotent successes', async () => {
    const existingClaimPayload = {
      cellIndex: 1,
      clientEventId: 'claim-1',
      guess: {
        gameId: 7,
        gameName: 'Chosen Port',
        gameImage: 'chosen.png',
        isCorrect: true,
        owner: 'x',
      },
    }
    const { supabase, insertMock } = buildSupabaseMock({
      existingEvents: [{ id: 1, player: 'x', type: 'claim', payload: existingClaimPayload }],
    })
    createAdminClientMock.mockReturnValue(supabase)

    const request = new NextRequest('http://localhost/api/versus/event', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'room-1',
        matchNumber: 3,
        player: 'x',
        type: 'claim',
        payload: existingClaimPayload,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      ok: true,
      duplicateEvent: true,
      type: 'claim',
      payload: existingClaimPayload,
    })
    expect(validateOnlineVersusEventMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('inserts the validated event payload on success', async () => {
    const { supabase, insertMock } = buildSupabaseMock({
      existingEvents: [{ id: 1, player: 'x', type: 'claim', payload: { cellIndex: 0 } }],
    })
    createAdminClientMock.mockReturnValue(supabase)
    validateOnlineVersusEventMock.mockReturnValue({
      ok: true,
      type: 'claim',
      payload: {
        cellIndex: 1,
        guess: {
          gameId: 7,
          gameName: 'Test Game',
          gameImage: null,
          isCorrect: true,
          owner: 'x',
        },
      },
      state: {
        guesses: Array.from({ length: 9 }, () => null),
        guessesRemaining: 9,
        currentPlayer: 'x',
        winner: null,
        stealableCell: null,
        pendingFinalSteal: null,
        objectionsUsed: { x: 0, o: 0 },
      },
    })

    const request = new NextRequest('http://localhost/api/versus/event', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'room-1',
        matchNumber: 3,
        player: 'x',
        type: 'claim',
        payload: { cellIndex: 1 },
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
        ok: true,
        type: 'claim',
        payload: expect.any(Object),
      })
    )
    expect(insertMock).toHaveBeenCalledWith({
      room_id: 'room-1',
      match_number: 3,
      player: 'x',
      type: 'claim',
      payload: {
        cellIndex: 1,
        guess: {
          gameId: 7,
          gameName: 'Chosen Port',
          gameSlug: 'resolved-game',
          gameUrl: 'https://example.com/resolved-game',
          gameImage: 'chosen.png',
          isCorrect: true,
          owner: 'x',
          released: '2001-01-01',
          metacritic: 88,
          stealRating: 99,
          stealRatingCount: 240,
          genres: ['RPG'],
          platforms: ['PlayStation'],
          developers: ['Dev Team'],
          publishers: ['Pub Team'],
          tags: ['Story Rich'],
          gameModes: ['Single player'],
          themes: ['Fantasy'],
          perspectives: ['Third person'],
          companies: ['Dev Team'],
          matchedRow: true,
          matchedCol: true,
          validationExplanation: expect.any(Object),
          objectionUsed: false,
          objectionVerdict: null,
          objectionExplanation: null,
          objectionOriginalMatchedRow: null,
          objectionOriginalMatchedCol: null,
        },
      },
    })
  })

  it('rejects a claim when the authoritative server validation fails for the submitted game', async () => {
    const { supabase, insertMock } = buildSupabaseMock()
    createAdminClientMock.mockReturnValue(supabase)
    validateOnlineVersusEventMock.mockReturnValue({
      ok: true,
      type: 'claim',
      payload: {
        cellIndex: 1,
        guess: {
          gameId: 7,
          gameName: 'Client Claimed Name',
          gameImage: null,
          isCorrect: true,
          owner: 'x',
        },
      },
      state: {
        guesses: Array.from({ length: 9 }, () => null),
        guessesRemaining: 9,
        currentPlayer: 'x',
        winner: null,
        stealableCell: null,
        pendingFinalSteal: null,
        objectionsUsed: { x: 0, o: 0 },
      },
    })
    validateIGDBGameForCellMock.mockResolvedValueOnce({
      valid: false,
      game: null,
      selectedGame: null,
      matchesRow: false,
      matchesCol: false,
      explanation: null,
    })

    const request = new NextRequest('http://localhost/api/versus/event', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'room-1',
        matchNumber: 3,
        player: 'x',
        type: 'claim',
        payload: { cellIndex: 1, guess: { gameId: 7, gameName: 'Client Claimed Name' } },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload).toEqual({
      error: 'The submitted game does not satisfy that cell on the server.',
      code: 'invalid_guess',
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('rewrites sustained objection guesses from authoritative server validation', async () => {
    const { supabase, insertMock } = buildSupabaseMock()
    createAdminClientMock.mockReturnValue(supabase)
    validateOnlineVersusEventMock.mockReturnValue({
      ok: true,
      type: 'objection',
      payload: {
        cellIndex: 1,
        verdict: 'sustained',
        updatedGuess: {
          gameId: 7,
          gameName: 'Client Claimed Name',
          gameImage: null,
          isCorrect: true,
          owner: 'x',
          objectionUsed: true,
          objectionVerdict: 'sustained',
          objectionExplanation: 'Judge agreed this should count.',
          objectionOriginalMatchedRow: false,
          objectionOriginalMatchedCol: true,
        },
        isSteal: false,
      },
      state: {
        guesses: Array.from({ length: 9 }, () => null),
        guessesRemaining: 9,
        currentPlayer: 'x',
        winner: null,
        stealableCell: null,
        pendingFinalSteal: null,
        objectionsUsed: { x: 0, o: 0 },
      },
    })

    const request = new NextRequest('http://localhost/api/versus/event', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'room-1',
        matchNumber: 3,
        player: 'x',
        type: 'objection',
        payload: { cellIndex: 1 },
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
        ok: true,
        type: 'objection',
        payload: expect.any(Object),
      })
    )
    expect(insertMock).toHaveBeenCalledWith({
      room_id: 'room-1',
      match_number: 3,
      player: 'x',
      type: 'objection',
      payload: {
        cellIndex: 1,
        verdict: 'sustained',
        isSteal: false,
        updatedGuess: {
          gameId: 7,
          gameName: 'Chosen Port',
          gameSlug: 'resolved-game',
          gameUrl: 'https://example.com/resolved-game',
          gameImage: 'chosen.png',
          isCorrect: true,
          owner: 'x',
          released: '2001-01-01',
          metacritic: 88,
          stealRating: 99,
          stealRatingCount: 240,
          genres: ['RPG'],
          platforms: ['PlayStation'],
          developers: ['Dev Team'],
          publishers: ['Pub Team'],
          tags: ['Story Rich'],
          gameModes: ['Single player'],
          themes: ['Fantasy'],
          perspectives: ['Third person'],
          companies: ['Dev Team'],
          matchedRow: true,
          matchedCol: true,
          validationExplanation: expect.any(Object),
          objectionUsed: true,
          objectionVerdict: 'sustained',
          objectionExplanation: 'Judge agreed this should count.',
          objectionOriginalMatchedRow: false,
          objectionOriginalMatchedCol: true,
        },
      },
    })
  })

  it('normalizes sustained objection review annotations before persisting them', async () => {
    const { supabase, insertMock } = buildSupabaseMock()
    createAdminClientMock.mockReturnValue(supabase)
    validateOnlineVersusEventMock.mockReturnValue({
      ok: true,
      type: 'objection',
      payload: {
        cellIndex: 1,
        verdict: 'sustained',
        updatedGuess: {
          gameId: 7,
          gameName: 'Client Claimed Name',
          gameImage: null,
          isCorrect: true,
          owner: 'x',
          objectionUsed: true,
          objectionVerdict: 'sustained',
          objectionExplanation: ' \u0007Judge agreed this should count.\u0000 ',
          objectionOriginalMatchedRow: 'not-a-boolean',
          objectionOriginalMatchedCol: true,
        },
        isSteal: false,
      },
      state: {
        guesses: Array.from({ length: 9 }, () => null),
        guessesRemaining: 9,
        currentPlayer: 'x',
        winner: null,
        stealableCell: null,
        pendingFinalSteal: null,
        objectionsUsed: { x: 0, o: 0 },
      },
    })

    const request = new NextRequest('http://localhost/api/versus/event', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'room-1',
        matchNumber: 3,
        player: 'x',
        type: 'objection',
        payload: { cellIndex: 1 },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          updatedGuess: expect.objectContaining({
            objectionExplanation: 'Judge agreed this should count.',
            objectionOriginalMatchedRow: null,
            objectionOriginalMatchedCol: true,
          }),
        }),
      })
    )
  })

  it('persists authoritative showdown details for sustained steal objections', async () => {
    const { supabase, insertMock } = buildSupabaseMock()
    createAdminClientMock.mockReturnValue(supabase)
    validateOnlineVersusEventMock.mockReturnValue({
      ok: true,
      type: 'objection',
      payload: {
        cellIndex: 1,
        verdict: 'sustained',
        updatedGuess: {
          gameId: 7,
          gameName: 'Client Claimed Name',
          gameImage: null,
          isCorrect: true,
          owner: 'x',
          objectionUsed: true,
          objectionVerdict: 'sustained',
          objectionExplanation: 'Judge agreed this should count.',
          objectionOriginalMatchedRow: false,
          objectionOriginalMatchedCol: true,
        },
        isSteal: true,
      },
      state: {
        guesses: [
          null,
          {
            gameId: 12,
            gameName: 'Defender Game',
            gameImage: null,
            isCorrect: true,
            owner: 'o',
            stealRating: 95,
            stealRatingCount: 800,
          },
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        guessesRemaining: 9,
        currentPlayer: 'x',
        winner: null,
        stealableCell: 1,
        pendingFinalSteal: null,
        objectionsUsed: { x: 0, o: 0 },
      },
    })

    const request = new NextRequest('http://localhost/api/versus/event', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'room-1',
        matchNumber: 3,
        player: 'x',
        type: 'objection',
        payload: { cellIndex: 1 },
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
        ok: true,
        type: 'objection',
        payload: expect.any(Object),
      })
    )
    expect(insertMock).toHaveBeenCalledWith({
      room_id: 'room-1',
      match_number: 3,
      player: 'x',
      type: 'objection',
      payload: {
        cellIndex: 1,
        verdict: 'sustained',
        isSteal: true,
        successful: false,
        hadShowdownScores: true,
        resolutionKind: 'next-player',
        nextPlayer: 'o',
        defender: undefined,
        attackingGameName: 'Chosen Port',
        attackingScore: 99,
        defendingGameName: 'Defender Game',
        defendingScore: 95,
        updatedGuess: {
          gameId: 7,
          gameName: 'Chosen Port',
          gameSlug: 'resolved-game',
          gameUrl: 'https://example.com/resolved-game',
          gameImage: 'chosen.png',
          isCorrect: true,
          owner: 'x',
          released: '2001-01-01',
          metacritic: 88,
          stealRating: 99,
          stealRatingCount: 240,
          genres: ['RPG'],
          platforms: ['PlayStation'],
          developers: ['Dev Team'],
          publishers: ['Pub Team'],
          tags: ['Story Rich'],
          gameModes: ['Single player'],
          themes: ['Fantasy'],
          perspectives: ['Third person'],
          companies: ['Dev Team'],
          matchedRow: true,
          matchedCol: true,
          validationExplanation: expect.any(Object),
          objectionUsed: true,
          objectionVerdict: 'sustained',
          objectionExplanation: 'Judge agreed this should count.',
          objectionOriginalMatchedRow: false,
          objectionOriginalMatchedCol: true,
        },
      },
    })
  })

  it('rewrites overruled steal objection resolution from server state', async () => {
    const { supabase, insertMock } = buildSupabaseMock()
    createAdminClientMock.mockReturnValue(supabase)
    validateOnlineVersusEventMock.mockReturnValue({
      ok: true,
      type: 'objection',
      payload: {
        cellIndex: 1,
        verdict: 'overruled',
        updatedGuess: {
          gameId: 7,
          gameName: 'Client Claimed Name',
          gameImage: null,
          isCorrect: false,
          owner: 'x',
          objectionExplanation: 'Client-side explanation',
          objectionOriginalMatchedRow: false,
          objectionOriginalMatchedCol: false,
        },
        isSteal: true,
        guessesRemaining: 8,
        resolutionKind: 'defender-wins',
        defender: 'x',
      },
      state: {
        guesses: [
          null,
          {
            gameId: 12,
            gameName: 'Defender Game',
            gameImage: null,
            isCorrect: true,
            owner: 'o',
          },
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        guessesRemaining: 9,
        currentPlayer: 'x',
        winner: null,
        stealableCell: 1,
        pendingFinalSteal: null,
        objectionsUsed: { x: 0, o: 0 },
      },
    })

    const request = new NextRequest('http://localhost/api/versus/event', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'room-1',
        matchNumber: 3,
        player: 'x',
        type: 'objection',
        payload: { cellIndex: 1 },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          verdict: 'overruled',
          isSteal: true,
          resolutionKind: 'next-player',
          nextPlayer: 'o',
          defender: undefined,
        }),
      })
    )
    expect(validateIGDBGameForCellMock).not.toHaveBeenCalled()
  })

  it('rejects a steal when the client-reported showdown result disagrees with the server', async () => {
    const { supabase, insertMock } = buildSupabaseMock()
    createAdminClientMock.mockReturnValue(supabase)
    validateOnlineVersusEventMock.mockReturnValue({
      ok: true,
      type: 'steal',
      payload: {
        cellIndex: 1,
        attackingGuess: {
          gameId: 7,
          gameName: 'Client Claimed Name',
          gameImage: null,
          isCorrect: true,
          owner: 'o',
        },
        successful: true,
      },
      state: {
        guesses: [
          null,
          {
            gameId: 12,
            gameName: 'Defender Game',
            gameImage: null,
            isCorrect: true,
            owner: 'x',
            stealRating: 95,
            stealRatingCount: 800,
          },
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        guessesRemaining: 9,
        currentPlayer: 'o',
        winner: null,
        stealableCell: 1,
        pendingFinalSteal: null,
        objectionsUsed: { x: 0, o: 0 },
      },
    })
    validateIGDBGameForCellMock.mockResolvedValueOnce({
      valid: true,
      game: {
        id: 70,
        name: 'Resolved Game',
        slug: 'resolved-game',
        gameUrl: 'https://example.com/resolved-game',
        background_image: 'resolved.png',
        released: '2001-01-01',
        metacritic: 88,
        stealRating: 99,
        stealRatingCount: 240,
        genres: [],
        platforms: [],
        developers: [],
        publishers: [],
        tags: [],
        igdb: {
          game_modes: [],
          themes: [],
          player_perspectives: [],
          companies: [],
          keywords: [],
        },
      },
      selectedGame: {
        id: 7,
        name: 'Chosen Port',
        slug: 'chosen-port',
        gameUrl: 'https://example.com/chosen-port',
        background_image: 'chosen.png',
        released: '2004-01-01',
        metacritic: 75,
        stealRating: 99,
        stealRatingCount: 100,
        genres: [],
        platforms: [],
        developers: [],
        publishers: [],
        tags: [],
        igdb: {
          game_modes: [],
          themes: [],
          player_perspectives: [],
          companies: [],
          keywords: [],
        },
      },
      matchesRow: true,
      matchesCol: true,
      explanation: {
        row: {
          matched: true,
          categoryType: 'genre',
          categoryName: 'RPG',
          matchSource: 'igdb-array',
          matchedValues: ['RPG'],
          note: null,
        },
        col: {
          matched: true,
          categoryType: 'platform',
          categoryName: 'PlayStation',
          matchSource: 'direct-id',
          matchedValues: ['PlayStation'],
          note: null,
        },
        familyResolution: {
          used: false,
          selectedGameId: 7,
          selectedGameName: 'Chosen Port',
          note: null,
        },
      },
    })

    const request = new NextRequest('http://localhost/api/versus/event', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'room-1',
        matchNumber: 3,
        player: 'x',
        type: 'steal',
        payload: {
          cellIndex: 1,
          attackingGuess: { gameId: 7, gameName: 'Client Claimed Name' },
          successful: true,
        },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload).toEqual({
      error: 'The steal result did not match the authoritative showdown outcome.',
      code: 'steal_outcome_mismatch',
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('keeps steals disabled when the room steal rule is off', async () => {
    const { supabase, insertMock } = buildSupabaseMock({
      room: {
        host_session_id: 'session-1',
        guest_session_id: 'session-2',
        match_number: 3,
        status: 'active',
        settings: {
          categoryFilters: {},
          stealRule: 'off',
          timerOption: 'none',
          disableDraws: false,
          objectionRule: 'one',
        },
        puzzle_id: 'puzzle-1',
        puzzle_data: {
          id: 'puzzle-1',
          date: null,
          is_daily: false,
          row_categories: [
            { type: 'genre', id: 1, name: 'RPG' },
            { type: 'genre', id: 2, name: 'Action' },
            { type: 'genre', id: 3, name: 'Puzzle' },
          ],
          col_categories: [
            { type: 'platform', id: 1, name: 'PlayStation' },
            { type: 'platform', id: 2, name: 'Switch' },
            { type: 'platform', id: 3, name: 'PC' },
          ],
          created_at: '2026-04-09T00:00:00.000Z',
        },
        state_data: null,
      },
    })
    createAdminClientMock.mockReturnValue(supabase)
    validateOnlineVersusEventMock.mockReturnValue({
      ok: true,
      type: 'steal',
      payload: {
        cellIndex: 1,
        attackingGuess: {
          gameId: 7,
          gameName: 'Client Claimed Name',
          gameImage: null,
          isCorrect: true,
          owner: 'x',
        },
        successful: false,
        resolutionKind: 'defender-wins',
        defender: 'x',
      },
      state: {
        guesses: [
          null,
          {
            gameId: 12,
            gameName: 'Defender Game',
            gameImage: null,
            isCorrect: true,
            owner: 'o',
          },
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        guessesRemaining: 9,
        currentPlayer: 'x',
        winner: null,
        stealableCell: 1,
        pendingFinalSteal: null,
        objectionsUsed: { x: 0, o: 0 },
      },
    })

    const request = new NextRequest('http://localhost/api/versus/event', {
      method: 'POST',
      body: JSON.stringify({
        roomId: 'room-1',
        matchNumber: 3,
        player: 'x',
        type: 'steal',
        payload: { cellIndex: 1 },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          successful: false,
          hadShowdownScores: false,
          attackingScore: null,
          defendingScore: null,
          resolutionKind: 'next-player',
          nextPlayer: 'o',
          defender: undefined,
        }),
      })
    )
  })
})
