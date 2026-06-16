-- Update devices with random group_id and speed_id
-- This will assign random group_id from group_devices and random speed_id from speed_group

UPDATE devices 
SET 
    group_id = (SELECT id FROM group_devices ORDER BY RANDOM() LIMIT 1),
    speed_id = (SELECT id FROM speed_group ORDER BY RANDOM() LIMIT 1)
WHERE group_id IS NULL OR speed_id IS NULL;

-- Or to update ALL devices (even those that already have values):
-- UPDATE devices 
-- SET 
--     group_id = (SELECT id FROM group_devices ORDER BY RANDOM() LIMIT 1),
--     speed_id = (SELECT id FROM speed_group ORDER BY RANDOM() LIMIT 1);

-- Verify the update
SELECT 
    d.id, 
    d.device_name, 
    d.group_id, 
    g.name as group_name,
    d.speed_id, 
    sg.name as speed_name
FROM devices d
LEFT JOIN group_devices g ON d.group_id = g.id
LEFT JOIN speed_group sg ON d.speed_id = sg.id
LIMIT 10;
