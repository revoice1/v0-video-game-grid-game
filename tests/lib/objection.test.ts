import { describe, expect, it } from 'vitest'
import {
  buildObjectionDataset,
  extractGeminiText,
  getObjectionSystemPrompt,
  hasGeminiEmptyContent,
  normalizeObjectionResponse,
  OBJECTION_SYSTEM_PROMPT_GEMINI_25,
  OBJECTION_SYSTEM_PROMPT_GEMINI_3,
} from '@/lib/objection'
import type { Category, CellGuess } from '@/lib/types'

const guess: CellGuess = {
  gameId: 43,
  gameName: 'Deus Ex: Human Revolution',
  gameImage: null,
  isCorrect: false,
  released: '2011-08-23',
  metacritic: 89,
  platforms: ['PlayStation 3', 'PC (Microsoft Windows)'],
  genres: ['Role-playing (RPG)', 'Shooter'],
  developers: ['Eidos Montreal'],
  publishers: ['Square Enix'],
  companies: ['Square Enix', 'Eidos Montreal'],
  gameModes: ['Single player'],
  perspectives: ['First person'],
  themes: ['Science fiction'],
  matchedRow: false,
  matchedCol: true,
}

const rowCategory: Category = {
  type: 'company',
  id: 'square-enix',
  name: 'Square Enix',
}

const colCategory: Category = {
  type: 'perspective',
  id: 1,
  name: 'First person',
}

describe('buildObjectionDataset', () => {
  it('builds a compact dataset for the judgment model', () => {
    expect(buildObjectionDataset(guess, rowCategory, colCategory)).toEqual({
      gameName: 'Deus Ex: Human Revolution',
      releaseYear: 2011,
      appMetadata: {
        genres: ['Role-playing (RPG)', 'Shooter'],
        themes: ['Science fiction'],
        perspectives: ['First person'],
        gameModes: ['Single player'],
        platforms: ['PlayStation 3', 'PC (Microsoft Windows)'],
        companies: ['Square Enix', 'Eidos Montreal'],
        developers: ['Eidos Montreal'],
        publishers: ['Square Enix'],
      },
      rowCategory: {
        name: 'Square Enix',
        type: 'company',
        validationQuestion:
          'Was this game developed or published by Square Enix? Do not count platform ownership, brand association, or vague Sony/Nintendo/Microsoft adjacency.',
      },
      colCategory: {
        name: 'First person',
        type: 'perspective',
        validationQuestion:
          "Is First person one of this game's recognized gameplay perspectives? Count official modes/toggles that enable substantial gameplay (or a full campaign) in the named perspective, even when another camera style is the default.",
      },
      appSignals: {
        matchedRow: false,
        matchedCol: true,
      },
      familyNames: ['Deus Ex: Human Revolution'],
    })
  })

  it('prefers resolved family names when provided', () => {
    expect(
      buildObjectionDataset(guess, rowCategory, colCategory, [
        'Final Fantasy XV',
        'Final Fantasy XV: Royal Edition',
      ]).familyNames
    ).toEqual(['Final Fantasy XV', 'Final Fantasy XV: Royal Edition'])
  })
})

describe('objection system prompts', () => {
  it('keeps the richer guardrails for Gemini 3.x models', () => {
    expect(OBJECTION_SYSTEM_PROMPT_GEMINI_3).toContain('Return JSON only')
    expect(OBJECTION_SYSTEM_PROMPT_GEMINI_3).toContain('"verdict":"sustained|overruled"')
    expect(OBJECTION_SYSTEM_PROMPT_GEMINI_3).toContain('familyNames')
    expect(OBJECTION_SYSTEM_PROMPT_GEMINI_3).toContain(
      'Every game in the payload is a real, official game title'
    )
    expect(OBJECTION_SYSTEM_PROMPT_GEMINI_3).toContain(
      'Use the category validation questions as the main standard'
    )
    expect(OBJECTION_SYSTEM_PROMPT_GEMINI_3).toContain(
      'The appMetadata block is useful but known to be incomplete, imperfect, or mismapped'
    )
    expect(OBJECTION_SYSTEM_PROMPT_GEMINI_3).toContain(
      'If model grounding/search evidence is available, prefer that evidence'
    )
    expect(OBJECTION_SYSTEM_PROMPT_GEMINI_3).toContain(
      'If the selected game or any clearly related family variant directly fits both categories'
    )
    expect(OBJECTION_SYSTEM_PROMPT_GEMINI_3).toContain(
      'If a clearly related family edition or expansion officially adds the disputed category fit'
    )
    expect(OBJECTION_SYSTEM_PROMPT_GEMINI_3).toContain('Do not require every variant to match')
    expect(OBJECTION_SYSTEM_PROMPT_GEMINI_3).toContain(
      'do not require the perspective to be the default camera'
    )
    expect(OBJECTION_SYSTEM_PROMPT_GEMINI_3).toContain(
      'Do not overrule only because a qualifying fit is optional, post-launch, less commonly used'
    )
    expect(OBJECTION_SYSTEM_PROMPT_GEMINI_3).toContain(
      'Do not sustain based on loose association, technicalities, indirect relationships'
    )
  })

  it('uses a flatter lite prompt for Gemini 2.5 models', () => {
    expect(OBJECTION_SYSTEM_PROMPT_GEMINI_25).toContain(
      'Search/grounding is the strongest evidence when available.'
    )
    expect(OBJECTION_SYSTEM_PROMPT_GEMINI_25).toContain('If unsure, overrule.')
    expect(OBJECTION_SYSTEM_PROMPT_GEMINI_25).not.toContain('EVIDENCE HIERARCHY (MANDATORY)')
  })

  it('selects prompts by model family', () => {
    expect(getObjectionSystemPrompt('gemini-3.1-flash-lite-preview')).toBe(
      OBJECTION_SYSTEM_PROMPT_GEMINI_3
    )
    expect(getObjectionSystemPrompt('gemini-flash-lite-latest')).toBe(
      OBJECTION_SYSTEM_PROMPT_GEMINI_3
    )
    expect(getObjectionSystemPrompt('gemini-2.5-flash-lite')).toBe(
      OBJECTION_SYSTEM_PROMPT_GEMINI_25
    )
  })
})

