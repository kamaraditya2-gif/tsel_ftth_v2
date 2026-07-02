-- ACS Database Schema
-- PostgreSQL Schema for ACS Monitoring System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- MASTER TABLES (Identity & Configuration)
-- ============================================

-- Roles for user management
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL, -- admin, operator, viewer
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    email VARCHAR(100),
    full_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Device Groups
CREATE TABLE group_devices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Speed Groups
CREATE TABLE speed_group (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    speed_limit FLOAT,
    upload_threshold FLOAT,
    download_threshold FLOAT,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Devices (ONT/STB)
CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    device_name VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100) UNIQUE NOT NULL,
    mac_address VARCHAR(17) UNIQUE,
    ip_address INET,
    group_id INTEGER REFERENCES group_devices(id) ON DELETE SET NULL,
    speed_id INTEGER REFERENCES speed_group(id) ON DELETE SET NULL,
    indihome_id VARCHAR(100),
    cpe_type VARCHAR(50),
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    status VARCHAR(20) DEFAULT 'offline', -- online, offline, unknown
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Network Targets (IGW, EBR, Axiros)
CREATE TABLE network_targets (
    id SERIAL PRIMARY KEY,
    target_name VARCHAR(100) NOT NULL, -- IGW-1, EBR-Jkt, Axiros-Server
    target_type VARCHAR(20) NOT NULL, -- 'IGW', 'EBR', 'AXIROS'
    ip_address VARCHAR(100) NOT NULL,
    port INTEGER, -- Khusus Axiros
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Test Servers
CREATE TABLE test_server (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    ip_address VARCHAR(100) NOT NULL,
    test_type VARCHAR(20) DEFAULT 'igw', -- 'igw', 'ebr', 'axiros'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100)
);

