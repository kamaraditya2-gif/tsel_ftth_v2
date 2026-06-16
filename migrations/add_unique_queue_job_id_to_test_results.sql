-- Fix: worker.js uses `ON CONFLICT (queue_job_id) DO UPDATE` when saving test
-- results, but queue_job_id had no UNIQUE constraint. As a result every INSERT
-- failed with "there is no unique or exclusion constraint matching the ON
-- CONFLICT specification", the error was swallowed by the worker's try/catch,
-- and no rows were ever saved (tables stopped growing on 2026-05-22).
--
-- This migration adds the missing UNIQUE constraint to all affected tables so
-- the upsert works. NULLs are allowed multiple times in Postgres UNIQUE, which
-- is fine since queue_job_id is only NULL for legacy/migrated rows.
--
-- Run with:
--   Get-Content migrations\add_unique_queue_job_id_to_test_results.sql | docker exec -i mojojojo_postgres psql -U mojojojo_user -d mojojojo_database

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'test_results_ping_queue_job_id_key'
  ) THEN
    ALTER TABLE test_results_ping
      ADD CONSTRAINT test_results_ping_queue_job_id_key UNIQUE (queue_job_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'test_results_traceroute_queue_job_id_key'
  ) THEN
    ALTER TABLE test_results_traceroute
      ADD CONSTRAINT test_results_traceroute_queue_job_id_key UNIQUE (queue_job_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'test_results_speed_upload_queue_job_id_key'
  ) THEN
    ALTER TABLE test_results_speed_upload
      ADD CONSTRAINT test_results_speed_upload_queue_job_id_key UNIQUE (queue_job_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'test_results_speed_download_queue_job_id_key'
  ) THEN
    ALTER TABLE test_results_speed_download
      ADD CONSTRAINT test_results_speed_download_queue_job_id_key UNIQUE (queue_job_id);
  END IF;
END $$;
