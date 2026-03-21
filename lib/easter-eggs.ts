export type EasterEggPieceKind =
  | 'chex'
  | 'goop'
  | 'fox'
  | 'sword'
  | 'spellcard'
  | 'dust'
  | 'photo'
  | 'pokeball'
  | 'candy'
  | 'pinata'
  | 'cap'
  | 'vault'
  | 'brain'
  | 'ball'
  | 'bow'
  | 'smash'
  | 'die'
  | 'party'
  | 'bomb'
  | 'spark'
  | 'hat'
  | 'timepiece'
  | 'belt'
  | 'burst'
  | 'fist'
  | 'crack'
  | 'pointer'
  | 'glitch'
  | 'energy-sword'
  | 'plasma'
  | 'disc'
  | 'trail'

export interface EasterEggConfig {
  achievementId: string
  achievementTitle: string
  achievementDescription: string
  triggerNames: string[]
  durationMs: number
  density: number
  pieceKinds: EasterEggPieceKind[]
}

export const EASTER_EGGS: EasterEggConfig[] = [
  {
    achievementId: 'chex-mix',
    achievementTitle: 'Breakfast Defender',
    achievementDescription: 'Trigger the Chex Quest easter egg.',
    triggerNames: ['chex quest'],
    durationMs: 5000,
    density: 42,
    pieceKinds: ['chex', 'goop'],
  },
  {
    achievementId: 'golden-path',
    achievementTitle: 'Golden Path',
    achievementDescription: 'Trigger the Tunic easter egg.',
    triggerNames: ['tunic'],
    durationMs: 5000,
    density: 34,
    pieceKinds: ['fox', 'sword'],
  },
  {
    achievementId: 'dust-to-dust',
    achievementTitle: 'Scraps of Memory',
    achievementDescription: 'Trigger the Phantom Dust easter egg.',
    triggerNames: ['phantom dust'],
    durationMs: 5200,
    density: 38,
    pieceKinds: ['spellcard', 'dust'],
  },
  {
    achievementId: 'snap-happy',
    achievementTitle: 'You Were Close!',
    achievementDescription: 'Trigger the Pokemon Snap easter egg.',
    triggerNames: ['pokemon snap', 'pokémon snap', 'pokÃ©mon snap'],
    durationMs: 5000,
    density: 34,
    pieceKinds: ['photo', 'pokeball'],
  },
  {
    achievementId: 'garden-party',
    achievementTitle: 'Maché Mating Dance',
    achievementDescription: 'Trigger the Viva Pinata easter egg.',
    triggerNames: ['viva pinata', 'viva piñata', 'viva piÃ±ata'],
    durationMs: 5200,
    density: 38,
    pieceKinds: ['candy', 'pinata'],
  },
  {
    achievementId: 'war-never-changes',
    achievementTitle: 'Fawkes Approved',
    achievementDescription: 'Trigger the Fallout 3 easter egg.',
    triggerNames: ['fallout 3'],
    durationMs: 5200,
    density: 34,
    pieceKinds: ['cap', 'vault'],
  },
  {
    achievementId: 'brain-bounce',
    achievementTitle: 'Stretching Jelly Hero',
    achievementDescription: 'Trigger the Smart Ball easter egg.',
    triggerNames: ['smart ball', 'jerry boy'],
    durationMs: 5000,
    density: 34,
    pieceKinds: ['brain', 'ball'],
  },
  {
    achievementId: 'cute-chaos',
    achievementTitle: 'Mascot Puck Smash',
    achievementDescription: 'Trigger the Sanrio World Smashball easter egg.',
    triggerNames: ['sanrio world smashball'],
    durationMs: 5000,
    density: 36,
    pieceKinds: ['bow', 'smash'],
  },
  {
    achievementId: 'second-round',
    achievementTitle: 'ZA PARTY GAAAAME! 2',
    achievementDescription: 'Trigger The Party Game 2 easter egg.',
    triggerNames: ['simple 2000 series the party game 2', 'the party game 2'],
    durationMs: 5200,
    density: 40,
    pieceKinds: ['die', 'party'],
  },
  {
    achievementId: 'blast-zone',
    achievementTitle: 'Kangaroo Mount Mayhem',
    achievementDescription: 'Trigger the Super Bomberman 5 easter egg.',
    triggerNames: ['super bomberman 5'],
    durationMs: 5000,
    density: 38,
    pieceKinds: ['bomb', 'spark'],
  },
  {
    achievementId: 'time-to-collect',
    achievementTitle: "Snatcher's Contract",
    achievementDescription: 'Trigger A Hat in Time easter egg.',
    triggerNames: ['a hat in time', 'hat in time'],
    durationMs: 5200,
    density: 36,
    pieceKinds: ['hat', 'timepiece'],
  },
  {
    achievementId: 'sold-out-crowd',
    achievementTitle: '64-bit-mania',
    achievementDescription: 'Trigger the WCW vs nWo World Tour easter egg.',
    triggerNames: [
      'wcw vs nwo world tour',
      'wcw vs. nwo world tour',
      'wcw vs nwo: world tour',
      'wcw vs. nwo: world tour',
    ],
    durationMs: 5000,
    density: 36,
    pieceKinds: ['belt', 'burst'],
  },
  {
    achievementId: 'maximum-impact',
    achievementTitle: '3D Buster Wolf',
    achievementDescription: 'Trigger The King of Fighters Maximum Impact easter egg.',
    triggerNames: [
      'king of fighters maximum impact',
      'the king of fighters maximum impact',
      'king of fighters: maximum impact',
      'the king of fighters: maximum impact',
    ],
    durationMs: 5000,
    density: 38,
    pieceKinds: ['fist', 'burst'],
  },
  {
    achievementId: 'wrong-dimension',
    achievementTitle: 'Definitly Nothing Here',
    achievementDescription: 'Trigger There Is No Game: Wrong Dimension easter egg.',
    triggerNames: ['there is no game: wrong dimension', 'there is no game wrong dimension'],
    durationMs: 5200,
    density: 34,
    pieceKinds: ['pointer', 'glitch'],
  },
  {
    achievementId: 'finish-the-fight',
    achievementTitle: 'Finish the Fight',
    achievementDescription: 'Trigger the Halo 2 easter egg.',
    triggerNames: ['halo 2'],
    durationMs: 5200,
    density: 36,
    pieceKinds: ['energy-sword', 'plasma'],
  },
  {
    achievementId: 'flying-power-disc',
    achievementTitle: 'Flying Power Disc',
    achievementDescription: 'Trigger the Windjammers easter egg.',
    triggerNames: ['windjammers'],
    durationMs: 5000,
    density: 38,
    pieceKinds: ['disc', 'trail'],
  },
]

export function findEasterEggConfig(gameName: string): EasterEggConfig | null {
  const normalizedName = gameName.trim().toLowerCase()

  return EASTER_EGGS.find(easterEgg => easterEgg.triggerNames.includes(normalizedName)) ?? null
}
