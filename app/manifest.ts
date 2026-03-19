import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GameGrid',
    short_name: 'GameGrid',
    description:
      'A daily video game grid puzzle where each answer must match both category clues.',
    id: 'https://gamegrid.games/',
    scope: '/',
    start_url: '/',
    display: 'standalone',
    background_color: '#05070b',
    theme_color: '#1a1a2e',
    icons: [
      {
        src: '/icon-light-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}
