-- Add cell_metadata column to store pre-computed cell validation data
-- This prevents unnecessary IGDB API calls on every puzzle fetch
ALTER TABLE puzzles ADD COLUMN IF NOT EXISTS cell_metadata JSONB;