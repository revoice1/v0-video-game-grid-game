import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAnonymousSession } from '@/lib/server-session'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const supabase = createAdminClient()
  const session = resolveAnonymousSession(request)
  const { code } = await params
  const upperCode = code.toUpperCase()

  const { data: room, error: fetchError } = await supabase
    .from('versus_rooms')
    .select('id, code, host_session_id, guest_session_id, status, settings')
    .eq('code', upperCode)
    .single()

  if (fetchError || !room) {
    console.error('[versus.room.continue] room lookup failed', {
      code: upperCode,
      sessionId: session.sessionId,
      error: fetchError,
    })
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  }

  if (room.host_session_id !== session.sessionId) {
    console.error('[versus.room.continue] not host', {
      code: upperCode,
      roomId: room.id,
      sessionId: session.sessionId,
    })
    return NextResponse.json({ error: 'Only the host can continue the room.' }, { status: 403 })
  }

  if (room.status !== 'finished') {
    return NextResponse.json({ error: 'The room is not ready for another match.' }, { status: 409 })
  }

  const { error: deleteEventsError } = await supabase
    .from('versus_events')
    .delete()
    .eq('room_id', room.id)

  if (deleteEventsError) {
    console.error('[versus.room.continue] failed to clear prior events', {
      code: upperCode,
      roomId: room.id,
      sessionId: session.sessionId,
      error: deleteEventsError,
    })
    return NextResponse.json({ error: 'Failed to reset prior match events.' }, { status: 500 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('versus_rooms')
    .update({
      status: 'active',
      puzzle_id: null,
      puzzle_data: null,
      state_data: null,
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', room.id)
    .eq('status', 'finished')
    .select(
      'id, code, status, settings, puzzle_id, puzzle_data, state_data, expires_at, created_at'
    )
    .single()

  if (updateError || !updated) {
    console.error('[versus.room.continue] room reset failed', {
      code: upperCode,
      roomId: room.id,
      sessionId: session.sessionId,
      error: updateError,
    })
    return NextResponse.json({ error: 'Failed to continue the room.' }, { status: 500 })
  }

  return NextResponse.json({ room: updated })
}
