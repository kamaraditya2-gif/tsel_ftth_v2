-- Seeder untuk ONT Model
-- Data ONT model dari aplikasi dashboard

INSERT INTO ont_model (id, name, manufacturer_id, created_at, created_by) VALUES
(1, 'F670L', 1, '2026-06-03T04:42:11.747Z'::timestamp, 'admin')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    manufacturer_id = EXCLUDED.manufacturer_id,
    created_at = EXCLUDED.created_at,
    created_by = EXCLUDED.created_by;

-- Reset sequence agar id berikutnya tidak konflik
SELECT setval('ont_model_id_seq', COALESCE((SELECT MAX(id) FROM ont_model), 1));
