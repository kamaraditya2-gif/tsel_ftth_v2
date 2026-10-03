-- Add run_id column to test_results_speed_upload table
-- Run with: Get-Content migrations\add_run_id_to_speed_upload.sql | docker exec -i mojo-db psql -U mojo_db_user -d mojo_db

ALTER TABLE test_results_speed_upload ADD COLUMN IF NOT EXISTS run_id INTEGER;

-- Add comment to column
COMMENT ON COLUMN test_results_speed_upload.run_id IS 'Run ID for tracking multiple test executions';
