import { GameClient } from '@/components/game/game-client'

export default function Home() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': ['WebSite', 'WebApplication'],
    name: 'GameGrid',
    url: 'https://www.gamegrid.games/',
    applicationCategory: 'Game',
    genre: ['Trivia', 'Puzzle', 'Video Game'],
    operatingSystem: 'Web',
    description:
      'A daily video game grid puzzle where every answer has to satisfy both category clues, including platform, genre, decade, perspective, theme, and game mode.',
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
