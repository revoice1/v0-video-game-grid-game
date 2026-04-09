import { describe, expect, it } from 'vitest'
import {
  classifyFetchedOnlineVersusEventSource,
  normalizeOnlineVersusEventSource,
  shouldReplayOnlineVersusSpectacle,
  shouldSkipOwnOnlineVersusEventReplay,
  shouldSuppressOnlineVersusReplayEffects,
} from '@/lib/online-versus-event-source'

describe('online versus event source helpers', () => {
  it('marks fetched events before replay start as history and newer ones as live-catchup', () => {
    const replayStartedAtMs = Date.parse('2026-04-09T00:00:10.000Z')

    expect(
      classifyFetchedOnlineVersusEventSource({
        createdAt: '2026-04-09T00:00:09.000Z',
        replayStartedAtMs,
        eventId: 9,
        highestKnownEventIdAtReplayStart: 0,
      })
    ).toBe('history')

    expect(
      classifyFetchedOnlineVersusEventSource({
        createdAt: '2026-04-09T00:00:10.000Z',
        replayStartedAtMs,
        eventId: 10,
        highestKnownEventIdAtReplayStart: 0,
      })
    ).toBe('live-catchup')

    expect(
      classifyFetchedOnlineVersusEventSource({
        createdAt: '2026-04-09T00:00:11.000Z',
        replayStartedAtMs,
        eventId: 11,
        highestKnownEventIdAtReplayStart: 0,
      })
    ).toBe('live-catchup')
  })

  it('uses event ids to recover missed live events during catch-up', () => {
    expect(
      classifyFetchedOnlineVersusEventSource({
        createdAt: '2026-04-09T00:00:09.000Z',
        replayStartedAtMs: Date.parse('2026-04-09T00:00:15.000Z'),
        eventId: 11,
        highestKnownEventIdAtReplayStart: 10,
      })
    ).toBe('live-catchup')

    expect(
      classifyFetchedOnlineVersusEventSource({
        createdAt: '2026-04-09T00:00:12.000Z',
        replayStartedAtMs: Date.parse('2026-04-09T00:00:15.000Z'),
        eventId: 10,
        highestKnownEventIdAtReplayStart: 10,
      })
    ).toBe('history')
  })

  it('falls back safely when created_at is invalid', () => {
    expect(
      classifyFetchedOnlineVersusEventSource({
        createdAt: 'not-a-date',
        replayStartedAtMs: Date.now(),
        eventId: 1,
        highestKnownEventIdAtReplayStart: 0,
      })
    ).toBe('history')
  })

  it('only suppresses replay effects for true history events', () => {
    expect(shouldSuppressOnlineVersusReplayEffects('history')).toBe(true)
    expect(shouldSuppressOnlineVersusReplayEffects('live')).toBe(false)
    expect(shouldSuppressOnlineVersusReplayEffects('live-catchup')).toBe(false)
  })

  it('allows spectacle replay when an already-applied event upgrades from history to live', () => {
    expect(
      shouldReplayOnlineVersusSpectacle({
        eventSource: 'history',
        alreadyApplied: true,
        alreadyShown: false,
      })
    ).toBe(false)

    expect(
      shouldReplayOnlineVersusSpectacle({
        eventSource: 'live',
        alreadyApplied: true,
        alreadyShown: false,
      })
    ).toBe(true)

    expect(
      shouldReplayOnlineVersusSpectacle({
        eventSource: 'live-catchup',
        alreadyApplied: true,
        alreadyShown: false,
      })
    ).toBe(true)

    expect(
      shouldReplayOnlineVersusSpectacle({
        eventSource: 'live',
        alreadyApplied: true,
        alreadyShown: true,
      })
    ).toBe(false)
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
