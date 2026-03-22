export interface PuzzleGenerationPlan {
  minValidOptionsPerCell: number
  maxAttempts: number
}

export function buildGenerationPlans(
  minValidOptionsPerCell: number,
  maxGenerationAttempts: number
): PuzzleGenerationPlan[] {
  const fallbackThresholds = [
    minValidOptionsPerCell,
    Math.max(Math.floor(minValidOptionsPerCell * 0.6), 2),
    2,
  ]

  const uniqueThresholds = fallbackThresholds.filter(
    (threshold, index) => threshold > 0 && fallbackThresholds.indexOf(threshold) === index
  )

  return uniqueThresholds.map((threshold, index) => ({
    minValidOptionsPerCell: threshold,
    maxAttempts:
      index === 0
        ? maxGenerationAttempts
        : Math.max(4, Math.ceil(maxGenerationAttempts / (index + 1))),
  }))
}
