import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getIGDBFamilyNamesMock, logErrorMock, logInfoMock, logWarnMock } = vi.hoisted(() => ({
  getIGDBFamilyNamesMock: vi.fn(),
  logErrorMock: vi.fn(),
  logInfoMock: vi.fn(),
  logWarnMock: vi.fn(),
}))

vi.mock('@/lib/igdb', () => ({
  getIGDBFamilyNames: getIGDBFamilyNamesMock,
}))

vi.mock('@/lib/logging', () => ({
  logError: logErrorMock,
  logInfo: logInfoMock,
  logWarn: logWarnMock,
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

describe('/api/objection route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = {
      ...originalEnv,
      GEMINI_KEY: 'test-gemini-key',
    }
    getIGDBFamilyNamesMock.mockResolvedValue([])
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllGlobals()
  })

  it('defaults to high thinking without Google search grounding', async () => {
    let requestBody: Record<string, unknown> | null = null
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

    let requestBody: Record<string, unknown> | null = null
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
  })

  it('uses thinking budgets for explicit Gemini 2.5 models', async () => {
    process.env.GEMINI_MODEL = 'gemini-2.5-flash-lite'
    process.env.GEMINI_OBJECTION_THINKING_LEVEL = 'minimal'

    let requestBody: Record<string, unknown> | null = null
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
  })
})
