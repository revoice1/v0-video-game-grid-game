# GameGrid

A daily video game trivia grid game where every answer must satisfy both its row and column category.

GameGrid includes:

- a daily puzzle
- a daily archive for catching up on missed boards
- streak and completion tracking for daily play
- unlimited practice boards
- local versus play
- post-match versus summaries
- curated category pools for standard play
- customizable category pools for practice and versus
- search metadata, easter eggs, and local achievements

## How This Was Built

GameGrid has been built through a design-directed vibe coding workflow: fast iteration with a strong
human point of view on feel, clarity, and play.

In practice that means the project has been shaped by:

- active playtesting, not just feature delivery
- rapid iteration between product direction and implementation
- treating interaction feel, pacing, readability, and surprise as first-class concerns
- keeping code quality, testing, and CI in the loop as features land

The goal is not to spray features onto the page. The goal is to make a trivia game that feels good
to play, is easy to read, and has enough personality to be worth returning to.

## Product Docs

For rules, category behavior, UX intent, and open alignment questions, see:

- [docs/README.md](./docs/README.md)

## Design Philosophy

- The board is the product. Supporting UI should stay out of the way unless it is helping the
  player make a decision.
- Clarity beats cleverness. Search, results, and customization should feel legible even when the
  rules get more complex.
- Playfulness matters. Easter eggs, achievements, celebrations, and versus drama are part of the
  identity of the project, not decoration added at the end.
- Shipping matters, but so does stewardship. New work should come with testing, validation, and a
  path to maintainability.

## Getting Started

Create a `.env.local` file from `.env.example`, then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For LAN testing from another device, open `http://<your-host-lan-ip>:3000` after adding that origin
to `ALLOWED_DEV_ORIGINS` in `.env.local`.

## Environment Variables

| Variable                                   | Required | Description                                                                                                                   |
| ------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                 | Yes      | Supabase project URL                                                                                                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`            | Yes      | Supabase anon key                                                                                                             |
| `SUPABASE_SERVICE_ROLE_KEY`                | Yes      | Supabase service-role key, used only in server routes for privileged daily persistence updates                                |
| `TWITCH_IGDB_CLIENT_ID`                    | Yes      | IGDB API client ID via the Twitch developer console                                                                           |
| `TWITCH_IGDB_CLIENT_SECRET`                | Yes      | IGDB API client secret                                                                                                        |
| `GEMINI_KEY`                               | No       | Gemini API key used by `/api/objection` for objection review judgments                                                        |
| `GEMINI_MODEL`                             | No       | Gemini model name override for objections (default: `gemini-flash-lite-latest`; `models/` prefix is normalized)               |
| `GEMINI_OBJECTION_THINKING_LEVEL`          | No       | Thinking level for objection review requests, one of `MINIMAL`, `LOW`, `MEDIUM`, or `HIGH` (default: `HIGH`)                  |
| `GEMINI_OBJECTION_ENABLE_SEARCH_GROUNDING` | No       | Set to `1` to enable grounded Google Search objection requests (default disabled); grounded calls may require billing access  |
| `PUZZLE_MIN_VALID_OPTIONS`                 | No       | Minimum valid answers per cell, default `3`                                                                                   |
| `PUZZLE_GENERATION_MAX_ATTEMPTS`           | No       | Max candidate grids to try before failing, default `12`                                                                       |
| `PUZZLE_VALIDATION_SAMPLE_SIZE`            | No       | IGDB matches sampled when validating each cell, default `40`                                                                  |
| `CRON_SECRET`                              | No       | Bearer token Vercel sends with cron requests. Required in production; without it, cron routes reject all requests.            |
| `ALLOWED_DEV_ORIGINS`                      | No       | Comma-separated extra dev origins for remote local testing, for example `http://your-hostname:3000,http://your-local-ip:3000` |

## Devcontainer LAN Access

When using VS Code Dev Containers with local Docker, this repo publishes container ports directly on
the host (`3000` and `54321`) so LAN clients can reach the dev server.

To allow LAN-origin requests in Next.js dev mode, set `ALLOWED_DEV_ORIGINS` in `.env.local`, for example:

```bash
ALLOWED_DEV_ORIGINS=http://192.168.1.25:3000,http://devbox.local:3000
```

Notes:

- Ensure your host firewall allows inbound TCP `3000` from your LAN subnet.
- Docker Desktop/WSL/VPN network rules can still block LAN reachability even when the app is bound
  to `0.0.0.0` and ports are published.

The devcontainer also persists GitHub CLI and `@openai/codex` auth state in named Docker volumes
(`/home/node/.config/gh` and `/home/node/.codex`), so you should only need to log in once per
machine unless you remove those volumes.

## Database Setup

Run migrations in order against your Supabase project:

```text
scripts/001_create_tables.sql          - core schema (puzzles, guesses, stats)
scripts/002_add_increment_function.sql
scripts/003_add_guess_correctness.sql
scripts/004_add_cell_metadata.sql      - adds cell metadata to puzzles
scripts/005_add_guess_objection_metadata.sql - persists daily objection outcomes on guesses
scripts/006_add_guess_update_policy.sql - removes the temporary public update policy for guesses after moving objection updates server-side
scripts/007_drop_public_guess_insert_policy.sql - removes the public guess insert policy after moving daily guess writes server-side
scripts/008_create_versus_tables.sql - creates online versus rooms/events and Realtime-friendly read policies
scripts/009_add_online_versus_room_state.sql - adds snapshot state storage for online versus resume/sync
scripts/010_expand_versus_event_types.sql - updates existing versus event constraints to allow newer event kinds like `miss`
scripts/011_add_online_versus_match_number.sql - adds match_number to rooms and events for in-room rematch boundary scoping
scripts/012_update_expires_at_defaults.sql - changes room expiry default from 2h to 48h for activity-based cleanup
scripts/013_cleanup_fn_security_definer.sql - rebuilds cleanup function as SECURITY DEFINER with pinned search_path
```

