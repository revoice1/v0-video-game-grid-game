import type { Category, CategoryType } from './types'
import { getPlatformDisplayLabel } from './category-display'

type FamilyKey = Extract<
  CategoryType,
  'platform' | 'genre' | 'decade' | 'company' | 'game_mode' | 'theme' | 'perspective'
>

export interface CuratedCategoryFamily {
  key: FamilyKey
  source: 'curated'
  categories: Category[]
}

export interface VersusCategoryFamilyOption {
  key: FamilyKey
  source: 'curated'
  categories: Array<{
    id: string
    name: string
    type: CategoryType
    defaultChecked?: boolean
  }>
}

type VersusFamilyDefaultSelections = Partial<Record<FamilyKey, string[]>>

const STANDARD_PLATFORM_CATEGORIES: Category[] = [
  { type: 'platform', id: 59, name: 'Atari 2600', slug: 'atari2600' },
  {
    type: 'platform',
    id: 18,
    name: 'Nintendo Entertainment System',
    slug: 'nes',
    platformIds: [18, 99, 51],
  },
  {
    type: 'platform',
    id: 19,
    name: 'Super Nintendo Entertainment System',
    slug: 'snes',
    platformIds: [19, 58],
  },
  { type: 'platform', id: 29, name: 'Sega Mega Drive/Genesis', slug: 'genesis-slash-megadrive' },
  { type: 'platform', id: 32, name: 'Sega Saturn', slug: 'saturn' },
  { type: 'platform', id: 23, name: 'Dreamcast', slug: 'dc' },
  { type: 'platform', id: 33, name: 'Game Boy', slug: 'gb' },
  { type: 'platform', id: 24, name: 'Game Boy Advance', slug: 'gba' },
  { type: 'platform', id: 20, name: 'Nintendo DS', slug: 'nds' },
  { type: 'platform', id: 37, name: 'Nintendo 3DS', slug: '3ds' },
  { type: 'platform', id: 4, name: 'Nintendo 64', slug: 'n64' },
  { type: 'platform', id: 21, name: 'Nintendo GameCube', slug: 'ngc' },
  { type: 'platform', id: 5, name: 'Wii', slug: 'wii' },
  { type: 'platform', id: 41, name: 'Wii U', slug: 'wiiu' },
  { type: 'platform', id: 130, name: 'Nintendo Switch', slug: 'switch' },
  { type: 'platform', id: 508, name: 'Nintendo Switch 2', slug: 'switch-2' },
  { type: 'platform', id: 7, name: 'PlayStation (Original)', slug: 'ps' },
  { type: 'platform', id: 8, name: 'PlayStation 2', slug: 'ps2' },
  { type: 'platform', id: 9, name: 'PlayStation 3', slug: 'ps3' },
  {
    type: 'platform',
    id: 6,
    name: 'PC (Windows/DOS)',
    slug: 'pc',
    platformIds: [6, 13],
  },
  { type: 'platform', id: 48, name: 'PlayStation 4', slug: 'ps4--1' },
  { type: 'platform', id: 167, name: 'PlayStation 5', slug: 'ps5' },
  { type: 'platform', id: 38, name: 'PlayStation Portable', slug: 'psp' },
  { type: 'platform', id: 46, name: 'PlayStation Vita', slug: 'psvita' },
  { type: 'platform', id: 11, name: 'Xbox (Original)', slug: 'xbox' },
  { type: 'platform', id: 12, name: 'Xbox 360', slug: 'xbox360' },
  { type: 'platform', id: 49, name: 'Xbox One', slug: 'xboxone' },
  { type: 'platform', id: 169, name: 'Xbox Series X|S', slug: 'series-x-s' },
]

const STANDARD_GENRE_CATEGORIES: Category[] = [
  { type: 'genre', id: 4, name: 'Fighting', slug: 'fighting' },
  { type: 'genre', id: 5, name: 'Shooter', slug: 'shooter' },
  { type: 'genre', id: 8, name: 'Platform', slug: 'platform' },
  { type: 'genre', id: 9, name: 'Puzzle', slug: 'puzzle' },
  { type: 'genre', id: 10, name: 'Racing', slug: 'racing' },
  { type: 'genre', id: 12, name: 'Role-playing (RPG)', slug: 'rpg' },
  { type: 'genre', id: 13, name: 'Simulator', slug: 'simulator' },
  { type: 'genre', id: 14, name: 'Sport', slug: 'sport' },
  { type: 'genre', id: 15, name: 'Strategy', slug: 'strategy' },
  { type: 'genre', id: 24, name: 'Tactical', slug: 'tactical' },
  { type: 'genre', id: 31, name: 'Adventure', slug: 'adventure' },
]

