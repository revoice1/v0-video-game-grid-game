import Link from 'next/link'
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
      <section className="mx-auto mt-14 max-w-5xl px-4 pb-20">
        <div className="rounded-3xl border border-border bg-card/60 p-8 shadow-xl backdrop-blur-sm">
          <h1 className="text-3xl font-bold text-foreground">GameGrid: Daily video game grid puzzle</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
            GameGrid is a daily video game trivia game where every answer has to satisfy two clues at
            once. Fill the 3x3 board by matching games to platforms, genres, decades, themes,
            perspectives, and multiplayer modes.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link
              href="/how-to-play"
              className="rounded-full border border-border bg-secondary/50 px-4 py-2 text-foreground transition-colors hover:bg-secondary"
            >
              Learn how to play
            </Link>
            <a
              href="#top"
              className="rounded-full border border-border bg-secondary/20 px-4 py-2 text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
            >
              Jump back to the puzzle
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card/50 p-5">
            <h2 className="text-lg font-semibold text-foreground">Daily puzzle</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Every day gets a fresh video game grid with category pairs that range from approachable
              to deep-cut.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card/50 p-5">
            <h2 className="text-lg font-semibold text-foreground">Practice mode</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Generate unlimited extra boards if you want more platform, genre, decade, and theme
              combinations after the daily challenge.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card/50 p-5">
            <h2 className="text-lg font-semibold text-foreground">Recognizable answers</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Boards are built from IGDB data with extra filtering to keep the answer pool cleaner and
              easier to reason about.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-border bg-card/50 p-8">
          <h2 className="text-2xl font-semibold text-foreground">What kinds of clues appear?</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
            GameGrid can mix classic video game categories like Xbox 360, Nintendo DS, RPG, Platform,
            Horror, Science fiction, First person, Side view, Single player, and Co-operative. That
            variety is what makes each board feel a little different.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-base font-medium text-foreground">Why people search for GameGrid</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                If you are looking for a daily video game puzzle, a gaming immaculate-grid-style game,
                or a video game trivia challenge with real metadata, this is the lane GameGrid lives in.
              </p>
            </div>
            <div>
              <h3 className="text-base font-medium text-foreground">Need the rules?</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Visit the{' '}
                <Link href="/how-to-play" className="text-primary hover:underline">
                  how-to-play page
                </Link>{' '}
                for a quick explanation of guesses, category types, and the daily reset.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
