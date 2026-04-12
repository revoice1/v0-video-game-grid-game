-- Change default expiry for new rooms from 2 hours to 48 hours.
-- Active rooms get bumped to 7 days via app logic on activity.
-- Waiting/finished rooms expire after 48 hours of inactivity.

ALTER TABLE versus_rooms
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '48 hours');