-- Axiros Server Configuration
CREATE TABLE axiros_server (
    id SERIAL PRIMARY KEY,
    server_url VARCHAR(255) NOT NULL, -- https://acs.network.telkomsel.co.id
    base_path VARCHAR(255) NOT NULL DEFAULT '/live/AXAPI/Indihome', -- /live/AXAPI/Indihome
    auth_username VARCHAR(100),
    auth_password VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Application Settings
CREATE TABLE app_settings (
    id SERIAL PRIMARY KEY,
    app_name VARCHAR(100) NOT NULL DEFAULT 'MojoJojo Monitor',
    logo_url TEXT, -- URL or base64 of logo
    favicon_url TEXT, -- URL or base64 of favicon
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- OPERATIONAL TABLES (Task & Payload)
-- ============================================

-- API Payload Definitions
CREATE TABLE payloads (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    method VARCHAR(10) NOT NULL, -- GET, POST, PUT, DELETE
    endpoint TEXT NOT NULL,      -- /rest/2.0/devices/
    parameters JSONB,            -- Flexible parameters in JSON
    headers JSONB,               -- Custom headers
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tasks (Master Schedule)
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    task_type VARCHAR(20) NOT NULL, -- 'scheduled' atau 'ondemand'
    test_type VARCHAR(50) NOT NULL, -- 'ping', 'traceroute', 'speedtest', 'custom'
    
    -- Target (Salah satu harus diisi)
    group_id INTEGER REFERENCES group_devices(id) ON DELETE SET NULL,
    device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
    
    payload_id INTEGER REFERENCES payloads(id),
    cron_time VARCHAR(50), -- '* * * * *' jika scheduled (cron format)
    scheduled_at TIMESTAMP, -- Untuk ondemand single execution
    next_run TIMESTAMP, -- Next scheduled run time
    
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure either group_id or device_id is set
    CONSTRAINT chk_target_not_null CHECK (
        (group_id IS NOT NULL AND device_id IS NULL) OR 
        (group_id IS NULL AND device_id IS NOT NULL)
    )
);

-- Add deleted_at column to tasks if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE tasks ADD COLUMN deleted_at TIMESTAMP;
    END IF;
END $$;

-- ============================================
-- EXECUTION & RESULTS TABLES
-- ============================================

-- Queue Jobs (Antrean yang akan ditarik ke Redis)
CREATE TABLE queue_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    payload_data JSONB, -- Snapshot payload saat itu
    execution_type VARCHAR(20) NOT NULL, -- scheduled / ondemand
    test_type VARCHAR(50), -- ping, download, upload, traceroute, speedtest, custom
    run_id TEXT, -- Run ID for tracking multiple test executions (TEXT format: task_id-timestamp)
    group_id INTEGER REFERENCES group_devices(id) ON DELETE SET NULL,
    speed_id INTEGER REFERENCES speed_group(id) ON DELETE SET NULL,
    
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Add test_type column if it doesn't exist (for existing databases)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'queue_jobs' AND column_name = 'test_type'
    ) THEN
        ALTER TABLE queue_jobs ADD COLUMN test_type VARCHAR(50);
    END IF;
END $$;

-- Add speed_id column if it doesn't exist (for existing databases)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'devices' AND column_name = 'speed_id'
    ) THEN
        ALTER TABLE devices ADD COLUMN speed_id INTEGER REFERENCES speed_group(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Queue Results (Hasil Test untuk Dashboard) - LEGACY
-- This table is kept for backward compatibility
-- New test results are stored in separate tables (test_results_ping, test_results_speed_upload, test_results_speed_download, test_results_traceroute)
CREATE TABLE queue_results (
    id SERIAL PRIMARY KEY,
    queue_job_id UUID REFERENCES queue_jobs(id) ON DELETE CASCADE,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    
    -- Metrik hasil test
    ping_ms FLOAT,
    traceroute_hops TEXT,
    download_speed FLOAT, -- in Mbps
    upload_speed FLOAT,   -- in Mbps
    packet_loss FLOAT,    -- percentage
    
    raw_response JSONB, -- Data mentah dari API Axiros/Device
    success BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    
    executed_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SEPARATE TEST RESULTS TABLES
-- These tables separate test results by type to avoid race conditions
-- ============================================

-- Ping Test Results
CREATE TABLE test_results_ping (
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

-- Upload Speed Test Results
CREATE TABLE test_results_speed_upload (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  queue_job_id UUID REFERENCES queue_jobs(id) ON DELETE SET NULL,
  upload_speed DECIMAL(10,2), -- Upload speed in Mbps
  upload_threshold DECIMAL(10,2), -- Upload speed threshold for success
  run_id TEXT, -- Run ID for tracking multiple test executions (TEXT format: task_id-timestamp)
  success BOOLEAN DEFAULT false,
  executed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Download Speed Test Results
CREATE TABLE test_results_speed_download (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  queue_job_id UUID REFERENCES queue_jobs(id) ON DELETE SET NULL,
  download_speed DECIMAL(10,2), -- Download speed in Mbps
  download_threshold DECIMAL(10,2), -- Download speed threshold for success
  run_id TEXT, -- Run ID for tracking multiple test executions (TEXT format: task_id-timestamp)
  success BOOLEAN DEFAULT false,
  executed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Traceroute Test Results
CREATE TABLE test_results_traceroute (
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

-- Add comments to tables
COMMENT ON TABLE test_results_ping IS 'Stores ping test results separately to avoid race conditions during concurrent test execution';
COMMENT ON TABLE test_results_speed_upload IS 'Stores upload speed test results separately to avoid race conditions during concurrent test execution';
COMMENT ON TABLE test_results_speed_download IS 'Stores download speed test results separately to avoid race conditions during concurrent test execution';
COMMENT ON TABLE test_results_traceroute IS 'Stores traceroute test results separately to avoid race conditions during concurrent test execution';

-- System Logs
CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(10) NOT NULL, -- info, warning, error, debug
    message TEXT NOT NULL,
    context JSONB, -- ID job, device, atau context lain
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Devices indexes
CREATE INDEX idx_devices_group ON devices(group_id);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_serial ON devices(serial_number);

-- Tasks indexes
CREATE INDEX idx_tasks_type ON tasks(task_type);
CREATE INDEX idx_tasks_active ON tasks(is_active) WHERE is_active = true;
CREATE INDEX idx_tasks_group ON tasks(group_id);
CREATE INDEX idx_tasks_device ON tasks(device_id);

-- Queue Jobs indexes
CREATE INDEX idx_queue_status ON queue_jobs(status) WHERE status = 'pending';
CREATE INDEX idx_queue_task ON queue_jobs(task_id);
CREATE INDEX idx_queue_device ON queue_jobs(device_id);
CREATE INDEX idx_queue_created ON queue_jobs(created_at);

-- Queue Results indexes (Legacy - Critical for Dashboard)
CREATE INDEX idx_results_device ON queue_results(device_id);
CREATE INDEX idx_results_time ON queue_results(executed_at);
CREATE INDEX idx_results_success ON queue_results(success);
CREATE INDEX idx_results_job ON queue_results(queue_job_id);

-- Test Results Ping indexes
CREATE INDEX idx_test_results_ping_device_id ON test_results_ping(device_id);
CREATE INDEX idx_test_results_ping_task_id ON test_results_ping(task_id);
CREATE INDEX idx_test_results_ping_queue_job_id ON test_results_ping(queue_job_id);
CREATE INDEX idx_test_results_ping_executed_at ON test_results_ping(executed_at DESC);
CREATE INDEX idx_test_results_ping_device_executed ON test_results_ping(device_id, executed_at DESC);

-- Test Results Speed Upload indexes
CREATE INDEX idx_test_results_speed_upload_device_id ON test_results_speed_upload(device_id);
CREATE INDEX idx_test_results_speed_upload_task_id ON test_results_speed_upload(task_id);
CREATE INDEX idx_test_results_speed_upload_queue_job_id ON test_results_speed_upload(queue_job_id);
CREATE INDEX idx_test_results_speed_upload_executed_at ON test_results_speed_upload(executed_at DESC);
CREATE INDEX idx_test_results_speed_upload_device_executed ON test_results_speed_upload(device_id, executed_at DESC);

-- Test Results Speed Download indexes
CREATE INDEX idx_test_results_speed_download_device_id ON test_results_speed_download(device_id);
CREATE INDEX idx_test_results_speed_download_task_id ON test_results_speed_download(task_id);
CREATE INDEX idx_test_results_speed_download_queue_job_id ON test_results_speed_download(queue_job_id);
CREATE INDEX idx_test_results_speed_download_executed_at ON test_results_speed_download(executed_at DESC);
CREATE INDEX idx_test_results_speed_download_device_executed ON test_results_speed_download(device_id, executed_at DESC);

-- Test Results Traceroute indexes
CREATE INDEX idx_test_results_traceroute_device_id ON test_results_traceroute(device_id);
CREATE INDEX idx_test_results_traceroute_task_id ON test_results_traceroute(task_id);
CREATE INDEX idx_test_results_traceroute_queue_job_id ON test_results_traceroute(queue_job_id);
CREATE INDEX idx_test_results_traceroute_executed_at ON test_results_traceroute(executed_at DESC);
CREATE INDEX idx_test_results_traceroute_device_executed ON test_results_traceroute(device_id, executed_at DESC);
CREATE INDEX idx_test_results_traceroute_raw ON test_results_traceroute USING GIN (traceroute_raw);

-- System Logs indexes
CREATE INDEX idx_logs_level ON system_logs(level);
CREATE INDEX idx_logs_time ON system_logs(created_at);

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default roles
INSERT INTO roles (name, description) VALUES
('admin', 'Full access to all features'),
('operator', 'Can manage devices and tasks'),
('viewer', 'Read-only access to dashboard');

-- Insert default admin user (password: admin123 - should be hashed in production)
INSERT INTO users (username, password, role_id, email) VALUES
('admin', '$2b$10$ReHCkVPOEEKjLBRCyDTcXeS/.ilZoGJbDzgStdynUzNEtZuxmVhJe', 1, 'admin@mojojojo.local');
-- Note: The password above is bcrypt hash for 'admin123'

-- Insert sample group
INSERT INTO group_devices (name, description) VALUES
('Default Group', 'Default device group');

-- Insert sample network targets
INSERT INTO network_targets (target_name, target_type, ip_address, port, description) VALUES
('IGW-Primary', 'IGW', '192.168.1.1', NULL, 'Primary Internet Gateway'),
('EBR-Jakarta', 'EBR', '10.0.0.1', NULL, 'Edge Router Jakarta'),
('Axiros-Server', 'AXIROS', '192.168.100.10', 8080, 'ACS Axiros Server');

-- Insert sample payload
INSERT INTO payloads (name, method, endpoint, parameters, description) VALUES
('Ping Device', 'GET', '/rest/2.0/devices/{serial}/ping', '{"timeout": 5}', 'Ping test for device'),
('Traceroute', 'GET', '/rest/2.0/devices/{serial}/traceroute', '{"max_hops": 30}', 'Traceroute test'),
('Speedtest', 'POST', '/rest/2.0/devices/{serial}/speedtest', '{"duration": 10}', 'Speed test measurement');

-- Insert default app settings
INSERT INTO app_settings (app_name, logo_url, favicon_url) VALUES
('MojoJojo Monitor', NULL, NULL);

-- ============================================
-- VIEWS FOR DASHBOARD
-- ============================================

-- View: Device Health Summary
CREATE OR REPLACE VIEW v_device_health AS
SELECT 
    d.id,
    d.device_name,
    d.serial_number,
    d.ip_address,
    d.status,
    g.name as group_name,
    COUNT(r.id) as total_tests,
    AVG(r.ping_ms) as avg_ping,
    AVG(r.download_speed) as avg_download,
    AVG(r.upload_speed) as avg_upload,
    SUM(CASE WHEN r.success = true THEN 1 ELSE 0 END)::FLOAT / 
        NULLIF(COUNT(r.id), 0) * 100 as success_rate
FROM devices d
LEFT JOIN group_devices g ON d.group_id = g.id
LEFT JOIN queue_results r ON d.id = r.device_id 
    AND r.executed_at > NOW() - INTERVAL '24 hours'
GROUP BY d.id, d.device_name, d.serial_number, d.ip_address, d.status, g.name;

-- View: Task Execution Summary
CREATE OR REPLACE VIEW v_task_summary AS
SELECT 
    t.id,
    t.title,
    t.task_type,
    t.test_type,
    t.is_active,
    t.cron_time,
    COUNT(qj.id) as total_jobs,
    SUM(CASE WHEN qj.status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
    SUM(CASE WHEN qj.status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
    SUM(CASE WHEN qj.status = 'pending' THEN 1 ELSE 0 END) as pending_jobs,
    SUM(CASE WHEN qj.status = 'processing' THEN 1 ELSE 0 END) as processing_jobs
FROM tasks t
LEFT JOIN queue_jobs qj ON t.id = qj.task_id
GROUP BY t.id, t.title, t.task_type, t.test_type, t.is_active, t.cron_time;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function: Update device timestamp
CREATE OR REPLACE FUNCTION update_device_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to devices
CREATE TRIGGER trg_devices_update_timestamp
    BEFORE UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_device_timestamp();

-- Apply trigger to users
CREATE TRIGGER trg_users_update_timestamp
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_device_timestamp();

-- Apply trigger to group_devices
CREATE TRIGGER trg_group_devices_update_timestamp
    BEFORE UPDATE ON group_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_device_timestamp();

-- Apply trigger to tasks
CREATE TRIGGER trg_tasks_update_timestamp
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_device_timestamp();

-- Apply trigger to app_settings
CREATE TRIGGER trg_app_settings_update_timestamp
    BEFORE UPDATE ON app_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_device_timestamp();