describe('extractGeminiText', () => {
  it('returns the first candidate text payload', () => {
    expect(
      extractGeminiText({
        candidates: [
          {
            content: {
              parts: [{ text: '{"verdict":"sustained","confidence":"high","explanation":"test"}' }],
            },
          },
        ],
      })
    ).toContain('"verdict":"sustained"')
  })

  it('returns null for malformed payloads', () => {
    expect(extractGeminiText(null)).toBeNull()
    expect(extractGeminiText({})).toBeNull()
  })
})

describe('hasGeminiEmptyContent', () => {
  it('detects grounded responses that stop without any text parts', () => {
    expect(
      hasGeminiEmptyContent({
        candidates: [
          {
            content: {
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
      })
    ).toBe(true)
  })

  it('returns false for normal text responses', () => {
    expect(
      hasGeminiEmptyContent({
        candidates: [
          {
            content: {
              parts: [{ text: 'hello' }],
            },
            finishReason: 'STOP',
          },
        ],
      })
    ).toBe(false)
  })
})

describe('normalizeObjectionResponse', () => {
  it('parses a valid JSON response', () => {
    expect(
      normalizeObjectionResponse(
        '{"verdict":"sustained","confidence":"high","explanation":"The game is widely first-person.","suspectedMissingMetadata":"player perspective"}'
      )
    ).toEqual({
      verdict: 'sustained',
      confidence: 'high',
      explanation: 'The game is widely first-person.',
      suspectedMissingMetadata: 'player perspective',
    })
  })

  it('accepts fenced JSON and normalizes empty missing metadata', () => {
    expect(
      normalizeObjectionResponse(`\`\`\`json
{"verdict":"overruled","confidence":"medium","explanation":"The rejection is probably correct.","suspectedMissingMetadata":""}
\`\`\``)
    ).toEqual({
      verdict: 'overruled',
      confidence: 'medium',
      explanation: 'The rejection is probably correct.',
      suspectedMissingMetadata: null,
    })
  })

  it('rejects invalid verdicts', () => {
    expect(
      normalizeObjectionResponse(
        '{"verdict":"maybe","confidence":"high","explanation":"Nope","suspectedMissingMetadata":null}'
      )
    ).toBeNull()
  })

  it('parses grounded narrative verdicts when Gemini ignores the JSON format', () => {
    expect(
      normalizeObjectionResponse(
        [
          'Cloning Clyde is a side-scrolling platformer.',
          'The game was released on Xbox 360.',
          'The perspective is side-view.',
          'The verdict is sustained.',
          'The game is a side-scrolling platformer, confirming the "Side view" perspective.',
        ].join(' ')
      )
    ).toEqual({
      verdict: 'sustained',
      confidence: 'medium',
      explanation:
        'Cloning Clyde is a side-scrolling platformer. The game was released on Xbox 360. The perspective is side-view. The verdict is sustained. The game is a side-scrolling platformer, confirming the "Side view" perspective.',
      suspectedMissingMetadata: null,
    })
  })

  it('prefers labeled explanation text over a huge mixed narrative blob', () => {
    expect(
      normalizeObjectionResponse(
        [
          'Some long grounded explanation about GameCube and fan mods.',
          '**Verdict**: overruled',
          '**Confidence**: high',
          '**Explanation**: The game was officially released on the GameCube, not the Wii. It is a racing game.',
          '**Suspected Missing Metadata**: null',
          'Then the model rambles for another paragraph about unofficial mods and rowCategory and colCategory.',
        ].join(' ')
      )
    ).toEqual({
      verdict: 'overruled',
      confidence: 'high',
      explanation:
        'The game was officially released on the GameCube, not the Wii. It is a racing game.',
      suspectedMissingMetadata: null,
    })
  })
})
