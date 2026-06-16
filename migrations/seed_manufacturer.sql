-- Seed: Manufacturer data
-- This seed file adds default manufacturer data

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM manufacturer WHERE name = 'ZTE Corporation') THEN
        INSERT INTO manufacturer (name, created_by) VALUES
        ('ZTE Corporation', 'admin');
    END IF;
END $$;
