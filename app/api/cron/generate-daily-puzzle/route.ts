import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { ensureDailyPuzzleForDate } from '@/lib/daily-puzzle'
import { logError, logInfo, logWarn } from '@/lib/logging'
import { getUtcDateOffset } from '@/lib/puzzle-api'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers)) {
    logWarn('Rejected unauthorized daily puzzle cron request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const targetDate = getUtcDateOffset(1)
    const result = await ensureDailyPuzzleForDate(supabase, targetDate)

    logInfo(
      `${result.createdNew ? 'Generated' : 'Confirmed existing'} daily puzzle for ${result.targetDate}`
    )

    return NextResponse.json({
      ok: true,
      date: result.targetDate,
      createdNew: result.createdNew,
      puzzleId: result.puzzle.id,
      validationStatus: result.validationStatus,
      validationMessage: result.validationMessage,
    })
  } catch (error) {
    logError('Failed to generate daily puzzle from cron:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
