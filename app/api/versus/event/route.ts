import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAnonymousSession } from '@/lib/server-session'
import type { OnlineVersusEventType, RoomPlayer } from '@/lib/versus-room'

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const session = resolveAnonymousSession(request)

  try {
    const body = await request.json()
    const { roomId, player, type, payload } = body as {
      roomId: string
      player: RoomPlayer
      type: OnlineVersusEventType
      payload: Record<string, unknown>
    }

    if (!roomId || !player || !type) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    // Verify the session owns the player slot they're claiming
    const { data: room, error: roomError } = await supabase
      .from('versus_rooms')
      .select('host_session_id, guest_session_id, status')
      .eq('id', roomId)
      .single()

    if (roomError) {
      console.error('Online versus event room lookup failed', {
        roomId,
        player,
        type,
        sessionId: session.sessionId,
        error: roomError,
      })
      return NextResponse.json({ error: roomError.message }, { status: 500 })
    }

    if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
    if (room.status === 'finished')
      return NextResponse.json({ error: 'Match is over.' }, { status: 409 })

    const expectedSession = player === 'x' ? room.host_session_id : room.guest_session_id

    if (expectedSession !== session.sessionId) {
      return NextResponse.json({ error: 'Not authorized for that player slot.' }, { status: 403 })
    }

    // TODO(online-versus): Enforce authoritative turn order, claim legality,
    // steal timing, objection limits, and duplicate-action prevention here
    // before this route is used in production. Currently only membership is
    // checked; a participant can submit any event sequence.
    const { error } = await supabase
      .from('versus_events')
      .insert({ room_id: roomId, player, type, payload: payload ?? {} })

    if (error) {
      console.error('Online versus event insert failed', {
        roomId,
        player,
        type,
        sessionId: session.sessionId,
        payload,
        error,
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Online versus event route crashed', {
      sessionId: session.sessionId,
      error,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
