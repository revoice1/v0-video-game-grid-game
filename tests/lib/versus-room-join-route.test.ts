import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { createAdminClientMock, resolveAnonymousSessionMock, applyAnonymousSessionCookieMock } =
  vi.hoisted(() => ({
    createAdminClientMock: vi.fn(),
    resolveAnonymousSessionMock: vi.fn(),
    applyAnonymousSessionCookieMock: vi.fn(),
  }))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))
vi.mock('@/lib/logging', () => ({ createRequestLogger: vi.fn(() => ({ error: vi.fn() })) }))
vi.mock('@/lib/server-session', () => ({
  resolveAnonymousSession: resolveAnonymousSessionMock,
  applyAnonymousSessionCookie: applyAnonymousSessionCookieMock,
}))

import { POST } from '@/app/api/versus/room/[code]/join/route'

const SETTINGS = {
  stealRule: 'off',
  timerOption: 'none',
  disableDraws: false,
  objectionRule: 'off',
  categoryFilters: {},
}

function makeRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'room-1',
    code: 'TSTRM',
    match_number: 1,
    status: 'waiting',
    settings: SETTINGS,
    puzzle_id: null,
    puzzle_data: null,
    state_data: null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    host_session_id: 'host-s',
    guest_session_id: null,
    ...overrides,
  }
}

function makeRequest(code = 'TSTRM') {
  return new NextRequest(`http://localhost/api/versus/room/${code}/join`, { method: 'POST' })
}

function makeSupabase(
  room: ReturnType<typeof makeRoom>,
  updateResult = { data: null, error: null as unknown }
) {
  const updatedRoom = { ...room, guest_session_id: 'guest-s', status: 'active' }
  const safeUpdated = (() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { host_session_id, guest_session_id, ...rest } = updatedRoom
    return rest
  })()

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: room, error: null }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi
                .fn()
                .mockResolvedValue(
                  updateResult.error ? updateResult : { data: safeUpdated, error: null }
                ),
            })),
          })),
        })),
      })),
    })),
  }
}

describe('/api/versus/room/[code]/join route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyAnonymousSessionCookieMock.mockImplementation((res: unknown) => res)
  })

  it('host rejoining their own waiting room returns role x without DB write', async () => {
    resolveAnonymousSessionMock.mockReturnValue({ sessionId: 'host-s' })
    const room = makeRoom()
    createAdminClientMock.mockReturnValue(makeSupabase(room))

    const res = await POST(makeRequest(), { params: Promise.resolve({ code: 'TSTRM' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.role).toBe('x')
    expect(body.isHost).toBe(true)
    expect(body.room.code).toBe('TSTRM')
    // session IDs must not be in the response
    expect(body.room.host_session_id).toBeUndefined()
    expect(body.room.guest_session_id).toBeUndefined()
  })

  it('guest rejoining their own active room returns role o without DB write', async () => {
    resolveAnonymousSessionMock.mockReturnValue({ sessionId: 'guest-s' })
    const room = makeRoom({ status: 'active', guest_session_id: 'guest-s' })
    createAdminClientMock.mockReturnValue(makeSupabase(room))

    const res = await POST(makeRequest(), { params: Promise.resolve({ code: 'TSTRM' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.role).toBe('o')
    expect(body.isHost).toBe(false)
    expect(body.room.host_session_id).toBeUndefined()
  })

  it('returns the rematch-assigned role when a guest re-joins as the next X', async () => {
    resolveAnonymousSessionMock.mockReturnValue({ sessionId: 'guest-s' })
    const room = makeRoom({
      status: 'active',
      guest_session_id: 'guest-s',
      state_data: {
        roleAssignments: {
          xSessionId: 'guest-s',
          oSessionId: 'host-s',
        },
      },
    })
    createAdminClientMock.mockReturnValue(makeSupabase(room))

    const res = await POST(makeRequest(), { params: Promise.resolve({ code: 'TSTRM' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.role).toBe('x')
    expect(body.isHost).toBe(false)
  })

  it('new guest joins a waiting room, room transitions to active', async () => {
    resolveAnonymousSessionMock.mockReturnValue({ sessionId: 'new-guest' })
    const room = makeRoom()
    createAdminClientMock.mockReturnValue(makeSupabase(room))

    const res = await POST(makeRequest(), { params: Promise.resolve({ code: 'TSTRM' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.role).toBe('o')
    expect(body.isHost).toBe(false)
    expect(body.room.status).toBe('active')
  })

  it('returns 409 when room is already finished', async () => {
    resolveAnonymousSessionMock.mockReturnValue({ sessionId: 'some-s' })
    const room = makeRoom({ status: 'finished' })
    createAdminClientMock.mockReturnValue(makeSupabase(room))

    const res = await POST(makeRequest(), { params: Promise.resolve({ code: 'TSTRM' }) })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/already ended/i)
  })

  it('returns 410 when room has expired', async () => {
    resolveAnonymousSessionMock.mockReturnValue({ sessionId: 'some-s' })
    const room = makeRoom({ expires_at: new Date(Date.now() - 1000).toISOString() })
    createAdminClientMock.mockReturnValue(makeSupabase(room))

    const res = await POST(makeRequest(), { params: Promise.resolve({ code: 'TSTRM' }) })
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.error).toMatch(/expired/i)
  })

  it('returns 409 when active room already has two players', async () => {
    resolveAnonymousSessionMock.mockReturnValue({ sessionId: 'outsider' })
    const room = makeRoom({ status: 'active', guest_session_id: 'other-guest' })
    createAdminClientMock.mockReturnValue(makeSupabase(room))

    const res = await POST(makeRequest(), { params: Promise.resolve({ code: 'TSTRM' }) })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/two players/i)
  })

  it('returns 409 when DB update fails (race-condition double join)', async () => {
    resolveAnonymousSessionMock.mockReturnValue({ sessionId: 'new-guest' })
    const room = makeRoom()
    createAdminClientMock.mockReturnValue(
      makeSupabase(room, { data: null, error: new Error('conflict') })
    )

    const res = await POST(makeRequest(), { params: Promise.resolve({ code: 'TSTRM' }) })
    expect(res.status).toBe(409)
  })

  it('returns 404 when room does not exist', async () => {
    resolveAnonymousSessionMock.mockReturnValue({ sessionId: 'some-s' })
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('not found') }),
          })),
        })),
      })),
    })

    const res = await POST(makeRequest(), { params: Promise.resolve({ code: 'TSTRM' }) })
    expect(res.status).toBe(404)
  })
})
