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
  | 'mtg-card'
  | 'mana'

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
    achievementDescription: 'Use Chex Quest as a correct answer.',
    triggerNames: ['chex quest'],
    durationMs: 5000,
    density: 42,
    pieceKinds: ['chex', 'goop'],
  },
  {
    achievementId: 'golden-path',
    achievementTitle: 'Golden Path',
    achievementDescription: 'Use Tunic as a correct answer.',
    triggerNames: ['tunic'],
    durationMs: 5000,
    density: 34,
    pieceKinds: ['fox', 'sword'],
  },
  {
    achievementId: 'dust-to-dust',
    achievementTitle: 'Scraps of Memory',
    achievementDescription: 'Use Phantom Dust as a correct answer.',
    triggerNames: ['phantom dust'],
    durationMs: 5200,
    density: 38,
    pieceKinds: ['spellcard', 'dust'],
  },
  {
    achievementId: 'snap-happy',
    achievementTitle: 'You Were Close!',
    achievementDescription: 'Use Pokemon Snap as a correct answer.',
    triggerNames: ['pokemon snap', 'pokémon snap', 'pokÃ©mon snap'],
    durationMs: 5000,
    density: 34,
    pieceKinds: ['photo', 'pokeball'],
  },
  {
    achievementId: 'garden-party',
    achievementTitle: 'Maché Mating Dance',
    achievementDescription: 'Use Viva Pinata as a correct answer.',
    triggerNames: ['viva pinata', 'viva piñata', 'viva piÃ±ata'],
    durationMs: 5200,
    density: 38,
    pieceKinds: ['candy', 'pinata'],
  },
  {
    achievementId: 'war-never-changes',
    achievementTitle: 'Fawkes Approved',
    achievementDescription: 'Use Fallout 3 as a correct answer.',
    triggerNames: ['fallout 3'],
    durationMs: 5200,
    density: 34,
    pieceKinds: ['cap', 'vault'],
  },
  {
    achievementId: 'brain-bounce',
    achievementTitle: 'Stretching Jelly Hero',
    achievementDescription: 'Use Smart Ball or Jerry Boy as a correct answer.',
    triggerNames: ['smart ball', 'jerry boy'],
    durationMs: 5000,
    density: 34,
    pieceKinds: ['brain', 'ball'],
  },
  {
    achievementId: 'cute-chaos',
    achievementTitle: 'Mascot Puck Smash',
    achievementDescription: 'Use Sanrio World Smashball as a correct answer.',
    triggerNames: ['sanrio world smashball'],
    durationMs: 5000,
    density: 36,
    pieceKinds: ['bow', 'smash'],
  },
  {
    achievementId: 'second-round',
    achievementTitle: 'ZA PARTY GAAAAME! 2',
    achievementDescription: 'Use The Party Game 2 as a correct answer.',
    triggerNames: ['simple 2000 series the party game 2', 'the party game 2'],
    durationMs: 5200,
    density: 40,
    pieceKinds: ['die', 'party'],
  },
  {
    achievementId: 'blast-zone',
    achievementTitle: 'Kangaroo Mount Mayhem',
    achievementDescription: 'Use Super Bomberman 5 as a correct answer.',
    triggerNames: ['super bomberman 5'],
    durationMs: 5000,
    density: 38,
    pieceKinds: ['bomb', 'spark'],
  },
  {
    achievementId: 'time-to-collect',
    achievementTitle: "Snatcher's Contract",
    achievementDescription: 'Use A Hat in Time as a correct answer.',
    triggerNames: ['a hat in time', 'hat in time'],
    durationMs: 5200,
    density: 36,
    pieceKinds: ['hat', 'timepiece'],
  },
  {
    achievementId: 'sold-out-crowd',
    achievementTitle: '64-bit-mania',
    achievementDescription: 'Use WCW vs nWo World Tour as a correct answer.',
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
    achievementDescription: 'Use The King of Fighters: Maximum Impact as a correct answer.',
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
    achievementDescription: 'Use There Is No Game: Wrong Dimension as a correct answer.',
    triggerNames: ['there is no game: wrong dimension', 'there is no game wrong dimension'],
    durationMs: 5200,
    density: 34,
    pieceKinds: ['pointer', 'glitch'],
  },
  {
    achievementId: 'finish-the-fight',
    achievementTitle: 'Finish the Fight',
    achievementDescription: 'Use Halo 2 as a correct answer.',
    triggerNames: ['halo 2'],
    durationMs: 5200,
    density: 36,
    pieceKinds: ['energy-sword', 'plasma'],
  },
  {
    achievementId: 'flying-power-disc',
    achievementTitle: 'Flying Power Disc',
    achievementDescription: 'Use Windjammers as a correct answer.',
    triggerNames: ['windjammers'],
    durationMs: 5000,
    density: 38,
    pieceKinds: ['disc', 'trail'],
  },
  {
    achievementId: 'free-planeswalker',
    achievementTitle: 'Free Planeswalker?!?!',
    achievementDescription: 'Use Magic: The Gathering - Duels of the Planeswalkers as a correct answer.',
    triggerNames: [
      'magic: the gathering - duels of the planeswalkers',
      'magic the gathering duels of the planeswalkers',
      'duels of the planeswalkers',
    ],
    durationMs: 5200,
    density: 38,
    pieceKinds: ['mtg-card', 'mana'],
  },
]

export function findEasterEggConfig(gameName: string): EasterEggConfig | null {
  const normalizedName = gameName.trim().toLowerCase()

  return EASTER_EGGS.find(easterEgg => easterEgg.triggerNames.includes(normalizedName)) ?? null
}
