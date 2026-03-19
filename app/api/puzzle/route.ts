import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildPuzzleCellMetadata,
  generatePuzzleCategories,
  getValidGameCountForCell,
  type PuzzleProgressCallback,
} from '@/lib/igdb'
import type { Category, PuzzleCellMetadata } from '@/lib/types'

const MIN_VALID_OPTIONS_PER_CELL = Number(process.env.PUZZLE_MIN_VALID_OPTIONS ?? '3')
const MAX_GENERATION_ATTEMPTS = Number(process.env.PUZZLE_GENERATION_MAX_ATTEMPTS ?? '12')
const VALIDATION_SAMPLE_SIZE = Number(process.env.PUZZLE_VALIDATION_SAMPLE_SIZE ?? '40')

function getGenerationPlans() {
  const fallbackThresholds = [
    MIN_VALID_OPTIONS_PER_CELL,
    Math.max(6, Math.min(MIN_VALID_OPTIONS_PER_CELL - 2, MIN_VALID_OPTIONS_PER_CELL)),
    3,
  ]
  const uniqueThresholds = fallbackThresholds.filter(
    (t, i) => t > 0 && fallbackThresholds.indexOf(t) === i
  )
  return uniqueThresholds.map((threshold, index) => ({
    minValidOptionsPerCell: threshold,
    maxAttempts:
      index === 0
        ? MAX_GENERATION_ATTEMPTS
        : Math.max(4, Math.ceil(MAX_GENERATION_ATTEMPTS / (index + 1))),
  }))
}

