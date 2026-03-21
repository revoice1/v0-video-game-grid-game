# GameGrid

A daily video game trivia grid game where every answer must satisfy both its row and column category.

GameGrid includes:
- a daily puzzle
- unlimited practice boards
- local versus play
- customizable category pools for practice and versus
- search metadata, easter eggs, and local achievements

## Getting Started

Create a `.env.local` file from `.env.example`, then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `TWITCH_IGDB_CLIENT_ID` | Yes | IGDB API client ID via the Twitch developer console |
| `TWITCH_IGDB_CLIENT_SECRET` | Yes | IGDB API client secret |
| `PUZZLE_MIN_VALID_OPTIONS` | No | Minimum valid answers per cell, default `3` |
| `PUZZLE_GENERATION_MAX_ATTEMPTS` | No | Max candidate grids to try before failing, default `12` |
| `PUZZLE_VALIDATION_SAMPLE_SIZE` | No | IGDB matches sampled when validating each cell, default `40` |
| `ALLOWED_DEV_ORIGINS` | No | Comma-separated extra dev origins for remote local testing, for example `http://ryans:3000,http://192.168.0.100:3000` |

## Database Setup

Run migrations in order against your Supabase project:

```text
scripts/001_create_tables.sql          - core schema (puzzles, guesses, stats)
scripts/002_add_increment_function.sql
scripts/003_add_guess_correctness.sql
scripts/004_add_cell_metadata.sql      - adds cell metadata to puzzles
```

## API Routes

| Route | Description |
|-------|-------------|
| `GET /api/puzzle?mode=daily\|practice` | Returns the current puzzle as JSON. |
| `GET /api/puzzle-stream?mode=daily\|practice` | Streams puzzle generation progress. |
| `GET /api/versus-options` | Returns category pools for practice and versus customization. |
| `GET /api/search?q=...` | Searches IGDB for games matching a query. |
| `POST /api/guess` | Validates a game guess against a cell's row and column categories. |
| `POST /api/stats` | Records a completed daily game session. |

## Notes

- Daily puzzles are stored and reused after generation.
- Practice puzzles are generated fresh and are not stored in the database.
- Versus matches are local-only and restored from local storage.
- Game data and category validation are powered by IGDB.

## Testing

```bash
npm test
```

This is the canonical verification command for the repo. It runs:
- TypeScript typechecking
- Vitest unit/component tests
- Playwright end-to-end tests

Useful local commands:

```bash
npm run typecheck
npm run test:unit
npm run test:e2e
npx playwright test --headed
```

GitHub Actions CI runs the same `npm test` entrypoint, so local and CI verification stay aligned.
