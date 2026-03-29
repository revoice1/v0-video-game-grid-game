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
  triggerGameIds: number[]
  durationMs: number
  density: number
  pieceKinds: EasterEggPieceKind[]
}

export const EASTER_EGGS: EasterEggConfig[] = [
  {
    achievementId: 'chex-mix',
    achievementTitle: 'Breakfast Defender',
    achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
    triggerGameIds: [8192, 58136],
    durationMs: 5000,
    density: 42,
    pieceKinds: ['chex', 'goop'],
  },
  {
    achievementId: 'golden-path',
    achievementTitle: 'Golden Path',
    achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
    triggerGameIds: [23733],
    durationMs: 5000,
    density: 34,
    pieceKinds: ['fox', 'sword'],
  },
  {
    achievementId: 'dust-to-dust',
    achievementTitle: 'Scraps of Memory',
    achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
    triggerGameIds: [5981, 7341, 280275],
    durationMs: 5200,
    density: 38,
    pieceKinds: ['spellcard', 'dust'],
  },
  {
    achievementId: 'snap-happy',
    achievementTitle: 'You Were Close!',
    achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
    triggerGameIds: [2324],
    durationMs: 5000,
    density: 34,
    pieceKinds: ['photo', 'pokeball'],
  },
  {
    achievementId: 'garden-party',
    achievementTitle: 'Mach\u00e9 Mating Dance',
    achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
    triggerGameIds: [7236],
    durationMs: 5200,
    density: 38,
    pieceKinds: ['candy', 'pinata'],
  },
  {
    achievementId: 'war-never-changes',
    achievementTitle: 'Fawkes Approved',
    achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
    triggerGameIds: [15, 21892, 267307],
    durationMs: 5200,
    density: 34,
    pieceKinds: ['cap', 'vault'],
  },
  {
    achievementId: 'brain-bounce',
    achievementTitle: 'Stretching Jelly Hero',
    achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
    triggerGameIds: [42461],
    durationMs: 5000,
    density: 34,
    pieceKinds: ['brain', 'ball'],
  },
  {
    achievementId: 'cute-chaos',
    achievementTitle: 'Mascot Puck Smash',
    achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
    triggerGameIds: [3692],
    durationMs: 5000,
    density: 36,
    pieceKinds: ['bow', 'burst'],
  },
  {
    achievementId: 'rub-rabbit-fever',
    achievementTitle: 'Rub It!',
    achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
    triggerGameIds: [20488],
    durationMs: 5000,
    density: 36,
    pieceKinds: ['bow', 'spark'],
  },
  {
    achievementId: 'second-round',
    achievementTitle: 'ZA PARTY GAAAAME! 2',
    achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
    triggerGameIds: [203326],
    durationMs: 5200,
    density: 40,
    pieceKinds: ['die', 'party'],
  },
  {
    achievementId: 'blast-zone',
    achievementTitle: 'Kangaroo Mount Mayhem',
    achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
    triggerGameIds: [38387],
    durationMs: 5000,
    density: 38,
    pieceKinds: ['bomb', 'spark'],
  },
  {
    achievementId: 'time-to-collect',
    achievementTitle: "Snatcher's Contract",
    achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
    triggerGameIds: [6705, 109466, 117747],
    durationMs: 5200,
    density: 36,
    pieceKinds: ['hat', 'timepiece'],
  },
  {
    achievementId: 'sold-out-crowd',
    achievementTitle: '64-bit-mania',
    achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
    triggerGameIds: [3635],
    durationMs: 5000,
    density: 36,
    pieceKinds: ['belt', 'burst'],
  },
  {
    achievementId: 'maximum-impact',
    achievementTitle: '3D Buster Wolf',
    achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
    triggerGameIds: [5897],
    durationMs: 5000,
    density: 38,
    pieceKinds: ['fist', 'burst'],
  },
  {
    achievementId: 'wrong-dimension',
    achievementTitle: 'Definitly Nothing Here',
    achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
    triggerGameIds: [132907],
    durationMs: 5200,
    density: 34,
    pieceKinds: ['pointer', 'glitch'],
  },
  {
    achievementId: 'finish-the-fight',
    achievementTitle: 'Finish the Fight',
    achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
    triggerGameIds: [986, 45149, 125009],
    durationMs: 5200,
    density: 36,
    pieceKinds: ['energy-sword', 'plasma'],
  },
  {
    achievementId: 'flying-power-disc',
    achievementTitle: 'Flying Power Disc',
    achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
    triggerGameIds: [11222],
    durationMs: 5000,
    density: 38,
    pieceKinds: ['disc', 'trail'],
  },
  {
    achievementId: 'free-planeswalker',
    achievementTitle: 'Free Planeswalker?!?!',
    achievementDescription: 'Unlocked by using its hidden trigger game as a correct answer.',
    triggerGameIds: [81444, 16173, 1891, 2188, 18218],
    durationMs: 5200,
    density: 38,
    pieceKinds: ['mtg-card', 'mana'],
  },
]

export function findEasterEggConfig(gameId: number): EasterEggConfig | null {
  return EASTER_EGGS.find((easterEgg) => easterEgg.triggerGameIds.includes(gameId)) ?? null
}
