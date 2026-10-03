-- Rename queue_results table to test_results
-- Run with: Get-Content migrations\rename_queue_result_to_test_results.sql | docker exec -i mojo-db psql -U mojo_db_user -d mojo_db
ALTER TABLE queue_results RENAME TO test_results;
