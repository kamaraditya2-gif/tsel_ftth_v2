-- Add traceroute_raw column to test_results table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_results' AND column_name = 'traceroute_raw'
    ) THEN
        ALTER TABLE test_results ADD COLUMN traceroute_raw JSONB;
    END IF;
END $$;
