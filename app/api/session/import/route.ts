import { NextRequest, NextResponse } from 'next/server'
import { applyAnonymousSessionCookie } from '@/lib/server-session'
import { createRequestLogger } from '@/lib/logging'
import { checkRateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeTransferCode } from '@/lib/session-transfer'

const IMPORT_RATE_LIMIT = { limit: 5, windowMs: 60_000 }

export async function POST(request: NextRequest) {
  const logger = createRequestLogger()
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (!checkRateLimit(`session-import:${ip}`, IMPORT_RATE_LIMIT)) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const incomingCode =
    body && typeof body === 'object' && 'code' in body
      ? (body as Record<string, unknown>).code
      : undefined

  const normalizedCode = normalizeTransferCode(incomingCode)
  if (!normalizedCode) {
    return NextResponse.json({ error: 'Invalid transfer code format' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const redeemedAt = new Date().toISOString()
    const { data, error } = await supabase
      .from('session_transfer_tokens')
      .update({ used_at: redeemedAt })
      .eq('token', normalizedCode)
      .is('used_at', null)
      .gt('expires_at', redeemedAt)
      .select('session_id')
      .single()

    if (error || !data?.session_id) {
      return NextResponse.json({ error: 'Invalid or expired transfer code' }, { status: 400 })
    }

    const response = NextResponse.json({ ok: true })
    return applyAnonymousSessionCookie(
      response,
      { sessionId: data.session_id, shouldSetCookie: true },
      request
    )
  } catch (error) {
    logger.error('session import failed', { error })
    return NextResponse.json({ error: 'Failed to import session' }, { status: 500 })
  }
}
