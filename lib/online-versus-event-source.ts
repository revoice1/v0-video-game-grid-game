import type { OnlineVersusEventSource, RoomPlayer } from './versus-room'

export function classifyFetchedOnlineVersusEventSource(
  createdAt: string,
  replayStartedAtMs: number
): OnlineVersusEventSource {
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
