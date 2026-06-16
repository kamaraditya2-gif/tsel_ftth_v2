-- Add deleted_at column to tasks table for soft delete
-- This allows tasks to be marked as deleted without actually removing the record
-- Historical test_results can still reference the task

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
