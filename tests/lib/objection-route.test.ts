import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  activateGeminiPrimaryFallbackMock,
  getGeminiPrimaryFallbackStateMock,
  getIGDBFamilyNamesMock,
  logErrorMock,
  logInfoMock,
  logWarnMock,
} = vi.hoisted(() => ({
  activateGeminiPrimaryFallbackMock: vi.fn(),
  getGeminiPrimaryFallbackStateMock: vi.fn(),
  getIGDBFamilyNamesMock: vi.fn(),
  logErrorMock: vi.fn(),
  logInfoMock: vi.fn(),
  logWarnMock: vi.fn(),
}))

vi.mock('@/lib/igdb', () => ({
  getIGDBFamilyNames: getIGDBFamilyNamesMock,
}))

vi.mock('@/lib/gemini-primary-health', () => ({
  activateGeminiPrimaryFallback: activateGeminiPrimaryFallbackMock,
  getGeminiObjectionModels: ({
    primaryModel,
    fallbackModel,
    healthState,
    now,
  }: {
    primaryModel: string
    fallbackModel: string | null
    healthState: { preferFallbackUntil: string; model: string; reason: string | null } | null
    now?: number
  }) => {
    if (!fallbackModel) {
      return [primaryModel]
    }

    if (
      healthState &&
      healthState.model === primaryModel &&
      Date.parse(healthState.preferFallbackUntil) > (now ?? Date.now())
    ) {
      return Array.from(new Set([fallbackModel, primaryModel]))
    }

    return Array.from(new Set([primaryModel, fallbackModel]))
  },
  getGeminiPrimaryFallbackState: getGeminiPrimaryFallbackStateMock,
}))

vi.mock('@/lib/logging', () => ({
  logError: logErrorMock,
  logInfo: logInfoMock,
  logWarn: logWarnMock,
  createRequestLogger: () => ({
    requestId: 'test-id',
    info: logInfoMock,
    warn: logWarnMock,
    error: logErrorMock,
  }),
}))

const originalEnv = { ...process.env }

function buildRequest() {
  return new NextRequest('http://localhost/api/objection', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      guess: {
        gameId: 43,
        gameName: 'Deus Ex: Human Revolution',
        gameSlug: 'deus-ex-human-revolution',
        gameImage: null,
        isCorrect: false,
        released: '2011-08-23',
        genres: ['Role-playing (RPG)', 'Shooter'],
        platforms: ['PlayStation 3', 'PC (Microsoft Windows)'],
        developers: ['Eidos Montreal'],
        publishers: ['Square Enix'],
        companies: ['Square Enix', 'Eidos Montreal'],
        gameModes: ['Single player'],
        perspectives: ['First person'],
        themes: ['Science fiction'],
        matchedRow: false,
        matchedCol: true,
      },
      rowCategory: {
        type: 'company',
        id: 'square-enix',
        name: 'Square Enix',
      },
      colCategory: {
        type: 'perspective',
        id: 1,
        name: 'First person',
      },
    }),
  })
}

function buildGeminiResponse() {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  verdict: 'overruled',
                  confidence: 'high',
                  explanation: 'The app rejection is probably correct.',
                  suspectedMissingMetadata: null,
                }),
              },
            ],
          },
        },
      ],
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

interface ParsedObjectionGeminiRequest {
  systemInstruction?: { parts?: Array<{ text?: string }> }
  generationConfig?: { thinkingConfig?: Record<string, unknown> }
  tools?: unknown[]
}

function getSystemPrompt(requestBody: ParsedObjectionGeminiRequest | null): string {
  return requestBody?.systemInstruction?.parts?.[0]?.text ?? ''
}

