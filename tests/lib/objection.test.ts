import { describe, expect, it } from 'vitest'
import {
  buildObjectionDataset,
  extractGeminiText,
  normalizeObjectionResponse,
  OBJECTION_SYSTEM_PROMPT,
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

describe('OBJECTION_SYSTEM_PROMPT', () => {
  it('describes the required structured response', () => {
    expect(OBJECTION_SYSTEM_PROMPT).toContain('Return JSON only')
    expect(OBJECTION_SYSTEM_PROMPT).toContain('"verdict":"sustained|overruled"')
    expect(OBJECTION_SYSTEM_PROMPT).toContain('familyNames')
    expect(OBJECTION_SYSTEM_PROMPT).toContain(
      'Every game in the payload is a real, official game title'
    )
    expect(OBJECTION_SYSTEM_PROMPT).toContain(
      'Use the category validation questions as the main standard'
    )
    expect(OBJECTION_SYSTEM_PROMPT).toContain(
      'The appMetadata block is useful but known to be incomplete, imperfect, or mismapped'
    )
    expect(OBJECTION_SYSTEM_PROMPT).toContain(
      'If model grounding/search evidence is available, prefer that evidence'
    )
    expect(OBJECTION_SYSTEM_PROMPT).toContain(
      'If the selected game or any clearly related family variant directly fits both categories'
    )
    expect(OBJECTION_SYSTEM_PROMPT).toContain(
      'If a clearly related family edition or expansion officially adds the disputed category fit'
    )
    expect(OBJECTION_SYSTEM_PROMPT).toContain('Do not require every variant to match')
    expect(OBJECTION_SYSTEM_PROMPT).toContain(
      'do not require the perspective to be the default camera'
    )
    expect(OBJECTION_SYSTEM_PROMPT).toContain(
      'Do not overrule only because a qualifying fit is optional, post-launch, less commonly used'
    )
    expect(OBJECTION_SYSTEM_PROMPT).toContain(
      'Do not sustain based on loose association, technicalities, indirect relationships'
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
})
