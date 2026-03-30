ALTER TABLE versus_rooms
  ADD COLUMN IF NOT EXISTS state_data JSONB;
