-- Update old queue_jobs records without run_id
-- Generate run_id from task_id and created_at for old records
UPDATE queue_jobs 
SET run_id = CONCAT(task_id, '-', EXTRACT(EPOCH FROM created_at)::bigint * 1000)
WHERE run_id IS NULL;
