import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  createClientMock,
  createRequestLoggerMock,
  resolveAnonymousSessionMock,
  getLegacySessionIdFromRequestMock,
  applyAnonymousSessionCookieMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createRequestLoggerMock: vi.fn(),
  resolveAnonymousSessionMock: vi.fn(),
  getLegacySessionIdFromRequestMock: vi.fn(),
  applyAnonymousSessionCookieMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
vi.mock('@/lib/logging', () => ({ createRequestLogger: createRequestLoggerMock }))
vi.mock('@/lib/server-session', () => ({
  resolveAnonymousSession: resolveAnonymousSessionMock,
  getLegacySessionIdFromRequest: getLegacySessionIdFromRequestMock,
  applyAnonymousSessionCookie: applyAnonymousSessionCookieMock,
}))

import { GET } from '@/app/api/daily-history/route'

const logger = { requestId: 'test', info: vi.fn(), warn: vi.fn(), error: vi.fn() }
const SESSION = { sessionId: 'sess-1', isNew: false }

function makeRequest() {
  return new NextRequest(new URL('http://localhost/api/daily-history'))
}

function makeSupabase({
  puzzles = [
    { id: 'p1', date: '2026-04-12' },
    { id: 'p2', date: '2026-04-11' },
  ],
  completions = [{ puzzle_id: 'p1' }],
  guesses = [
    { puzzle_id: 'p1', cell_index: 0 },
    { puzzle_id: 'p1', cell_index: 1 },
  ],
  puzzleError = null as unknown,
  completionError = null as unknown,
  guessError = null as unknown,
} = {}) {
  const puzzleChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: puzzles, error: puzzleError }),
  }
  const completionChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: completions, error: completionError }),
  }
  const guessChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: guesses, error: guessError }),
  }

  return {
    from: vi.fn((table: string) => {
      if (table === 'puzzles') return puzzleChain
      if (table === 'puzzle_completions') return completionChain
      if (table === 'guesses') return guessChain
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

describe('GET /api/daily-history', () => {
  beforeEach(() => {
    createRequestLoggerMock.mockReturnValue(logger)
    resolveAnonymousSessionMock.mockReturnValue(SESSION)
    getLegacySessionIdFromRequestMock.mockReturnValue(null)
    applyAnonymousSessionCookieMock.mockImplementation((res) => res)
  })

  it('returns entries with completion and guess count', async () => {
    createClientMock.mockResolvedValue(makeSupabase())
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.entries).toHaveLength(2)
    expect(body.entries[0]).toMatchObject({
      id: 'p1',
      date: '2026-04-12',
      is_completed: true,
      guess_count: 2,
    })
    expect(body.entries[1]).toMatchObject({
      id: 'p2',
      date: '2026-04-11',
      is_completed: false,
      guess_count: 0,
    })
  })

  it('marks puzzle as not completed when no completion row', async () => {
    createClientMock.mockResolvedValue(makeSupabase({ completions: [] }))
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.entries.every((e: { is_completed: boolean }) => !e.is_completed)).toBe(true)
  })

  it('returns 500 on puzzle query error', async () => {
    createClientMock.mockResolvedValue(makeSupabase({ puzzleError: new Error('DB error') }))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
    expect(logger.error).toHaveBeenCalled()
  })

  it('returns 500 on completion query error', async () => {
    createClientMock.mockResolvedValue(
      makeSupabase({ completionError: new Error('completion fail') })
    )
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })

  it('calls applyAnonymousSessionCookie on success', async () => {
    createClientMock.mockResolvedValue(makeSupabase())
    await GET(makeRequest())
    expect(applyAnonymousSessionCookieMock).toHaveBeenCalled()
  })
})
