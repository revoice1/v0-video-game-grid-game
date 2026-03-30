'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  // Set synchronously on mount (before any async fetch) if localStorage has an
  // in-progress room. The ?join= effect reads this to avoid a double-join race.
  const isResumingRef = useRef(loadRoomEntry() !== null)

  useEffect(() => {
    roomRef.current = room
  }, [room])
  useEffect(() => {
    myRoleRef.current = myRole
  }, [myRole])

  // ── Realtime subscription ─────────────────────────────────────────────────

  const subscribeToRoom = useCallback((targetRoom: VersusRoom) => {
    const supabase = createClient()

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

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
          setRoom(updated)
          if (updated.status === 'active') {
            if (updated.puzzle_id === null && updated.state_data === null) {
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
            const incoming = payload.new as OnlineVersusEvent
            // Deduplicate: Realtime can deliver an event that was already
            // fetched during the initial history load
            if (prev.some((e) => e.id === incoming.id)) return prev
            return [...prev, incoming]
          })
        }
      )
      .subscribe()

    channelRef.current = channel
  }, [])

  // ── Fetch existing event history ──────────────────────────────────────────
  // Merges by ID so live Realtime inserts that arrive before the HTTP response
  // are not overwritten by the (slightly older) history snapshot.

  const fetchEventHistory = useCallback(async (roomId: string) => {
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
          if (!known.has(e.id)) known.set(e.id, e)
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
      if (!currentRoom || !role) return { ok: false, error: 'Not in a match.' }

      try {
        const res = await fetch('/api/versus/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: currentRoom.id, player: role, type, payload }),
        })
        const json = await res.json()
        if (!res.ok || json.error)
          return { ok: false, error: json.error ?? 'Failed to send event.' }
        return { ok: true, error: null }
      } catch {
        return { ok: false, error: 'Network error.' }
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
          body: JSON.stringify({ puzzleId, puzzle }),
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

    try {
      const res = await fetch(`/api/versus/room/${currentRoom.code}/finish`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || json.error) return { ok: false, error: json.error ?? 'Failed to end match.' }
      setPhase('finished')
      clearRoomEntry()
      return { ok: true, error: null }
    } catch {
      return { ok: false, error: 'Network error.' }
    }
  }, [])

  const saveSnapshot = useCallback(
    async (snapshot: OnlineVersusSnapshot): Promise<SendEventResult> => {
      const currentRoom = roomRef.current
      if (!currentRoom) return { ok: false, error: 'Not in a match.' }

      try {
        const res = await fetch(`/api/versus/room/${currentRoom.code}/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshot }),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          return { ok: false, error: json.error ?? 'Failed to save match state.' }
        }
        return { ok: true, error: null }
      } catch {
        return { ok: false, error: 'Network error.' }
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
