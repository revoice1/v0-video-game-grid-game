-- Atomic upsert function for answer_stats to avoid race conditions
-- Replaces the SELECT + UPDATE/INSERT double round-trip in the guess API
CREATE OR REPLACE FUNCTION increment_answer_stat(
  p_puzzle_id UUID,
  p_cell_index INTEGER,
  p_game_id INTEGER,
  p_game_name TEXT,
  p_game_image TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO answer_stats (puzzle_id, cell_index, game_id, game_name, game_image, count)
  VALUES (p_puzzle_id, p_cell_index, p_game_id, p_game_name, p_game_image, 1)
  ON CONFLICT (puzzle_id, cell_index, game_id)
  DO UPDATE SET count = answer_stats.count + 1;
END;
$$ LANGUAGE plpgsql;
