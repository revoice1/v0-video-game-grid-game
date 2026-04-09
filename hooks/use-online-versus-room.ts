'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { classifyFetchedOnlineVersusEventSource } from '@/lib/online-versus-event-source'
import type {
  OnlineVersusEvent,
  OnlineVersusEventType,
  OnlineVersusSnapshot,
  RoomPlayer,
  RoomSettings,
  VersusRoom,
} from '@/lib/versus-room'
import type { Puzzle } from '@/lib/types'

export type OnlineVersusPhase =
  | 'idle'
  | 'creating'
  | 'joining'
  | 'lobby'
  | 'active'
  | 'finished'
  | 'error'

export interface SendEventResult {
  ok: boolean
  error: string | null
  code?: string | null
}

export interface UseOnlineVersusRoomReturn {
  phase: OnlineVersusPhase
  room: VersusRoom | null
  myRole: RoomPlayer | null
  opponentReady: boolean
  events: OnlineVersusEvent[]
  errorMessage: string | null
  /** True synchronously on mount when localStorage holds an in-progress room entry. */
  isResuming: boolean
  /** True while historical room events are being fetched and merged for resume/join. */
  isHydratingHistory: boolean
  createRoom: (settings: RoomSettings) => Promise<void>
  joinRoom: (code: string) => Promise<void>
  sendEvent: (
    type: OnlineVersusEventType,
    payload?: Record<string, unknown>
  ) => Promise<SendEventResult>
  markFinished: () => Promise<SendEventResult>
  setPuzzle: (puzzleId: string, puzzle: Puzzle) => Promise<SendEventResult>
  saveSnapshot: (snapshot: OnlineVersusSnapshot) => Promise<SendEventResult>
  continueRoom: () => Promise<SendEventResult>
  reset: () => void
}

// ── Persistence keys ──────────────────────────────────────────────────────────
// Stores enough to re-enter an active room after a page reload.
const STORAGE_KEY = 'gg_online_versus_room'

interface PersistedRoomEntry {
  code: string
  role: RoomPlayer
}

function saveRoomEntry(code: string, role: RoomPlayer) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, role }))
  } catch {
    /* quota or SSR — ignore */
  }
}

function loadRoomEntry(): PersistedRoomEntry | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedRoomEntry
  } catch {
    return null
  }
}

