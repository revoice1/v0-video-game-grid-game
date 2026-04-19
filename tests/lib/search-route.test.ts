import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { searchIGDBGamesMock, createRequestLoggerMock, createClientMock } = vi.hoisted(() => ({
  searchIGDBGamesMock: vi.fn(),
  createRequestLoggerMock: vi.fn(),
  createClientMock: vi.fn(),
}))

vi.mock('@/lib/igdb', () => ({
  searchIGDBGames: searchIGDBGamesMock,
}))

vi.mock('@/lib/logging', () => ({
  createRequestLogger: createRequestLoggerMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { GET } from '@/app/api/search/route'

const logger = { requestId: 'test', info: vi.fn(), warn: vi.fn(), error: vi.fn() }

function makeGame(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Half-Life',
    background_image: null,
    metacritic: 96,
    gameTypeLabel: null,
    originalPlatformName: 'PC',
    hasSameNamePortFamily: false,
    released: '1998-11-19',
    genres: ['Shooter'],
    platforms: ['PC'],
    stealRating: null,
    stealRatingCount: null,
    ...overrides,
  }
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/search')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new NextRequest(url)
}

describe('GET /api/search', () => {
  beforeEach(() => {
    createRequestLoggerMock.mockReturnValue(logger)
    searchIGDBGamesMock.mockResolvedValue([])
    createClientMock.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    })
  })

  it('returns empty results when query is absent', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body).toEqual({ results: [] })
    expect(searchIGDBGamesMock).not.toHaveBeenCalled()
  })

  it('returns empty results when query is too short', async () => {
    const res = await GET(makeRequest({ q: 'a' }))
    const body = await res.json()
    expect(body).toEqual({ results: [] })
    expect(searchIGDBGamesMock).not.toHaveBeenCalled()
  })

  it('calls searchIGDBGames and returns mapped results', async () => {
    searchIGDBGamesMock.mockResolvedValue([makeGame()])
    const res = await GET(makeRequest({ q: 'half-life' }))
    const body = await res.json()
    expect(searchIGDBGamesMock).toHaveBeenCalledWith(
      'half-life',
      expect.objectContaining({
        allowUnratedFallback: false,
        onDebugEvent: expect.any(Function),
      })
    )
    expect(body.results).toHaveLength(1)
    expect(body.results[0].id).toBe(1)
    expect(body.results[0].name).toBe('Half-Life')
    expect(logger.info).toHaveBeenCalledWith('Search completed', expect.any(Object))
  })

  it('enables unrated fallback for daily search mode', async () => {
    searchIGDBGamesMock.mockResolvedValue([makeGame()])

    await GET(makeRequest({ q: 'lunacy', mode: 'daily' }))

    expect(searchIGDBGamesMock).toHaveBeenCalledWith(
      'lunacy',
      expect.objectContaining({
        allowUnratedFallback: true,
        onDebugEvent: expect.any(Function),
      })
    )
  })

  it('keeps rated-only search for versus mode', async () => {
    searchIGDBGamesMock.mockResolvedValue([makeGame()])

    await GET(makeRequest({ q: 'lunacy', mode: 'versus' }))

    expect(searchIGDBGamesMock).toHaveBeenCalledWith(
      'lunacy',
      expect.objectContaining({
        allowUnratedFallback: false,
        onDebugEvent: expect.any(Function),
      })
    )
  })

  it('allows unrated fallback for versus mode when steals are disabled', async () => {
    searchIGDBGamesMock.mockResolvedValue([makeGame()])

    await GET(makeRequest({ q: 'lunacy', mode: 'versus', versusStealsEnabled: 'false' }))

    expect(searchIGDBGamesMock).toHaveBeenCalledWith(
      'lunacy',
      expect.objectContaining({
        allowUnratedFallback: true,
        onDebugEvent: expect.any(Function),
      })
    )
  })

  it('scrubs platform data when categoryTypes includes platform', async () => {
    searchIGDBGamesMock.mockResolvedValue([makeGame()])
    const res = await GET(makeRequest({ q: 'half-life', categoryTypes: 'platform' }))
    const body = await res.json()
    expect(body.results[0].platforms).toEqual([])
    expect(body.results[0].originalPlatformName).toBeNull()
  })

  it('scrubs genre data when categoryTypes includes genre', async () => {
    searchIGDBGamesMock.mockResolvedValue([makeGame()])
    const res = await GET(makeRequest({ q: 'half-life', categoryTypes: 'genre' }))
    const body = await res.json()
    expect(body.results[0].genres).toEqual([])
  })

  it('scrubs release date when categoryTypes includes decade', async () => {
    searchIGDBGamesMock.mockResolvedValue([makeGame()])
    const res = await GET(makeRequest({ q: 'half-life', categoryTypes: 'decade' }))
    const body = await res.json()
    expect(body.results[0].released).toBeNull()
  })

  it('adds disambiguation fields for duplicate-named games', async () => {
    searchIGDBGamesMock.mockResolvedValue([
      makeGame({ id: 1, name: 'Portal', originalPlatformName: 'PC', released: '2007-10-10' }),
      makeGame({ id: 2, name: 'Portal', originalPlatformName: 'PS3', released: '2011-06-14' }),
    ])
    const res = await GET(makeRequest({ q: 'portal' }))
    const body = await res.json()
    expect(body.results[0].disambiguationPlatform).toBe('PC')
    expect(body.results[0].disambiguationYear).toBe('2007')
    expect(body.results[1].disambiguationPlatform).toBe('PS3')
    expect(body.results[1].disambiguationYear).toBe('2011')
  })

  it('returns empty results and logs on searchIGDBGames error', async () => {
    searchIGDBGamesMock.mockRejectedValue(new Error('IGDB down'))
    const res = await GET(makeRequest({ q: 'half-life' }))
    const body = await res.json()
    expect(body).toEqual({ results: [] })
    expect(logger.error).toHaveBeenCalledWith('Search error', expect.any(Object))
  })
})
