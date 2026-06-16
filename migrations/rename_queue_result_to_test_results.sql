-- Rename queue_results table to test_results
-- Run with: Get-Content migrations\rename_queue_result_to_test_results.sql | docker exec -i mojojojo_postgres psql -U mojojojo_user -d mojojojo_database
ALTER TABLE queue_results RENAME TO test_results;
