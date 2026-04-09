import type { OnlineVersusEventSource, RoomPlayer } from './versus-room'

export function classifyFetchedOnlineVersusEventSource(options: {
  createdAt: string
  replayStartedAtMs: number
  eventId: number
  highestKnownEventIdAtReplayStart: number
}): OnlineVersusEventSource {
  const { createdAt, replayStartedAtMs, eventId, highestKnownEventIdAtReplayStart } = options

  // During catch-up, event IDs are the most reliable signal for "the user had not
  // seen this yet". This avoids suppressing spectacle when a missed live event is
  // fetched after the replay window has already started.
  if (highestKnownEventIdAtReplayStart > 0) {
    return eventId > highestKnownEventIdAtReplayStart ? 'live-catchup' : 'history'
  }

  const createdAtMs = Date.parse(createdAt)
  if (Number.isNaN(createdAtMs)) {
    return 'history'
  }

  return createdAtMs >= replayStartedAtMs ? 'live-catchup' : 'history'
}

export function normalizeOnlineVersusEventSource(
  source: OnlineVersusEventSource | undefined,
  isHydratingHistory: boolean
): OnlineVersusEventSource {
  if (source) {
    return source
  }

  return isHydratingHistory ? 'history' : 'live'
}

export function shouldSkipOwnOnlineVersusEventReplay(
  source: OnlineVersusEventSource,
  eventPlayer: RoomPlayer,
  myRole: RoomPlayer
): boolean {
  return eventPlayer === myRole && source !== 'history'
}

export function shouldSuppressOnlineVersusReplayEffects(source: OnlineVersusEventSource): boolean {
  return source === 'history'
}
