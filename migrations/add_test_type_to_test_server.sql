-- Add test_type column to test_server table
ALTER TABLE test_server ADD COLUMN IF NOT EXISTS test_type VARCHAR(10) DEFAULT 'igw' CHECK (test_type IN ('igw', 'ebr'));
