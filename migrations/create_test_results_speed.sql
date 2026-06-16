-- Create test_results_speed table for download and upload speed test results
-- This separates speed results from the general test_results table to avoid race conditions
-- Run with: Get-Content migrations\create_test_results_speed.sql | docker exec -i mojojojo_postgres psql -U mojojojo_user -d mojojojo_database

-- Create the new table
CREATE TABLE IF NOT EXISTS test_results_speed (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  queue_job_id UUID REFERENCES queue_jobs(id) ON DELETE SET NULL,
  download_speed DECIMAL(10,2), -- Download speed in Mbps
  upload_speed DECIMAL(10,2), -- Upload speed in Mbps
  download_threshold DECIMAL(10,2), -- Download speed threshold for success
  upload_threshold DECIMAL(10,2), -- Upload speed threshold for success
  success BOOLEAN DEFAULT false,
  executed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_test_results_speed_device_id ON test_results_speed(device_id);
CREATE INDEX IF NOT EXISTS idx_test_results_speed_task_id ON test_results_speed(task_id);
CREATE INDEX IF NOT EXISTS idx_test_results_speed_queue_job_id ON test_results_speed(queue_job_id);
CREATE INDEX IF NOT EXISTS idx_test_results_speed_executed_at ON test_results_speed(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_results_speed_device_executed ON test_results_speed(device_id, executed_at DESC);

-- Migrate existing speed data from test_results
-- Only migrate rows where test_types contains 'download' or 'upload' or speed fields are not null
INSERT INTO test_results_speed (task_id, device_id, queue_job_id, download_speed, upload_speed, success, executed_at, created_at)
SELECT 
  task_id,
  device_id,
  queue_job_id,
  download_speed,
  upload_speed,
  success,
  executed_at,
  executed_at as created_at
FROM test_results
WHERE test_types @> ARRAY['download']::TEXT[]
  OR test_types @> ARRAY['upload']::TEXT[]
  OR download_speed IS NOT NULL
  OR upload_speed IS NOT NULL;

-- Add comment to table
COMMENT ON TABLE test_results_speed IS 'Stores download and upload speed test results separately to avoid race conditions during concurrent test execution';
