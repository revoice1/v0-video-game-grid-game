-- GameGrid Database Schema - Tables
CREATE TABLE IF NOT EXISTS puzzles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE,
  is_daily BOOLEAN NOT NULL DEFAULT false,
  row_categories JSONB NOT NULL,
  col_categories JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puzzle_id UUID NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  cell_index INTEGER NOT NULL CHECK (cell_index >= 0 AND cell_index <= 8),
  game_id INTEGER NOT NULL,
  game_name TEXT NOT NULL,
  game_image TEXT,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS answer_stats (
  puzzle_id UUID NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  cell_index INTEGER NOT NULL CHECK (cell_index >= 0 AND cell_index <= 8),
  game_id INTEGER NOT NULL,
  game_name TEXT NOT NULL,
  game_image TEXT,
  count INTEGER DEFAULT 1,
  PRIMARY KEY (puzzle_id, cell_index, game_id)
);

CREATE TABLE IF NOT EXISTS puzzle_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puzzle_id UUID NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 9),
  rarity_score DECIMAL(10,2),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(puzzle_id, session_id)
);
