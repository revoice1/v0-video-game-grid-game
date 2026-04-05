import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeMinValidOptionsOverride } from '@/lib/min-valid-options'
import { getMinValidOptionsDefaultFromEnv } from '@/lib/min-valid-options-server'
import { resolveAnonymousSession, applyAnonymousSessionCookie } from '@/lib/server-session'

const CategoryFiltersSchema = z.record(z.string(), z.array(z.string()))

const RoomSettingsSchema = z.object({
  categoryFilters: CategoryFiltersSchema,
  stealRule: z.enum(['off', 'lower', 'higher', 'fewer_reviews', 'more_reviews']),
  timerOption: z.union([
    z.literal('none'),
    z.literal(20),
    z.literal(60),
    z.literal(120),
    z.literal(300),
  ]),
  disableDraws: z.boolean(),
  objectionRule: z.enum(['off', 'one', 'three']),
  minimumValidOptionsOverride: z.number().int().min(1).nullable().optional(),
})

const MIN_VALID_OPTIONS_PER_CELL = getMinValidOptionsDefaultFromEnv()

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const session = resolveAnonymousSession(request)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    console.error('[versus.room.create] invalid request body', {
      sessionId: session.sessionId,
    })
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = RoomSettingsSchema.safeParse((body as { settings?: unknown })?.settings)
  if (!parsed.success) {
    console.error('[versus.room.create] invalid settings', {
      sessionId: session.sessionId,
      detail: parsed.error.flatten(),
    })
    return NextResponse.json(
      { error: 'Invalid settings.', detail: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const sanitizedMinimumValidOptionsOverride = sanitizeMinValidOptionsOverride(
    parsed.data.minimumValidOptionsOverride,
    MIN_VALID_OPTIONS_PER_CELL
  )
  if (
    parsed.data.minimumValidOptionsOverride !== undefined &&
    parsed.data.minimumValidOptionsOverride !== null &&
    sanitizedMinimumValidOptionsOverride === null
  ) {
    return NextResponse.json(
      {
        error: `minimumValidOptionsOverride must be lower than default (${MIN_VALID_OPTIONS_PER_CELL}).`,
      },
      { status: 400 }
    )
  }
  const sanitizedSettings = {
    ...parsed.data,
    minimumValidOptionsOverride: sanitizedMinimumValidOptionsOverride,
  }

  const { data, error } = await supabase
    .from('versus_rooms')
    .insert({ host_session_id: session.sessionId, settings: sanitizedSettings })
    .select(
      'id, code, status, settings, expires_at, created_at, puzzle_id, puzzle_data, state_data'
    )
    .single()

  if (error) {
    console.error('[versus.room.create] insert failed', {
      sessionId: session.sessionId,
      settings: sanitizedSettings,
      error,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const response = NextResponse.json({ room: data })
  return applyAnonymousSessionCookie(response, session, request)
}
