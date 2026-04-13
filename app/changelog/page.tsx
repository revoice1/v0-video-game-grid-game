import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Changelog',
  description:
    'User-facing GameGrid changelog covering recent features, versus updates, archive improvements, and category-pool changes.',
  alternates: {
    canonical: '/changelog',
  },
}

const CHANGELOG_ENTRIES = [
  {
    id: '2026-04-12-history-transfer',
    date: 'April 12, 2026',
    title: 'History Transfer',
    items: [
      'Added History Transfer in Settings so you can move completed puzzle history to another device without logging in.',
      'Transfer codes now support both manual entry and QR-based phone scanning.',
      'Imported sessions now clear stale local daily board state on the destination device so today’s board reflects the transferred session correctly.',
    ],
  },
  {
    id: '2026-04-12-submission-race-guard',
    date: 'April 12, 2026',
    title: 'Submission Race Guard',
    items: [
      'Fixed a bug where a slow IGDB validation could apply stale guess results to the wrong cell if the board state changed mid-request.',
    ],
  },
  {
    id: '2026-04-11-online-versus-polish',
    date: 'April 11, 2026',
    title: 'Online Versus Polish And Objection Improvements',
    items: [
      'Overruled objection toasts now show the Gemini rationale explaining why the objection was rejected.',
      'Online versus is now server-authoritative: the server validates claims, misses, and turn ownership before committing them.',
      'Fixed a bug where optimistic claim commits could fire twice in online versus, causing duplicate events.',
      'Fixed a bug where the turn timer could double-expire in local versus matches.',
      'Objection requests now fall back gracefully when the grounded Gemini call fails, rather than silently dropping the result.',
      'Guess explanations are now included in the match flow and several online versus edge cases were hardened.',
    ],
  },
  {
    id: '2026-03-28-daily-archive-streaks',
    date: 'March 28, 2026',
    title: 'Daily Archive, Streaks, And Versus Summary',
    items: [
      'Added a Daily Archive so missed boards can be opened from a calendar-style archive view.',
      'Archived dailies now restore your saved progress or completed board for this browser session.',
      'Daily results now show current streak, best streak, total dailies completed, and perfect boards.',
      'Versus matches now end with a compact winner dialog that can expand into a deeper match summary.',
      'The versus summary now tracks real steal attempts, successful steals, failed steals, objections, and showdown reveals across the match.',
      'Standard versus defaults now use Lower score steals, 1 objection each, draws disabled, and a 5 minute timer.',
      'Anonymous daily progress is now tied more cleanly to the server-managed browser session.',
    ],
  },
  {
    id: '2026-03-27-versus-objections',
    date: 'March 27, 2026',
    title: 'Versus Objections And Custom Rules',
    items: [
      'Added Gemini-powered objections for rejected guesses, with a reduced-information modal during versus play.',
      'Sustained objections can now rescue a square without exposing the full metadata panel mid-match.',
      'Versus matches now show active-player objection tokens in the header.',
      'The custom versus setup modal was reorganized into clearer Rules and Categories sections with lighter custom indicators.',
      'Steal resolutions now consistently honor showdown scoring and last-chance final steal rules.',
      'Showdown-revealed scores can now stay visible on the board.',
    ],
  },
  {
    id: '2026-03-26-category-pool-cleanup',
    date: 'March 26, 2026',
    title: 'Category Pool Cleanup',
    items: [
      'Moved several niche categories out of the default standard pool and into opt-in fun/custom-only pools.',
      'Handheld platform families like Game Boy, GBA, Nintendo DS, Nintendo 3DS, PSP, and Vita are now fun/default-off options.',
      'MMO and Battle Royale moved into the fun/default-off game mode pool.',
      'Strategy and Tactical moved into the fun/default-off genre pool.',
      'Survival and Warfare moved into the fun/default-off theme pool.',
      'THQ / Nordic was shifted below the default company set.',
      'Added merged fun platform buckets for PC-Engine / TG16 and Neo Geo / AES / MVS.',
    ],
  },
]

function getEntryAnchorId(id: string) {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export default function ChangelogPage() {
  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-4xl rounded-3xl border border-border bg-card/70 p-8 shadow-xl backdrop-blur-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Changelog</p>
        <h1 className="mt-3 text-3xl font-bold text-foreground">What&apos;s new in GameGrid</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          A concise player-facing summary of recent features, rules updates, archive improvements,
          and category-pool changes.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href="/"
            className="inline-flex items-center rounded-full border border-border bg-secondary/30 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          >
            Back to Game
          </a>
          <a
            href="/how-to-play"
            className="inline-flex items-center rounded-full border border-border bg-secondary/30 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          >
            How to Play
          </a>
          <a
            href="https://github.com/revoice1/gamegrid/issues/new?template=bug_report.yml"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-full border border-border bg-secondary/30 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          >
            Report a bug
          </a>
          <a
            href="https://github.com/revoice1/gamegrid/issues/new?template=feature_request.yml"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-full border border-border bg-secondary/30 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          >
            Request a feature
          </a>
        </div>
        <div className="mt-6 inline-flex items-center rounded-full border border-border bg-secondary/30 px-3 py-1 text-xs font-medium text-muted-foreground">
          Recent updates, newest first
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          This page only tracks player-facing changes, not every internal refactor or dependency
          update.
        </p>
        <nav className="mt-5" aria-label="Changelog quick links">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Jump to update
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CHANGELOG_ENTRIES.map((entry) => (
              <a
                key={entry.id}
                href={`#${getEntryAnchorId(entry.id)}`}
                className="inline-flex items-center rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
              >
                {entry.date}
              </a>
            ))}
          </div>
        </nav>

        <div className="mt-10 space-y-6" aria-label="Changelog entries">
          {CHANGELOG_ENTRIES.map((entry) => (
            <section
              key={entry.id}
              id={getEntryAnchorId(entry.id)}
              className="scroll-mt-24 rounded-2xl border border-border/80 bg-secondary/20 p-5 shadow-sm transition-colors target:border-primary/35 target:bg-primary/8"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                    {entry.date}
                  </p>
                  <h2 className="mt-3 text-xl font-semibold text-foreground">{entry.title}</h2>
                </div>
              </div>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">
                {entry.items.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
