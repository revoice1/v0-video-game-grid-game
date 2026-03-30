ALTER TABLE versus_events
  DROP CONSTRAINT IF EXISTS versus_events_type_check;

ALTER TABLE versus_events
  ADD CONSTRAINT versus_events_type_check
  CHECK (type IN ('claim', 'miss', 'objection', 'steal', 'ready', 'rematch'));
