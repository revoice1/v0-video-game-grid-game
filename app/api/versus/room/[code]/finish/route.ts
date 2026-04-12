import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAnonymousSession } from '@/lib/server-session'
import { createRequestLogger } from '@/lib/logging'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const logger = createRequestLogger()
  const supabase = createAdminClient()
  const session = resolveAnonymousSession(request)
  const { code } = await params

  let matchNumber: number | undefined
  try {
    ;({ matchNumber } = (await request.json()) as { matchNumber?: number })
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!Number.isInteger(matchNumber)) {
    return NextResponse.json({ error: 'Missing matchNumber.' }, { status: 400 })
  }

  const upperCode = code.toUpperCase()

  const { data: room, error: fetchError } = await supabase
    .from('versus_rooms')
    .select('id, host_session_id, guest_session_id, match_number, status')
    .eq('code', upperCode)
    .single()

  if (fetchError || !room) {
    logger.error('[versus.room.finish] room lookup failed', {
      code: upperCode,
      sessionId: session.sessionId,
      error: fetchError,
    })
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  }

  const isParticipant =
    room.host_session_id === session.sessionId || room.guest_session_id === session.sessionId

  if (!isParticipant) {
    logger.error('[versus.room.finish] not authorized', {
      code: upperCode,
      roomId: room.id,
      sessionId: session.sessionId,
    })
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }

  if (matchNumber !== room.match_number) {
    return NextResponse.json({ error: 'This room has moved to a newer match.' }, { status: 409 })
  }

  const { error: updateError } = await supabase
    .from('versus_rooms')
    .update({
      status: 'finished',
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', room.id)

  if (updateError) {
    logger.error('[versus.room.finish] status update failed', {
      code: upperCode,
      roomId: room.id,
      sessionId: session.sessionId,
      error: updateError,
    })
    return NextResponse.json({ error: 'Failed to end match.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
