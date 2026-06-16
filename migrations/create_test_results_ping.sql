-- Create test_results_ping table for ping test results
-- This separates ping results from the general test_results table to avoid race conditions
-- Run with: Get-Content migrations\create_test_results_ping.sql | docker exec -i mojojojo_postgres psql -U mojojojo_user -d mojojojo_database

-- Create the new table
CREATE TABLE IF NOT EXISTS test_results_ping (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  queue_job_id UUID REFERENCES queue_jobs(id) ON DELETE SET NULL,
  ping_igw DECIMAL(10,2), -- Latency to IGW in milliseconds
  ping_ebr DECIMAL(10,2), -- Latency to EBR in milliseconds
  packet_loss_igw DECIMAL(5,2), -- Packet loss percentage to IGW
  packet_loss_ebr DECIMAL(5,2), -- Packet loss percentage to EBR
  success BOOLEAN DEFAULT false,
  executed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_test_results_ping_device_id ON test_results_ping(device_id);
CREATE INDEX IF NOT EXISTS idx_test_results_ping_task_id ON test_results_ping(task_id);
CREATE INDEX IF NOT EXISTS idx_test_results_ping_queue_job_id ON test_results_ping(queue_job_id);
CREATE INDEX IF NOT EXISTS idx_test_results_ping_executed_at ON test_results_ping(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_results_ping_device_executed ON test_results_ping(device_id, executed_at DESC);

-- Migrate existing ping data from test_results
-- Only migrate rows where test_types contains 'ping'
INSERT INTO test_results_ping (task_id, device_id, queue_job_id, ping_igw, ping_ebr, packet_loss_igw, packet_loss_ebr, success, executed_at, created_at)
SELECT 
  task_id,
  device_id,
  queue_job_id,
  ping_igw,
  ping_ebr,
  packet_loss_igw,
  packet_loss_ebr,
  success,
  executed_at,
  executed_at as created_at
FROM test_results
WHERE test_types @> ARRAY['ping']::TEXT[]
  OR test_types @> ARRAY['ping-igw']::TEXT[]
  OR test_types @> ARRAY['ping-ebr']::TEXT[]
  OR ping_igw IS NOT NULL
  OR ping_ebr IS NOT NULL;

-- Add comment to table
COMMENT ON TABLE test_results_ping IS 'Stores ping test results separately to avoid race conditions during concurrent test execution';
