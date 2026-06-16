-- Drop the payloads table
-- WARNING: This will permanently delete all payload data
-- Payload functionality has been removed from the worker
-- Run with: Get-Content migrations\drop_payloads.sql | docker exec -i mojojojo_postgres psql -U mojojojo_user -d mojojojo_database

-- Drop the foreign key constraint first
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_payload_id_fkey;

-- Drop the table
DROP TABLE IF EXISTS payloads;
