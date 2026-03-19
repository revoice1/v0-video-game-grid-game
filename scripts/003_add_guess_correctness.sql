ALTER TABLE guesses
ADD COLUMN IF NOT EXISTS is_correct BOOLEAN;

UPDATE guesses
SET is_correct = true
WHERE is_correct IS NULL;

ALTER TABLE guesses
ALTER COLUMN is_correct SET DEFAULT true;
