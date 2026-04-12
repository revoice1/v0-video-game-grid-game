-- Re-create cleanup function as SECURITY DEFINER so it executes with owner
-- privileges and can DELETE rows even when called via anon/service-role clients
-- that lack an explicit DELETE RLS policy on versus_rooms.

CREATE OR REPLACE FUNCTION cleanup_expired_versus_rooms()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM versus_rooms
  WHERE expires_at < now();
$$;
