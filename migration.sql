DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'next_run'
    ) THEN
        ALTER TABLE tasks ADD COLUMN next_run TIMESTAMP;
    END IF;
END $$;
