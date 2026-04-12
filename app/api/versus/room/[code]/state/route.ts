import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAnonymousSession } from '@/lib/server-session'

const CategoryMatchExplanationSchema = z.object({
  matched: z.boolean(),
  categoryType: z.enum([
    'platform',
    'genre',
    'developer',
    'publisher',
    'decade',
    'tag',
    'company',
    'game_mode',
    'theme',
    'perspective',
  ]),
  categoryName: z.string(),
  matchSource: z.enum([
    'direct-id',
    'alias-name',
    'merged-platform-bucket',
    'release-date-family',
    'company-id',
    'company-alias',
    'company-prefix',
    'igdb-array',
    'no-match',
  ]),
  matchedValues: z.array(z.string()),
  note: z.string().nullable().optional(),
})

const GuessValidationExplanationSchema = z.object({
  row: CategoryMatchExplanationSchema,
  col: CategoryMatchExplanationSchema,
  familyResolution: z.object({
    used: z.boolean(),
    selectedGameId: z.number(),
    selectedGameName: z.string(),
    note: z.string().nullable().optional(),
  }),
})

const GuessRecordSchema = z.object({
  gameId: z.number(),
  gameName: z.string(),
  gameImage: z.string().nullable(),
  isCorrect: z.boolean(),
  owner: z.enum(['x', 'o']).optional(),
  gameSlug: z.string().nullable().optional(),
  gameUrl: z.string().nullable().optional(),
  released: z.string().nullable().optional(),
  metacritic: z.number().nullable().optional(),
  stealRating: z.number().nullable().optional(),
  stealRatingCount: z.number().nullable().optional(),
  genres: z.array(z.string()).optional(),
  platforms: z.array(z.string()).optional(),
  developers: z.array(z.string()).optional(),
  publishers: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  gameModes: z.array(z.string()).optional(),
  themes: z.array(z.string()).optional(),
  perspectives: z.array(z.string()).optional(),
  companies: z.array(z.string()).optional(),
  matchedRow: z.boolean().optional(),
  matchedCol: z.boolean().optional(),
  validationExplanation: GuessValidationExplanationSchema.nullable().optional(),
  objectionUsed: z.boolean().optional(),
  objectionVerdict: z.enum(['sustained', 'overruled']).nullable().optional(),
  objectionExplanation: z.string().nullable().optional(),
  objectionOriginalMatchedRow: z.boolean().nullable().optional(),
  objectionOriginalMatchedCol: z.boolean().nullable().optional(),
  showdownScoreRevealed: z.boolean().optional(),
})

const SnapshotSchema = z.object({
  puzzleId: z.string().nullable(),
  guesses: z.array(GuessRecordSchema.nullable()).length(9),
  guessesRemaining: z.number().int().min(0).max(9),
  currentPlayer: z.enum(['x', 'o']),
  winner: z.enum(['x', 'o', 'draw']).nullable(),
  stealableCell: z.number().int().min(0).max(8).nullable(),
  pendingFinalSteal: z
    .object({
      defender: z.enum(['x', 'o']),
      cellIndex: z.number().int().min(0).max(8),
    })
    .nullable(),
  objectionsUsed: z.object({
    x: z.number().int().min(0),
    o: z.number().int().min(0),
  }),
  turnDeadlineAt: z.string().datetime().nullable(),
  turnDurationSeconds: z.number().int().positive().nullable(),
})

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
    .select('id, host_session_id, guest_session_id, match_number, status, puzzle_id')
    .eq('code', upperCode)
    .single()

  if (fetchError || !room) {
    console.error('[versus.room.state] room lookup failed', {
      code: upperCode,
      sessionId: session.sessionId,
      error: fetchError,
    })
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  }

  const isParticipant =
    room.host_session_id === session.sessionId || room.guest_session_id === session.sessionId

  if (!isParticipant) {
    console.error('[versus.room.state] not authorized', {
      code: upperCode,
      roomId: room.id,
      sessionId: session.sessionId,
    })
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }

  if (room.status !== 'active') {
    return NextResponse.json({ error: 'Room is not active.' }, { status: 409 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    console.error('[versus.room.state] invalid request body', {
      code: upperCode,
      roomId: room.id,
      sessionId: session.sessionId,
    })
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = SnapshotSchema.safeParse((body as { snapshot?: unknown })?.snapshot)
  if (!parsed.success) {
    console.error('[versus.room.state] invalid snapshot', {
      code: upperCode,
      roomId: room.id,
      sessionId: session.sessionId,
      detail: parsed.error.flatten(),
    })
    return NextResponse.json(
      { error: 'Invalid snapshot.', detail: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const matchNumber = (body as { matchNumber?: unknown })?.matchNumber
  if (!Number.isInteger(matchNumber)) {
    return NextResponse.json({ error: 'Missing matchNumber.' }, { status: 400 })
  }

  if (matchNumber !== room.match_number) {
    return NextResponse.json({ error: 'This room has moved to a newer match.' }, { status: 409 })
  }

  if (room.puzzle_id && parsed.data.puzzleId !== room.puzzle_id) {
    return NextResponse.json(
      { error: 'Snapshot puzzle does not match room puzzle.' },
      { status: 409 }
    )
  }

  const { data: updated, error } = await supabase
    .from('versus_rooms')
    .update({
      state_data: parsed.data,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', room.id)
    .eq('status', 'active')
    .eq('match_number', matchNumber as number)
    .select('id')
    .single()

  if (error || !updated) {
    console.error('[versus.room.state] update failed or room no longer active', {
      code: upperCode,
      roomId: room.id,
      sessionId: session.sessionId,
      snapshotPuzzleId: parsed.data.puzzleId,
      error,
    })
    return NextResponse.json({ error: 'Room is no longer active.' }, { status: 409 })
  }

  return NextResponse.json({ ok: true })
}
