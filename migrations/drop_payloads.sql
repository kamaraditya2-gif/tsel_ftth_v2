-- Drop the payloads table
-- WARNING: This will permanently delete all payload data
-- Payload functionality has been removed from the worker
-- Run with: Get-Content migrations\drop_payloads.sql | docker exec -i mojo-db psql -U mojo_db_user -d mojo_db

-- Drop the foreign key constraint first
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_payload_id_fkey;

-- Drop the table
DROP TABLE IF EXISTS payloads;
