import { beforeEach, describe, expect, it, vi } from 'vitest'

const { upsertMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(async () => ({ error: null })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      upsert: upsertMock,
    }),
  }),
}))
import {
  activateGeminiPrimaryFallback,
  getGeminiObjectionModels,
  shouldPreferGeminiFallback,
  type GeminiPrimaryFallbackState,
} from '@/lib/gemini-primary-health'

function buildFallbackState(
  overrides: Partial<GeminiPrimaryFallbackState> = {}
): GeminiPrimaryFallbackState {
  return {
    preferFallbackUntil: '2026-04-20T01:00:00.000Z',
    model: 'gemini-flash-lite-latest',
    reason: 'timeout',
    ...overrides,
  }
}

describe('shouldPreferGeminiFallback', () => {
  beforeEach(() => {
    upsertMock.mockClear()
  })

  it('returns true when the saved fallback window is still active', () => {
    expect(
      shouldPreferGeminiFallback({
        primaryModel: 'gemini-flash-lite-latest',
        fallbackModel: 'gemini-2.5-flash-lite',
        healthState: buildFallbackState(),
        now: Date.parse('2026-04-20T00:30:00.000Z'),
      })
    ).toBe(true)
  })

  it('returns false when the fallback window has expired or targets another model', () => {
    expect(
      shouldPreferGeminiFallback({
        primaryModel: 'gemini-flash-lite-latest',
        fallbackModel: 'gemini-2.5-flash-lite',
        healthState: buildFallbackState(),
        now: Date.parse('2026-04-20T01:30:00.000Z'),
      })
    ).toBe(false)

    expect(
      shouldPreferGeminiFallback({
        primaryModel: 'gemini-flash-lite-latest',
        fallbackModel: 'gemini-2.5-flash-lite',
        healthState: buildFallbackState({
          model: 'gemini-3.1-flash-lite-preview',
        }),
        now: Date.parse('2026-04-20T00:30:00.000Z'),
      })
    ).toBe(false)
  })
})

describe('getGeminiObjectionModels', () => {
  it('keeps the primary first when there is no active fallback window', () => {
    expect(
      getGeminiObjectionModels({
        primaryModel: 'gemini-flash-lite-latest',
        fallbackModel: 'gemini-2.5-flash-lite',
        healthState: null,
      })
    ).toEqual(['gemini-flash-lite-latest', 'gemini-2.5-flash-lite'])
  })

  it('moves the fallback first during the active cooldown window', () => {
    expect(
      getGeminiObjectionModels({
        primaryModel: 'gemini-flash-lite-latest',
        fallbackModel: 'gemini-2.5-flash-lite',
        healthState: buildFallbackState(),
        now: Date.parse('2026-04-20T00:30:00.000Z'),
      })
    ).toEqual(['gemini-2.5-flash-lite', 'gemini-flash-lite-latest'])
  })
})

describe('activateGeminiPrimaryFallback', () => {
  it('builds a fallback window from the provided cooldown', async () => {
    const state = await activateGeminiPrimaryFallback({
      primaryModel: 'gemini-flash-lite-latest',
      cooldownMs: 60_000,
      reason: 'timeout',
      now: Date.parse('2026-04-20T00:00:00.000Z'),
    })

    expect(state).toEqual({
      preferFallbackUntil: '2026-04-20T00:01:00.000Z',
      model: 'gemini-flash-lite-latest',
      reason: 'timeout',
    })
    expect(upsertMock).toHaveBeenCalledOnce()
  })
})
