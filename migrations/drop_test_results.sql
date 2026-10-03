-- Drop the old test_results table
-- WARNING: This will permanently delete all data in the test_results table
-- Make sure all applications are using the new separate tables:
-- - test_results_ping (ping data)
-- - test_results_traceroute (traceroute data)
-- - test_results_speed (download/upload speed data)
-- Run with: Get-Content migrations\drop_test_results.sql | docker exec -i mojo-db psql -U mojo_db_user -d mojo_db

-- Drop the dependent view first
DROP VIEW IF EXISTS v_device_health;

-- Drop indexes first (they will be dropped automatically with the table, but being explicit)
DROP INDEX IF EXISTS idx_results_device;
DROP INDEX IF EXISTS idx_results_job;
DROP INDEX IF EXISTS idx_results_success;
DROP INDEX IF EXISTS idx_results_time;
DROP INDEX IF EXISTS idx_test_results_device_id;
DROP INDEX IF EXISTS idx_test_results_executed_at;
DROP INDEX IF EXISTS idx_test_results_ping;
DROP INDEX IF EXISTS idx_test_results_speed;
DROP INDEX IF EXISTS idx_test_results_traceroute;
DROP INDEX IF EXISTS idx_test_results_traceroute_raw;

-- Drop the table
DROP TABLE IF EXISTS test_results;
