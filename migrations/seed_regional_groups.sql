-- Seeder untuk Regional Groups
-- Data regional dari aplikasi dashboard

INSERT INTO group_devices (id, name, code, description, created_at, updated_at) VALUES
(1, 'Regional 1', 'REG 1', 'Regional 1', '2026-05-09T21:44:23.233Z'::timestamp, '2026-05-10T01:29:11.892Z'::timestamp),
(3, 'Regional 2', 'REG 2', 'Regional 2', '2026-05-10T02:02:19.180Z'::timestamp, '2026-05-10T02:02:19.180Z'::timestamp),
(4, 'Regional 3', 'REG 3', 'Regional 3', '2026-05-10T15:51:02.203Z'::timestamp, '2026-05-18T04:40:01.090Z'::timestamp),
(9, 'Regional 4', 'REG 4', 'Regional 4', '2026-05-18T06:29:38.890Z'::timestamp, '2026-05-18T06:30:54.031Z'::timestamp),
(10, 'Default Group', NULL, 'Default device group', '2026-06-08T03:32:06.823Z'::timestamp, '2026-06-08T03:32:06.823Z'::timestamp),
(100, 'All ONTs', 'ALL', NULL, '2026-06-15T02:32:40.250Z'::timestamp, '2026-06-15T02:32:40.250Z'::timestamp),
(101, 'R01_Sumbagut', 'R01', NULL, '2026-06-15T04:17:05.282Z'::timestamp, '2026-06-15T04:17:05.282Z'::timestamp),
(102, 'R02_Sumbagsel', 'R02', NULL, '2026-06-15T04:17:05.282Z'::timestamp, '2026-06-15T04:17:05.282Z'::timestamp),
(103, 'R03_Jabotabek', 'R03', NULL, '2026-06-15T04:17:05.282Z'::timestamp, '2026-06-15T04:17:05.282Z'::timestamp),
(104, 'R04_Jabar', 'R04', NULL, '2026-06-15T04:17:05.282Z'::timestamp, '2026-06-15T04:17:05.282Z'::timestamp),
(105, 'R05_Jateng', 'R05', NULL, '2026-06-15T04:17:05.282Z'::timestamp, '2026-06-15T04:17:05.282Z'::timestamp),
(106, 'R06_Jatim', 'R06', NULL, '2026-06-15T04:17:05.282Z'::timestamp, '2026-06-15T04:17:05.282Z'::timestamp),
(107, 'R07_BaliNusra', 'R07', NULL, '2026-06-15T04:17:05.282Z'::timestamp, '2026-06-15T04:17:05.282Z'::timestamp),
(108, 'R08_Kalimantan', 'R08', NULL, '2026-06-15T04:17:05.282Z'::timestamp, '2026-06-15T04:17:05.282Z'::timestamp),
(109, 'R09_Sulawesi', 'R09', NULL, '2026-06-15T04:17:05.282Z'::timestamp, '2026-06-15T04:17:05.282Z'::timestamp),
(110, 'R10_Sumbagteng', 'R10', NULL, '2026-06-15T04:17:05.282Z'::timestamp, '2026-06-15T04:17:05.282Z'::timestamp),
(111, 'R11_MalukuPapua', 'R11', NULL, '2026-06-15T04:17:05.282Z'::timestamp, '2026-06-15T04:17:05.282Z'::timestamp),
(112, 'R12_Jabodetabek', 'R12', NULL, '2026-06-15T04:17:05.282Z'::timestamp, '2026-06-15T04:17:05.282Z'::timestamp),
(201, 'R03_TANGERANG', 'TGR', NULL, '2026-06-15T04:28:04.525Z'::timestamp, '2026-06-15T04:28:04.525Z'::timestamp),
(202, 'R03_NORTHERN_JAKARTA', 'NJ', NULL, '2026-06-15T04:28:04.525Z'::timestamp, '2026-06-15T04:28:04.525Z'::timestamp),
(203, 'R03_SOUTHERN_JAKARTA', 'SJ', NULL, '2026-06-15T04:28:04.525Z'::timestamp, '2026-06-15T04:28:04.525Z'::timestamp),
(204, 'R12_BEKASI', 'BKS', NULL, '2026-06-15T04:28:04.525Z'::timestamp, '2026-06-15T04:28:04.525Z'::timestamp),
(205, 'R12_BOGOR', 'BGR', NULL, '2026-06-15T04:28:04.525Z'::timestamp, '2026-06-15T04:28:04.525Z'::timestamp)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    description = EXCLUDED.description,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

-- Reset sequence agar id berikutnya tidak konflik
SELECT setval('group_devices_id_seq', COALESCE((SELECT MAX(id) FROM group_devices), 1));
