-- Seed: ONT Model data
-- This seed file adds default ONT model data

DO $$
DECLARE
    zte_manufacturer_id INTEGER;
BEGIN
    -- Get the manufacturer ID for ZTE Corporation
    SELECT id INTO zte_manufacturer_id FROM manufacturer WHERE name = 'ZTE Corporation' LIMIT 1;
    
    -- Insert F670L model linked to ZTE Corporation
    IF zte_manufacturer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ont_model WHERE name = 'F670L') THEN
        INSERT INTO ont_model (name, manufacturer_id, created_by) VALUES
        ('F670L', zte_manufacturer_id, 'admin');
    ELSIF zte_manufacturer_id IS NULL AND NOT EXISTS (SELECT 1 FROM ont_model WHERE name = 'F670L') THEN
        -- If manufacturer doesn't exist, insert without manufacturer_id
        INSERT INTO ont_model (name, created_by) VALUES
        ('F670L', 'admin');
    END IF;
END $$;
