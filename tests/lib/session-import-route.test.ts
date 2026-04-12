import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  createAdminClientMock,
  applyAnonymousSessionCookieMock,
  checkRateLimitMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  applyAnonymousSessionCookieMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))
vi.mock('@/lib/server-session', () => ({
  applyAnonymousSessionCookie: applyAnonymousSessionCookieMock,
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock,
}))
vi.mock('@/lib/logging', () => ({
  createRequestLogger: vi.fn(() => ({ error: loggerErrorMock })),
}))

import { POST } from '@/app/api/session/import/route'

function makeRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/session/import', {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

describe('/api/session/import route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimitMock.mockReturnValue(true)
    applyAnonymousSessionCookieMock.mockImplementation((response: unknown) => response)
    const updateChain = {
      eq: vi.fn(),
      is: vi.fn(),
      gt: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: { session_id: '11111111-1111-1111-1111-111111111111' },
        error: null,
      }),
    }
    updateChain.eq.mockReturnValue(updateChain)
    updateChain.is.mockReturnValue(updateChain)
    updateChain.gt.mockReturnValue(updateChain)
    updateChain.select.mockReturnValue(updateChain)
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn(() => updateChain),
      })),
    })
  })

  it('accepts valid transfer code and sets cookie', async () => {
    const request = makeRequest(JSON.stringify({ code: 'ABCD-EFGH' }))

    const res = await POST(request)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(applyAnonymousSessionCookieMock).toHaveBeenCalledWith(
      expect.anything(),
      { sessionId: '11111111-1111-1111-1111-111111111111', shouldSetCookie: true },
      request
    )
  })

  it('returns 400 when code field is missing', async () => {
    const res = await POST(makeRequest(JSON.stringify({ nope: 'x' })))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid transfer code', async () => {
    const res = await POST(makeRequest(JSON.stringify({ code: 'hello' })))
    expect(res.status).toBe(400)
  })

  it('normalizes surrounding whitespace and separators', async () => {
    const res = await POST(makeRequest(JSON.stringify({ code: '  abcd efgh  ' })))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(applyAnonymousSessionCookieMock).toHaveBeenCalledWith(
      expect.anything(),
      { sessionId: '11111111-1111-1111-1111-111111111111', shouldSetCookie: true },
      expect.anything()
    )
  })

  it('returns 400 for malformed JSON body', async () => {
    const res = await POST(makeRequest('{'))
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limit exceeded', async () => {
    checkRateLimitMock.mockReturnValue(false)

    const res = await POST(makeRequest(JSON.stringify({ code: 'ABCD-EFGH' })))
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error).toBe('Too many attempts')
  })

  it('returns 400 when transfer code is missing or expired', async () => {
    const updateChain = {
      eq: vi.fn(),
      is: vi.fn(),
      gt: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    }
    updateChain.eq.mockReturnValue(updateChain)
    updateChain.is.mockReturnValue(updateChain)
    updateChain.gt.mockReturnValue(updateChain)
    updateChain.select.mockReturnValue(updateChain)
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn(() => updateChain),
      })),
    })

    const res = await POST(makeRequest(JSON.stringify({ code: 'ABCD-EFGH' })))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Invalid or expired transfer code')
  })

  it('returns 500 when applyAnonymousSessionCookie throws', async () => {
    applyAnonymousSessionCookieMock.mockImplementation(() => {
      throw new Error('boom')
    })

    const res = await POST(makeRequest(JSON.stringify({ code: 'ABCD-EFGH' })))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toBe('Failed to import session')
    expect(loggerErrorMock).toHaveBeenCalled()
  })
})
