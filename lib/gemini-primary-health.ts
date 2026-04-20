import { createAdminClient } from '@/lib/supabase/admin'

const GEMINI_PRIMARY_FALLBACK_FLAG_KEY = 'gemini_objection_primary_fallback'
const GEMINI_PRIMARY_FALLBACK_CACHE_TTL_MS = 60 * 1000

export interface GeminiPrimaryFallbackState {
  preferFallbackUntil: string
  model: string
  reason: string | null
}

let cachedFallbackState: {
  expiresAt: number
  state: GeminiPrimaryFallbackState | null
} | null = null

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeFallbackState(value: unknown): GeminiPrimaryFallbackState | null {
  if (!isPlainObject(value)) {
    return null
  }

  const preferFallbackUntil = value.preferFallbackUntil
  const model = value.model

  if (typeof preferFallbackUntil !== 'string' || typeof model !== 'string') {
    return null
  }

  return {
    preferFallbackUntil,
    model,
    reason: typeof value.reason === 'string' ? value.reason : null,
  }
}

function dedupeModels(models: string[]): string[] {
  return Array.from(
    new Set(models.map((model) => model.trim()).filter((model) => model.length > 0))
  )
}

export function clearGeminiPrimaryFallbackCacheForTests() {
  cachedFallbackState = null
}

export function shouldPreferGeminiFallback(options: {
  primaryModel: string
  fallbackModel: string | null
  healthState: GeminiPrimaryFallbackState | null
  now?: number
}): boolean {
  const { primaryModel, fallbackModel, healthState, now = Date.now() } = options

  if (!fallbackModel || fallbackModel.trim().length === 0) {
    return false
  }

  if (!healthState || healthState.model !== primaryModel) {
    return false
  }

  const preferFallbackUntilMs = Date.parse(healthState.preferFallbackUntil)
  if (Number.isNaN(preferFallbackUntilMs)) {
    return false
  }

  return now < preferFallbackUntilMs
}

export function getGeminiObjectionModels(options: {
  primaryModel: string
  fallbackModel: string | null
  healthState: GeminiPrimaryFallbackState | null
  now?: number
}): string[] {
  const { primaryModel, fallbackModel, healthState, now } = options

  if (
    shouldPreferGeminiFallback({
      primaryModel,
      fallbackModel,
      healthState,
      now,
    })
  ) {
    return dedupeModels([fallbackModel ?? '', primaryModel])
  }

  return dedupeModels([primaryModel, fallbackModel ?? ''])
}

export async function getGeminiPrimaryFallbackState(): Promise<GeminiPrimaryFallbackState | null> {
  const now = Date.now()
  if (cachedFallbackState && cachedFallbackState.expiresAt > now) {
    return cachedFallbackState.state
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('app_runtime_flags')
    .select('value')
    .eq('key', GEMINI_PRIMARY_FALLBACK_FLAG_KEY)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const state = normalizeFallbackState(data?.value)
  cachedFallbackState = {
    expiresAt: now + GEMINI_PRIMARY_FALLBACK_CACHE_TTL_MS,
    state,
  }

  return state
}

export async function setGeminiPrimaryFallbackState(
  state: GeminiPrimaryFallbackState
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('app_runtime_flags').upsert(
    {
      key: GEMINI_PRIMARY_FALLBACK_FLAG_KEY,
      value: state,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'key',
    }
  )

  if (error) {
    throw new Error(error.message)
  }

  cachedFallbackState = {
    expiresAt: Date.now() + GEMINI_PRIMARY_FALLBACK_CACHE_TTL_MS,
    state,
  }
}

export async function activateGeminiPrimaryFallback(options: {
  primaryModel: string
  cooldownMs: number
  reason: string | null
  now?: number
}): Promise<GeminiPrimaryFallbackState> {
  const now = options.now ?? Date.now()
  const state: GeminiPrimaryFallbackState = {
    preferFallbackUntil: new Date(now + options.cooldownMs).toISOString(),
    model: options.primaryModel,
    reason: options.reason,
  }

  await setGeminiPrimaryFallbackState(state)
  return state
}
