-- Seeder untuk Downstream Servers
-- Data downstream servers dari aplikasi dashboard

INSERT INTO downstream_servers (id, name, location, province, lat, lng, status, icon, color) VALUES
(1, 'R01_Sumbagut', 'Medan', 'Sumatera Utara', 3.59520000, 98.67220000, 'active', 'server', '#ef4444'),
(2, 'R02_Sumbagsel', 'Palembang', 'Sumatera Selatan', -2.97610000, 104.77540000, 'active', 'server', '#ef4444'),
(3, 'R03_Jakarta dan Banten', 'Jakarta Selatan', 'DKI Jakarta', -6.26150000, 106.81060000, 'active', 'server', '#ef4444'),
(4, 'R04_Jawa Barat', 'Bandung', 'Jawa Barat', -6.91470000, 107.60980000, 'active', 'server', '#ef4444'),
(5, 'R05_Jawa Tengah DIY', 'Semarang', 'Jawa Tengah', -6.99320000, 110.42030000, 'active', 'server', '#ef4444'),
(6, 'R06_Jawa Timur', 'Surabaya', 'Jawa Timur', -7.25750000, 112.75210000, 'active', 'server', '#ef4444'),
(7, 'R07_Bali Nusra', 'Denpasar', 'Bali', -8.65000000, 115.21670000, 'active', 'server', '#ef4444'),
(8, 'R08_Kalimantan', 'Balikpapan', 'Kalimantan Timur', -1.26540000, 116.83120000, 'active', 'server', '#ef4444'),
(9, 'R09_Sulawesi', 'Makassar', 'Sulawesi Selatan', -5.14860000, 119.43190000, 'active', 'server', '#ef4444'),
(10, 'R10_Sumbagteng', 'Pekanbaru', 'Riau', 0.50710000, 101.44780000, 'active', 'server', '#ef4444'),
(11, 'R11_Maluku dan Papua', 'Jayapura', 'Papua', -2.59200000, 140.70140000, 'active', 'server', '#ef4444'),
(12, 'R12_Eastern Jabotabek', 'Bekasi', 'Jawa Barat', -6.23490000, 106.98960000, 'active', 'server', '#ef4444')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    location = EXCLUDED.location,
    province = EXCLUDED.province,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    status = EXCLUDED.status,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

-- Reset sequence agar id berikutnya tidak konflik
SELECT setval('downstream_servers_id_seq', COALESCE((SELECT MAX(id) FROM downstream_servers), 1));
