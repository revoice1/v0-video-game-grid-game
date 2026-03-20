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

async function computePuzzleCellMetadata(
  rows: Category[],
  cols: Category[],
  minValidOptionsPerCell: number,
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

function sseEvent(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

function generationProgress(
  event: Parameters<PuzzleProgressCallback>[0],
  maxAttempts: number
): { pct: number; message: string } {
  switch (event.stage) {
    case 'families':
      return { pct: 2, message: 'Loading category data...' }
    case 'attempt': {
      const pct = 5 + ((event.attempt ?? 1) - 1) / maxAttempts * 70
      return { pct: Math.round(pct), message: `Attempt ${event.attempt}/${maxAttempts}: picking categories...` }
    }
    case 'cell': {
      const attemptStart = 5 + ((event.attempt ?? 1) - 1) / maxAttempts * 70
      const attemptSlice = 70 / maxAttempts
      const cellFrac = ((event.cellIndex ?? 0) + 1) / (event.totalCells ?? 9)
      const pct = attemptStart + cellFrac * attemptSlice
      return {
        pct: Math.round(pct),
        message: `Attempt ${event.attempt}/${maxAttempts}: checking intersection ${(event.cellIndex ?? 0) + 1}/${event.totalCells ?? 9}...`,
      }
    }
    case 'metadata': {
      const pct = 75 + ((event.cellIndex ?? 0) + 1) / (event.totalCells ?? 9) * 20
      return { pct: Math.round(pct), message: `Validating cell ${(event.cellIndex ?? 0) + 1}/${event.totalCells ?? 9}...` }
    }
    case 'rejected': {
      const pct = 5 + ((event.attempt ?? 1) - 1) / maxAttempts * 70
      return {
        pct: Math.round(Math.max(8, pct)),
        message: event.message ?? `Attempt ${event.attempt}/${maxAttempts} rejected`,
      }
    }
    default:
      return { pct: 0, message: '' }
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('mode') || 'daily'
  const supabase = await createClient()

  const encoder = new TextEncoder()
  const stream = new TransformStream<string, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(encoder.encode(chunk))
    },
  })
  const writer = stream.writable.getWriter()
  const send = (data: object) => writer.write(sseEvent(data)).catch(() => {})

  ;(async () => {
    try {
      if (mode === 'daily') {
        const today = getTodayDate()
        const existingPuzzle = await getExistingDailyPuzzle(supabase, today)

        if (existingPuzzle) {
          let cellMetadata: PuzzleCellMetadata[] = existingPuzzle.cell_metadata

          if (!cellMetadata) {
            await send({ type: 'progress', pct: 10, message: "Loading today's board..." })
            cellMetadata = await computePuzzleCellMetadata(
              existingPuzzle.row_categories,
              existingPuzzle.col_categories,
              MIN_VALID_OPTIONS_PER_CELL,
              (cellIndex, total) => send({
                type: 'progress',
                pct: 10 + Math.round((cellIndex + 1) / total * 85),
                message: `Validating cell ${cellIndex + 1}/${total}...`,
              })
            )
            supabase.from('puzzles').update({ cell_metadata: cellMetadata }).eq('id', existingPuzzle.id).then()
          }

          await send({ type: 'progress', pct: 100, message: 'Board ready.' })
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
      }

      await send({ type: 'progress', pct: 0, message: 'Starting puzzle generation...' })

      const plans = getGenerationPlans()
      type GeneratedCategories = {
        rows: Category[]
        cols: Category[]
        validationStatus: string
        validationMessage: string | null
        cellMetadata: PuzzleCellMetadata[]
      }
      let categories: GeneratedCategories | null = null
      let lastError: Error | null = null

      for (const plan of plans) {
        try {
          const onProgress: PuzzleProgressCallback = (event) => {
            const { pct, message } = generationProgress(event, plan.maxAttempts)
            send({ type: 'progress', pct, message })
          }

          const { rows, cols, cellMetadata } = await generatePuzzleCategories({
            minValidOptionsPerCell: plan.minValidOptionsPerCell,
            maxAttempts: plan.maxAttempts,
            sampleSize: VALIDATION_SAMPLE_SIZE,
            onProgress,
          })

          categories = {
            rows,
            cols,
            validationStatus: plan.minValidOptionsPerCell !== MIN_VALID_OPTIONS_PER_CELL ? 'relaxed' : 'validated',
            validationMessage: plan.minValidOptionsPerCell !== MIN_VALID_OPTIONS_PER_CELL
              ? `Generated with relaxed validation (${plan.minValidOptionsPerCell}+ valid options per cell instead of ${MIN_VALID_OPTIONS_PER_CELL}+).`
              : null,
            cellMetadata,
          }
          break
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Unknown error')
          await send({ type: 'progress', pct: 10, message: 'Attempt failed, retrying with relaxed rules...' })
        }
      }

      if (!categories) throw lastError ?? new Error('Failed to generate puzzle')

      await send({ type: 'progress', pct: 95, message: 'Saving puzzle...' })

      const insertPayload = mode === 'daily'
        ? { date: getTodayDate(), is_daily: true, row_categories: categories.rows, col_categories: categories.cols, cell_metadata: categories.cellMetadata }
        : { date: null, is_daily: false, row_categories: categories.rows, col_categories: categories.cols }

      const { data: newPuzzle, error } = await supabase.from('puzzles').insert(insertPayload).select().single()

      if (error) {
        if (error.code === '23505' && mode === 'daily') {
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
