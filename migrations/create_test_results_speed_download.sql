-- Create test_results_speed_download table for download speed test results
-- Separates download speed results to avoid race conditions
-- Run with: Get-Content migrations\create_test_results_speed_download.sql | docker exec -i mojo-db psql -U mojo_db_user -d mojo_db

-- Create the new table
CREATE TABLE IF NOT EXISTS test_results_speed_download (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  queue_job_id UUID REFERENCES queue_jobs(id) ON DELETE SET NULL,
  download_speed DECIMAL(10,2), -- Download speed in Mbps
  download_threshold DECIMAL(10,2), -- Download speed threshold for success
  success BOOLEAN DEFAULT false,
  executed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_test_results_speed_download_device_id ON test_results_speed_download(device_id);
CREATE INDEX IF NOT EXISTS idx_test_results_speed_download_task_id ON test_results_speed_download(task_id);
CREATE INDEX IF NOT EXISTS idx_test_results_speed_download_queue_job_id ON test_results_speed_download(queue_job_id);
CREATE INDEX IF NOT EXISTS idx_test_results_speed_download_executed_at ON test_results_speed_download(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_results_speed_download_device_executed ON test_results_speed_download(device_id, executed_at DESC);

-- Add comment to table
COMMENT ON TABLE test_results_speed_download IS 'Stores download speed test results separately to avoid race conditions during concurrent test execution';
