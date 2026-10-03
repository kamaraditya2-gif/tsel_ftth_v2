-- Create test_results_traceroute table for traceroute test results
-- This separates traceroute results from the general test_results table to avoid race conditions
-- Run with: Get-Content migrations\create_test_results_traceroute.sql | docker exec -i mojo-db psql -U mojo_db_user -d mojo_db

-- Create the new table
CREATE TABLE IF NOT EXISTS test_results_traceroute (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  queue_job_id UUID REFERENCES queue_jobs(id) ON DELETE SET NULL,
  traceroute_raw JSONB, -- Raw traceroute data in JSONB format
  total_hops INTEGER, -- Total number of hops
  total_rtt_ms DECIMAL(10,2), -- Total round-trip time in milliseconds
  success BOOLEAN DEFAULT false,
  executed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_test_results_traceroute_device_id ON test_results_traceroute(device_id);
CREATE INDEX IF NOT EXISTS idx_test_results_traceroute_task_id ON test_results_traceroute(task_id);
CREATE INDEX IF NOT EXISTS idx_test_results_traceroute_queue_job_id ON test_results_traceroute(queue_job_id);
CREATE INDEX IF NOT EXISTS idx_test_results_traceroute_executed_at ON test_results_traceroute(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_results_traceroute_device_executed ON test_results_traceroute(device_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_results_traceroute_raw ON test_results_traceroute USING GIN (traceroute_raw);

-- Migrate existing traceroute data from test_results
-- Only migrate rows where test_types contains 'traceroute' or traceroute_raw is not null
INSERT INTO test_results_traceroute (task_id, device_id, queue_job_id, traceroute_raw, total_hops, total_rtt_ms, success, executed_at, created_at)
SELECT 
  task_id,
  device_id,
  queue_job_id,
  traceroute_raw,
  CASE 
    WHEN traceroute_raw IS NOT NULL THEN 
      CASE 
        WHEN jsonb_typeof(traceroute_raw) = 'array' THEN jsonb_array_length(traceroute_raw)
        WHEN jsonb_typeof(traceroute_raw) = 'object' THEN 
          CASE 
            WHEN traceroute_raw ? 'RouteHopsNumberOfEntries' THEN (traceroute_raw->>'RouteHopsNumberOfEntries')::INTEGER
            ELSE 0
          END
        ELSE 0
      END
    ELSE 0
  END as total_hops,
  NULL as total_rtt_ms, -- Will need to calculate from raw data if needed
  success,
  executed_at,
  executed_at as created_at
FROM test_results
WHERE test_types @> ARRAY['traceroute']::TEXT[]
  OR traceroute_raw IS NOT NULL;

-- Add comment to table
COMMENT ON TABLE test_results_traceroute IS 'Stores traceroute test results separately to avoid race conditions during concurrent test execution';
