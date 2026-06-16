-- Add run_id column to test_results_speed and test_results_ping tables
-- Run with: Get-Content migrations\add_run_id_to_test_results.sql | docker exec -i mojojojo_postgres psql -U mojojojo_user -d mojojojo_database

-- Add run_id to test_results_speed
ALTER TABLE test_results_speed ADD COLUMN IF NOT EXISTS run_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_test_results_speed_run_id ON test_results_speed(run_id);
CREATE INDEX IF NOT EXISTS idx_test_results_speed_device_task_run ON test_results_speed(device_id, task_id, run_id);

-- Add run_id to test_results_ping
ALTER TABLE test_results_ping ADD COLUMN IF NOT EXISTS run_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_test_results_ping_run_id ON test_results_ping(run_id);
CREATE INDEX IF NOT EXISTS idx_test_results_ping_device_task_run ON test_results_ping(device_id, task_id, run_id);

-- Add run_id to test_results_traceroute
ALTER TABLE test_results_traceroute ADD COLUMN IF NOT EXISTS run_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_test_results_traceroute_run_id ON test_results_traceroute(run_id);
CREATE INDEX IF NOT EXISTS idx_test_results_traceroute_device_task_run ON test_results_traceroute(device_id, task_id, run_id);

COMMENT ON COLUMN test_results_speed.run_id IS 'Unique identifier for the task execution run';
COMMENT ON COLUMN test_results_ping.run_id IS 'Unique identifier for the task execution run';
COMMENT ON COLUMN test_results_traceroute.run_id IS 'Unique identifier for the task execution run';
