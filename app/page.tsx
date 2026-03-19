import { GameClient } from '@/components/game/game-client'

export default function Home() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': ['WebSite', 'WebApplication', 'Game'],
    name: 'GameGrid',
    url: 'https://gamegrid.games/',
    applicationCategory: 'Game',
    genre: ['Trivia', 'Puzzle', 'Video Game'],
    operatingSystem: 'Web',
    description:
      'A daily video game grid puzzle where every answer has to satisfy both category clues, including platform, genre, decade, perspective, theme, and game mode.',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="sr-only">
        <h1>GameGrid: Daily Video Game Grid Puzzle</h1>
        <p>
          GameGrid is a daily video game trivia puzzle where each answer must match both the
          row clue and the column clue. Search for games by title and fill the grid using genres,
          platforms, decades, themes, perspectives, and multiplayer modes.
        </p>
      </section>
      <GameClient />
    </>
  )
}
