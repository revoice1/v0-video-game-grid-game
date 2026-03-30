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
    .select('id, host_session_id, guest_session_id, status')
    .eq('code', upperCode)
    .single()

  if (fetchError || !room) {
    console.error('[versus.room.finish] room lookup failed', {
      code: upperCode,
      sessionId: session.sessionId,
      error: fetchError,
    })
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  }

  const isParticipant =
    room.host_session_id === session.sessionId || room.guest_session_id === session.sessionId

  if (!isParticipant) {
    console.error('[versus.room.finish] not authorized', {
      code: upperCode,
      roomId: room.id,
      sessionId: session.sessionId,
    })
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }

  const { error: updateError } = await supabase
    .from('versus_rooms')
    .update({ status: 'finished' })
    .eq('id', room.id)

  if (updateError) {
    console.error('[versus.room.finish] status update failed', {
      code: upperCode,
      roomId: room.id,
      sessionId: session.sessionId,
      error: updateError,
    })
    return NextResponse.json({ error: 'Failed to end match.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
