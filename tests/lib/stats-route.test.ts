import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  createClientMock,
  createRequestLoggerMock,
  resolveAnonymousSessionMock,
  applyAnonymousSessionCookieMock,
  buildDailyStreakSummaryMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createRequestLoggerMock: vi.fn(),
  resolveAnonymousSessionMock: vi.fn(),
  applyAnonymousSessionCookieMock: vi.fn(),
  buildDailyStreakSummaryMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
vi.mock('@/lib/logging', () => ({ createRequestLogger: createRequestLoggerMock }))
vi.mock('@/lib/server-session', () => ({
  resolveAnonymousSession: resolveAnonymousSessionMock,
  applyAnonymousSessionCookie: applyAnonymousSessionCookieMock,
}))
vi.mock('@/lib/daily-streaks', () => ({
  buildDailyStreakSummary: buildDailyStreakSummaryMock,
}))

import { GET, POST } from '@/app/api/stats/route'

let logger = { requestId: 'test', info: vi.fn(), warn: vi.fn(), error: vi.fn() }
const SESSION = { sessionId: 'sess-1', isNew: false }

function makeGetRequest(puzzleId?: string) {
  const url = new URL('http://localhost/api/stats')
  if (puzzleId) url.searchParams.set('puzzleId', puzzleId)
  return new NextRequest(url)
}

function makePostRequest(body: unknown) {
  return new NextRequest(new URL('http://localhost/api/stats'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// Returns a Supabase-style chainable that resolves when awaited or when .single()/.in() is called.
function makeChain(resolved: { data: unknown; error: unknown }) {
  const promise = Promise.resolve(resolved)
  const chain: Record<string, unknown> = {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }
  const methods = ['select', 'eq', 'not', 'order', 'limit', 'in', 'single', 'maybeSingle']
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  return chain
}

type GuessRow = {
  puzzle_id: string
  cell_index: number
  game_id: number
  game_name: string
  game_image: null
  is_correct: boolean
  session_id: string
}

function makeGetSupabase({
  puzzle = { row_categories: [], col_categories: [], is_daily: false } as unknown,
  puzzleError = null as unknown,
  completionRows = [{ session_id: 'sess-1' }] as { session_id: string }[],
  completionError = null as unknown,
  answerRows = [] as GuessRow[],
  guessRows = [] as GuessRow[],
  guessError = null as unknown,
} = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'puzzles') return makeChain({ data: puzzle, error: puzzleError })
      if (table === 'puzzle_completions')
        return makeChain({ data: completionRows, error: completionError })
      if (table === 'answer_stats') return makeChain({ data: answerRows, error: null })
      if (table === 'guesses') return makeChain({ data: guessRows, error: guessError })
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

describe('GET /api/stats', () => {
  beforeEach(() => {
    logger = { requestId: 'test', info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    createRequestLoggerMock.mockReturnValue(logger)
    resolveAnonymousSessionMock.mockReturnValue(SESSION)
    applyAnonymousSessionCookieMock.mockImplementation((res) => res)
    buildDailyStreakSummaryMock.mockReturnValue({
      streak: 0,
      bestStreak: 0,
      totalCompleted: 0,
      perfectBoards: 0,
    })
  })

  it('returns 400 when puzzleId is missing', async () => {
    createClientMock.mockResolvedValue(makeGetSupabase())
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns cellStats and totalCompletions on success', async () => {
    createClientMock.mockResolvedValue(
      makeGetSupabase({
        completionRows: [{ session_id: 'sess-1' }, { session_id: 'sess-2' }],
        answerRows: [
          {
            puzzle_id: 'p1',
            cell_index: 0,
            game_id: 1,
            game_name: 'Portal',
            game_image: null,
            is_correct: true,
            session_id: 'sess-1',
          },
        ],
        guessRows: [
          {
            puzzle_id: 'p1',
            cell_index: 0,
            game_id: 2,
            game_name: 'HL2',
            game_image: null,
            is_correct: false,
            session_id: 'sess-1',
          },
        ],
      })
    )
    const res = await GET(makeGetRequest('p1'))
    const body = await res.json()
    expect(body.totalCompletions).toBe(2)
    expect(body.cellStats[0].correct).toHaveLength(1)
    expect(body.cellStats[0].incorrect).toHaveLength(1)
    expect(body.cellStats[0].correct[0].game_name).toBe('Portal')
  })

  it('returns 500 on puzzle query error', async () => {
    createClientMock.mockResolvedValue(makeGetSupabase({ puzzleError: new Error('DB fail') }))
    const res = await GET(makeGetRequest('p1'))
    expect(res.status).toBe(500)
    expect(logger.error).toHaveBeenCalled()
  })

  it('does not include dailySummary for non-daily puzzles', async () => {
    createClientMock.mockResolvedValue(
      makeGetSupabase({ puzzle: { row_categories: [], col_categories: [], is_daily: false } })
    )
    const res = await GET(makeGetRequest('p1'))
    const body = await res.json()
    expect(body.dailySummary).toBeNull()
  })
})

describe('POST /api/stats', () => {
  beforeEach(() => {
    logger = { requestId: 'test', info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    createRequestLoggerMock.mockReturnValue(logger)
    resolveAnonymousSessionMock.mockReturnValue(SESSION)
    applyAnonymousSessionCookieMock.mockImplementation((res) => res)
  })

  it('returns success on valid upsert', async () => {
    let callIdx = 0
    const supabaseFull = {
      from: vi.fn((table: string) => {
        callIdx++
        if (table === 'puzzle_completions' && callIdx === 1) {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
            })),
          }
        }
        if (table === 'puzzle_completions' && callIdx === 2) {
          return { upsert: vi.fn().mockResolvedValue({ error: null }) }
        }
        if (table === 'guesses') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                })),
              })),
            })),
          }
        }
        throw new Error(`Unexpected: ${table}`)
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    }
    createClientMock.mockResolvedValue(supabaseFull)

    const res = await POST(makePostRequest({ puzzleId: 'p1', score: 7, rarityScore: 42 }))
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 on upsert error', async () => {
    let callIdx = 0
    const supabase = {
      from: vi.fn((table: string) => {
        callIdx++
        if (table === 'puzzle_completions' && callIdx === 1) {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
            })),
          }
        }
        if (table === 'puzzle_completions' && callIdx === 2) {
          return { upsert: vi.fn().mockResolvedValue({ error: new Error('upsert fail') }) }
        }
        throw new Error(`Unexpected: ${table}`)
      }),
      rpc: vi.fn(),
    }
    createClientMock.mockResolvedValue(supabase)

    const res = await POST(makePostRequest({ puzzleId: 'p1', score: 7, rarityScore: 42 }))
    expect(res.status).toBe(500)
    expect(logger.error).toHaveBeenCalled()
  })
})
