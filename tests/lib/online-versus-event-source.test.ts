import { describe, expect, it } from 'vitest'
import {
  classifyFetchedOnlineVersusEventSource,
  normalizeOnlineVersusEventSource,
  shouldSkipOwnOnlineVersusEventReplay,
  shouldSuppressOnlineVersusReplayEffects,
} from '@/lib/online-versus-event-source'

describe('online versus event source helpers', () => {
  it('marks fetched events before replay start as history and newer ones as live-catchup', () => {
    const replayStartedAtMs = Date.parse('2026-04-09T00:00:10.000Z')

    expect(
      classifyFetchedOnlineVersusEventSource('2026-04-09T00:00:09.000Z', replayStartedAtMs)
    ).toBe('history')

    expect(
      classifyFetchedOnlineVersusEventSource('2026-04-09T00:00:10.000Z', replayStartedAtMs)
    ).toBe('live-catchup')

    expect(
      classifyFetchedOnlineVersusEventSource('2026-04-09T00:00:11.000Z', replayStartedAtMs)
    ).toBe('live-catchup')
  })

  it('falls back safely when created_at is invalid', () => {
    expect(classifyFetchedOnlineVersusEventSource('not-a-date', Date.now())).toBe('history')
  })

  it('only suppresses replay effects for true history events', () => {
    expect(shouldSuppressOnlineVersusReplayEffects('history')).toBe(true)
    expect(shouldSuppressOnlineVersusReplayEffects('live')).toBe(false)
    expect(shouldSuppressOnlineVersusReplayEffects('live-catchup')).toBe(false)
  })

  it('skips only my non-history events because they are already applied locally', () => {
    expect(shouldSkipOwnOnlineVersusEventReplay('live', 'o', 'o')).toBe(true)
    expect(shouldSkipOwnOnlineVersusEventReplay('live-catchup', 'o', 'o')).toBe(true)
    expect(shouldSkipOwnOnlineVersusEventReplay('history', 'o', 'o')).toBe(false)
    expect(shouldSkipOwnOnlineVersusEventReplay('live', 'x', 'o')).toBe(false)
  })

  it('normalizes missing sources based on whether history hydration is active', () => {
    expect(normalizeOnlineVersusEventSource(undefined, true)).toBe('history')
    expect(normalizeOnlineVersusEventSource(undefined, false)).toBe('live')
    expect(normalizeOnlineVersusEventSource('live-catchup', true)).toBe('live-catchup')
  })
})
