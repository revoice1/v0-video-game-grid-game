import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAnonymousSession } from '@/lib/server-session'
import { createRequestLogger } from '@/lib/logging'
import type { Puzzle } from '@/lib/types'
import type { OnlineVersusSnapshot } from '@/lib/versus-room'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const logger = createRequestLogger()
  const supabase = createAdminClient()
  const session = resolveAnonymousSession(request)
  const { code } = await params

  const upperCode = code.toUpperCase()

  const { data: room, error: fetchError } = await supabase
    .from('versus_rooms')
    .select('id, host_session_id, match_number, status, puzzle_id, settings')
    .eq('code', upperCode)
    .single()

  if (fetchError || !room) {
    logger.error('[versus.room.puzzle] room lookup failed', {
      code: upperCode,
      sessionId: session.sessionId,
      error: fetchError,
    })
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  }
  if (room.host_session_id !== session.sessionId) {
    logger.error('[versus.room.puzzle] not host', {
      code: upperCode,
      roomId: room.id,
      sessionId: session.sessionId,
    })
    return NextResponse.json({ error: 'Only the host can set the puzzle.' }, { status: 403 })
  }
  if (room.status !== 'active') {
    return NextResponse.json({ error: 'Room is not active.' }, { status: 409 })
  }
  // Idempotency guard — puzzle is write-once; reject if already set
  if (room.puzzle_id !== null) {
    return NextResponse.json({ error: 'Puzzle already set for this match.' }, { status: 409 })
  }

  let puzzleId: string
  let puzzle: Puzzle
  let matchNumber: number | undefined
  try {
    ;({ puzzleId, puzzle, matchNumber } = (await request.json()) as {
      puzzleId: string
      puzzle: Puzzle
      matchNumber?: number
    })
  } catch {
    logger.error('[versus.room.puzzle] invalid request body', {
      code: upperCode,
      roomId: room.id,
      sessionId: session.sessionId,
    })
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!puzzleId || !puzzle || !Number.isInteger(matchNumber)) {
    return NextResponse.json(
      { error: 'Missing puzzleId, puzzle, or matchNumber.' },
      { status: 400 }
    )
  }

  if (matchNumber !== room.match_number) {
    return NextResponse.json({ error: 'This room has moved to a newer match.' }, { status: 409 })
  }

  const timerOption = room.settings?.timerOption
  const turnDurationSeconds = typeof timerOption === 'number' ? timerOption : null
  const initialSnapshot: OnlineVersusSnapshot = {
    puzzleId,
    guesses: Array.from({ length: 9 }, () => null),
    guessesRemaining: 9,
    currentPlayer: 'x',
    winner: null,
    stealableCell: null,
    pendingFinalSteal: null,
    objectionsUsed: { x: 0, o: 0 },
    turnDeadlineAt:
      turnDurationSeconds !== null
        ? new Date(Date.now() + turnDurationSeconds * 1000).toISOString()
        : null,
    turnDurationSeconds,
  }

  const { data: updated, error: updateError } = await supabase
    .from('versus_rooms')
    .update({
      puzzle_id: puzzleId,
      puzzle_data: puzzle,
      state_data: initialSnapshot,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', room.id)
    .is('puzzle_id', null) // DB-level idempotency — only matches when puzzle is not yet set
    .select('id')

  if (updateError) {
    logger.error('[versus.room.puzzle] update failed', {
      code: upperCode,
      roomId: room.id,
      sessionId: session.sessionId,
      puzzleId,
      error: updateError,
    })
    return NextResponse.json({ error: 'Failed to save puzzle.' }, { status: 500 })
  }

  // .is('puzzle_id', null) matched zero rows — another instance already published
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'Puzzle already set for this match.' }, { status: 409 })
  }

  return NextResponse.json({ ok: true })
}
