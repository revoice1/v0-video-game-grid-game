import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAnonymousSession } from '@/lib/server-session'
import { logError } from '@/lib/logging'

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
    .select(
      'id, code, host_session_id, guest_session_id, match_number, status, settings, state_data'
    )
    .eq('code', upperCode)
    .single()

  if (fetchError || !room) {
    logError('[versus.room.continue] room lookup failed', {
      code: upperCode,
      sessionId: session.sessionId,
      error: fetchError,
    })
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  }

  if (room.host_session_id !== session.sessionId) {
    logError('[versus.room.continue] not host', {
      code: upperCode,
      roomId: room.id,
      sessionId: session.sessionId,
    })
    return NextResponse.json({ error: 'Only the host can continue the room.' }, { status: 403 })
  }

  const snapshotWinner =
    room.state_data &&
    typeof room.state_data === 'object' &&
    'winner' in room.state_data &&
    (room.state_data.winner === 'x' ||
      room.state_data.winner === 'o' ||
      room.state_data.winner === 'draw')
      ? room.state_data.winner
      : null

  const isReadyForContinue = room.status === 'finished' || snapshotWinner !== null

  if (!isReadyForContinue) {
    return NextResponse.json({ error: 'The room is not ready for another match.' }, { status: 409 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('versus_rooms')
    .update({
      match_number: room.match_number + 1,
      status: 'active',
      puzzle_id: null,
      puzzle_data: null,
      state_data: null,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', room.id)
    .select(
      'id, code, match_number, status, settings, puzzle_id, puzzle_data, state_data, expires_at, created_at'
    )
    .single()

  if (updateError || !updated) {
    logError('[versus.room.continue] room reset failed', {
      code: upperCode,
      roomId: room.id,
      sessionId: session.sessionId,
      error: updateError,
    })
    return NextResponse.json({ error: 'Failed to continue the room.' }, { status: 500 })
  }

  return NextResponse.json({ room: updated })
}
