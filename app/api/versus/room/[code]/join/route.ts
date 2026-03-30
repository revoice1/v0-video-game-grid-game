import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAnonymousSession, applyAnonymousSessionCookie } from '@/lib/server-session'

// Columns safe to return to the client — session IDs are never exposed
const SAFE_ROOM_COLUMNS =
  'id, code, status, settings, puzzle_id, puzzle_data, state_data, expires_at, created_at'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const supabase = createAdminClient()
  const session = resolveAnonymousSession(request)
  const { code } = await params

  const upperCode = code.toUpperCase()

  // Fetch with session IDs for membership checks (not returned to client)
  const { data: room, error: fetchError } = await supabase
    .from('versus_rooms')
    .select(
      'id, code, status, settings, puzzle_id, puzzle_data, state_data, expires_at, created_at, host_session_id, guest_session_id'
    )
    .eq('code', upperCode)
    .single()

  if (fetchError || !room) {
    console.error('[versus.room.join] room lookup failed', {
      code: upperCode,
      sessionId: session.sessionId,
      error: fetchError,
    })
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  }

  if (room.status === 'finished') {
    return NextResponse.json({ error: 'This match has already ended.' }, { status: 409 })
  }

  if (room.expires_at && new Date(room.expires_at) < new Date()) {
    return NextResponse.json({ error: 'That invite has expired.' }, { status: 410 })
  }

  // Build the safe room payload — no session IDs
  const safeRoom = {
    id: room.id,
    code: room.code,
    status: room.status,
    settings: room.settings,
    puzzle_id: room.puzzle_id,
    puzzle_data: room.puzzle_data,
    state_data: room.state_data,
    expires_at: room.expires_at,
    created_at: room.created_at,
  }

  // Host rejoining their own room
  if (room.host_session_id === session.sessionId) {
    const response = NextResponse.json({ room: safeRoom, role: 'x' })
    return applyAnonymousSessionCookie(response, session, request)
  }

  // Guest rejoining
  if (room.guest_session_id === session.sessionId) {
    const response = NextResponse.json({ room: safeRoom, role: 'o' })
    return applyAnonymousSessionCookie(response, session, request)
  }

  // Room is active but this session isn't in it
  if (room.status === 'active') {
    return NextResponse.json({ error: 'That match already has two players.' }, { status: 409 })
  }

  // New guest joining a waiting room
  if (room.status !== 'waiting') {
    return NextResponse.json({ error: 'That match already has two players.' }, { status: 409 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('versus_rooms')
    .update({ guest_session_id: session.sessionId, status: 'active' })
    .eq('id', room.id)
    .eq('status', 'waiting') // optimistic lock — prevents race-condition double joins
    .select(SAFE_ROOM_COLUMNS)
    .single()

  if (updateError || !updated) {
    console.error('[versus.room.join] guest attach failed', {
      code: upperCode,
      roomId: room.id,
      sessionId: session.sessionId,
      error: updateError,
    })
    return NextResponse.json(
      { error: 'Failed to join match. It may have just filled up.' },
      { status: 409 }
    )
  }

  const response = NextResponse.json({ room: updated, role: 'o' })
  return applyAnonymousSessionCookie(response, session, request)
}
