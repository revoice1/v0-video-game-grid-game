import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  generatePuzzleCategories,
  type PuzzleCategoryFilters,
  type PuzzleProgressCallback,
} from '@/lib/igdb'
import { logError } from '@/lib/logging'
import {
  computePuzzleCellMetadata,
  getExistingDailyPuzzle,
  getTodayDate,
  sanitizeCategories,
} from '@/lib/puzzle-api'
import {
  getAnonymousSessionCookieHeader,
  getLegacySessionIdFromRequest,
  resolveAnonymousSession,
} from '@/lib/server-session'
import { buildGenerationPlans } from '@/lib/puzzle-generation-plans'
import { sanitizeMinValidOptionsOverride } from '@/lib/min-valid-options'
import { getMinValidOptionsDefaultFromEnv } from '@/lib/min-valid-options-server'
import type { Category, PuzzleCellMetadata } from '@/lib/types'

const MIN_VALID_OPTIONS_PER_CELL = getMinValidOptionsDefaultFromEnv()
const MAX_GENERATION_ATTEMPTS = Number(process.env.PUZZLE_GENERATION_MAX_ATTEMPTS ?? '12')
const VALIDATION_SAMPLE_SIZE = Number(process.env.PUZZLE_VALIDATION_SAMPLE_SIZE ?? '40')

function createEphemeralPuzzleId(): string {
  return `practice-${crypto.randomUUID()}`
}

