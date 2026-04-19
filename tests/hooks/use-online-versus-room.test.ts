import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOnlineVersusRoom } from '@/hooks/use-online-versus-room'
import type { RoomSettings } from '@/lib/versus-room'

let capturedSubscribeCallback: ((status: string) => void) | null = null

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockImplementation((cb?: (status: string) => void) => {
    if (cb) capturedSubscribeCallback = cb
    return mockChannel
  }),
}

const mockRemoveChannel = vi.fn()
const mockSupabase = {
  channel: vi.fn(() => mockChannel),
  removeChannel: mockRemoveChannel,
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}))

function makeRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'room-1',
    code: 'ABCD',
    created_at: '2026-04-02T00:00:00.000Z',
    expires_at: '2026-04-03T00:00:00.000Z',
    match_number: 1,
    status: 'waiting',
    settings: {},
    puzzle_id: null,
    puzzle_data: null,
    state_data: null,
    ...overrides,
  }
}

function makeActiveRoom(overrides: Record<string, unknown> = {}) {
  return makeRoom({ status: 'active', ...overrides })
}

function makeSnapshot() {
  return {
    puzzleId: 'p1',
    guesses: Array(9).fill(null),
    guessesRemaining: 6,
    currentPlayer: 'x' as const,
    winner: null,
    stealableCell: null,
    pendingFinalSteal: null,
    objectionsUsed: { x: 0, o: 0 },
    turnDeadlineAt: null,
    turnDurationSeconds: null,
  }
}

function makeSettings(): RoomSettings {
  return {
    categoryFilters: {},
    stealRule: 'off',
    timerOption: 'none',
    disableDraws: false,
    objectionRule: 'off',
  }
}

function makeJsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('useOnlineVersusRoom', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
    capturedSubscribeCallback = null
    mockChannel.on.mockReturnThis()
    mockChannel.subscribe.mockImplementation((cb?: (status: string) => void) => {
      if (cb) capturedSubscribeCallback = cb
      return mockChannel
    })
    mockSupabase.channel.mockReturnValue(mockChannel)
  })

  it('starts in idle phase with no room or role', () => {
    const { result } = renderHook(() => useOnlineVersusRoom())

    expect(result.current.phase).toBe('idle')
    expect(result.current.room).toBeNull()
    expect(result.current.myRole).toBeNull()
    expect(result.current.events).toEqual([])
    expect(result.current.errorMessage).toBeNull()
    expect(result.current.isHydratingHistory).toBe(false)
  })

  it('returns isResuming=false when localStorage has no room entry', () => {
    const { result } = renderHook(() => useOnlineVersusRoom())
    expect(result.current.isResuming).toBe(false)
  })

  describe('createRoom', () => {
    it('transitions to lobby phase and saves room entry on success', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(makeJsonResponse({ room: makeRoom() }))

      const { result } = renderHook(() => useOnlineVersusRoom())

      await act(async () => {
        await result.current.createRoom(makeSettings())
      })

      expect(result.current.phase).toBe('lobby')
      expect(result.current.myRole).toBe('x')
      expect(localStorage.getItem('gg_online_versus_room')).not.toBeNull()
    })

    it('transitions to error phase on API failure', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'Room limit reached' }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const { result } = renderHook(() => useOnlineVersusRoom())

      await act(async () => {
        await result.current.createRoom(makeSettings())
      })

      expect(result.current.phase).toBe('error')
      expect(result.current.errorMessage).toBe('Room limit reached')
    })

    it('transitions to error phase on network failure', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network failure'))

      const { result } = renderHook(() => useOnlineVersusRoom())

      await act(async () => {
        await result.current.createRoom(makeSettings())
      })

      expect(result.current.phase).toBe('error')
      expect(result.current.errorMessage).toBe('Network error. Please try again.')
    })
  })

  describe('joinRoom', () => {
    it('transitions to lobby for a waiting room', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        makeJsonResponse({ room: makeRoom({ status: 'waiting' }), role: 'o' })
      )

      const { result } = renderHook(() => useOnlineVersusRoom())

      await act(async () => {
        await result.current.joinRoom('ABCD')
      })

      expect(result.current.phase).toBe('lobby')
      expect(result.current.myRole).toBe('o')
    })

    it('transitions to active for an already-active room', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        makeJsonResponse({ room: makeActiveRoom(), role: 'o' })
      )

      const { result } = renderHook(() => useOnlineVersusRoom())

      await act(async () => {
        await result.current.joinRoom('ABCD')
      })

      expect(result.current.phase).toBe('active')
    })

    it('transitions to error on API failure', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'Room not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const { result } = renderHook(() => useOnlineVersusRoom())

      await act(async () => {
        await result.current.joinRoom('ZZZZ')
      })

      expect(result.current.phase).toBe('error')
      expect(result.current.errorMessage).toBe('Room not found')
    })
  })

  describe('sendEvent', () => {
    it('returns { ok: false } when not in a match', async () => {
      const { result } = renderHook(() => useOnlineVersusRoom())
      const res = await result.current.sendEvent('claim', { cellIndex: 0 })
      expect(res.ok).toBe(false)
      expect(res.error).toBe('Not in a match.')
    })

    it('returns { ok: true } after a successful join', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        makeJsonResponse({ room: makeActiveRoom(), role: 'x' })
      )

      const { result } = renderHook(() => useOnlineVersusRoom())

      await act(async () => {
        await result.current.joinRoom('ABCD')
      })

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(makeJsonResponse({}))

      const res = await result.current.sendEvent('claim', { cellIndex: 0 })
      expect(res.ok).toBe(true)
      expect(res.code).toBeNull()
      expect(fetchSpy).toHaveBeenLastCalledWith(
        '/api/versus/event',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            roomId: 'room-1',
            matchNumber: 1,
            player: 'x',
            type: 'claim',
            payload: { cellIndex: 0 },
          }),
        })
      )
    })

    it('returns the server rejection code and catches the room back up after a rejected event', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((input) => {
        const url = String(input)

        if (url === '/api/versus/room/ABCD') {
          return Promise.resolve(makeJsonResponse({ room: makeActiveRoom() }))
        }

        if (url === '/api/versus/event') {
          return Promise.resolve(
            new Response(JSON.stringify({ error: 'It is not your turn.', code: 'wrong_turn' }), {
              status: 409,
              headers: { 'Content-Type': 'application/json' },
            })
          )
        }

        if (url === '/api/versus/room/ABCD/join') {
          return Promise.resolve(makeJsonResponse({ room: makeActiveRoom(), role: 'x' }))
        }

        if (url === '/api/versus/room-events/room-1') {
          return Promise.resolve(makeJsonResponse({ events: [] }))
        }

        throw new Error(`Unexpected fetch: ${url}`)
      })

      const { result } = renderHook(() => useOnlineVersusRoom())

      await act(async () => {
        await result.current.joinRoom('ABCD')
      })

      let res!: Awaited<ReturnType<typeof result.current.sendEvent>>
      await act(async () => {
        res = await result.current.sendEvent('claim', { cellIndex: 0 })
      })

      expect(res).toEqual({
        ok: false,
        error: 'It is not your turn.',
        code: 'wrong_turn',
        payload: null,
        type: null,
      })

      const urls = fetchSpy.mock.calls.map((call) => String(call[0]))
      expect(urls).toContain('/api/versus/room/ABCD')
      expect(urls).toContain('/api/versus/room-events/room-1')
    })
  })

  describe('saveSnapshot', () => {
    it('returns { ok: false } when not in a match', async () => {
      const { result } = renderHook(() => useOnlineVersusRoom())
      const res = await result.current.saveSnapshot(makeSnapshot())
      expect(res.ok).toBe(false)
      expect(res.error).toBe('Not in a match.')
    })

    it('returns { ok: true } after a successful join and server 200', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        makeJsonResponse({ room: makeActiveRoom(), role: 'x' })
      )

      const { result } = renderHook(() => useOnlineVersusRoom())

      await act(async () => {
        await result.current.joinRoom('ABCD')
      })

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(makeJsonResponse({}))

      const res = await result.current.saveSnapshot(makeSnapshot())
      expect(res.ok).toBe(true)
      expect(res.error).toBeNull()
      expect(fetchSpy).toHaveBeenLastCalledWith(
        '/api/versus/room/ABCD/state',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            snapshot: makeSnapshot(),
            matchNumber: 1,
          }),
        })
      )
    })

    it('returns { ok: false, error: "Request timed out." } when the fetch is aborted', async () => {
      vi.useFakeTimers()

      try {
        let fetchCallCount = 0
        vi.spyOn(global, 'fetch').mockImplementation((_url, opts) => {
          fetchCallCount++
          if (fetchCallCount === 1) {
            return Promise.resolve(makeJsonResponse({ room: makeActiveRoom(), role: 'x' }))
          }
          return new Promise<Response>((_resolve, reject) => {
            const signal = (opts as RequestInit | undefined)?.signal
            if (signal) {
              signal.addEventListener('abort', () => {
                const err = new Error('The user aborted a request.')
                err.name = 'AbortError'
                reject(err)
              })
            }
          })
        })

        const { result } = renderHook(() => useOnlineVersusRoom())

        await act(async () => {
          await result.current.joinRoom('ABCD')
        })

        let saveResult: Awaited<ReturnType<typeof result.current.saveSnapshot>> | undefined
        const savePromise = result.current.saveSnapshot(makeSnapshot()).then((r) => {
          saveResult = r
        })

        await act(async () => {
          vi.advanceTimersByTime(8500)
        })

        await savePromise
        expect(saveResult?.ok).toBe(false)
        expect(saveResult?.error).toBe('Request timed out.')
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('markFinished', () => {
    it('returns { ok: false } when not in a match', async () => {
      const { result } = renderHook(() => useOnlineVersusRoom())
      const res = await result.current.markFinished()
      expect(res.ok).toBe(false)
      expect(res.error).toBe('Not in a match.')
    })

    it('returns { ok: false, error: "Request timed out." } when the fetch is aborted', async () => {
      vi.useFakeTimers()

      try {
        let fetchCallCount = 0
        vi.spyOn(global, 'fetch').mockImplementation((_url, opts) => {
          fetchCallCount++
          if (fetchCallCount === 1) {
            return Promise.resolve(makeJsonResponse({ room: makeActiveRoom(), role: 'x' }))
          }
          return new Promise<Response>((_resolve, reject) => {
            const signal = (opts as RequestInit | undefined)?.signal
            if (signal) {
              signal.addEventListener('abort', () => {
                const err = new Error('The user aborted a request.')
                err.name = 'AbortError'
                reject(err)
              })
            }
          })
        })

        const { result } = renderHook(() => useOnlineVersusRoom())

        await act(async () => {
          await result.current.joinRoom('ABCD')
        })

        let finishResult: Awaited<ReturnType<typeof result.current.markFinished>> | undefined
        const finishPromise = result.current.markFinished().then((r) => {
          finishResult = r
        })

        await act(async () => {
          vi.advanceTimersByTime(8500)
        })

        await finishPromise
        expect(finishResult?.ok).toBe(false)
        expect(finishResult?.error).toBe('Request timed out.')
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('continueRoom', () => {
    it('updates the local role when the continued room returns a swapped side', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((input) => {
        const url = String(input)

        if (url === '/api/versus/room/ABCD/join') {
          return Promise.resolve(makeJsonResponse({ room: makeActiveRoom(), role: 'o' }))
        }

        if (url === '/api/versus/room/ABCD/continue') {
          return Promise.resolve(
            makeJsonResponse({
              room: makeActiveRoom({ match_number: 2 }),
              role: 'x',
            })
          )
        }

        throw new Error(`Unexpected fetch: ${url}`)
      })

      const { result } = renderHook(() => useOnlineVersusRoom())

      await act(async () => {
        await result.current.joinRoom('ABCD')
      })

      expect(result.current.myRole).toBe('o')

      await act(async () => {
        await result.current.continueRoom()
      })

      expect(fetchSpy).toHaveBeenLastCalledWith('/api/versus/room/ABCD/continue', {
        method: 'POST',
      })
      expect(result.current.phase).toBe('active')
      expect(result.current.myRole).toBe('x')
      expect(result.current.room?.match_number).toBe(2)
      expect(localStorage.getItem('gg_online_versus_room')).toContain('"role":"x"')
    })
  })

  describe('catch-up recovery', () => {
    async function joinActiveRoomWithRouter(
      snapshotOverride?:
        | ReturnType<typeof makeSnapshot>
        | {
            puzzleId: string
            guesses: null[]
            guessesRemaining: number
            currentPlayer: 'x' | 'o'
            winner: null
            stealableCell: number | null
            pendingFinalSteal: { defender: 'x' | 'o'; cellIndex: number } | null
            objectionsUsed: { x: number; o: number }
            turnDeadlineAt: string | null
            turnDurationSeconds: number | null
          }
    ) {
      let latestRoom = makeActiveRoom()
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation((input) => {
        const url = String(input)

        if (url === '/api/versus/room/ABCD/join') {
          return Promise.resolve(makeJsonResponse({ room: latestRoom, role: 'x' }))
        }

        if (url === '/api/versus/room-events/room-1') {
          return Promise.resolve(makeJsonResponse({ events: [] }))
        }

        if (url === '/api/versus/room/ABCD') {
          latestRoom = makeActiveRoom({
            state_data: snapshotOverride ?? latestRoom.state_data,
          })
          return Promise.resolve(makeJsonResponse({ room: latestRoom }))
        }

        throw new Error(`Unexpected fetch: ${url}`)
      })

      const { result } = renderHook(() => useOnlineVersusRoom())
      await act(async () => {
        await result.current.joinRoom('ABCD')
      })

      return { result, fetchSpy }
    }

    it('first SUBSCRIBED does not trigger a catch-up fetch', async () => {
      const { fetchSpy } = await joinActiveRoomWithRouter()
      const joinCallCount = fetchSpy.mock.calls.length

      act(() => {
        capturedSubscribeCallback?.('SUBSCRIBED')
      })

      expect(fetchSpy.mock.calls.length).toBe(joinCallCount)
    })

    it('second SUBSCRIBED triggers event-history and room-state fetches', async () => {
      const { fetchSpy } = await joinActiveRoomWithRouter()

      act(() => {
        capturedSubscribeCallback?.('SUBSCRIBED')
      })

      const beforeReconnect = fetchSpy.mock.calls.length

      act(() => {
        capturedSubscribeCallback?.('SUBSCRIBED')
      })

      await waitFor(() => {
        const urls = fetchSpy.mock.calls.slice(beforeReconnect).map((call) => String(call[0]))
        expect(urls).toContain('/api/versus/room-events/room-1')
        expect(urls).toContain('/api/versus/room/ABCD')
      })
    })

    it('non-SUBSCRIBED status does not trigger a catch-up fetch', async () => {
      const { fetchSpy } = await joinActiveRoomWithRouter()

      act(() => {
        capturedSubscribeCallback?.('SUBSCRIBED')
      })

      const afterFirst = fetchSpy.mock.calls.length

      act(() => {
        capturedSubscribeCallback?.('CHANNEL_ERROR')
      })
      act(() => {
        capturedSubscribeCallback?.('TIMED_OUT')
      })

      expect(fetchSpy.mock.calls.length).toBe(afterFirst)
    })

    it('fetches event history and room state when tab becomes visible in an active room', async () => {
      const { fetchSpy } = await joinActiveRoomWithRouter()
      const beforeVisibility = fetchSpy.mock.calls.length

      act(() => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          value: 'visible',
        })
        document.dispatchEvent(new Event('visibilitychange'))
      })

      await waitFor(() => {
        const urls = fetchSpy.mock.calls.slice(beforeVisibility).map((call) => String(call[0]))
        expect(urls).toContain('/api/versus/room-events/room-1')
        expect(urls).toContain('/api/versus/room/ABCD')
      })
    })

    it('does not fetch when tab becomes visible but no active room exists', async () => {
      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response('{}', { status: 200 }))

      renderHook(() => useOnlineVersusRoom())
      const beforeVisibility = fetchSpy.mock.calls.length

      act(() => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          value: 'visible',
        })
        document.dispatchEvent(new Event('visibilitychange'))
      })

      expect(fetchSpy.mock.calls.length).toBe(beforeVisibility)
    })

    it('updates room.state_data from the server response during catch-up', async () => {
      const snapshot = {
        puzzleId: 'p1',
        guesses: Array(9).fill(null),
        guessesRemaining: 5,
        currentPlayer: 'o' as const,
        winner: null,
        stealableCell: null,
        pendingFinalSteal: null,
        objectionsUsed: { x: 0, o: 0 },
        turnDeadlineAt: '2026-04-02T20:00:30.000Z',
        turnDurationSeconds: 20,
      }

      const { result } = await joinActiveRoomWithRouter(snapshot)

      expect(result.current.room?.state_data).toBeNull()

      act(() => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          value: 'visible',
        })
        document.dispatchEvent(new Event('visibilitychange'))
      })

      await waitFor(() => {
        expect(result.current.room?.state_data).toEqual(snapshot)
      })
    })

    it('still fetches event history when the refreshed room already has state_data', async () => {
      const snapshot = {
        puzzleId: 'p1',
        guesses: Array(9).fill(null),
        guessesRemaining: 5,
        currentPlayer: 'o' as const,
        winner: null,
        stealableCell: 4,
        pendingFinalSteal: { defender: 'x' as const, cellIndex: 4 },
        objectionsUsed: { x: 0, o: 0 },
        turnDeadlineAt: '2026-04-02T20:00:30.000Z',
        turnDurationSeconds: 20,
      }

      const { fetchSpy } = await joinActiveRoomWithRouter(snapshot)
      const beforeVisibility = fetchSpy.mock.calls.length

      act(() => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          value: 'visible',
        })
        document.dispatchEvent(new Event('visibilitychange'))
      })

      await waitFor(() => {
        const urls = fetchSpy.mock.calls.slice(beforeVisibility).map((call) => String(call[0]))
        expect(urls).toContain('/api/versus/room/ABCD')
        expect(urls).toContain('/api/versus/room-events/room-1')
      })
    })
  })

  describe('reset', () => {
    it('returns all state to defaults and clears localStorage', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(makeJsonResponse({ room: makeRoom(), role: 'x' }))

      const { result } = renderHook(() => useOnlineVersusRoom())

      await act(async () => {
        await result.current.createRoom(makeSettings())
      })

      expect(result.current.phase).toBe('lobby')

      act(() => {
        result.current.reset()
      })

      expect(result.current.phase).toBe('idle')
      expect(result.current.room).toBeNull()
      expect(result.current.myRole).toBeNull()
      expect(result.current.events).toEqual([])
      expect(localStorage.getItem('gg_online_versus_room')).toBeNull()
    })
  })
})
