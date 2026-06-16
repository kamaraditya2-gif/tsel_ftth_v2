-- Add run_id column to test_results_speed_download table
-- Run with: Get-Content migrations\add_run_id_to_speed_download.sql | docker exec -i mojojojo_postgres psql -U mojojojo_user -d mojojojo_database

ALTER TABLE test_results_speed_download ADD COLUMN IF NOT EXISTS run_id INTEGER;

-- Add comment to column
COMMENT ON COLUMN test_results_speed_download.run_id IS 'Run ID for tracking multiple test executions';
