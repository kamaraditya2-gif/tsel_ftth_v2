-- Migration to update database schema to latest state
-- This migration should be run on fresh production deployments
-- to ensure consistency with the current development state

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE UPDATES
-- ============================================

-- 1. Rename queue_results to test_results if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'queue_results') THEN
        ALTER TABLE queue_results RENAME TO test_results;
    END IF;
END $$;

-- 2. Add started_at column to tasks if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'started_at'
    ) THEN
        ALTER TABLE tasks ADD COLUMN started_at TIMESTAMP;
    END IF;
END $$;

-- 3. Add raw_response column to queue_jobs if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'queue_jobs' AND column_name = 'raw_response'
    ) THEN
        ALTER TABLE queue_jobs ADD COLUMN raw_response JSONB;
    END IF;
END $$;

-- 4. Add run_id column to queue_jobs if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'queue_jobs' AND column_name = 'run_id'
    ) THEN
        ALTER TABLE queue_jobs ADD COLUMN run_id VARCHAR(100);
    END IF;
END $$;

-- 5. Create test_server table if it doesn't exist
CREATE TABLE IF NOT EXISTS test_server (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(100) NOT NULL,
    test_type VARCHAR(20) NOT NULL, -- 'igw', 'ebr'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Alter test_results columns
-- Add new columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_results' AND column_name = 'ping_igw'
    ) THEN
        ALTER TABLE test_results ADD COLUMN ping_igw FLOAT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_results' AND column_name = 'ping_ebr'
    ) THEN
        ALTER TABLE test_results ADD COLUMN ping_ebr FLOAT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_results' AND column_name = 'packet_loss_igw'
    ) THEN
        ALTER TABLE test_results ADD COLUMN packet_loss_igw FLOAT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_results' AND column_name = 'packet_loss_ebr'
    ) THEN
        ALTER TABLE test_results ADD COLUMN packet_loss_ebr FLOAT;
    END IF;
END $$;

-- Note: We keep ping_ms and packet_loss columns for backward compatibility
-- The application will use ping_igw/ping_ebr and packet_loss_igw/packet_loss_ebr

-- 7. Update test_results table name references in indexes
DROP INDEX IF EXISTS idx_results_device;
DROP INDEX IF EXISTS idx_results_time;
DROP INDEX IF EXISTS idx_results_success;
DROP INDEX IF EXISTS idx_results_job;

CREATE INDEX idx_test_results_device ON test_results(device_id);
CREATE INDEX idx_test_results_time ON test_results(executed_at);
CREATE INDEX idx_test_results_success ON test_results(success);
CREATE INDEX idx_test_results_job ON test_results(queue_job_id);

-- 8. Add test_type column to test_server if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_server' AND column_name = 'test_type'
    ) THEN
        ALTER TABLE test_server ADD COLUMN test_type VARCHAR(20);
    END IF;
END $$;

-- 9. Add index on queue_jobs run_id
CREATE INDEX IF NOT EXISTS idx_queue_run_id ON queue_jobs(run_id);

-- 10. Update views to use test_results instead of queue_results
DROP VIEW IF EXISTS v_device_health;

CREATE OR REPLACE VIEW v_device_health AS
SELECT 
    d.id,
    d.device_name,
    d.serial_number,
    d.ip_address,
    d.status,
    g.name as group_name,
    COUNT(r.id) as total_tests,
    AVG(r.ping_igw) as avg_ping,
    AVG(r.download_speed) as avg_download,
    AVG(r.upload_speed) as avg_upload,
    SUM(CASE WHEN r.success = true THEN 1 ELSE 0 END)::FLOAT / 
        NULLIF(COUNT(r.id), 0) * 100 as success_rate
FROM devices d
LEFT JOIN group_devices g ON d.group_id = g.id
LEFT JOIN test_results r ON d.id = r.device_id 
    AND r.executed_at > NOW() - INTERVAL '24 hours'
GROUP BY d.id, d.device_name, d.serial_number, d.ip_address, d.status, g.name;