function clearRoomEntry() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useOnlineVersusRoom(): UseOnlineVersusRoomReturn {
  const [phase, setPhase] = useState<OnlineVersusPhase>('idle')
  const [room, setRoom] = useState<VersusRoom | null>(null)
  const [myRole, setMyRole] = useState<RoomPlayer | null>(null)
  const [opponentReady, setOpponentReady] = useState(false)
  const [events, setEvents] = useState<OnlineVersusEvent[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isHydratingHistory, setIsHydratingHistory] = useState(false)

  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const roomRef = useRef<VersusRoom | null>(null)
  const myRoleRef = useRef<RoomPlayer | null>(null)
  const eventsRef = useRef<OnlineVersusEvent[]>([])
  // Set synchronously on mount (before any async fetch) if localStorage has an
  // in-progress room. The ?join= effect reads this to avoid a double-join race.
  const isResumingRef = useRef(loadRoomEntry() !== null)
  // Tracks whether we've ever successfully subscribed on the current channel.
  // Used to distinguish first-connect from reconnect in the subscribe callback.
  const hasConnectedOnceRef = useRef(false)
  // Stable refs to catch-up helpers so subscribeToRoom can call them without a
  // forward-declaration ordering problem (both are useCallback, the helpers are
  // declared after subscribeToRoom in the file).
  const fetchEventHistoryRef = useRef<(roomId: string) => Promise<void>>(async () => {})
  const fetchRoomStateRef = useRef<(code: string) => Promise<VersusRoom | null>>(async () => null)
  const catchUpRoomRef = useRef<(roomId: string, code: string) => Promise<void>>(async () => {})

  useEffect(() => {
    roomRef.current = room
  }, [room])
  useEffect(() => {
    myRoleRef.current = myRole
  }, [myRole])
  useEffect(() => {
    eventsRef.current = events
  }, [events])

  // ── Realtime subscription ─────────────────────────────────────────────────

  const subscribeToRoom = useCallback((targetRoom: VersusRoom) => {
    const supabase = createClient()

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    hasConnectedOnceRef.current = false

    const channel = supabase
      .channel(`versus_room:${targetRoom.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'versus_rooms',
          filter: `id=eq.${targetRoom.id}`,
        },
        (payload) => {
          const updated = payload.new as VersusRoom
          const previousMatchNumber = roomRef.current?.match_number ?? null
          const didAdvanceMatch =
            previousMatchNumber !== null && previousMatchNumber !== updated.match_number
          setRoom(updated)
          if (updated.status === 'active') {
            if (didAdvanceMatch || (updated.puzzle_id === null && updated.state_data === null)) {
              setEvents([])
            }
            setOpponentReady(true)
            setPhase('active')
            if (myRoleRef.current) {
              saveRoomEntry(updated.code, myRoleRef.current)
            }
          } else if (updated.status === 'finished') {
            setPhase('finished')
            clearRoomEntry()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'versus_events',
          filter: `room_id=eq.${targetRoom.id}`,
        },
        (payload) => {
          setEvents((prev) => {
            const incoming = {
              ...(payload.new as OnlineVersusEvent),
              source: 'live' as const,
            }
            const existingIndex = prev.findIndex((event) => event.id === incoming.id)
            if (existingIndex === -1) {
              return [...prev, incoming]
            }

            const existing = prev[existingIndex]
            if (existing.source === 'live') {
              return prev
            }

            const next = [...prev]
            next[existingIndex] = {
              ...existing,
              source: 'live',
            }
            return next
          })
        }
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        if (!hasConnectedOnceRef.current) {
          // First successful connection — normal path, no catch-up needed.
          hasConnectedOnceRef.current = true
          return
        }
        // Reconnected after a drop (phone sleep, network blip, etc.).
        // Refresh the room row first. If the host has a fresh snapshot, prefer
        // that authoritative state over replaying old events on top of it.
        void catchUpRoomRef.current(targetRoom.id, targetRoom.code)
      })

    channelRef.current = channel
  }, [])

  // ── Fetch existing event history ──────────────────────────────────────────
  // Merges by ID so live Realtime inserts that arrive before the HTTP response
  // are not overwritten by the (slightly older) history snapshot.

  const fetchEventHistory = useCallback(async (roomId: string) => {
    const replayStartedAtMs = Date.now()
    const highestKnownEventIdAtReplayStart = eventsRef.current.reduce(
      (highestId, event) => Math.max(highestId, event.id),
      0
    )
    setIsHydratingHistory(true)
    try {
      const res = await fetch(`/api/versus/room-events/${roomId}`)
      if (!res.ok) return
      const json = await res.json()
      if (!Array.isArray(json.events)) return
      const fetched = json.events as OnlineVersusEvent[]
      setEvents((prev) => {
        // Build a map of already-known events, then add any fetched ones missing from it
        const known = new Map(prev.map((e) => [e.id, e]))
        for (const e of fetched) {
          if (!known.has(e.id)) {
            known.set(e.id, {
              ...e,
              source: classifyFetchedOnlineVersusEventSource({
                createdAt: e.created_at,
                replayStartedAtMs,
                eventId: e.id,
                highestKnownEventIdAtReplayStart,
              }),
            })
          }
        }
        // Return sorted by id so order is deterministic regardless of arrival order
        return Array.from(known.values()).sort((a, b) => a.id - b.id)
      })
    } catch {
      /* non-fatal — Realtime will catch up */
    } finally {
      // Let consumers see one committed render where the fetched history is
      // present *and* hydration is still true. If we flip this back to false
      // in the same batch as setEvents(...), replay consumers can treat old
      // history as live events and re-fire spectacle like showdown overlays.
      window.setTimeout(() => {
        setIsHydratingHistory(false)
      }, 0)
    }
  }, [])

  // Keep the ref in sync so subscribeToRoom's subscribe callback can call it
  // without a forward-declaration ordering problem.
  fetchEventHistoryRef.current = fetchEventHistory

  // ── Fetch latest room state ───────────────────────────────────────────────
  // Refreshes the room row (including state_data / turnDeadlineAt) from the
  // server. Called alongside fetchEventHistory on reconnect / visibility-change
  // so snapshot-only fields stay in sync even if no new events arrived.

  const fetchRoomState = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/versus/room/${code}`)
      if (!res.ok) return null
      const json = await res.json()
      if (json.room) {
        const nextRoom = json.room as VersusRoom
        setRoom(nextRoom)
        return nextRoom
      }
    } catch {
      /* non-fatal */
    }

    return null
  }, [])

  fetchRoomStateRef.current = fetchRoomState

  const catchUpRoom = useCallback(async (roomId: string, code: string) => {
    await fetchRoomStateRef.current(code)
    await fetchEventHistoryRef.current(roomId)
  }, [])

  catchUpRoomRef.current = catchUpRoom

  // ── Reload resume ─────────────────────────────────────────────────────────
  // On mount, check localStorage for an in-progress room and rejoin it.

  useEffect(() => {
    const entry = loadRoomEntry()
    if (!entry) return

    setPhase('joining')
    fetch(`/api/versus/room/${entry.code}/join`, { method: 'POST' })
      .then((res) => res.json())
      .then((json) => {
        isResumingRef.current = false
        if (json.error || !json.room) {
          clearRoomEntry()
          setPhase('idle')
          return
        }
        const rejoined = json.room as VersusRoom
        const role = json.role as RoomPlayer
        setRoom(rejoined)
        setMyRole(role)
        setOpponentReady(rejoined.status === 'active')
        setPhase(rejoined.status === 'active' ? 'active' : 'lobby')
        subscribeToRoom(rejoined)
        if (!rejoined.state_data) {
          fetchEventHistory(rejoined.id)
        }
      })
      .catch(() => {
        isResumingRef.current = false
        clearRoomEntry()
        setPhase('idle')
      })
  }, [])

  // ── Visibility-based catch-up ─────────────────────────────────────────────
  // When the tab/app becomes visible again (phone waking from sleep, user
  // switching back to the tab), fetch event history to fill any gap that
  // occurred while the Realtime socket was suspended.

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      const room = roomRef.current
      if (!room || room.status !== 'active') return
      void catchUpRoomRef.current(room.id, room.code)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      const supabase = createClient()
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  // ── Actions ───────────────────────────────────────────────────────────────

  const createRoom = useCallback(
    async (settings: RoomSettings) => {
      setPhase('creating')
      setErrorMessage(null)

      try {
        const res = await fetch('/api/versus/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings }),
        })
        const json = await res.json()

        if (!res.ok || json.error) {
          setErrorMessage(json.error ?? 'Failed to create match.')
          setPhase('error')
          return
        }

        const newRoom = json.room as VersusRoom
        const role: RoomPlayer = 'x'
        setRoom(newRoom)
        setMyRole(role)
        setPhase('lobby')
        saveRoomEntry(newRoom.code, role)
        subscribeToRoom(newRoom)
      } catch {
        setErrorMessage('Network error. Please try again.')
        setPhase('error')
      }
    },
    [subscribeToRoom]
  )

  const joinRoom = useCallback(
    async (code: string) => {
      setPhase('joining')
      setErrorMessage(null)

      try {
        const res = await fetch(`/api/versus/room/${code.toUpperCase()}/join`, {
          method: 'POST',
        })
        const json = await res.json()

        if (!res.ok || json.error) {
          setErrorMessage(json.error ?? 'Failed to join match.')
          setPhase('error')
          return
        }

        const joinedRoom = json.room as VersusRoom
        const role = json.role as RoomPlayer
        setRoom(joinedRoom)
        setMyRole(role)
        setOpponentReady(role === 'o')
        setPhase(joinedRoom.status === 'active' ? 'active' : 'lobby')
        saveRoomEntry(joinedRoom.code, role)
        subscribeToRoom(joinedRoom)
        // Legacy fallback: rooms without a canonical snapshot still reconstruct
        // from event history. Snapshot-backed rooms hydrate directly from state_data.
        if (!joinedRoom.state_data) {
          fetchEventHistory(joinedRoom.id)
        }
      } catch {
        setErrorMessage('Network error. Please try again.')
        setPhase('error')
      }
    },
    [subscribeToRoom, fetchEventHistory]
  )

  const sendEvent = useCallback(
    async (
      type: OnlineVersusEventType,
      payload: Record<string, unknown> = {}
    ): Promise<SendEventResult> => {
      const currentRoom = roomRef.current
      const role = myRoleRef.current
      if (!currentRoom || !role) return { ok: false, error: 'Not in a match.', code: null }

      try {
        const res = await fetch('/api/versus/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: currentRoom.id,
            matchNumber: currentRoom.match_number,
            player: role,
            type,
            payload,
          }),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          await catchUpRoomRef.current(currentRoom.id, currentRoom.code)
          return {
            ok: false,
            error: json.error ?? 'Failed to send event.',
            code: typeof json.code === 'string' ? json.code : null,
          }
        }
        return { ok: true, error: null, code: null }
      } catch {
        return { ok: false, error: 'Network error.', code: null }
      }
    },
    []
  )

  const setPuzzle = useCallback(
    async (puzzleId: string, puzzle: Puzzle): Promise<SendEventResult> => {
      const currentRoom = roomRef.current
      if (!currentRoom) return { ok: false, error: 'Not in a match.' }

      try {
        const res = await fetch(`/api/versus/room/${currentRoom.code}/puzzle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ puzzleId, puzzle, matchNumber: currentRoom.match_number }),
        })
        const json = await res.json()
        // 409 with "already set" is not an error from the client's perspective —
        // it means another instance already published the puzzle successfully
        if (res.status === 409 && json.error?.includes('already set'))
          return { ok: true, error: null }
        if (!res.ok || json.error)
          return { ok: false, error: json.error ?? 'Failed to set puzzle.' }
        return { ok: true, error: null }
      } catch {
        return { ok: false, error: 'Network error.' }
      }
    },
    []
  )

  const markFinished = useCallback(async (): Promise<SendEventResult> => {
    const currentRoom = roomRef.current
    if (!currentRoom) return { ok: false, error: 'Not in a match.' }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)

    try {
      const res = await fetch(`/api/versus/room/${currentRoom.code}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchNumber: currentRoom.match_number }),
        signal: controller.signal,
      })
      const json = await res.json()
      if (!res.ok || json.error) return { ok: false, error: json.error ?? 'Failed to end match.' }
      setPhase('finished')
      clearRoomEntry()
      return { ok: true, error: null }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { ok: false, error: 'Request timed out.' }
      }
      return { ok: false, error: 'Network error.' }
    } finally {
      window.clearTimeout(timeout)
    }
  }, [])

  const saveSnapshot = useCallback(
    async (snapshot: OnlineVersusSnapshot): Promise<SendEventResult> => {
      const currentRoom = roomRef.current
      if (!currentRoom) return { ok: false, error: 'Not in a match.' }

      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 8000)

      try {
        const res = await fetch(`/api/versus/room/${currentRoom.code}/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshot, matchNumber: currentRoom.match_number }),
          signal: controller.signal,
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          return { ok: false, error: json.error ?? 'Failed to save match state.' }
        }
        return { ok: true, error: null }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return { ok: false, error: 'Request timed out.' }
        }
        return { ok: false, error: 'Network error.' }
      } finally {
        window.clearTimeout(timeout)
      }
    },
    []
  )

  const continueRoom = useCallback(async (): Promise<SendEventResult> => {
    const currentRoom = roomRef.current
    if (!currentRoom) return { ok: false, error: 'Not in a match.' }

    try {
      const res = await fetch(`/api/versus/room/${currentRoom.code}/continue`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || json.error) {
        return { ok: false, error: json.error ?? 'Failed to continue match.' }
      }
      const continuedRoom = json.room as VersusRoom | undefined
      if (continuedRoom) {
        setRoom(continuedRoom)
        setPhase('active')
        setOpponentReady(true)
        if (myRoleRef.current) {
          saveRoomEntry(continuedRoom.code, myRoleRef.current)
        }
      }
      setEvents([])
      return { ok: true, error: null }
    } catch {
      return { ok: false, error: 'Network error.' }
    }
  }, [])

  const reset = useCallback(() => {
    const supabase = createClient()
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    clearRoomEntry()
    setPhase('idle')
    setRoom(null)
    setMyRole(null)
    setOpponentReady(false)
    setEvents([])
    setErrorMessage(null)
    setIsHydratingHistory(false)
  }, [])

  return {
    phase,
    room,
    myRole,
    opponentReady,
    events,
    errorMessage,
    isResuming: isResumingRef.current,
    isHydratingHistory,
    createRoom,
    joinRoom,
    sendEvent,
    markFinished,
    setPuzzle,
    saveSnapshot,
    continueRoom,
    reset,
  }
}
