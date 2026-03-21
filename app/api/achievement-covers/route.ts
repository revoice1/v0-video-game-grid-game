import { NextResponse } from 'next/server'
import { EASTER_EGGS } from '@/lib/easter-eggs'
import { getIGDBGameDetails } from '@/lib/igdb'

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { achievementIds?: string[] }
    const achievementIds = Array.isArray(payload?.achievementIds) ? payload.achievementIds : []

    if (achievementIds.length === 0) {
      return NextResponse.json({ images: {} })
    }

    const idToGameId = new Map<string, number>()
    for (const egg of EASTER_EGGS) {
      if (egg.triggerGameIds.length > 0) {
        idToGameId.set(egg.achievementId, egg.triggerGameIds[0])
      }
    }

    const entries = achievementIds
      .map((id) => ({ id, gameId: idToGameId.get(id) }))
      .filter((entry): entry is { id: string; gameId: number } => typeof entry.gameId === 'number')

    const images: Record<string, string | null> = {}

    await Promise.all(
      entries.map(async ({ id, gameId }) => {
        const game = await getIGDBGameDetails(gameId)
        images[id] = game?.background_image ?? null
      })
    )

    return NextResponse.json({ images })
  } catch {
    return NextResponse.json({ images: {} }, { status: 200 })
  }
}
