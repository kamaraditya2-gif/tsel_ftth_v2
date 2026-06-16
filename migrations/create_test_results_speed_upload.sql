-- Create test_results_speed_upload table for upload speed test results
-- Separates upload speed results to avoid race conditions
-- Run with: Get-Content migrations\create_test_results_speed_upload.sql | docker exec -i mojojojo_postgres psql -U mojojojo_user -d mojojojo_database

-- Create the new table
CREATE TABLE IF NOT EXISTS test_results_speed_upload (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  queue_job_id UUID REFERENCES queue_jobs(id) ON DELETE SET NULL,
  upload_speed DECIMAL(10,2), -- Upload speed in Mbps
  upload_threshold DECIMAL(10,2), -- Upload speed threshold for success
  success BOOLEAN DEFAULT false,
  executed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_test_results_speed_upload_device_id ON test_results_speed_upload(device_id);
CREATE INDEX IF NOT EXISTS idx_test_results_speed_upload_task_id ON test_results_speed_upload(task_id);
CREATE INDEX IF NOT EXISTS idx_test_results_speed_upload_queue_job_id ON test_results_speed_upload(queue_job_id);
CREATE INDEX IF NOT EXISTS idx_test_results_speed_upload_executed_at ON test_results_speed_upload(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_results_speed_upload_device_executed ON test_results_speed_upload(device_id, executed_at DESC);

-- Add comment to table
COMMENT ON TABLE test_results_speed_upload IS 'Stores upload speed test results separately to avoid race conditions during concurrent test execution';