function sanitizeCategories(categories: Category[]): Omit<Category, 'developerId' | 'publisherId'>[] {
  return categories.map(({ developerId: _d, publisherId: _p, ...safe }) => safe)
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

async function getExistingDailyPuzzle(supabase: Awaited<ReturnType<typeof createClient>>, today: string) {
  const { data } = await supabase
    .from('puzzles')
    .select('*')
    .eq('date', today)
    .eq('is_daily', true)
    .single()
  return data
}

/**
 * Compute cell metadata with a per-cell progress callback.
 * Used after generation to get exact valid-option counts for display.
 */
async function computePuzzleCellMetadata(
  rows: Category[],
  cols: Category[],
  minValidOptionsPerCell = MIN_VALID_OPTIONS_PER_CELL,
  onCell?: (cellIndex: number, total: number) => void
): Promise<PuzzleCellMetadata[]> {
  const total = rows.length * cols.length
  const exactCellResults = await Promise.all(
    rows.flatMap((rowCategory, rowIndex) =>
      cols.map(async (colCategory, colIndex) => {
        const cellIndex = rowIndex * 3 + colIndex
        const validOptionCount = await getValidGameCountForCell(rowCategory, colCategory)
        onCell?.(cellIndex, total)
        return { cellIndex, rowCategory, colCategory, validOptionCount }
      })
    )
  )

  const validation = {
    valid: exactCellResults.every(c => c.validOptionCount >= minValidOptionsPerCell),
    minValidOptionCount: exactCellResults.reduce(
      (low, c) => Math.min(low, c.validOptionCount),
      Number.POSITIVE_INFINITY
    ),
    cellResults: exactCellResults,
    failedCells: exactCellResults.filter(c => c.validOptionCount < minValidOptionsPerCell),
  }

  return buildPuzzleCellMetadata(validation, minValidOptionsPerCell, VALIDATION_SAMPLE_SIZE, false)
}

/** Encode a Server-Sent Event frame */
function sseEvent(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

/**
 * Convert raw generation progress events into a 0-100 progress value.
 *
 * Budget breakdown (generation path):
 *   0–5   : fetching category families
 *   5–75  : generation attempts  (each attempt gets an equal slice; within each
 *            attempt the 9 cell-validation calls advance the slice linearly)
 *   75–95 : final cell-metadata computation (9 parallel counts)
 *   95–100: DB write + response assembly
 */
function generationProgress(
  event: Parameters<PuzzleProgressCallback>[0],
  maxAttempts: number
): { pct: number; message: string } {
  const FAMILIES_END = 5
  const ATTEMPTS_END = 75
  const METADATA_END = 95

  switch (event.stage) {
    case 'families':
      return { pct: 2, message: 'Loading category data...' }

    case 'attempt': {
      const attemptFrac = ((event.attempt ?? 1) - 1) / maxAttempts
      const pct = FAMILIES_END + attemptFrac * (ATTEMPTS_END - FAMILIES_END)
      return { pct: Math.round(pct), message: `Attempt ${event.attempt}/${maxAttempts}: picking categories...` }
    }

    case 'cell': {
      const attemptFrac = ((event.attempt ?? 1) - 1) / maxAttempts
      const attemptStart = FAMILIES_END + attemptFrac * (ATTEMPTS_END - FAMILIES_END)
      const attemptSlice = (ATTEMPTS_END - FAMILIES_END) / maxAttempts
      const cellFrac = ((event.cellIndex ?? 0) + 1) / (event.totalCells ?? 9)
      const pct = attemptStart + cellFrac * attemptSlice
      return {
        pct: Math.round(pct),
        message: `Attempt ${event.attempt}/${maxAttempts}: checking intersection ${(event.cellIndex ?? 0) + 1}/${event.totalCells ?? 9}...`,
      }
    }

    case 'metadata':
      return {
        pct: Math.round(ATTEMPTS_END + ((event.cellIndex ?? 0) + 1) / (event.totalCells ?? 9) * (METADATA_END - ATTEMPTS_END)),
        message: `Validating cell ${(event.cellIndex ?? 0) + 1}/${event.totalCells ?? 9}...`,
      }

    case 'done':
      return { pct: 98, message: 'Saving puzzle...' }

    default:
      return { pct: 0, message: '' }
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('mode') || 'daily'

  // createClient() calls cookies() from next/headers which MUST run inside the
  // request scope — before we return the Response or detach any async work.
  const supabase = await createClient()

  const encoder = new TextEncoder()
  const stream = new TransformStream<string, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(encoder.encode(chunk))
    },
  })
  const writer = stream.writable.getWriter()

  const send = (data: object) => writer.write(sseEvent(data)).catch(() => {})

  // supabase client is already created above — safe to use inside the detached task.
  ;(async () => {
    try {

      if (mode === 'daily') {
        const today = getTodayDate()
        const existingPuzzle = await getExistingDailyPuzzle(supabase, today)

        if (existingPuzzle) {
          // Already generated — serve cached metadata directly, no progress needed
          let cellMetadata: PuzzleCellMetadata[] = existingPuzzle.cell_metadata

          if (!cellMetadata) {
            // Backfill for pre-migration rows
            await send({ type: 'progress', pct: 30, message: "Loading today's board..." })
            cellMetadata = await computePuzzleCellMetadata(
              existingPuzzle.row_categories,
              existingPuzzle.col_categories,
              MIN_VALID_OPTIONS_PER_CELL,
              (cellIndex, total) => send({ type: 'progress', pct: 30 + Math.round((cellIndex + 1) / total * 65), message: `Validating cell ${cellIndex + 1}/${total}...` })
            )
            await supabase.from('puzzles').update({ cell_metadata: cellMetadata }).eq('id', existingPuzzle.id)
          }

          await send({ type: 'progress', pct: 100, message: "Board ready." })
          await send({
            type: 'puzzle',
            puzzle: {
              ...existingPuzzle,
              row_categories: sanitizeCategories(existingPuzzle.row_categories),
              col_categories: sanitizeCategories(existingPuzzle.col_categories),
              cell_metadata: cellMetadata,
            },
          })
          return
        }

        // Need to generate today's puzzle — stream real progress
        await send({ type: 'progress', pct: 0, message: 'Starting puzzle generation...' })
      } else {
        await send({ type: 'progress', pct: 0, message: 'Starting puzzle generation...' })
      }

      // --- Generation ---
      const plans = getGenerationPlans()
      let categories: { rows: Category[]; cols: Category[]; validationStatus: string; validationMessage: string | null; cellMetadata: PuzzleCellMetadata[] } | null = null
      let lastError: Error | null = null

      for (const plan of plans) {
        try {
          const onProgress: PuzzleProgressCallback = (event) => {
            const { pct, message } = generationProgress(event, plan.maxAttempts)
            send({ type: 'progress', pct, message })
          }

          const { rows, cols } = await generatePuzzleCategories({
            minValidOptionsPerCell: plan.minValidOptionsPerCell,
            maxAttempts: plan.maxAttempts,
            sampleSize: VALIDATION_SAMPLE_SIZE,
            onProgress,
          })

          // Final metadata computation (exact counts, not sampled)
          await send({ type: 'progress', pct: 75, message: 'Computing final cell counts...' })
          const cellMetadata = await computePuzzleCellMetadata(
            rows,
            cols,
            plan.minValidOptionsPerCell,
            (cellIndex, total) => send({
              type: 'progress',
              pct: 75 + Math.round((cellIndex + 1) / total * 20),
              message: `Validating cell ${cellIndex + 1}/${total}...`,
            })
          )

          const validationStatus = plan.minValidOptionsPerCell !== MIN_VALID_OPTIONS_PER_CELL ? 'relaxed' : 'validated'
          const validationMessage = validationStatus === 'relaxed'
            ? `Generated with relaxed validation (${plan.minValidOptionsPerCell}+ valid options per cell instead of ${MIN_VALID_OPTIONS_PER_CELL}+).`
            : null

          categories = { rows, cols, validationStatus, validationMessage, cellMetadata }
          break
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Unknown error')
          await send({ type: 'progress', pct: 10, message: `Attempt failed, retrying with relaxed rules...` })
        }
      }

      if (!categories) {
        throw lastError ?? new Error('Failed to generate puzzle')
      }

      await send({ type: 'progress', pct: 95, message: 'Saving puzzle...' })

      const insertPayload =
        mode === 'daily'
          ? { date: getTodayDate(), is_daily: true, row_categories: categories.rows, col_categories: categories.cols, cell_metadata: categories.cellMetadata }
          : { date: null, is_daily: false, row_categories: categories.rows, col_categories: categories.cols }

      let { data: newPuzzle, error } = await supabase.from('puzzles').insert(insertPayload).select().single()

      if (error) {
        if (error.code === '23505' && mode === 'daily') {
          // Race condition — use what was already inserted
          const existing = await getExistingDailyPuzzle(supabase, getTodayDate())
          if (existing) {
            const cellMetadata: PuzzleCellMetadata[] = existing.cell_metadata ?? categories.cellMetadata
            await send({ type: 'progress', pct: 100, message: 'Board ready.' })
            await send({
              type: 'puzzle',
              puzzle: {
                ...existing,
                row_categories: sanitizeCategories(existing.row_categories),
                col_categories: sanitizeCategories(existing.col_categories),
                cell_metadata: cellMetadata,
              },
            })
            return
          }
        }
        throw error
      }

      await send({ type: 'progress', pct: 100, message: 'Board ready.' })
      await send({
        type: 'puzzle',
        puzzle: {
          ...newPuzzle,
          row_categories: sanitizeCategories(categories.rows),
          col_categories: sanitizeCategories(categories.cols),
          validation_status: categories.validationStatus,
          validation_message: categories.validationMessage,
          cell_metadata: categories.cellMetadata,
        },
      })
    } catch (err) {
      console.error('[v0] puzzle-stream error:', err)
      await send({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      await writer.close()
    }
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}