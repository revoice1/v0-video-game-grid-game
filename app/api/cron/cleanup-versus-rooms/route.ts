import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { logError, logInfo, logWarn } from '@/lib/logging'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers)) {
    logWarn('Rejected unauthorized cleanup-versus-rooms cron request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.rpc('cleanup_expired_versus_rooms')

  if (error) {
    logError('Failed to clean up expired versus rooms from cron:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  logInfo('Cleaned up expired versus rooms')
  return NextResponse.json({ ok: true })
}
