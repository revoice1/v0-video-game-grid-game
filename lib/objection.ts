import type { Category, CellGuess } from './types'

export type ObjectionVerdict = 'sustained' | 'overruled'
export type ObjectionConfidence = 'low' | 'medium' | 'high'

export interface ObjectionJudgment {
  verdict: ObjectionVerdict
  confidence: ObjectionConfidence
  explanation: string
  suspectedMissingMetadata: string | null
}

export interface ObjectionDataset {
  gameName: string
  releaseYear: number | null
  rowCategory: {
    name: string
    type: Category['type']
    validationQuestion: string
  }
  colCategory: {
    name: string
    type: Category['type']
    validationQuestion: string
  }
  appSignals: {
    matchedRow: boolean
    matchedCol: boolean
  }
  familyNames: string[]
}

interface GeminiResponsePart {
  text?: string
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiResponsePart[]
  }
}

interface GeminiPayload {
  candidates?: GeminiCandidate[]
}

function getReleaseYear(released?: string | null): number | null {
  if (!released) {
    return null
  }

  const year = Number.parseInt(released.slice(0, 4), 10)
  return Number.isFinite(year) ? year : null
}

function buildFamilyNames(guess: CellGuess): string[] {
  const values = [guess.gameName, guess.gameSlug]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim())

  return Array.from(new Set(values))
}

function buildCategoryValidationQuestion(category: Category): string {
  switch (category.type) {
    case 'company':
      return `Was this game developed or published by ${category.name}? Do not count platform ownership, brand association, or vague Sony/Nintendo/Microsoft adjacency.`
    case 'game_mode':
      return `Does this game have ${category.name} as a real supported mode of play? Do not count trivial side features, metadata quirks, or weak indirect multiplayer associations.`
    case 'perspective':
      return `Is ${category.name} one of this game's recognized gameplay perspectives?`
    case 'genre':
      return `Is this game commonly classified as ${category.name}?`
    case 'theme':
      return `Is ${category.name} a recognized theme of this game, not just a loose vibe or weak association?`
    case 'platform':
      return `Was this game officially released on ${category.name}?`
    case 'decade':
      return `Was this game first released during the ${category.name}?`
    default:
      return `Does this game clearly and directly fit the category ${category.name}?`
  }
}

export const OBJECTION_SYSTEM_PROMPT = [
  'You are reviewing a disputed video-game category judgment for a puzzle game.',
  'Your job is to decide whether the selected game should count for BOTH listed categories.',
  'Be conservative and prefer overruled when the evidence is weak or ambiguous.',
  'Sustain only when the game clearly and directly satisfies the category as a normal player would understand it.',
  'Do not sustain based on loose association, technicalities, platform ownership, franchise adjacency, optional/minor features, or niche edge-case interpretations.',
  'Do not over-weight incomplete app metadata.',
  'Treat the JSON payload as the full case file for this turn.',
  'The `familyNames` array contains alternate editions, ports, remasters, remakes, or expanded releases that belong to the same game family.',
  'Use those family variants as supporting evidence when judging the selected game, especially when one release name is better known than another.',
  'Do not require every variant to match the categories; use the family list to understand the broader identity of the game family.',
  'If the selected game OR any clearly related variant in `familyNames` includes both categories, that is valid evidence in favor of sustained.',
  'This includes special editions, expanded versions, ports, remasters, or alternate releases that add or expose a mode, perspective, platform, or company relationship relevant to the categories.',
  'Do not reject solely because the base release is better known for a different mode or perspective if a listed family variant clearly includes the disputed category.',
  'Return JSON only.',
  'Required JSON schema:',
  '{"verdict":"sustained|overruled","confidence":"low|medium|high","explanation":"string","suspectedMissingMetadata":"string|null"}',
  'Use "sustained" only when the player is likely correct and the rejection is probably caused by incomplete or mismapped metadata.',
  'Use "overruled" when the app rejection is probably correct or the evidence is too weak.',
  'Keep explanation under 45 words.',
].join('\n')

export function buildObjectionDataset(
  guess: CellGuess,
  rowCategory: Category,
  colCategory: Category,
  familyNames: string[] = []
): ObjectionDataset {
  const fallbackFamilyNames = buildFamilyNames(guess)

  return {
    gameName: guess.gameName,
    releaseYear: getReleaseYear(guess.released),
    rowCategory: {
      name: rowCategory.name,
      type: rowCategory.type,
      validationQuestion: buildCategoryValidationQuestion(rowCategory),
    },
    colCategory: {
      name: colCategory.name,
      type: colCategory.type,
      validationQuestion: buildCategoryValidationQuestion(colCategory),
    },
    appSignals: {
      matchedRow: Boolean(guess.matchedRow),
      matchedCol: Boolean(guess.matchedCol),
    },
    familyNames: familyNames.length > 0 ? Array.from(new Set(familyNames)) : fallbackFamilyNames,
  }
}

export function extractGeminiText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidates = (payload as GeminiPayload).candidates
  const text = candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim()

  return text || null
}

function cleanJsonResponse(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

export function normalizeObjectionResponse(text: string): ObjectionJudgment | null {
  try {
    const parsed = JSON.parse(cleanJsonResponse(text)) as Partial<ObjectionJudgment>

    if (parsed.verdict !== 'sustained' && parsed.verdict !== 'overruled') {
      return null
    }

    if (
      parsed.confidence !== 'low' &&
      parsed.confidence !== 'medium' &&
      parsed.confidence !== 'high'
    ) {
      return null
    }

    return {
      verdict: parsed.verdict,
      confidence: parsed.confidence,
      explanation:
        typeof parsed.explanation === 'string' && parsed.explanation.trim().length > 0
          ? parsed.explanation.trim()
          : 'No explanation provided.',
      suspectedMissingMetadata:
        typeof parsed.suspectedMissingMetadata === 'string' &&
        parsed.suspectedMissingMetadata.trim().length > 0
          ? parsed.suspectedMissingMetadata.trim()
          : null,
    }
  } catch {
    return null
  }
}
