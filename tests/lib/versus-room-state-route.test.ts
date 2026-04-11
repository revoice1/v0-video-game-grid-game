import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { createAdminClientMock, resolveAnonymousSessionMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  resolveAnonymousSessionMock: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/server-session', () => ({
  resolveAnonymousSession: resolveAnonymousSessionMock,
}))

import { POST } from '@/app/api/versus/room/[code]/state/route'

function buildSupabaseMock() {
  const updateChainMock = {
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: { id: 'room-1' }, error: null }),
  }
  updateChainMock.eq.mockReturnValue(updateChainMock)
  updateChainMock.select.mockReturnValue(updateChainMock)
  const updateMock = vi.fn(() => updateChainMock)
  const updateEqMock = updateChainMock.eq
  const roomSingleMock = vi.fn().mockResolvedValue({
    data: {
      id: 'room-1',
      host_session_id: 'session-1',
      guest_session_id: 'session-2',
      match_number: 2,
      status: 'active',
      puzzle_id: 'puzzle-1',
    },
    error: null,
  })

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'versus_rooms') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: roomSingleMock,
            })),
          })),
          update: updateMock,
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  }

  return { supabase, updateMock, updateEqMock }
}

describe('/api/versus/room/[code]/state route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveAnonymousSessionMock.mockReturnValue({
      sessionId: 'session-1',
      shouldSetCookie: false,
    })
  })

  it('accepts snapshots that include stealRatingCount on guesses', async () => {
    const { supabase, updateMock } = buildSupabaseMock()
    createAdminClientMock.mockReturnValue(supabase)

    const request = new NextRequest('http://localhost/api/versus/room/ABCD/state', {
      method: 'POST',
      body: JSON.stringify({
        matchNumber: 2,
        snapshot: {
          puzzleId: 'puzzle-1',
          guesses: [
            {
              gameId: 7,
              gameName: 'Test Game',
              gameImage: null,
              isCorrect: true,
              owner: 'x',
              stealRating: 88,
              stealRatingCount: 245,
            },
            ...Array(8).fill(null),
          ],
          guessesRemaining: 8,
          currentPlayer: 'o',
          winner: null,
          stealableCell: 0,
          pendingFinalSteal: null,
          objectionsUsed: { x: 0, o: 0 },
          turnDeadlineAt: null,
          turnDurationSeconds: null,
        },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request, {
      params: Promise.resolve({ code: 'ABCD' }),
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ ok: true })
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        state_data: {
          puzzleId: 'puzzle-1',
          guesses: [
            {
              gameId: 7,
              gameName: 'Test Game',
              gameImage: null,
              isCorrect: true,
              owner: 'x',
              stealRating: 88,
              stealRatingCount: 245,
            },
            ...Array(8).fill(null),
          ],
          guessesRemaining: 8,
          currentPlayer: 'o',
          winner: null,
          stealableCell: 0,
          pendingFinalSteal: null,
          objectionsUsed: { x: 0, o: 0 },
          turnDeadlineAt: null,
          turnDurationSeconds: null,
        },
        expires_at: expect.any(String),
      })
    )
  })
})