For online versus, also add these tables to your Supabase Realtime publication:

```text
versus_rooms
versus_events
```

The current online implementation uses backend routes for writes and Supabase Realtime subscriptions
for live room/event updates, so the tables must be published for clients to stay in sync.

## API Routes

| Route                                         | Description                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `GET /api/puzzle?mode=daily\|practice`        | Returns the current puzzle as JSON.                                                     |
| `GET /api/puzzle-stream?mode=daily\|practice` | Streams puzzle generation progress.                                                     |
| `GET /api/search?q=...`                       | Searches IGDB for games matching a query.                                               |
| `POST /api/guess`                             | Validates a game guess against a cell's row and column categories.                      |
| `PATCH /api/guess`                            | Persists daily objection verdict metadata through a server-only privileged write path.  |
| `POST /api/stats`                             | Records a completed daily game session.                                                 |
| `POST /api/versus/room`                       | Creates an online versus room as the host.                                              |
| `POST /api/versus/room/:code/join`            | Joins or rejoins an online versus room by invite code.                                  |
| `POST /api/versus/room/:code/puzzle`          | Host-only route that publishes the shared versus puzzle into the room.                  |
| `POST /api/versus/room/:code/state`           | Persists the current authoritative online versus snapshot state.                        |
| `POST /api/versus/room/:code/finish`          | Marks an online room finished.                                                          |
| `POST /api/versus/room/:code/continue`        | Host-only route that clears a finished room for another game under the same code.       |
| `POST /api/versus/event`                      | Appends an online versus event for the active room.                                     |
| `GET /api/versus/room-events/:roomId`         | Fetches room event history for resume/hydration.                                        |
| `GET /api/cron/cleanup-versus-rooms`          | Cron-only route that deletes expired versus rooms. Runs daily via Vercel cron.          |
| `GET /api/cron/generate-daily-puzzle`         | Cron-only route that pre-generates the next daily puzzle. Runs nightly via Vercel cron. |

## Notes

- Daily puzzles are stored and reused after generation.
- Daily progress is tied to an anonymous browser session so archived boards can reopen your saved
  state on the same device/browser.
- Daily guess inserts and objection verdict metadata are updated server-side with the Supabase
  service-role key, so the database does not need public `INSERT` or `UPDATE` policies on
  `guesses`.
- Practice puzzles are generated fresh and are not stored in the database.
- Local versus matches are restored from local storage.
- Online versus rooms use backend routes for writes, Supabase Realtime for live updates, and room
  snapshots for faster resume after refresh.
- Online post-game flow supports a host-side `Continue In Room` reset that advances `match_number` and scopes event replay to the new match boundary, so old events do not leak into the next game.
- Finished versus matches can expand into a post-game summary with the rules used, picks, and key
  match stats.
- Standard puzzle generation uses curated category families and prevalidated banned pairs to avoid
  dead intersections.
- Practice and versus custom setup start from curated defaults and let players opt into additional
  categories.
- Versus steals can compare either rating score (`lower` / `higher`) or review-count obscurity
  (`fewer_reviews` / `more_reviews`), and the default steal rule is `fewer_reviews`.
- Practice/versus custom setup includes a **Minimum Answers Per Cell** override that accepts only
  integer values lower than `PUZZLE_MIN_VALID_OPTIONS`.
- Local saved game state is versioned; when legacy snapshots are detected after schema changes, the
  app safely resets incompatible cached puzzle/progress data instead of crashing.
- Game data and guess validation are powered by IGDB.
- Search results hide metadata that would directly overlap with active puzzle categories, while
  still disambiguating exact duplicate titles.

## Testing

```bash
npm test
```

This is the canonical verification command for the repo. It runs:

- Prettier format check
- ESLint
- TypeScript typechecking
- Vitest unit/component tests
- Playwright end-to-end tests

Useful local commands:

```bash
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npx playwright test --headed
```

Git hooks are set up with Husky. On commit, `lint-staged` runs:

- `prettier --write` on staged supported files
- `eslint --fix` on staged JS/TS files

GitHub Actions CI validates format, lint, typecheck, unit tests, and Playwright end-to-end tests on every PR.

## Category Model

The board pulls from curated category families rather than a live IGDB category scrape.

Standard generation currently uses these families:

- Platform
- Genre
- Decade
- Company
- Game Mode
- Theme
- Perspective

Practice and versus custom setup reuse the same curated base, with a few extra categories exposed as
opt-in custom-only choices.

Notable category behavior:

- `Company` is a player-facing combined bucket: a game counts if the company developed it or
  published it.
- Merged platform buckets such as `NES`, `SNES`, and `PC (Windows/DOS)` use native platform ID
  groups for validation/counting.
- Standard generation uses a curated symmetric ban table for impossible inter-family pairings.

## Feedback

- Changelog: `/changelog`
- Daily archive and streak behavior: [app/how-to-play/page.tsx](./app/how-to-play/page.tsx)
- Bug reports: [github.com/revoice1/gamegrid/issues/new?template=bug_report.yml](https://github.com/revoice1/gamegrid/issues/new?template=bug_report.yml)
- Feature requests: [github.com/revoice1/gamegrid/issues/new?template=feature_request.yml](https://github.com/revoice1/gamegrid/issues/new?template=feature_request.yml)

GitHub issue forms automatically apply:

- `bug` for bug reports
- `enhancement` for feature requests
