-- 0009_seed_reference_data.sql
-- Data referensi awal: role, admin default, setting, root cause, threshold,
-- dan hierarki organisasi Area → Regional → NOP (61 NOP).
--
-- ⚠️  Admin default: username "admin", password "admin123".
--     Ganti segera setelah login pertama.

-- ---------------------------------------------------------------------------
-- Roles & admin
-- ---------------------------------------------------------------------------
INSERT INTO roles (name, description) VALUES
    ('Administrator', 'Full access to all features'),
    ('Admin',         'Can manage devices and tasks'),
    ('User',          'Read-only access to dashboard'),
    ('field',         'Field engineer — diarahkan ke halaman /field');

INSERT INTO users (username, password, role_id, email, full_name, is_active) VALUES
    ('admin',
     '$2b$10$v/ULSFrsxPlB8noPulB8neKRGE3fTAm0dSTqR8WW79D4Lsmo4v3QW',   -- admin123
     (SELECT id FROM roles WHERE name = 'Administrator'),
     'admin@mojojojo.local', 'Administrator', true);

-- ---------------------------------------------------------------------------
-- Setting aplikasi & integrasi
-- ---------------------------------------------------------------------------
INSERT INTO app_settings (app_name) VALUES ('MojoJojo Monitor');

INSERT INTO integration_settings (platform, name, status, config) VALUES
    ('telegram',  'Telegram Bot',     'inactive', '{}'),
    ('whatsapp',  'WhatsApp API',     'inactive', '{}'),
    ('ticketing', 'Ticketing System', 'inactive', '{}');

-- ---------------------------------------------------------------------------
-- Root cause alarm (L1 → L2)
-- ---------------------------------------------------------------------------
INSERT INTO alarm_root_cause (name, category) VALUES
    ('High Temperature',     'L1'),
    ('PLN Down',             'L1'),
    ('NE Faulty',            'L1'),
    ('FO Cut',               'L1'),
    ('Flicker',              'L1'),
    ('Capacity Utilization', 'L1'),
    ('Interface CRC Error',  'L1'),
    ('Interface Error',      'L1'),
    ('Packet Discard',       'L1'),
    ('ONT Obsolete',         'L2'),
    ('Power Down',           'L2'),
    ('FO Cut',               'L2'),
    ('NE Faulty',            'L2');

-- ---------------------------------------------------------------------------
-- Threshold default
-- ---------------------------------------------------------------------------
INSERT INTO threshold_master (category, alarm_name, profile, threshold_type, warning_value, critical_value, unit) VALUES
    ('Performance',  'Latency',            NULL,       'UPPER', 50,  100,  'ms'),
    ('Performance',  'Latency_IGW',        NULL,       'UPPER', 30,  60,   'ms'),
    ('Performance',  'Latency_EBR',        NULL,       'UPPER', 80,  150,  'ms'),
    ('Performance',  'Packet_Loss',        NULL,       'UPPER', 3,   5,    '%'),
    ('Performance',  'Packet_Loss_IGW',    NULL,       'UPPER', 2,   4,    '%'),
    ('Performance',  'Packet_Loss_EBR',    NULL,       'UPPER', 5,   10,   '%'),
    ('Performance',  'Jitter',             NULL,       'UPPER', 10,  20,   'ms'),
    ('Throughput',   'Download_Speed',     'Platinum', 'LOWER', 80,  50,   'Mbps'),
    ('Throughput',   'Download_Speed',     'Gold',     'LOWER', 60,  30,   'Mbps'),
    ('Throughput',   'Download_Speed',     'Silver',   'LOWER', 40,  20,   'Mbps'),
    ('Throughput',   'Download_Speed',     'Bronze',   'LOWER', 20,  10,   'Mbps'),
    ('Throughput',   'Upload_Speed',       'Platinum', 'LOWER', 40,  20,   'Mbps'),
    ('Throughput',   'Upload_Speed',       'Gold',     'LOWER', 30,  15,   'Mbps'),
    ('Throughput',   'Upload_Speed',       'Silver',   'LOWER', 20,  10,   'Mbps'),
    ('Throughput',   'Upload_Speed',       'Bronze',   'LOWER', 10,  5,    'Mbps'),
    ('Capacity',     'CPU_Utilization',    NULL,       'UPPER', 70,  85,   '%'),
    ('Capacity',     'Memory_Utilization', NULL,       'UPPER', 70,  85,   '%'),
    ('Hardware',     'Temperature',        NULL,       'UPPER', 55,  65,   '°C'),
    ('Hardware',     'CRC_Error',          NULL,       'UPPER', 100, 1000, 'count'),
    ('Availability', 'Uptime',             NULL,       'LOWER', 95,  90,   '%'),
    ('Availability', 'Ping_Success_Rate',  NULL,       'LOWER', 98,  95,   '%');