const STANDARD_DECADE_CATEGORIES: Category[] = [
  { type: 'decade', id: '1980', name: '1980s', slug: '1980-01-01,1989-12-31' },
  { type: 'decade', id: '1990', name: '1990s', slug: '1990-01-01,1999-12-31' },
  { type: 'decade', id: '2000', name: '2000s', slug: '2000-01-01,2009-12-31' },
  { type: 'decade', id: '2010', name: '2010s', slug: '2010-01-01,2019-12-31' },
  { type: 'decade', id: '2020', name: '2020s', slug: '2020-01-01,2029-12-31' },
]

const STANDARD_COMPANY_CATEGORIES: Category[] = [
  { type: 'company', id: 'nintendo', name: 'Nintendo', slug: 'nintendo', companyIds: [70] },
  { type: 'company', id: 'sega', name: 'Sega', slug: 'sega', companyIds: [112] },
  {
    type: 'company',
    id: 'electronic-arts',
    name: 'Electronic Arts',
    slug: 'electronic-arts',
    companyIds: [1],
  },
  { type: 'company', id: 'konami', name: 'Konami', slug: 'konami', companyIds: [129] },
  {
    type: 'company',
    id: 'activision',
    name: 'Activision / Blizzard',
    slug: 'activision',
    companyIds: [66],
  },
  { type: 'company', id: 'capcom', name: 'Capcom', slug: 'capcom', companyIds: [37] },
  {
    type: 'company',
    id: 'square-enix',
    name: 'Square Enix',
    slug: 'square-enix',
    companyIds: [26, 250, 26323],
  },
  {
    type: 'company',
    id: 'ubisoft',
    name: 'Ubisoft',
    slug: 'ubisoft',
    companyNamePatterns: ['Ubisoft'],
  },
  { type: 'company', id: 'thq', name: 'THQ / Nordic', slug: 'thq', companyIds: [197] },
  {
    type: 'company',
    id: 'microsoft-xbox',
    name: 'Microsoft',
    slug: 'microsoft-xbox',
    companyIds: [128, 53, 1010, 17966],
  },
  {
    type: 'company',
    id: 'sony',
    name: 'Sony',
    slug: 'sony',
    companyIds: [10100, 13634, 27081, 334, 45, 907],
  },
]

const CUSTOM_ONLY_COMPANY_CATEGORIES: Category[] = [
  {
    type: 'company',
    id: 'bandai-namco',
    name: 'Bandai Namco',
    slug: 'bandai-namco',
    companyIds: [248, 3958, 6330, 263],
  },
  { type: 'company', id: 'atlus', name: 'Atlus', slug: 'atlus', companyIds: [818] },
  { type: 'company', id: 'taito', name: 'Taito', slug: 'taito', companyIds: [817] },
  { type: 'company', id: 'snk', name: 'SNK', slug: 'snk', companyIds: [1474] },
  {
    type: 'company',
    id: 'koei-tecmo',
    name: 'Koei Tecmo',
    slug: 'koei-tecmo',
    companyIds: [18532, 630, 14776, 858, 24352],
  },
]

const VERSUS_COMPANY_CATEGORIES: Category[] = [
  ...STANDARD_COMPANY_CATEGORIES,
  ...CUSTOM_ONLY_COMPANY_CATEGORIES,
]

const STANDARD_GAME_MODE_CATEGORIES: Category[] = [
  { type: 'game_mode', id: 1, name: 'Single player', slug: 'single-player' },
  { type: 'game_mode', id: 2, name: 'Multiplayer', slug: 'multiplayer' },
  { type: 'game_mode', id: 3, name: 'Co-operative', slug: 'co-operative' },
  { type: 'game_mode', id: 4, name: 'Split screen', slug: 'split-screen' },
  { type: 'game_mode', id: 5, name: 'Massively Multiplayer Online (MMO)', slug: 'mmo' },
  { type: 'game_mode', id: 6, name: 'Battle Royale', slug: 'battle-royale' },
]

