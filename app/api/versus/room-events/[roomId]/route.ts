import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAnonymousSession } from '@/lib/server-session'
import { createRequestLogger } from '@/lib/logging'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const logger = createRequestLogger()
  const supabase = createAdminClient()
  const session = resolveAnonymousSession(request)
  const { roomId } = await params

  // Verify the requesting session is a participant in this room
  const { data: room, error: roomError } = await supabase
    .from('versus_rooms')
    .select('host_session_id, guest_session_id, match_number, status')
    .eq('id', roomId)
    .single()

  if (roomError || !room) {
    logger.error('[versus.room-events] room lookup failed', {
      roomId,
      sessionId: session.sessionId,
      error: roomError,
    })
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  }

  const isParticipant =
    room.host_session_id === session.sessionId || room.guest_session_id === session.sessionId

  if (!isParticipant) {
    logger.error('[versus.room-events] not authorized', {
      roomId,
      sessionId: session.sessionId,
    })
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }

  const { data: events, error } = await supabase
    .from('versus_events')
    .select('id, room_id, created_at, match_number, player, type, payload')
    .eq('room_id', roomId)
    .eq('match_number', room.match_number)
    .order('id', { ascending: true })

  if (error) {
    logger.error('[versus.room-events] fetch failed', {
      roomId,
      sessionId: session.sessionId,
      error,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ events: events ?? [] })
}
