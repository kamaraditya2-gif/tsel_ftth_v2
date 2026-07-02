-- Seeder untuk Master Area
-- Data master area dari aplikasi dashboard

INSERT INTO master_area (id, name, code, created_at) VALUES
(1, 'A1_Sumatera', 'SMA', '2026-06-24T09:47:23.316Z'::timestamp),
(2, 'A2_Jabotabek Jabar', 'JWA', '2026-06-24T09:47:23.316Z'::timestamp),
(3, 'A4_Pamasuka', 'KLM', '2026-06-24T09:47:23.316Z'::timestamp),
(4, 'Sulawesi', 'SLW', '2026-06-24T09:47:23.316Z'::timestamp),
(5, 'A3_Jawa Bali', 'BLN', '2026-06-24T09:47:23.316Z'::timestamp)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    created_at = EXCLUDED.created_at;

-- Reset sequence agar id berikutnya tidak konflik
SELECT setval('master_area_id_seq', COALESCE((SELECT MAX(id) FROM master_area), 1));
