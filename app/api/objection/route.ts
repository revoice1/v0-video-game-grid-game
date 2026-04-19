import { NextRequest, NextResponse } from 'next/server'
import { getIGDBFamilyNames } from '@/lib/igdb'
import { createRequestLogger } from '@/lib/logging'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  buildObjectionDataset,
  extractGeminiText,
  hasGeminiEmptyContent,
  normalizeObjectionResponse,
  OBJECTION_SYSTEM_PROMPT,
} from '@/lib/objection'
import { createObjectionProof } from '@/lib/objection-proof'
import type { Category, CellGuess } from '@/lib/types'

const GEMINI_KEY = process.env.GEMINI_KEY
const GEMINI_MODEL = (process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite-preview')
  .replace(/^models\//, '')
  .trim()
const GEMINI_FALLBACK_MODEL = (process.env.GEMINI_FALLBACK_MODEL ?? '')
  .replace(/^models\//, '')
  .trim()
const GEMINI_MODELS = Array.from(
  new Set([GEMINI_MODEL, GEMINI_FALLBACK_MODEL].filter((model) => model.length > 0))
)
const GEMINI_TIMEOUT_MS = 10_000
const IS_DEV = process.env.NODE_ENV !== 'production'
const GROUNDED_MAX_ATTEMPTS = 2
const DEFAULT_THINKING_LEVEL = 'HIGH'
const SUPPORTED_THINKING_LEVELS = new Set(['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'])
const GEMINI_3_LATEST_ALIASES = new Set(['gemini-flash-lite-latest'])

function isSearchGroundingEnabled(value: string | undefined): boolean {
  if (!value) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true'
}

function getThinkingLevel(value: string | undefined): string {
  const normalized = value?.trim().toUpperCase()
  if (normalized && SUPPORTED_THINKING_LEVELS.has(normalized)) {
    return normalized
  }

  return DEFAULT_THINKING_LEVEL
}

const ENABLE_SEARCH_GROUNDING = isSearchGroundingEnabled(
  process.env.GEMINI_OBJECTION_ENABLE_SEARCH_GROUNDING
)
const THINKING_LEVEL = getThinkingLevel(process.env.GEMINI_OBJECTION_THINKING_LEVEL)

function isGemini3Model(model: string): boolean {
  return /^gemini-3(?:[.-]|$)/.test(model) || GEMINI_3_LATEST_ALIASES.has(model)
}

function isGemini25Model(model: string): boolean {
  return /^gemini-2\.5(?:[.-]|$)/.test(model)
}

function getGemini25ThinkingBudget(model: string, level: string): number {
  if (model.includes('flash-lite')) {
    switch (level) {
      case 'MINIMAL':
        return 0
      case 'LOW':
        return 512
      case 'MEDIUM':
        return 4096
      case 'HIGH':
      default:
        return 24576
    }
  }

  switch (level) {
    case 'MINIMAL':
      return 0
    case 'LOW':
      return 1024
    case 'MEDIUM':
      return 8192
    case 'HIGH':
    default:
      return 24576
  }
}

function getGeminiThinkingConfig(
  model: string,
  level: string
): {
  thinkingLevel?: string
  thinkingBudget?: number
} {
  if (isGemini25Model(model)) {
    return {
      thinkingBudget: getGemini25ThinkingBudget(model, level),
    }
  }

  if (isGemini3Model(model)) {
    return {
      thinkingLevel: level.toLowerCase(),
    }
  }

  return {
    thinkingLevel: level.toLowerCase(),
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 10 objection requests per IP per minute
const OBJECTION_RATE_LIMIT = { limit: 10, windowMs: 60_000 }

export async function POST(request: NextRequest) {
  const logger = createRequestLogger()

  if (!GEMINI_KEY) {
    return NextResponse.json({ error: 'Objection review is not configured yet.' }, { status: 503 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(`objection:${ip}`, OBJECTION_RATE_LIMIT)) {
    logger.warn('Objection rate limit exceeded', { ip })
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  try {
    const body = (await request.json()) as {
      guess?: CellGuess | null
      rowCategory?: Category | null
      colCategory?: Category | null
    }

    if (!body.guess || !body.rowCategory || !body.colCategory) {
      return NextResponse.json({ error: 'Missing objection context.' }, { status: 400 })
    }

    const familyNames = await getIGDBFamilyNames(body.guess.gameId)
    const dataset = buildObjectionDataset(
      body.guess,
      body.rowCategory,
      body.colCategory,
      familyNames
    )
    const datasetForPrompt = JSON.stringify(dataset, null, 2)
    const familyNamesPreview = dataset.familyNames.slice(0, 12)
    const familyNamesRemainder =
      dataset.familyNames.length > familyNamesPreview.length
        ? dataset.familyNames.length - familyNamesPreview.length
        : 0

    logger.info('Objection review dataset summary', {
      gameId: body.guess.gameId,
      gameName: body.guess.gameName,
      rowCategory: body.rowCategory.name,
      colCategory: body.colCategory.name,
      familyCount: dataset.familyNames.length,
      familyNamesPreview,
      familyNamesRemainder,
      metadataCounts: {
        genres: dataset.appMetadata.genres.length,
        platforms: dataset.appMetadata.platforms.length,
        developers: dataset.appMetadata.developers.length,
        publishers: dataset.appMetadata.publishers.length,
        gameModes: dataset.appMetadata.gameModes.length,
        themes: dataset.appMetadata.themes.length,
        perspectives: dataset.appMetadata.perspectives.length,
      },
      promptBytes: datasetForPrompt.length,
      groundingEnabled: ENABLE_SEARCH_GROUNDING,
      thinkingConfig: getGeminiThinkingConfig(GEMINI_MODEL, THINKING_LEVEL),
      fallbackModel: GEMINI_FALLBACK_MODEL || null,
    })

    let geminiResponse: Response | null = null
    let lastErrorText = ''
    let lastErrorMessage = ''
    let lastModelUsed = GEMINI_MODEL
    for (const model of GEMINI_MODELS) {
      lastModelUsed = model
      let modelProducedValidJudgment = false
      const baseThinkingConfig = getGeminiThinkingConfig(model, THINKING_LEVEL)
      const requestBodyBase = {
        systemInstruction: {
          parts: [{ text: OBJECTION_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: datasetForPrompt }],
          },
        ],
      }
      const tools = [{ googleSearch: {} }]
      const requestVariants: Array<{
        label: 'grounded' | 'standard'
        body: Record<string, unknown>
      }> = ENABLE_SEARCH_GROUNDING
        ? [
            {
              label: 'grounded',
              body: {
                ...requestBodyBase,
                tools,
                generationConfig: {
                  temperature: 0.1,
                  ...(isGemini25Model(model) ? {} : { responseMimeType: 'application/json' }),
                  thinkingConfig: baseThinkingConfig,
                },
              },
            },
            {
              label: 'standard',
              body: {
                ...requestBodyBase,
                generationConfig: {
                  temperature: 0.1,
                  responseMimeType: 'application/json',
                  thinkingConfig: baseThinkingConfig,
                },
              },
            },
          ]
        : [
            {
              label: 'standard',
              body: {
                ...requestBodyBase,
                generationConfig: {
                  temperature: 0.1,
                  responseMimeType: 'application/json',
                  thinkingConfig: baseThinkingConfig,
                },
              },
            },
          ]

      for (const requestVariant of requestVariants) {
        if (IS_DEV) {
          logger.info('Gemini objection outbound request', {
            model,
            variant: requestVariant.label,
            requestBody: requestVariant.body,
          })
        } else {
          logger.info('Gemini objection request', {
            model,
            variant: requestVariant.label,
            gameId: body.guess.gameId,
            rowCategory: body.rowCategory.name,
            colCategory: body.colCategory.name,
            familyCount: dataset.familyNames.length,
            familyNamesPreview,
            familyNamesRemainder,
            promptBytes: datasetForPrompt.length,
            thinkingConfig: baseThinkingConfig,
          })
        }
        const requestUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`
        if (IS_DEV) {
          logger.info('Gemini objection HTTP request', {
            url: requestUrl.replace(/key=[^&]+/, 'key=REDACTED'),
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestVariant.body,
          })
        }

        let response: Response | null = null
        const maxAttempts = requestVariant.label === 'grounded' ? GROUNDED_MAX_ATTEMPTS : 1
        let lastAttempt = 0
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          lastAttempt = attempt
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)
          try {
            response = await fetch(requestUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestVariant.body),
              signal: controller.signal,
            })
          } catch (error) {
            lastErrorText = ''
            lastErrorMessage = error instanceof Error ? error.message : String(error)
            logger.warn('Gemini objection request failed', {
              model,
              variant: requestVariant.label,
              status: null,
              message: lastErrorMessage,
            })
            response = null
            clearTimeout(timeoutId)
            break
          }
          clearTimeout(timeoutId)

          if (response.status !== 429 || attempt === maxAttempts) {
            break
          }

          const retryAfterHeader = response.headers.get('retry-after')
          const retryAfterSeconds = retryAfterHeader ? Number.parseFloat(retryAfterHeader) : NaN
          const retryDelayMs =
            Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
              ? Math.ceil(retryAfterSeconds * 1000)
              : 500

          logger.warn('Gemini grounded request rate-limited; retrying request', {
            model,
            variant: requestVariant.label,
            attempt,
            maxAttempts,
            retryAfterHeader: retryAfterHeader ?? null,
            retryDelayMs,
          })
          await sleep(retryDelayMs)
        }

        if (!response) {
          continue
        }

        if (response.ok) {
          const payload = (await response.json()) as unknown
          const extractedText = extractGeminiText(payload)
          const hasEmptyContent = hasGeminiEmptyContent(payload)
          const parsedJudgment = extractedText ? normalizeObjectionResponse(extractedText) : null
          if (
            !parsedJudgment?.verdict ||
            !parsedJudgment.confidence ||
            !parsedJudgment.explanation
          ) {
            lastErrorText = extractedText ?? ''
            lastErrorMessage = 'Gemini objection response was not parseable'
            logger.warn('Gemini objection response was not parseable', {
              model,
              variant: requestVariant.label,
              emptyContent: hasEmptyContent,
              extractedTextPreview: extractedText ? extractedText.slice(0, 500) : null,
              ...(IS_DEV ? { payload } : {}),
            })
            if (
              requestVariant.label === 'grounded' &&
              hasEmptyContent &&
              lastAttempt < maxAttempts
            ) {
              logger.warn('Gemini grounded response had empty content; retrying request', {
                model,
                variant: requestVariant.label,
                attempt: lastAttempt,
                maxAttempts,
              })
              response = null
              await sleep(250)
              continue
            }
            response = null
            continue
          }
          if (IS_DEV) {
            logger.info('Gemini objection raw response', {
              model,
              variant: requestVariant.label,
              payload: JSON.stringify(payload, null, 2),
              extractedText,
              parsedJudgment,
            })
            logger.info('Gemini objection verdict', {
              model,
              variant: requestVariant.label,
              verdict: parsedJudgment?.verdict ?? null,
              confidence: parsedJudgment?.confidence ?? null,
              explanation: parsedJudgment?.explanation ?? null,
              suspectedMissingMetadata: parsedJudgment?.suspectedMissingMetadata ?? null,
            })
          } else {
            logger.info('Gemini objection verdict', {
              model,
              variant: requestVariant.label,
              verdict: parsedJudgment?.verdict ?? null,
              confidence: parsedJudgment?.confidence ?? null,
              explanation: parsedJudgment?.explanation ?? null,
              suspectedMissingMetadata: parsedJudgment?.suspectedMissingMetadata ?? null,
            })
          }
          geminiResponse = new Response(JSON.stringify(payload), {
            status: response.status,
            headers: { 'Content-Type': 'application/json' },
          })
          modelProducedValidJudgment = true
          break
        }

        lastErrorText = await response.text()
        let parsedMessage: string | null = null
        if (lastErrorText) {
          try {
            const parsed = JSON.parse(lastErrorText) as {
              error?: { message?: string }
              message?: string
            }
            parsedMessage = parsed.error?.message ?? parsed.message ?? null
          } catch {
            parsedMessage = null
          }
        }
        lastErrorMessage = parsedMessage ?? ''
        logger.warn('Gemini objection request failed', {
          model,
          variant: requestVariant.label,
          status: response.status,
          message: parsedMessage ?? null,
          body: IS_DEV ? lastErrorText : undefined,
        })

        geminiResponse = response
        break
      }

      if (modelProducedValidJudgment && geminiResponse?.ok) {
        break
      }
    }

    if (!geminiResponse?.ok) {
      return NextResponse.json(
        {
          error:
            lastErrorText.includes('NOT_FOUND') || lastErrorMessage.includes('NOT_FOUND')
              ? 'No supported Gemini judgment model is configured.'
              : 'Judgment service is unavailable.',
        },
        { status: 502 }
      )
    }

    const payload = (await geminiResponse.json()) as unknown
    const text = extractGeminiText(payload)
    const judgment = text ? normalizeObjectionResponse(text) : null

    if (!judgment?.verdict || !judgment.confidence || !judgment.explanation) {
      logger.warn('Gemini objection response was not parseable', {
        model: lastModelUsed,
        ...(IS_DEV ? { payload } : {}),
      })
      return NextResponse.json(
        { error: 'Judgment service returned an invalid verdict.' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ...judgment,
      proof:
        judgment.verdict === 'sustained'
          ? createObjectionProof({
              gameId: body.guess.gameId,
              rowCategory: body.rowCategory,
              colCategory: body.colCategory,
              verdict: 'sustained',
            })
          : null,
    })
  } catch (error) {
    logger.error('Objection error', { error })
    return NextResponse.json({ error: 'Failed to review objection.' }, { status: 500 })
  }
}