-- ---------------------------------------------------------------------------
-- Referensi perangkat
-- ---------------------------------------------------------------------------
INSERT INTO manufacturer (name, created_by) VALUES ('ZTE Corporation', 'admin');
INSERT INTO ont_model (name, manufacturer_id, created_by)
    VALUES ('F670L', (SELECT id FROM manufacturer WHERE name = 'ZTE Corporation'), 'admin');

-- ---------------------------------------------------------------------------
-- Organisasi: Area → Regional → NOP
-- ---------------------------------------------------------------------------
INSERT INTO master_area (name, code) VALUES
    ('A1_Sumatera',        'A1'),
    ('A2_Jabotabek Jabar', 'A2'),
    ('A3_Jawa Bali',       'A3'),
    ('A4_Pamasuka',        'A4');

-- id regional dipakai sebagai REGION_ID worker regional, jadi diisi eksplisit.
INSERT INTO downstream_servers (id, name) VALUES
    (1,  'R01_Sumbagut'),
    (2,  'R02_Sumbagsel'),
    (3,  'R03_Jakarta dan Banten'),
    (4,  'R04_Jawa Barat'),
    (5,  'R05_Jawa Tengah DIY'),
    (6,  'R06_Jawa Timur'),
    (7,  'R07_Bali Nusra'),
    (8,  'R08_Kalimantan'),
    (9,  'R09_Sulawesi'),
    (10, 'R10_Sumbagteng'),
    (11, 'R11_Maluku dan Papua'),
    (12, 'R12_Eastern Jabotabek');
SELECT setval(pg_get_serial_sequence('downstream_servers', 'id'), (SELECT MAX(id) FROM downstream_servers));

