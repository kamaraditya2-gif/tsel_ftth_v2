-- Seeder untuk Manufacturer
-- Data manufacturer dari aplikasi dashboard

INSERT INTO manufacturer (id, name, created_at, created_by) VALUES
(1, 'ZTE Corporation', '2026-06-03T04:38:10.545Z'::timestamp, 'admin')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    created_at = EXCLUDED.created_at,
    created_by = EXCLUDED.created_by;

-- Reset sequence agar id berikutnya tidak konflik
SELECT setval('manufacturer_id_seq', COALESCE((SELECT MAX(id) FROM manufacturer), 1));
