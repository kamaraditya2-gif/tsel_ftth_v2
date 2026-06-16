-- Fix ON DELETE CASCADE on test_results queue_job_id foreign key
-- This prevents test_results from being deleted when queue_jobs are deleted

-- Drop the foreign key constraint with CASCADE
ALTER TABLE test_results DROP CONSTRAINT IF EXISTS queue_results_queue_job_id_fkey;

-- Re-add the foreign key without ON DELETE CASCADE
ALTER TABLE test_results 
ADD CONSTRAINT queue_results_queue_job_id_fkey 
FOREIGN KEY (queue_job_id) REFERENCES queue_jobs(id) ON DELETE SET NULL;