const STANDARD_THEME_CATEGORIES: Category[] = [
  { type: 'theme', id: 1, name: 'Action', slug: 'action' },
  { type: 'theme', id: 17, name: 'Fantasy', slug: 'fantasy' },
  { type: 'theme', id: 18, name: 'Science fiction', slug: 'science-fiction' },
  { type: 'theme', id: 19, name: 'Horror', slug: 'horror' },
  { type: 'theme', id: 21, name: 'Survival', slug: 'survival' },
  { type: 'theme', id: 38, name: 'Open world', slug: 'open-world' },
  { type: 'theme', id: 39, name: 'Warfare', slug: 'warfare' },
  { type: 'theme', id: 43, name: 'Mystery', slug: 'mystery' },
]

const STANDARD_PERSPECTIVE_CATEGORIES: Category[] = [
  { type: 'perspective', id: 1, name: 'First person', slug: 'first-person' },
  { type: 'perspective', id: 2, name: 'Third person', slug: 'third-person' },
  { type: 'perspective', id: 3, name: 'Bird view / Isometric', slug: 'isometric' },
  { type: 'perspective', id: 4, name: 'Side view', slug: 'side-view' },
]

const VERSUS_PERSPECTIVE_CATEGORIES: Category[] = [
  ...STANDARD_PERSPECTIVE_CATEGORIES,
  { type: 'perspective', id: 5, name: 'Text', slug: 'text' },
  { type: 'perspective', id: 6, name: 'Auditory', slug: 'auditory' },
  { type: 'perspective', id: 7, name: 'Virtual Reality', slug: 'virtual-reality' },
]

export const CURATED_STANDARD_CATEGORY_FAMILIES: CuratedCategoryFamily[] = [
  { key: 'platform', source: 'curated', categories: STANDARD_PLATFORM_CATEGORIES },
  { key: 'genre', source: 'curated', categories: STANDARD_GENRE_CATEGORIES },
  { key: 'decade', source: 'curated', categories: STANDARD_DECADE_CATEGORIES },
  { key: 'company', source: 'curated', categories: STANDARD_COMPANY_CATEGORIES },
  { key: 'game_mode', source: 'curated', categories: STANDARD_GAME_MODE_CATEGORIES },
  { key: 'theme', source: 'curated', categories: STANDARD_THEME_CATEGORIES },
  { key: 'perspective', source: 'curated', categories: STANDARD_PERSPECTIVE_CATEGORIES },
]

export const CURATED_VERSUS_GENERATION_CATEGORY_FAMILIES: CuratedCategoryFamily[] = [
  ...CURATED_STANDARD_CATEGORY_FAMILIES.map((family) =>
    family.key === 'perspective'
      ? ({
          key: 'perspective',
          source: 'curated',
          categories: VERSUS_PERSPECTIVE_CATEGORIES,
        } satisfies CuratedCategoryFamily)
      : family.key === 'company'
        ? ({
            key: 'company',
            source: 'curated',
            categories: VERSUS_COMPANY_CATEGORIES,
          } satisfies CuratedCategoryFamily)
        : family
  ),
]

export const CURATED_VERSUS_CATEGORY_FAMILIES: VersusCategoryFamilyOption[] =
  CURATED_VERSUS_GENERATION_CATEGORY_FAMILIES.map((family) => ({
    key: family.key,
    source: 'curated',
    categories: family.categories.map((category) => ({
      id: String(category.id),
      name: family.key === 'platform' ? getPlatformDisplayLabel(category.name) : category.name,
      type: category.type,
      defaultChecked: !(
        (family.key === 'perspective' &&
          (String(category.id) === '5' ||
            String(category.id) === '6' ||
            String(category.id) === '7')) ||
        (family.key === 'company' &&
          (String(category.id) === 'bandai-namco' ||
            String(category.id) === 'thq' ||
            String(category.id) === 'atlus' ||
            String(category.id) === 'taito' ||
            String(category.id) === 'snk' ||
            String(category.id) === 'koei-tecmo'))
      ),
    })),
  }))

export const CURATED_VERSUS_DEFAULT_SELECTIONS: VersusFamilyDefaultSelections =
  CURATED_VERSUS_CATEGORY_FAMILIES.reduce<VersusFamilyDefaultSelections>((acc, family) => {
    acc[family.key] = family.categories
      .filter((category) => category.defaultChecked !== false)
      .map((category) => category.id)
    return acc
  }, {})