describe('/api/objection route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = {
      ...originalEnv,
      GEMINI_KEY: 'test-gemini-key',
    }
    getIGDBFamilyNamesMock.mockResolvedValue([])
    getGeminiPrimaryFallbackStateMock.mockResolvedValue(null)
    activateGeminiPrimaryFallbackMock.mockResolvedValue({
      preferFallbackUntil: '2026-04-20T00:20:00.000Z',
      model: 'gemini-flash-lite-latest',
      reason: 'timeout',
    })
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllGlobals()
  })

  it('defaults to high thinking without Google search grounding', async () => {
    let requestBody: ParsedObjectionGeminiRequest | null = null
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body))
      return buildGeminiResponse()
    })
    vi.stubGlobal('fetch', fetchMock)

    const { POST } = await import('@/app/api/objection/route')
    const response = await POST(buildRequest())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      verdict: 'overruled',
      confidence: 'high',
      explanation: 'The app rejection is probably correct.',
      suspectedMissingMetadata: null,
      proof: null,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(requestBody).toMatchObject({
      generationConfig: {
        thinkingConfig: {
          thinkingLevel: 'high',
        },
      },
    })
    expect(requestBody).not.toHaveProperty('tools')
  })

  it('supports opt-in Google search grounding and thinking overrides for Gemini 3.1 Flash-Lite', async () => {
    process.env.GEMINI_OBJECTION_ENABLE_SEARCH_GROUNDING = '1'
    process.env.GEMINI_OBJECTION_THINKING_LEVEL = 'minimal'

    let requestBody: ParsedObjectionGeminiRequest | null = null
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body))
      return buildGeminiResponse()
    })
    vi.stubGlobal('fetch', fetchMock)

    const { POST } = await import('@/app/api/objection/route')
    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(requestBody).toMatchObject({
      generationConfig: {
        thinkingConfig: {
          thinkingLevel: 'minimal',
        },
      },
      tools: [{ googleSearch: {} }],
    })
    const systemPrompt = getSystemPrompt(requestBody)
    expect(systemPrompt).toContain('EVIDENCE HIERARCHY (MANDATORY)')
  })

  it('returns a proof for sustained verdicts', async () => {
    process.env.OBJECTION_PROOF_SECRET = 'test-proof-secret'

    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        verdict: 'sustained',
                        confidence: 'high',
                        explanation: 'The app rejection is wrong.',
                        suspectedMissingMetadata: null,
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
    )
    vi.stubGlobal('fetch', fetchMock)

    const { POST } = await import('@/app/api/objection/route')
    const response = await POST(buildRequest())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      verdict: 'sustained',
      confidence: 'high',
      explanation: 'The app rejection is wrong.',
      suspectedMissingMetadata: null,
      proof: expect.any(String),
    })
  })

  it('uses thinking budgets for explicit Gemini 2.5 models', async () => {
    process.env.GEMINI_MODEL = 'gemini-2.5-flash-lite'
    process.env.GEMINI_OBJECTION_THINKING_LEVEL = 'minimal'

    let requestBody: ParsedObjectionGeminiRequest | null = null
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body))
      return buildGeminiResponse()
    })
    vi.stubGlobal('fetch', fetchMock)

    const { POST } = await import('@/app/api/objection/route')
    const response = await POST(buildRequest())
    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(requestBody).toMatchObject({
      generationConfig: {
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    })
    expect(requestBody).not.toMatchObject({
      generationConfig: {
        thinkingConfig: {
          thinkingLevel: expect.anything(),
        },
      },
    })
    const systemPrompt = getSystemPrompt(requestBody)
    expect(systemPrompt).toContain('Search/grounding is the strongest evidence when available.')
    expect(systemPrompt).not.toContain('EVIDENCE HIERARCHY (MANDATORY)')
  })

  it('accepts grounded narrative verdicts from Gemini 2.5 without falling back to standard', async () => {
    process.env.GEMINI_MODEL = 'gemini-2.5-flash-lite'
    process.env.GEMINI_OBJECTION_ENABLE_SEARCH_GROUNDING = '1'
    process.env.GEMINI_OBJECTION_THINKING_LEVEL = 'minimal'

    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: [
                        'Cloning Clyde is a side-scrolling platformer.',
                        'The game was released on Xbox 360.',
                        'The verdict is sustained.',
                      ].join(' '),
                    },
                  ],
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
    )
    vi.stubGlobal('fetch', fetchMock)

    const { POST } = await import('@/app/api/objection/route')
    const response = await POST(buildRequest())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      verdict: 'sustained',
      confidence: 'medium',
      explanation:
        'Cloning Clyde is a side-scrolling platformer. The game was released on Xbox 360. The verdict is sustained.',
      suspectedMissingMetadata: null,
      proof: null,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('activates fallback cooldown when the primary request throws before the fallback succeeds', async () => {
    process.env.GEMINI_MODEL = 'gemini-flash-lite-latest'
    process.env.GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash-lite'

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('This operation was aborted'))
      .mockResolvedValueOnce(buildGeminiResponse())
    vi.stubGlobal('fetch', fetchMock)

    const { POST } = await import('@/app/api/objection/route')
    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(activateGeminiPrimaryFallbackMock).toHaveBeenCalledWith({
      primaryModel: 'gemini-flash-lite-latest',
      cooldownMs: 1_200_000,
      reason: 'This operation was aborted',
    })
  })

  it('activates fallback cooldown when the primary returns 5xx before the fallback succeeds', async () => {
    process.env.GEMINI_MODEL = 'gemini-flash-lite-latest'
    process.env.GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash-lite'

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'This model is overloaded.' } }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(buildGeminiResponse())
    vi.stubGlobal('fetch', fetchMock)

    const { POST } = await import('@/app/api/objection/route')
    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(activateGeminiPrimaryFallbackMock).toHaveBeenCalledWith({
      primaryModel: 'gemini-flash-lite-latest',
      cooldownMs: 1_200_000,
      reason: 'This model is overloaded.',
    })
  })

  it('activates fallback cooldown when grounded primary responses are empty before fallback succeeds', async () => {
    process.env.GEMINI_MODEL = 'gemini-flash-lite-latest'
    process.env.GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash-lite'
    process.env.GEMINI_OBJECTION_ENABLE_SEARCH_GROUNDING = '1'
    process.env.GEMINI_OBJECTION_THINKING_LEVEL = 'minimal'

    const buildEmptyGroundedResponse = () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: { role: 'model' },
              finishReason: 'STOP',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(buildEmptyGroundedResponse())
      .mockResolvedValueOnce(buildEmptyGroundedResponse())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Primary standard failed.' } }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(buildGeminiResponse())
    vi.stubGlobal('fetch', fetchMock)

    const { POST } = await import('@/app/api/objection/route')
    const response = await POST(buildRequest())

    expect(response.status).toBe(502)
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(activateGeminiPrimaryFallbackMock).toHaveBeenCalledWith({
      primaryModel: 'gemini-flash-lite-latest',
      cooldownMs: 1_200_000,
      reason: 'empty_content',
    })
  })
})
