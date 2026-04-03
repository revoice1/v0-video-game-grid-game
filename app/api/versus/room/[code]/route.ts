import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAnonymousSession, applyAnonymousSessionCookie } from '@/lib/server-session'

// GET /api/versus/room/[code]
// Returns the safe room shape for an existing member. Read-only — no mutations.
// Used by the client to refresh room state (e.g. state_data / turnDeadlineAt)
// after a reconnect or visibility-change catch-up.

const SAFE_ROOM_COLUMNS =
  'id, code, status, settings, puzzle_id, puzzle_data, state_data, expires_at, created_at'

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const supabase = createAdminClient()
  const session = resolveAnonymousSession(request)
  const { code } = await params

  const upperCode = code.toUpperCase()

  const { data: room, error } = await supabase
    .from('versus_rooms')
    .select(`${SAFE_ROOM_COLUMNS}, host_session_id, guest_session_id`)
    .eq('code', upperCode)
    .single()

  if (error || !room) {
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  }

  const isMember =
    room.host_session_id === session.sessionId || room.guest_session_id === session.sessionId

  if (!isMember) {
    return NextResponse.json({ error: 'Not a member of this room.' }, { status: 403 })
  }

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

  const response = NextResponse.json({ room: safeRoom })
  return applyAnonymousSessionCookie(response, session, request)
}