function sseEvent(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

function generationProgress(
  event: Parameters<PuzzleProgressCallback>[0],
  maxAttempts: number
): { pct: number; message: string } {
  const generationStartPct = 10
  const generationSpan = 18
  const validationSpan = 50
  const metadataStartPct = 78
  const metadataEndPct = 94

  switch (event.stage) {
    case 'families':
      return { pct: 4, message: 'Loading category data...' }
    case 'attempt': {
      const pct =
        generationStartPct +
        (((event.attempt ?? 1) - 1) / Math.max(maxAttempts, 1)) * generationSpan
      return {
        pct: Math.round(pct),
        message: `Attempt ${event.attempt}/${maxAttempts}: picking categories...`,
      }
    }
    case 'cell': {
      const attemptStart =
        generationStartPct +
        (((event.attempt ?? 1) - 1) / Math.max(maxAttempts, 1)) * generationSpan
      const cellFrac = ((event.cellIndex ?? 0) + 1) / (event.totalCells ?? 9)
      const pct = attemptStart + cellFrac * validationSpan
      return {
        pct: Math.round(pct),
        message: `Attempt ${event.attempt}/${maxAttempts}: checking intersection ${(event.cellIndex ?? 0) + 1}/${event.totalCells ?? 9}...`,
      }
    }
    case 'metadata': {
      const pct =
        metadataStartPct +
        (((event.cellIndex ?? 0) + 1) / (event.totalCells ?? 9)) *
          (metadataEndPct - metadataStartPct)
      return {
        pct: Math.round(pct),
        message:
          event.message ??
          `Counting answers for cell ${(event.cellIndex ?? 0) + 1}/${event.totalCells ?? 9}...`,
      }
    }
    case 'rejected': {
      const pct =
        generationStartPct +
        ((event.attempt ?? 1) / Math.max(maxAttempts, 1)) * generationSpan +
        validationSpan
      return {
        pct: Math.round(Math.max(generationStartPct, pct)),
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
  const rawFilters = searchParams.get('filters')
  const rawMinValidOptions = searchParams.get('minValidOptions')
  const supabase = await createClient()
  const resolvedSession = resolveAnonymousSession(request, getLegacySessionIdFromRequest(request))
  const allowedCategoryIds = rawFilters
    ? (JSON.parse(rawFilters) as PuzzleCategoryFilters)
    : undefined
  const parsedMinValidOptions = rawMinValidOptions ? Number(rawMinValidOptions) : Number.NaN
  const requestedMinValidOptions = Number.isFinite(parsedMinValidOptions)
    ? parsedMinValidOptions
    : null
  const sanitizedMinValidOptionsOverride = sanitizeMinValidOptionsOverride(
    requestedMinValidOptions,
    MIN_VALID_OPTIONS_PER_CELL
  )
  const minValidOptionsPerCellBase =
    mode !== 'daily' && sanitizedMinValidOptionsOverride !== null
      ? sanitizedMinValidOptionsOverride
      : MIN_VALID_OPTIONS_PER_CELL

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
              VALIDATION_SAMPLE_SIZE,
              (cellIndex, total) =>
                send({
                  type: 'progress',
                  pct: 10 + Math.round(((cellIndex + 1) / total) * 85),
                  message: `Validating cell ${cellIndex + 1}/${total}...`,
                })
            )
            supabase
              .from('puzzles')
              .update({ cell_metadata: cellMetadata })
              .eq('id', existingPuzzle.id)
              .then()
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

      await send({ type: 'progress', pct: 2, message: 'Starting puzzle generation...' })

      const plans = buildGenerationPlans(minValidOptionsPerCellBase, MAX_GENERATION_ATTEMPTS)
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
            send({
              type: 'progress',
              pct,
              message,
              stage: event.stage,
              attempt: event.attempt,
              rows: event.rows,
              cols: event.cols,
              cellIndex: event.cellIndex,
              rowCategory: event.rowCategory,
              colCategory: event.colCategory,
              validOptionCount: event.validOptionCount,
              passed: event.passed,
            })
          }

          const { rows, cols, cellMetadata } = await generatePuzzleCategories({
            minValidOptionsPerCell: plan.minValidOptionsPerCell,
            maxAttempts: plan.maxAttempts,
            sampleSize: VALIDATION_SAMPLE_SIZE,
            allowedCategoryIds,
            onProgress,
          })

          categories = {
            rows,
            cols,
            validationStatus:
              plan.minValidOptionsPerCell !== minValidOptionsPerCellBase ? 'relaxed' : 'validated',
            validationMessage:
              plan.minValidOptionsPerCell !== minValidOptionsPerCellBase
                ? `Generated with relaxed validation (${plan.minValidOptionsPerCell}+ valid options per cell instead of ${minValidOptionsPerCellBase}+).`
                : null,
            cellMetadata,
          }
          break
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Unknown error')
          await send({
            type: 'progress',
            pct: 12,
            message: 'Attempt failed, retrying with relaxed rules...',
          })
        }
      }

      if (!categories) throw lastError ?? new Error('Failed to generate puzzle')

      if (mode !== 'daily') {
        await send({ type: 'progress', pct: 100, message: 'Board ready.' })
        await send({
          type: 'puzzle',
          puzzle: {
            id: createEphemeralPuzzleId(),
            date: null,
            is_daily: false,
            created_at: new Date().toISOString(),
            row_categories: sanitizeCategories(categories.rows),
            col_categories: sanitizeCategories(categories.cols),
            validation_status: categories.validationStatus,
            validation_message: categories.validationMessage,
            cell_metadata: categories.cellMetadata,
          },
        })
        return
      }

      await send({ type: 'progress', pct: 96, message: 'Saving puzzle...' })

      const { data: newPuzzle, error } = await supabase
        .from('puzzles')
        .insert({
          date: getTodayDate(),
          is_daily: true,
          row_categories: categories.rows,
          col_categories: categories.cols,
          cell_metadata: categories.cellMetadata,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          const existing = await getExistingDailyPuzzle(supabase, getTodayDate())
          if (existing) {
            const cellMetadata: PuzzleCellMetadata[] =
              existing.cell_metadata ?? categories.cellMetadata
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
      logError('puzzle-stream error:', err)
      await send({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      await writer.close().catch(() => {})
    }
  })()

  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  const sessionCookieHeader = getAnonymousSessionCookieHeader(resolvedSession, request)
  if (sessionCookieHeader) {
    headers.set('Set-Cookie', sessionCookieHeader)
  }

  return new Response(stream.readable, { headers })
}
