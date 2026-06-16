-- Fix run_id column type from INTEGER to TEXT in speed tables
-- Run with: Get-Content migrations\fix_run_id_type_speed_tables.sql | docker exec -i mojojojo_postgres psql -U mojojojo_user -d mojojojo_database

-- Change run_id column type to TEXT in test_results_speed_upload
ALTER TABLE test_results_speed_upload ALTER COLUMN run_id TYPE TEXT;

-- Change run_id column type to TEXT in test_results_speed_download
ALTER TABLE test_results_speed_download ALTER COLUMN run_id TYPE TEXT;

-- Add comment to clarify the change
COMMENT ON COLUMN test_results_speed_upload.run_id IS 'Run ID for tracking multiple test executions (TEXT format: task_id-timestamp)';
COMMENT ON COLUMN test_results_speed_download.run_id IS 'Run ID for tracking multiple test executions (TEXT format: task_id-timestamp)';
