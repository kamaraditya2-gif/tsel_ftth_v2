-- Add run_id column to queue_jobs table for tracking individual executions
ALTER TABLE queue_jobs ADD COLUMN IF NOT EXISTS run_id VARCHAR(255);

-- Create index on run_id for faster queries
CREATE INDEX IF NOT EXISTS idx_queue_jobs_run_id ON queue_jobs(run_id);

-- Create composite index on task_id, device_id, run_id for consolidation queries
CREATE INDEX IF NOT EXISTS idx_queue_jobs_task_device_run ON queue_jobs(task_id, device_id, run_id);
