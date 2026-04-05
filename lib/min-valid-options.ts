const FALLBACK_MIN_VALID_OPTIONS_PER_CELL = 3

export function parseMinValidOptionsDefault(rawValue: unknown): number {
  const parsed =
    typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string'
        ? Number(rawValue)
        : Number.NaN

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    return FALLBACK_MIN_VALID_OPTIONS_PER_CELL
  }

  return parsed
}

export function sanitizeMinValidOptionsOverride(
  rawOverride: number | null | undefined,
  minValidOptionsDefault: number
): number | null {
  const maxOverride = minValidOptionsDefault - 1
  if (maxOverride < 1) {
    return null
  }

  if (
    typeof rawOverride !== 'number' ||
    !Number.isFinite(rawOverride) ||
    !Number.isInteger(rawOverride) ||
    rawOverride < 1 ||
    rawOverride > maxOverride
  ) {
    return null
  }

  return rawOverride
}
