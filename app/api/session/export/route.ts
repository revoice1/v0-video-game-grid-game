import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyAnonymousSessionCookie, resolveAnonymousSession } from '@/lib/server-session'
import { createRequestLogger } from '@/lib/logging'
import {
  createTransferCode,
  createTransferExpiryDate,
  TRANSFER_CODE_TTL_MINUTES,
} from '@/lib/session-transfer'

export async function GET(request: NextRequest) {
  const logger = createRequestLogger()

  try {
    const supabase = createAdminClient()
    const resolved = resolveAnonymousSession(request)
    const nowIso = new Date().toISOString()
    const expiresAt = createTransferExpiryDate()
    let insertError: { message?: string } | null = null
    let code: string | null = null

    const { error: expiredCleanupError } = await supabase
      .from('session_transfer_tokens')
      .delete()
      .lt('expires_at', nowIso)

    if (expiredCleanupError) {
      logger.error('session export cleanup failed', {
        sessionId: resolved.sessionId,
        phase: 'expired',
        error: expiredCleanupError,
      })
    }

    const { error: usedCleanupError } = await supabase
      .from('session_transfer_tokens')
      .delete()
      .not('used_at', 'is', null)

    if (usedCleanupError) {
      logger.error('session export cleanup failed', {
        sessionId: resolved.sessionId,
        phase: 'used',
        error: usedCleanupError,
      })
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const candidate = createTransferCode()
      const { error } = await supabase.from('session_transfer_tokens').insert({
        token: candidate,
        session_id: resolved.sessionId,
        expires_at: expiresAt.toISOString(),
      })

      if (!error) {
        code = candidate
        insertError = null
        break
      }

      insertError = error
      if (error.code !== '23505') {
        break
      }
    }

    if (!code) {
      logger.error('session export insert failed', {
        sessionId: resolved.sessionId,
        error: insertError,
      })
      return NextResponse.json({ error: 'Failed to create transfer code' }, { status: 500 })
    }

    const response = NextResponse.json({
      code,
      expiresAt: expiresAt.toISOString(),
      expiresInMinutes: TRANSFER_CODE_TTL_MINUTES,
    })
    return applyAnonymousSessionCookie(response, resolved, request)
  } catch (error) {
    logger.error('session export failed', { error })
    return NextResponse.json({ error: 'Failed to export session' }, { status: 500 })
  }
}
