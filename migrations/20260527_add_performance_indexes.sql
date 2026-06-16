-- Migration: Add performance indexes for frequently queried columns
-- Date: 2026-05-27
-- Author: SWE Optimization Agent

-- Indexes for queue_jobs (frequently queried for pending jobs, task lookups, device lookups)
CREATE INDEX IF NOT EXISTS idx_queue_jobs_status ON queue_jobs(status);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_device_id ON queue_jobs(device_id);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_task_id ON queue_jobs(task_id);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_test_type ON queue_jobs(test_type);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_created_at ON queue_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_status_created_at ON queue_jobs(status, created_at);

-- Indexes for test results tables (frequently joined with tasks and devices)
CREATE INDEX IF NOT EXISTS idx_test_results_ping_task_id ON test_results_ping(task_id);
CREATE INDEX IF NOT EXISTS idx_test_results_ping_device_id ON test_results_ping(device_id);
CREATE INDEX IF NOT EXISTS idx_test_results_ping_executed_at ON test_results_ping(executed_at);

CREATE INDEX IF NOT EXISTS idx_test_results_speed_upload_task_id ON test_results_speed_upload(task_id);
CREATE INDEX IF NOT EXISTS idx_test_results_speed_upload_device_id ON test_results_speed_upload(device_id);
CREATE INDEX IF NOT EXISTS idx_test_results_speed_upload_executed_at ON test_results_speed_upload(executed_at);

CREATE INDEX IF NOT EXISTS idx_test_results_speed_download_task_id ON test_results_speed_download(task_id);
CREATE INDEX IF NOT EXISTS idx_test_results_speed_download_device_id ON test_results_speed_download(device_id);
CREATE INDEX IF NOT EXISTS idx_test_results_speed_download_executed_at ON test_results_speed_download(executed_at);

CREATE INDEX IF NOT EXISTS idx_test_results_traceroute_task_id ON test_results_traceroute(task_id);
CREATE INDEX IF NOT EXISTS idx_test_results_traceroute_device_id ON test_results_traceroute(device_id);

-- Indexes for devices (frequently filtered by status and group)
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_group_id ON devices(group_id);
CREATE INDEX IF NOT EXISTS idx_devices_speed_id ON devices(speed_id);

-- Indexes for queue_results (legacy table, still used by dashboard)
CREATE INDEX IF NOT EXISTS idx_queue_results_device_id ON queue_results(device_id);
CREATE INDEX IF NOT EXISTS idx_queue_results_executed_at ON queue_results(executed_at);

-- Indexes for tasks (frequently filtered by schedule)
CREATE INDEX IF NOT EXISTS idx_tasks_schedule_type ON tasks(schedule_type);
CREATE INDEX IF NOT EXISTS idx_tasks_is_active ON tasks(is_active);

-- Index for system_logs (frequently queried for recent logs)
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);

-- Add comment for documentation
COMMENT ON INDEX idx_queue_jobs_status IS 'Optimizes polling for pending jobs by worker';
COMMENT ON INDEX idx_queue_jobs_status_created_at IS 'Optimizes dashboard queries filtering jobs by status and time';
COMMENT ON INDEX idx_test_results_speed_download_executed_at IS 'Optimizes dashboard chart queries for download speed over time';
