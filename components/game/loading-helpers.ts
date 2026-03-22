export interface LoadingIntersection {
  label: string
  status: 'pending' | 'passed' | 'failed'
  validOptionCount?: number
}

export interface LoadingAttempt {
  attempt: number
  rows: string[]
  cols: string[]
  intersections: LoadingIntersection[]
  rejectedMessage?: string
}

export function buildAttemptIntersections(rows: string[], cols: string[]): LoadingIntersection[] {
  return rows.flatMap((row) =>
    cols.map((col) => ({
      label: `${row} x ${col}`,
      status: 'pending' as const,
    }))
  )
}

export function getIntersectionLabelClass(label: string): string {
  if (label.length > 42) {
    return 'text-[10px]'
  }

  if (label.length > 30) {
    return 'text-[11px]'
  }

  return 'text-xs'
}
