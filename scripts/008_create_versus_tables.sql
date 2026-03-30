CREATE TABLE IF NOT EXISTS versus_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL DEFAULT upper(substring(gen_random_uuid()::text from 1 for 6)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 hours'),
  host_session_id TEXT NOT NULL,
  guest_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
  settings JSONB NOT NULL DEFAULT '{}',
  puzzle_id TEXT,
  puzzle_data JSONB
);

CREATE TABLE IF NOT EXISTS versus_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES versus_rooms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  player TEXT NOT NULL CHECK (player IN ('x', 'o')),
  type TEXT NOT NULL CHECK (type IN ('claim', 'miss', 'objection', 'steal', 'ready', 'rematch')),
  payload JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS versus_events_room_id_idx ON versus_events(room_id, id);

ALTER TABLE versus_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE versus_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'versus_rooms'
      AND policyname = 'rooms_select'
  ) THEN
    CREATE POLICY "rooms_select" ON public.versus_rooms FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'versus_events'
      AND policyname = 'events_select'
  ) THEN
    CREATE POLICY "events_select" ON public.versus_events FOR SELECT USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION cleanup_expired_versus_rooms()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM versus_rooms
  WHERE expires_at < now();
$$;
