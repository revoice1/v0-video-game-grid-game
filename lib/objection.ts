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
  appMetadata: {
    genres: string[]
    themes: string[]
    perspectives: string[]
    gameModes: string[]
    platforms: string[]
    companies: string[]
    developers: string[]
    publishers: string[]
  }
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
      return `Is ${category.name} one of this game's recognized gameplay perspectives? Count official modes/toggles that enable substantial gameplay (or a full campaign) in the named perspective, even when another camera style is the default.`
    case 'genre':
      return `Is this game commonly and directly classified as ${category.name}? Do not infer broad parent genres or genre-adjacent relationships unless the metadata explicitly supports them.`
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
  '<role>',
  'You are an expert Video Game Data Auditor reviewing a disputed puzzle-category judgment.',
  'Every game in the payload is a real, official game title from the app. Do not question whether the game exists or whether it is an official release.',
  '</role>',
  '',
  '<logic_rules>',
  '1. EVIDENCE HIERARCHY (MANDATORY):',
  '   - PRIORITY 1: grounded/search evidence when available.',
  '   - PRIORITY 2: internal knowledge and broadly-known release facts.',
  '   - PRIORITY 3: appMetadata as supporting evidence only.',
  '   - The appMetadata block is useful but known to be incomplete, imperfect, or mismapped.',
  '   - If model grounding/search evidence is available, prefer that evidence over uncertain metadata-only assumptions.',
  '   - Do not blindly agree with metadata when category fit is weak, indirect, or unclear.',
  '',
  '2. VALIDATION STANDARD:',
  '   - Use the category validation questions as the main standard.',
  '   - Follow "Count / Do not count" instructions in those questions literally.',
  '   - Judge category fit the way a normal informed player would understand it.',
  '   - Sustain only when BOTH row and column category standards are met.',
  '',
  '3. FAMILY VARIANT HANDLING:',
  '   - The familyNames array contains alternate editions, ports, remasters, remakes, or expanded releases that belong to the same game family.',
  '   - Use family variants as supporting context when one release name is better known than another.',
  '   - If a clearly related family edition or expansion officially adds the disputed category fit, treat that as valid support for sustained.',
  '   - If the selected game or any clearly related family variant directly fits both categories, that is valid evidence in favor of sustained.',
  '   - Do not require every variant to match.',
  '',
  '4. JUDGMENT GUARDRAILS:',
  '   - For perspective categories, do not require the perspective to be the default camera if an official mode/toggle supports substantial or full-game play in that perspective.',
  '   - Do not overrule only because a qualifying fit is optional, post-launch, less commonly used, or less optimal in some scenarios when it is still officially supported and meaningfully playable/relevant.',
  '   - Do not sustain based on loose association, technicalities, indirect relationships, platform ownership, franchise adjacency, optional/minor features, or niche edge-case interpretations.',
  '   - If evidence is mixed, indirect, surprising, or ambiguous, overrule.',
  '   - Use "sustained" only when the player is likely correct and the app rejection may be caused by incomplete or mismapped metadata.',
  '   - Use "overruled" when the app rejection is probably correct or the evidence is too weak.',
  '</logic_rules>',
  '',
  '<output_format>',
  'Return JSON only. No markdown.',
  '{"verdict":"sustained|overruled","confidence":"low|medium|high","explanation":"string","suspectedMissingMetadata":"string|null"}',
  'Constraint: explanation must be under 45 words.',
  '</output_format>',
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
    appMetadata: {
      genres: guess.genres ?? [],
      themes: guess.themes ?? [],
      perspectives: guess.perspectives ?? [],
      gameModes: guess.gameModes ?? [],
      platforms: guess.platforms ?? [],
      companies: guess.companies ?? [],
      developers: guess.developers ?? [],
      publishers: guess.publishers ?? [],
    },
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
