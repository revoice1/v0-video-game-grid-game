import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  createAdminClientMock,
  resolveAnonymousSessionMock,
  applyAnonymousSessionCookieMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  resolveAnonymousSessionMock: vi.fn(),
  applyAnonymousSessionCookieMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))
vi.mock('@/lib/server-session', () => ({
  resolveAnonymousSession: resolveAnonymousSessionMock,
  applyAnonymousSessionCookie: applyAnonymousSessionCookieMock,
}))
vi.mock('@/lib/logging', () => ({
  createRequestLogger: vi.fn(() => ({ error: loggerErrorMock })),
}))

import { GET } from '@/app/api/session/export/route'

describe('/api/session/export route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyAnonymousSessionCookieMock.mockImplementation((response: unknown) => response)
    const deleteExpiredChain = {
      lt: vi.fn().mockResolvedValue({ error: null }),
    }
    const deleteUsedChain = {
      not: vi.fn().mockResolvedValue({ error: null }),
    }
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    const fromMock = vi
      .fn()
      .mockReturnValueOnce({
        delete: vi.fn(() => deleteExpiredChain),
      })
      .mockReturnValueOnce({
        delete: vi.fn(() => deleteUsedChain),
      })
      .mockReturnValue({
        insert: insertMock,
      })
    createAdminClientMock.mockReturnValue({
      from: fromMock,
    })
  })

  it('returns a transfer code and expiry', async () => {
    resolveAnonymousSessionMock.mockReturnValue({
      sessionId: '11111111-1111-1111-1111-111111111111',
      shouldSetCookie: false,
    })

    const res = await GET(new NextRequest('http://localhost/api/session/export'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    expect(body.expiresAt).toEqual(expect.any(String))
    expect(body.expiresInMinutes).toBe(10)
  })

  it('calls applyAnonymousSessionCookie on the response', async () => {
    const resolved = {
      sessionId: '11111111-1111-1111-1111-111111111111',
      shouldSetCookie: true,
    }
    resolveAnonymousSessionMock.mockReturnValue(resolved)
    const request = new NextRequest('http://localhost/api/session/export')

    await GET(request)

    expect(applyAnonymousSessionCookieMock).toHaveBeenCalledWith(
      expect.anything(),
      resolved,
      request
    )
  })

  it('cleans up expired and used transfer codes before inserting', async () => {
    const deleteExpiredChain = {
      lt: vi.fn().mockResolvedValue({ error: null }),
    }
    const deleteUsedChain = {
      not: vi.fn().mockResolvedValue({ error: null }),
    }
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    const fromMock = vi
      .fn()
      .mockReturnValueOnce({
        delete: vi.fn(() => deleteExpiredChain),
      })
      .mockReturnValueOnce({
        delete: vi.fn(() => deleteUsedChain),
      })
      .mockReturnValue({
        insert: insertMock,
      })

    createAdminClientMock.mockReturnValue({ from: fromMock })
    resolveAnonymousSessionMock.mockReturnValue({
      sessionId: '11111111-1111-1111-1111-111111111111',
      shouldSetCookie: false,
    })

    await GET(new NextRequest('http://localhost/api/session/export'))

    expect(deleteExpiredChain.lt).toHaveBeenCalledWith('expires_at', expect.any(String))
    expect(deleteUsedChain.not).toHaveBeenCalledWith('used_at', 'is', null)
    expect(insertMock).toHaveBeenCalled()
  })

  it('returns 500 if token insert fails', async () => {
    const deleteExpiredChain = {
      lt: vi.fn().mockResolvedValue({ error: null }),
    }
    const deleteUsedChain = {
      not: vi.fn().mockResolvedValue({ error: null }),
    }
    createAdminClientMock.mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce({
          delete: vi.fn(() => deleteExpiredChain),
        })
        .mockReturnValueOnce({
          delete: vi.fn(() => deleteUsedChain),
        })
        .mockReturnValue({
          insert: vi.fn().mockResolvedValue({ error: { message: 'boom' } }),
        }),
    })

    const res = await GET(new NextRequest('http://localhost/api/session/export'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Failed to create transfer code')
    expect(loggerErrorMock).toHaveBeenCalled()
  })

  it('continues when cleanup fails', async () => {
    const deleteExpiredChain = {
      lt: vi.fn().mockResolvedValue({ error: { message: 'expired cleanup failed' } }),
    }
    const deleteUsedChain = {
      not: vi.fn().mockResolvedValue({ error: { message: 'used cleanup failed' } }),
    }
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    createAdminClientMock.mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce({
          delete: vi.fn(() => deleteExpiredChain),
        })
        .mockReturnValueOnce({
          delete: vi.fn(() => deleteUsedChain),
        })
        .mockReturnValue({
          insert: insertMock,
        }),
    })
    resolveAnonymousSessionMock.mockReturnValue({
      sessionId: '11111111-1111-1111-1111-111111111111',
      shouldSetCookie: false,
    })

    const res = await GET(new NextRequest('http://localhost/api/session/export'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.code).toEqual(expect.any(String))
    expect(insertMock).toHaveBeenCalled()
    expect(loggerErrorMock).toHaveBeenCalledTimes(2)
  })

  it('returns 500 if resolveAnonymousSession throws', async () => {
    resolveAnonymousSessionMock.mockImplementation(() => {
      throw new Error('boom')
    })

    const res = await GET(new NextRequest('http://localhost/api/session/export'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Failed to export session')
    expect(loggerErrorMock).toHaveBeenCalled()
  })
})
