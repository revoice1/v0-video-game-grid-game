import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useDailyArchive } from '@/hooks/use-daily-archive'

vi.mock('@/components/game/game-client-submission', () => ({
  buildLegacySessionHeaders: vi.fn((sessionId: string) => ({
    'x-session-id': sessionId,
  })),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

describe('useDailyArchive', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('starts with empty entries, not loading, no error', () => {
    const { result } = renderHook(() => useDailyArchive('sess-1'))

    expect(result.current.entries).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('sets isLoading true while fetch is in-flight', async () => {
    let resolveJson!: (value: unknown) => void
    const jsonPromise = new Promise((res) => {
      resolveJson = res
    })
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: true,
        json: () => jsonPromise,
      })
    )

    const { result } = renderHook(() => useDailyArchive('sess-1'))

    act(() => {
      void result.current.fetchDailyArchive()
    })

    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      resolveJson({ entries: [] })
      await jsonPromise
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('maps API response to DailyArchiveEntry shape', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({
        entries: [
          { id: 'p1', date: '2026-04-01', is_completed: true, guess_count: 7 },
          { id: 'p2', date: '2026-04-02', is_completed: false, guess_count: 0 },
        ],
      })
    )

    const { result } = renderHook(() => useDailyArchive('sess-1'))

    await act(async () => {
      await result.current.fetchDailyArchive()
    })

    expect(result.current.entries).toEqual([
      { id: 'p1', date: '2026-04-01', isCompleted: true, guessCount: 7 },
      { id: 'p2', date: '2026-04-02', isCompleted: false, guessCount: 0 },
    ])
    expect(result.current.error).toBeNull()
  })

  it('fills defaults when optional fields are absent', async () => {
    mockFetch.mockResolvedValue(
      makeResponse({
        entries: [{ id: 'p3', date: '2026-03-15' }],
      })
    )

    const { result } = renderHook(() => useDailyArchive('sess-1'))

    await act(async () => {
      await result.current.fetchDailyArchive()
    })

    expect(result.current.entries).toEqual([
      { id: 'p3', date: '2026-03-15', isCompleted: false, guessCount: 0 },
    ])
  })

  it('treats missing entries array as empty list', async () => {
    mockFetch.mockResolvedValue(makeResponse({}))

    const { result } = renderHook(() => useDailyArchive('sess-1'))

    await act(async () => {
      await result.current.fetchDailyArchive()
    })

    expect(result.current.entries).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('sets error on non-OK response with error field', async () => {
    mockFetch.mockResolvedValue(makeResponse({ error: 'Not authorized' }, false, 401))

    const { result } = renderHook(() => useDailyArchive('sess-1'))

    await act(async () => {
      await result.current.fetchDailyArchive()
    })

    expect(result.current.error).toBe('Not authorized')
    expect(result.current.entries).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('sets fallback error message when error field absent on non-OK response', async () => {
    mockFetch.mockResolvedValue(makeResponse({}, false, 500))

    const { result } = renderHook(() => useDailyArchive('sess-1'))

    await act(async () => {
      await result.current.fetchDailyArchive()
    })

    expect(result.current.error).toBe('Failed to load daily archive')
  })

  it('sets error on fetch network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useDailyArchive('sess-1'))

    await act(async () => {
      await result.current.fetchDailyArchive()
    })

    expect(result.current.error).toBe('Network error')
    expect(result.current.isLoading).toBe(false)
  })

  it('clears previous error on successful refetch', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ error: 'Server error' }, false, 500))
    mockFetch.mockResolvedValueOnce(makeResponse({ entries: [{ id: 'p4', date: '2026-04-10' }] }))

    const { result } = renderHook(() => useDailyArchive('sess-1'))

    await act(async () => {
      await result.current.fetchDailyArchive()
    })
    expect(result.current.error).not.toBeNull()

    await act(async () => {
      await result.current.fetchDailyArchive()
    })
    expect(result.current.error).toBeNull()
    expect(result.current.entries).toHaveLength(1)
  })

  it('passes sessionId via buildLegacySessionHeaders', async () => {
    mockFetch.mockResolvedValue(makeResponse({ entries: [] }))

    const { result } = renderHook(() => useDailyArchive('my-session-id'))

    await act(async () => {
      await result.current.fetchDailyArchive()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/daily-history', {
      headers: { 'x-session-id': 'my-session-id' },
    })
  })

  it('fetchDailyArchive is stable across re-renders with same sessionId', () => {
    const { result, rerender } = renderHook(() => useDailyArchive('sess-1'))
    const first = result.current.fetchDailyArchive

    rerender()
    expect(result.current.fetchDailyArchive).toBe(first)
  })

  it('fetchDailyArchive changes when sessionId changes', () => {
    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string }) => useDailyArchive(sessionId),
      { initialProps: { sessionId: 'sess-a' } }
    )
    const first = result.current.fetchDailyArchive

    rerender({ sessionId: 'sess-b' })
    expect(result.current.fetchDailyArchive).not.toBe(first)
  })
})
