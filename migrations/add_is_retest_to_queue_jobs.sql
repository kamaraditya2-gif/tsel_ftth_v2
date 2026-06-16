-- Add is_retest flag to queue_jobs table
-- This flag indicates whether a queue job is a retest (update existing test_results instead of insert new)

ALTER TABLE queue_jobs ADD COLUMN IF NOT EXISTS is_retest BOOLEAN DEFAULT FALSE;
