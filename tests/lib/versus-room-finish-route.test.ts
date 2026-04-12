import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { createAdminClientMock, resolveAnonymousSessionMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  resolveAnonymousSessionMock: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))
vi.mock('@/lib/logging', () => ({ createRequestLogger: vi.fn(() => ({ error: vi.fn() })) }))
vi.mock('@/lib/server-session', () => ({
  resolveAnonymousSession: resolveAnonymousSessionMock,
}))

import { POST } from '@/app/api/versus/room/[code]/finish/route'

function makeRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'room-1',
    host_session_id: 'host-s',
    guest_session_id: 'guest-s',
    match_number: 3,
    status: 'active',
    ...overrides,
  }
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/versus/room/TSTRM/finish', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeSupabase(room: ReturnType<typeof makeRoom>, updateError: unknown = null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: room, error: null }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: updateError }),
      })),
    })),
  }
}

describe('/api/versus/room/[code]/finish route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok:true and marks room finished for host', async () => {
    resolveAnonymousSessionMock.mockReturnValue({ sessionId: 'host-s' })
    createAdminClientMock.mockReturnValue(makeSupabase(makeRoom()))

    const res = await POST(makeRequest({ matchNumber: 3 }), {
      params: Promise.resolve({ code: 'TSTRM' }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it('returns ok:true and marks room finished for guest', async () => {
    resolveAnonymousSessionMock.mockReturnValue({ sessionId: 'guest-s' })
    createAdminClientMock.mockReturnValue(makeSupabase(makeRoom()))

    const res = await POST(makeRequest({ matchNumber: 3 }), {
      params: Promise.resolve({ code: 'TSTRM' }),
    })
    expect(res.status).toBe(200)
  })

  it('returns 409 when matchNumber is stale', async () => {
    resolveAnonymousSessionMock.mockReturnValue({ sessionId: 'host-s' })
    createAdminClientMock.mockReturnValue(makeSupabase(makeRoom())) // match_number: 3

    const res = await POST(makeRequest({ matchNumber: 2 }), {
      params: Promise.resolve({ code: 'TSTRM' }),
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/newer match/i)
  })

  it('returns 403 when caller is not a participant', async () => {
    resolveAnonymousSessionMock.mockReturnValue({ sessionId: 'outsider' })
    createAdminClientMock.mockReturnValue(makeSupabase(makeRoom()))

    const res = await POST(makeRequest({ matchNumber: 3 }), {
      params: Promise.resolve({ code: 'TSTRM' }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 400 when matchNumber is missing', async () => {
    resolveAnonymousSessionMock.mockReturnValue({ sessionId: 'host-s' })
    createAdminClientMock.mockReturnValue(makeSupabase(makeRoom()))

    const res = await POST(makeRequest({}), {
      params: Promise.resolve({ code: 'TSTRM' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 404 when room does not exist', async () => {
    resolveAnonymousSessionMock.mockReturnValue({ sessionId: 'host-s' })
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('not found') }),
          })),
        })),
      })),
    })

    const res = await POST(makeRequest({ matchNumber: 3 }), {
      params: Promise.resolve({ code: 'TSTRM' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 500 when DB update fails', async () => {
    resolveAnonymousSessionMock.mockReturnValue({ sessionId: 'host-s' })
    createAdminClientMock.mockReturnValue(makeSupabase(makeRoom(), new Error('DB error')))

    const res = await POST(makeRequest({ matchNumber: 3 }), {
      params: Promise.resolve({ code: 'TSTRM' }),
    })
    expect(res.status).toBe(500)
  })
})
