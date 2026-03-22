import type { Category, CategoryType } from './types'

export interface CategoryDefinitionContent {
  description: string
  source: 'fallback'
  sourceLabel: string
}

const GENRE_DESCRIPTIONS: Partial<Record<string, string>> = {
  fighting:
    'Games built around direct combat between opponents, usually emphasizing move sets, timing, spacing, and character matchups.',
  shooter:
    'Games where aiming and ranged attacks are central, whether in first-person, third-person, on-rails, or top-down form.',
  platform:
    'Games focused on movement challenges such as jumping, climbing, timing, and navigation through obstacle-heavy spaces.',
  puzzle:
    'Games that primarily test logic, pattern recognition, planning, or problem-solving rather than reflexes alone.',
  racing:
    'Games centered on speed, driving lines, vehicle control, and finishing ahead of other racers or the clock.',
  rpg: 'Games built around character growth, stats, party building, quests, and long-term progression choices.',
  simulator:
    'Games designed to model activities, systems, or professions with a stronger focus on authenticity, management, or routine.',
  sport:
    'Games based on athletic competition, from realistic recreations of sports to more arcade-style interpretations.',
  strategy:
    'Games that reward planning, positioning, resource use, and longer-term decision-making over pure reaction speed.',
  tactical:
    'Games with a strong emphasis on deliberate positioning, unit control, and encounter-by-encounter decision-making.',
  adventure:
    'Games driven by exploration, story progression, discovery, and interacting with the world to move forward.',
}

const THEME_DESCRIPTIONS: Partial<Record<string, string>> = {
  action:
    'A theme built around intensity, momentum, and conflict, often emphasizing danger and constant engagement.',
  fantasy:
    'A theme involving imagined worlds, magic, mythic creatures, or other supernatural elements outside ordinary reality.',
  'science-fiction':
    'A theme centered on speculative technology, space, futurism, advanced science, or imagined scientific possibilities.',
  horror:
    'A theme meant to create fear, dread, unease, or tension through threat, atmosphere, and unsettling imagery.',
  survival:
    'A theme focused on scarcity, endurance, and staying alive against environmental pressure, enemies, or limited resources.',
  'open-world':
    'A theme built around broad player freedom, traversal, and choosing how to explore a large interconnected world.',
  warfare:
    'A theme centered on armed conflict, military forces, battles, or war-related settings and stakes.',
  mystery:
    'A theme driven by the unknown, investigation, hidden information, and uncovering what really happened.',
}

const PERSPECTIVE_DESCRIPTIONS: Partial<Record<string, string>> = {
  'first-person':
    'The player views the game world through the eyes of the controlled character, emphasizing immediacy and direct presence.',
  'third-person':
    'The camera follows the controlled character from outside the body, giving more awareness of movement and surroundings.',
  isometric:
    'The world is shown from an angled overhead viewpoint, often making spaces, positioning, and layout easy to read.',
  'side-view':
    'The action is presented from the side, highlighting horizontal movement, spacing, and layered 2D composition.',
  text: 'Interaction happens primarily through written language, descriptions, and commands instead of direct visual action.',
  auditory:
    'The experience relies heavily on sound cues and audio feedback as a primary way to understand and navigate play.',
  'virtual-reality':
    'The game is designed for immersive VR hardware, placing the player inside a spatial, tracked first-person environment.',
}

const GAME_MODE_DESCRIPTIONS: Partial<Record<string, string>> = {
  'single-player':
    'Designed to be played by one person, with progression, challenge, or story that does not require other players.',
  multiplayer:
    'Built for multiple players sharing a competitive or cooperative experience, locally, online, or both.',
  'co-operative':
    'A multiplayer mode where players work together toward shared objectives instead of directly opposing one another.',
  'split-screen':
    'A local multiplayer format where multiple viewpoints are shown on the same display at the same time.',
  mmo: 'A large-scale online format where many players exist in the same persistent world or connected play space.',
  'battle-royale':
    'A competitive mode where many players enter the same match and play until one player or team remains.',
}

const TYPE_LABELS: Record<CategoryType, string> = {
  platform: 'Platform',
  genre: 'Genre',
  developer: 'Developer',
  publisher: 'Publisher',
  decade: 'Decade',
  tag: 'Tag',
  company: 'Company',
  game_mode: 'Game Mode',
  theme: 'Theme',
  perspective: 'Perspective',
}

function normalizeCategoryKey(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[|/]/g, ' ')
    .replace(/[()]/g, '')
    .replace(/\s+/g, '-')
    .trim()
}

function getMappedDescription(
  mapping: Partial<Record<string, string>>,
  category: Category,
  fallback: string
): string {
  const key = normalizeCategoryKey(category.slug || category.name)
  return mapping[key] ?? fallback
}

export function getCategoryTypeLabel(type: CategoryType): string {
  return TYPE_LABELS[type]
}

export function getFallbackCategoryDefinition(category: Category): CategoryDefinitionContent {
  if (category.type === 'platform') {
    return {
      description: `${category.name} refers to games released for that hardware platform or system family. Ports, originals, and platform-specific versions can all qualify when they were released there.`,
      source: 'fallback',
      sourceLabel: 'GameGrid guide',
    }
  }

  if (category.type === 'genre') {
    return {
      description: getMappedDescription(
        GENRE_DESCRIPTIONS,
        category,
        `${category.name} is a genre classification used to describe a game’s dominant style of play.`
      ),
      source: 'fallback',
      sourceLabel: 'GameGrid guide',
    }
  }

  if (category.type === 'theme') {
    return {
      description: getMappedDescription(
        THEME_DESCRIPTIONS,
        category,
        `${category.name} is a theme label describing the setting, tone, or narrative flavor a game leans into.`
      ),
      source: 'fallback',
      sourceLabel: 'GameGrid guide',
    }
  }

  if (category.type === 'perspective') {
    return {
      description: getMappedDescription(
        PERSPECTIVE_DESCRIPTIONS,
        category,
        `${category.name} describes the viewpoint or camera perspective the player primarily experiences during play.`
      ),
      source: 'fallback',
      sourceLabel: 'GameGrid guide',
    }
  }

  if (category.type === 'game_mode') {
    return {
      description: getMappedDescription(
        GAME_MODE_DESCRIPTIONS,
        category,
        `${category.name} describes how players participate in the game, such as solo, co-op, or competitive play.`
      ),
      source: 'fallback',
      sourceLabel: 'GameGrid guide',
    }
  }

  if (category.type === 'decade') {
    return {
      description: `${category.name} means games originally released during that ten-year span, based on their release date rather than later ports or re-releases.`,
      source: 'fallback',
      sourceLabel: 'GameGrid guide',
    }
  }

  if (category.type === 'developer') {
    return {
      description: `${category.name} means the studio or team that developed the game itself.`,
      source: 'fallback',
      sourceLabel: 'GameGrid guide',
    }
  }

  if (category.type === 'publisher') {
    return {
      description: `${category.name} means the company that published or distributed the game.`,
      source: 'fallback',
      sourceLabel: 'GameGrid guide',
    }
  }

  if (category.type === 'company') {
    return {
      description: `${category.name} means games associated with that company, typically through development or publishing credits.`,
      source: 'fallback',
      sourceLabel: 'GameGrid guide',
    }
  }

  return {
    description: `${category.name} is a descriptive tag used to group games by notable traits, themes, mechanics, or player-facing qualities.`,
    source: 'fallback',
    sourceLabel: 'GameGrid guide',
  }
}
