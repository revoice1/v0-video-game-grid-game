import { GameClient } from '@/components/game/game-client'

export default function Home() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': ['WebSite', 'WebApplication'],
    name: 'GameGrid',
    alternateName: [
      'Video Game Immaculate Grid',
      'Video Game Trivia Grid',
      'Gaming Immaculate Grid',
      'Daily Video Game Grid Puzzle',
    ],
    url: 'https://www.gamegrid.games/',
    applicationCategory: 'Game',
    genre: ['Trivia', 'Puzzle', 'Video Game'],
    operatingSystem: 'Web',
    keywords: [
      'video game immaculate grid',
      'gaming immaculate grid',
      'video game trivia grid',
      'daily video game puzzle',
      'video game grid',
    ].join(', '),
    description:
      'A daily video game immaculate grid-style puzzle where every answer has to satisfy both category clues, including platform, genre, decade, perspective, theme, and game mode.',
    potentialAction: {
      '@type': 'PlayAction',
      target: 'https://www.gamegrid.games/',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <GameClient />
    </>
  )
}
