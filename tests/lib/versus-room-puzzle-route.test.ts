import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { createAdminClientMock, resolveAnonymousSessionMock, createRequestLoggerMock } = vi.hoisted(
  () => ({
    createAdminClientMock: vi.fn(),
    resolveAnonymousSessionMock: vi.fn(),
    createRequestLoggerMock: vi.fn(),
  })
)

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/server-session', () => ({
  resolveAnonymousSession: resolveAnonymousSessionMock,
}))

vi.mock('@/lib/logging', () => ({
  createRequestLogger: createRequestLoggerMock,
}))

import { POST } from '@/app/api/versus/room/[code]/puzzle/route'

function buildSupabaseMock() {
  const room = {
    id: 'room-1',
    code: 'ABCD',
    host_session_id: 'session-1',
    guest_session_id: 'session-2',
    match_number: 1,
    status: 'active',
    puzzle_id: null,
    settings: {
      categoryFilters: {},
      stealRule: 'off',
      timerOption: 'none',
      disableDraws: false,
      objectionRule: 'off',
    },
    state_data: null,
  }

  const updatePayloads: Array<Record<string, unknown>> = []

  const supabase = {
    from: vi.fn((table: string) => {
      if (table !== 'versus_rooms') {
        throw new Error(`Unexpected table: ${table}`)
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: room, error: null }),
          })),
        })),
        update: vi.fn((payload: Record<string, unknown>) => {
          updatePayloads.push(payload)
          return {
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                select: vi.fn().mockResolvedValue({ data: [{ id: room.id }], error: null }),
              })),
            })),
          }
        }),
      }
    }),
  }

  return { supabase, updatePayloads }
}

describe('/api/versus/room/[code]/puzzle route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createRequestLoggerMock.mockReturnValue({
      requestId: 'test',
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })
    resolveAnonymousSessionMock.mockReturnValue({
      sessionId: 'session-1',
      shouldSetCookie: false,
    })
  })

  it('seeds initial role assignments with the joined guest as player o', async () => {
    const { supabase, updatePayloads } = buildSupabaseMock()
    createAdminClientMock.mockReturnValue(supabase)

    const request = new NextRequest('http://localhost/api/versus/room/ABCD/puzzle', {
      method: 'POST',
      body: JSON.stringify({
        puzzleId: 'puzzle-1',
        matchNumber: 1,
        puzzle: {
          id: 'puzzle-1',
          row_categories: [],
          col_categories: [],
        },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await POST(request, { params: Promise.resolve({ code: 'ABCD' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ ok: true })
    expect(updatePayloads).toHaveLength(1)
    expect(updatePayloads[0]).toEqual(
      expect.objectContaining({
        state_data: expect.objectContaining({
          currentPlayer: 'x',
          roleAssignments: {
            xSessionId: 'session-1',
            oSessionId: 'session-2',
          },
        }),
      })
    )
  })
})
