import type { Category, CategoryType } from './types'

type FamilyKey = Extract<
  CategoryType,
  'platform' | 'genre' | 'decade' | 'company' | 'game_mode' | 'theme' | 'perspective'
>

const PLATFORM_SHORT_LABELS: Record<string, string> = {
  Arcade: 'ARC',
  'Family Computer': 'FC',
  'Family Computer Disk System': 'FDS',
  'Nintendo Entertainment System': 'NES',
  'Super Famicom': 'SFC',
  'Super Nintendo Entertainment System': 'SNES',
  'Sega Mega Drive/Genesis': 'GEN',
  'Sega Saturn': 'Saturn',
  Dreamcast: 'DC',
  'Game Boy': 'GB',
  'Game Boy Advance': 'GBA',
  'Nintendo DS': 'DS',
  'Nintendo 3DS': '3DS',
  'Nintendo 64': 'N64',
  'Nintendo GameCube': 'GC',
  Wii: 'WII',
  'Wii U': 'WIIU',
  'Nintendo Switch': 'SW',
  'Nintendo Switch 2': 'SW2',
  PlayStation: 'PS1',
  'PlayStation (Original)': 'PS1',
  'PlayStation 2': 'PS2',
  'PlayStation 3': 'PS3',
  'PlayStation 4': 'PS4',
  'PlayStation 5': 'PS5',
  'PlayStation Portable': 'PSP',
  'PlayStation Vita': 'VITA',
  Xbox: 'XBOX',
  'Xbox (Original)': 'XBOX',
  'Xbox 360': 'X360',
  'Xbox One': 'XONE',
  'Xbox Series X|S': 'XSX',
  'PC-Engine / TG16': 'PCE/TG16',
  'Neo Geo / AES / MVS': 'NeoGeo',
  DOS: 'DOS',
  'PC (Windows/DOS)': 'PC/DOS',
  'PC (Microsoft Windows)': 'PC',
}

const FAMILY_LABELS: Record<FamilyKey, string> = {
  platform: 'Platforms',
  genre: 'Genres',
  decade: 'Decades',
  company: 'Companies',
  game_mode: 'Modes',
  theme: 'Themes',
  perspective: 'Perspectives',
}

export function getPlatformDisplayLabel(platformName: string): string {
  return PLATFORM_SHORT_LABELS[platformName] ?? platformName
}

export function getFamilyDisplayLabel(familyKey: FamilyKey): string {
  return FAMILY_LABELS[familyKey]
}

export function getCategoryDisplayName(category: Category): string {
  if (category.type === 'game_mode' && category.name === 'Massively Multiplayer Online (MMO)') {
    return 'MMO'
  }

  if (category.type === 'genre' && category.name === 'Role-playing (RPG)') {
    return 'RPG'
  }

  if (category.type === 'genre' && category.name === 'Platform') {
    return 'Platformer'
  }

  return category.name
}
