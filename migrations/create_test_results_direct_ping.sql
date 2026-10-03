-- Create test_results_direct_ping table for direct ping test results
-- This stores results from direct IP ping tests (not via IGW/EBR)
-- Run with: Get-Content migrations\create_test_results_direct_ping.sql | docker exec -i mojo-db psql -U mojo_db_user -d mojo_db

-- Create the new table
CREATE TABLE IF NOT EXISTS test_results_direct_ping (
  id SERIAL PRIMARY KEY,
  device_id INTEGER REFERENCES devices_ont(id) ON DELETE CASCADE,
  ip_address VARCHAR(45), -- IPv4 or IPv6 address
  avg_latency_ms DECIMAL(10,2), -- Average latency in milliseconds
  packet_loss_percent DECIMAL(5,2), -- Packet loss percentage
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_test_results_direct_ping_device_id ON test_results_direct_ping(device_id);
CREATE INDEX IF NOT EXISTS idx_test_results_direct_ping_ip_address ON test_results_direct_ping(ip_address);
CREATE INDEX IF NOT EXISTS idx_test_results_direct_ping_created_at ON test_results_direct_ping(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_results_direct_ping_device_created ON test_results_direct_ping(device_id, created_at DESC);

-- Add comment to table
COMMENT ON TABLE test_results_direct_ping IS 'Stores direct ping test results to specific IP addresses';