INSERT INTO master_cluster_nop (name, code, regional_id, area_id, lat, lng)
SELECT v.name, v.code, v.regional_id, a.id, v.lat, v.lng
FROM (VALUES
    ('01 NOP ACEH', 'ACH', 1, 'A1', 5.5500, 95.3167),
    ('02 NOP BINJAI', 'BNJ', 1, 'A1', 3.6000, 98.5000),
    ('03 NOP MEDAN', 'MED', 1, 'A1', 3.5952, 98.6722),
    ('04 NOP PADANG SIDEMPUAN', 'PDS', 1, 'A1', 1.1167, 99.7333),
    ('05 NOP PEMATANG SIANTAR', 'PMS', 1, 'A1', 2.9667, 99.0667),
    ('06 NOP RANTAU PRAPAT', 'RTP', 1, 'A1', 2.1000, 99.8333),
    ('07 NOP BATAM', 'BTM', 10, 'A1', 1.0833, 104.0333),
    ('08 NOP BUKITTINGGI', 'BKT', 10, 'A1', -0.3000, 100.3667),
    ('09 NOP DUMAI', 'DMI', 10, 'A1', 1.6833, 101.4500),
    ('10 NOP PADANG', 'PDG', 10, 'A1', -0.9500, 100.3500),
    ('11 NOP PEKANBARU', 'PBR', 10, 'A1', 0.5333, 101.4500),
    ('12 NOP BENGKULU', 'BKL', 2, 'A1', -3.8000, 102.2667),
    ('13 NOP JAMBI', 'JMB', 2, 'A1', -1.6167, 103.6167),
    ('14 NOP LAMPUNG', 'LMP', 2, 'A1', -5.4500, 105.2667),
    ('15 NOP PALEMBANG', 'PLG', 2, 'A1', -2.9833, 104.7500),
    ('16 NOP PANGKAL PINANG', 'PPG', 2, 'A1', -2.1333, 106.1167),
    ('17 NOP NORTHERN JAKARTA', 'JKN', 3, 'A2', -6.1750, 106.8286),
    ('18 NOP SOUTHERN JAKARTA', 'JKS', 3, 'A2', -6.2615, 106.8102),
    ('19 NOP SERANG', 'SRG', 3, 'A2', -6.1167, 106.1500),
    ('20 NOP TANGERANG', 'TNG', 3, 'A2', -6.1790, 106.6300),
    ('21 NOP BEKASI', 'BKS', 12, 'A2', -6.2349, 106.9896),
    ('22 NOP BOGOR', 'BGR', 12, 'A2', -6.5972, 106.8060),
    ('23 NOP KARAWANG', 'KRW', 12, 'A2', -6.3333, 107.3333),
    ('24 NOP BANDUNG', 'BDG', 4, 'A2', -6.9147, 107.6098),
    ('25 NOP CIREBON', 'CRB', 4, 'A2', -6.7150, 108.5550),
    ('26 NOP SOREANG', 'SRN', 4, 'A2', -7.0167, 107.5167),
    ('27 NOP TASIKMALAYA', 'TSM', 4, 'A2', -7.3274, 108.2200),
    ('28 NOP MAGELANG', 'MGL', 5, 'A3', -7.4667, 110.2167),
    ('29 NOP PEKALONGAN', 'PKL', 5, 'A3', -6.8917, 109.6683),
    ('30 NOP PURWOKERTO', 'PWK', 5, 'A3', -7.4167, 109.2333),
    ('31 NOP SEMARANG', 'SMG', 5, 'A3', -6.9667, 110.4167),
    ('32 NOP SURAKARTA', 'SRA', 5, 'A3', -7.5700, 110.8260),
    ('33 NOP YOGYAKARTA', 'YGK', 5, 'A3', -7.8000, 110.3667),
    ('34 NOP JEMBER', 'JMB', 6, 'A3', -8.1833, 113.6833),
    ('35 NOP LAMONGAN', 'LMG', 6, 'A3', -6.8833, 112.0500),
    ('36 NOP MADIUN', 'MDN', 6, 'A3', -7.6300, 111.5300),
    ('37 NOP MALANG', 'MLG', 6, 'A3', -7.9797, 112.6304),
    ('38 NOP SIDOARJO', 'SDA', 6, 'A3', -7.4667, 112.7167),
    ('39 NOP SURABAYA', 'SBY', 6, 'A3', -7.2575, 112.7528),
    ('40 NOP DENPASAR', 'DPS', 7, 'A3', -8.6500, 115.2167),
    ('41 NOP FLORES', 'FLR', 7, 'A3', -8.3500, 121.0000),
    ('42 NOP KUPANG', 'KPG', 7, 'A3', -10.1667, 123.5833),
    ('43 NOP MATARAM', 'MTR', 7, 'A3', -8.5833, 116.1167),
    ('44 NOP BALIKPAPAN', 'BLP', 8, 'A4', -1.2667, 116.8333),
    ('45 NOP BANJARMASIN', 'BJM', 8, 'A4', -3.3167, 114.5833),
    ('46 NOP PALANGKARAYA', 'PLK', 8, 'A4', -1.8833, 113.5333),
    ('47 NOP PALANGKALAN BUN', 'PLB', 8, 'A4', -2.2167, 113.9167),
    ('48 NOP PONTIANAK', 'PTK', 8, 'A4', -0.0333, 109.3333),
    ('49 NOP SAMARINDA', 'SMD', 8, 'A4', -0.5000, 117.1500),
    ('50 NOP TARAKAN', 'TRK', 8, 'A4', 3.3167, 117.6000),
    ('51 NOP BONE', 'BNE', 9, 'A4', -4.5333, 120.3333),
    ('52 NOP KENDARI', 'KDR', 9, 'A4', -3.9667, 122.5167),
    ('53 NOP MAKASSAR', 'MKS', 9, 'A4', -5.1333, 119.4167),
    ('54 NOP MANADO', 'MND', 9, 'A4', 1.4833, 124.8500),
    ('55 NOP PALU', 'PLU', 9, 'A4', -0.9000, 119.8667),
    ('56 NOP PARE-PARE', 'PRE', 9, 'A4', -3.7167, 119.6667),
    ('57 NOP TERNATE', 'TRT', 9, 'A4', 0.8000, 127.3833),
    ('58 NOP AMBON', 'AMB', 11, 'A4', -3.7000, 128.1833),
    ('59 NOP JAYAPURA', 'JYP', 11, 'A4', -2.5920, 140.7014),
    ('60 NOP SORONG', 'SRG', 11, 'A4', -0.8667, 131.2500),
    ('61 NOP TIMIKA', 'TMK', 11, 'A4', -4.5333, 136.8833)
) AS v(name, code, regional_id, area_code, lat, lng)
JOIN master_area a ON a.code = v.area_code;
