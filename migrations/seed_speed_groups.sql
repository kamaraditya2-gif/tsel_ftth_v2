-- Seeder untuk Speed Groups
-- Data speed groups dari aplikasi dashboard

INSERT INTO speed_group (id, name, speed_limit, upload_threshold, download_threshold, description, created_at, updated_at) VALUES
(2, 'Paket 50', 50, 15, 35, '', '2026-05-12T04:04:16.129Z'::timestamp, '2026-06-07T22:35:48.484Z'::timestamp),
(3, 'Paket 75', 75, 20, 50, '', '2026-05-15T10:55:31.840Z'::timestamp, '2026-06-07T22:36:17.455Z'::timestamp),
(1, 'Paket 100', 100, 30, 75, '', '2026-05-12T04:00:04.450Z'::timestamp, '2026-05-18T04:28:27.297Z'::timestamp),
(4, 'Paket 150', 150, 50, 120, '', '2026-05-15T10:56:21.892Z'::timestamp, '2026-05-18T04:28:47.147Z'::timestamp),
(5, 'Paket 200', 200, 70, 180, '', '2026-05-15T10:56:47.389Z'::timestamp, '2026-05-18T04:29:07.406Z'::timestamp)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    speed_limit = EXCLUDED.speed_limit,
    upload_threshold = EXCLUDED.upload_threshold,
    download_threshold = EXCLUDED.download_threshold,
    description = EXCLUDED.description,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

-- Reset sequence agar id berikutnya tidak konflik
SELECT setval('speed_group_id_seq', COALESCE((SELECT MAX(id) FROM speed_group), 1));
