import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'How To Play',
  description:
    'Learn how GameGrid works, how guesses are validated, which category types can appear, and when the daily video game puzzle resets.',
  alternates: {
    canonical: '/how-to-play',
  },
}

export default function HowToPlayPage() {
  const faqStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How do you play GameGrid?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Pick one video game for each grid cell. Every answer has to satisfy both the row clue and the column clue at the same time.',
        },
      },
      {
        '@type': 'Question',
        name: 'What categories can appear in GameGrid?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'GameGrid can use video game platforms, genres, decades, themes, player perspectives, and game modes.',
        },
      },
      {
        '@type': 'Question',
        name: 'When does the daily GameGrid reset?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'The daily puzzle resets at midnight UTC and a new board becomes available for everyone.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I play more than one board?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            'Yes. In addition to the daily puzzle, GameGrid also offers practice boards so you can keep playing after finishing the daily challenge.',
        },
      },
    ],
  }

  return (
    <main className="min-h-screen px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card/70 p-8 shadow-xl backdrop-blur-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">How To Play</p>
        <h1 className="mt-3 text-3xl font-bold text-foreground">How GameGrid works</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          GameGrid is a daily video game trivia puzzle where every answer has to satisfy two clues at once.
          Each cell in the 3x3 board combines one row category with one column category, and your job is to find
          a real game that matches both.
        </p>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-foreground">Basic rules</h2>
          <ul className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
            <li>Choose one game per cell.</li>
            <li>Each answer has to match both categories for that cell.</li>
            <li>You cannot reuse the same game in multiple cells.</li>
            <li>The daily board resets at midnight UTC.</li>
            <li>Practice mode lets you generate fresh boards whenever you want.</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-foreground">Common category types</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Boards can include platforms like Xbox 360 or PC, genres like RPG or Shooter, decades like the 1990s,
            themes like Horror or Science fiction, perspectives like First person or Side view, and game modes like
            Single player or Co-operative.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-foreground">Frequently asked questions</h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-border/80 bg-secondary/20 p-4">
              <h3 className="font-medium text-foreground">How are answers validated?</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                GameGrid validates answers against IGDB category data and additional game-cleanup rules to keep the
                puzzle focused on recognizable releases.
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-secondary/20 p-4">
              <h3 className="font-medium text-foreground">Why do some cells show big answer counts?</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Some category combinations are broad, like a major theme paired with an entire decade. Others are much
                narrower, which is part of what makes each board interesting.
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-secondary/20 p-4">
              <h3 className="font-medium text-foreground">Can I play old daily boards?</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Right now the easiest way to keep playing is practice mode. A fuller archive is a natural future
                expansion for the site.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
