-- Add raw_response column to queue_jobs table
-- Run with: docker exec -i mojo-db psql -U mojo_db_user -d mojo_db < migrations/add_raw_response_to_queue_jobs.sql
ALTER TABLE queue_jobs ADD COLUMN IF NOT EXISTS raw_response jsonb;
