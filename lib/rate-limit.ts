/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * Resets on cold start — not a hard guarantee, but sufficient to deter
 * accidental or casual abuse on expensive routes (e.g. Gemini objections).
 * For a hard limit, replace with an edge KV store.
 */

interface Window {
  count: number
  windowStart: number
}

const store = new Map<string, Window>()

export interface RateLimitOptions {
  /** Max requests per window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

export function checkRateLimit(key: string, options: RateLimitOptions): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now - entry.windowStart >= options.windowMs) {
    store.set(key, { count: 1, windowStart: now })
    return true
  }

  if (entry.count >= options.limit) {
    return false
  }

  entry.count++
  return true
}
