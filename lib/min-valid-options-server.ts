import { parseMinValidOptionsDefault } from '@/lib/min-valid-options'

export function getMinValidOptionsDefaultFromEnv(): number {
  return parseMinValidOptionsDefault(process.env.PUZZLE_MIN_VALID_OPTIONS)
}
