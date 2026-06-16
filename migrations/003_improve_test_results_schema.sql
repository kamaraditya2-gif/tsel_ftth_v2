-- Improve test_results table schema
-- Add test_types array column and indexes for better query performance

-- Add test_types column to track which tests were executed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_results' AND column_name = 'test_types'
    ) THEN
        ALTER TABLE test_results ADD COLUMN test_types TEXT[];
    END IF;
END $$;

-- Add GIN index on traceroute_raw for JSONB queries
CREATE INDEX IF NOT EXISTS idx_test_results_traceroute_raw 
ON test_results USING GIN (traceroute_raw);

-- Add partial index for ping queries
CREATE INDEX IF NOT EXISTS idx_test_results_ping 
ON test_results (device_id, executed_at) 
WHERE ping_igw IS NOT NULL OR ping_ebr IS NOT NULL;

-- Add partial index for traceroute queries
CREATE INDEX IF NOT EXISTS idx_test_results_traceroute 
ON test_results (device_id, executed_at) 
WHERE traceroute_raw IS NOT NULL;

-- Add partial index for download/upload queries
CREATE INDEX IF NOT EXISTS idx_test_results_speed 
ON test_results (device_id, executed_at) 
WHERE download_speed IS NOT NULL OR upload_speed IS NOT NULL;

-- Add index on executed_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_test_results_executed_at 
ON test_results (executed_at DESC);

-- Add index on device_id for device-based queries
CREATE INDEX IF NOT EXISTS idx_test_results_device_id 
ON test_results (device_id);
