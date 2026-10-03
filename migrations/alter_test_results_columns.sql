-- Alter test_results table columns
-- Run with: Get-Content migrations\alter_test_results_columns.sql | docker exec -i mojo-db psql -U mojo_db_user -d mojo_db

-- Rename ping_ms to ping_igw
ALTER TABLE test_results RENAME COLUMN ping_ms TO ping_igw;

-- Add ping_ebr
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS ping_ebr numeric;

-- Rename packet_loss to packet_loss_igw
ALTER TABLE test_results RENAME COLUMN packet_loss TO packet_loss_igw;

-- Add packet_loss_ebr
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS packet_loss_ebr numeric;

-- Rename traceroute_hops to traceroute_raw and change type to jsonb
ALTER TABLE test_results RENAME COLUMN traceroute_hops TO traceroute_raw;
ALTER TABLE test_results ALTER COLUMN traceroute_raw TYPE jsonb USING '{}'::jsonb;

-- Remove raw_response
ALTER TABLE test_results DROP COLUMN IF EXISTS raw_response;

-- Remove started_at
ALTER TABLE test_results DROP COLUMN IF EXISTS started_at;

-- Remove worker_id
ALTER TABLE test_results DROP COLUMN IF EXISTS worker_id;
