-- Update Area names
UPDATE master_area SET name = 'A1_Sumatera' WHERE code = 'SMA';
UPDATE master_area SET name = 'A2_Jabotabek Jabar' WHERE code = 'JWA';
UPDATE master_area SET name = 'A3_Jawa Bali' WHERE code = 'BLN';
UPDATE master_area SET name = 'A4_Pamasuka' WHERE code = 'KLM';
INSERT INTO master_area (name, code) VALUES ('A3_Jawa Bali', 'JWB') ON CONFLICT (code) DO UPDATE SET name = 'A3_Jawa Bali';
INSERT INTO master_area (name, code) VALUES ('A4_Pamasuka', 'SLA') ON CONFLICT (code) DO UPDATE SET name = 'A4_Pamasuka';
INSERT INTO master_area (name, code) VALUES ('A4_Pamasuka', 'MLP') ON CONFLICT (code) DO UPDATE SET name = 'A4_Pamasuka';

-- Hapus area duplikat
DELETE FROM master_area WHERE id NOT IN (SELECT MIN(id) FROM master_area GROUP BY name);

-- Update Regional names
UPDATE downstream_servers SET name = 'R01_Sumbagut' WHERE id = 1;
UPDATE downstream_servers SET name = 'R02_Sumbagsel' WHERE id = 2;
UPDATE downstream_servers SET name = 'R03_Jakarta dan Banten' WHERE id = 3;
UPDATE downstream_servers SET name = 'R04_Jawa Barat' WHERE id = 4;
UPDATE downstream_servers SET name = 'R05_Jawa Tengah DIY' WHERE id = 5;
UPDATE downstream_servers SET name = 'R06_Jawa Timur' WHERE id = 6;
UPDATE downstream_servers SET name = 'R07_Bali Nusra' WHERE id = 7;
UPDATE downstream_servers SET name = 'R08_Kalimantan' WHERE id = 8;
UPDATE downstream_servers SET name = 'R09_Sulawesi' WHERE id = 9;
UPDATE downstream_servers SET name = 'R10_Sumbagteng' WHERE id = 10;
UPDATE downstream_servers SET name = 'R11_Maluku dan Papua' WHERE id = 11;
UPDATE downstream_servers SET name = 'R12_Eastern Jabotabek' WHERE id = 12;

-- Reset NOP data
DELETE FROM master_cluster_nop;

-- Insert NOP sesuai mapping
-- A1_Sumatera → R01_Sumbagut, R10_Sumbagteng, R02_Sumbagsel
INSERT INTO master_cluster_nop (name, code, regional_id, area_id) VALUES
('01 NOP ACEH', 'ACH', 1, (SELECT id FROM master_area WHERE name='A1_Sumatera' LIMIT 1)),
('02 NOP BINJAI', 'BNJ', 1, (SELECT id FROM master_area WHERE name='A1_Sumatera' LIMIT 1)),
('03 NOP MEDAN', 'MED', 1, (SELECT id FROM master_area WHERE name='A1_Sumatera' LIMIT 1)),
('04 NOP PADANG SIDEMPUAN', 'PDS', 1, (SELECT id FROM master_area WHERE name='A1_Sumatera' LIMIT 1)),
('05 NOP PEMATANG SIANTAR', 'PMS', 1, (SELECT id FROM master_area WHERE name='A1_Sumatera' LIMIT 1)),
('06 NOP RANTAU PRAPAT', 'RTP', 1, (SELECT id FROM master_area WHERE name='A1_Sumatera' LIMIT 1)),
('07 NOP BATAM', 'BTM', 10, (SELECT id FROM master_area WHERE name='A1_Sumatera' LIMIT 1)),
('08 NOP BUKITTINGGI', 'BKT', 10, (SELECT id FROM master_area WHERE name='A1_Sumatera' LIMIT 1)),
('09 NOP DUMAI', 'DMI', 10, (SELECT id FROM master_area WHERE name='A1_Sumatera' LIMIT 1)),
('10 NOP PADANG', 'PDG', 10, (SELECT id FROM master_area WHERE name='A1_Sumatera' LIMIT 1)),
('11 NOP PEKANBARU', 'PBR', 10, (SELECT id FROM master_area WHERE name='A1_Sumatera' LIMIT 1)),
('12 NOP BENGKULU', 'BKL', 2, (SELECT id FROM master_area WHERE name='A1_Sumatera' LIMIT 1)),
('13 NOP JAMBI', 'JMB', 2, (SELECT id FROM master_area WHERE name='A1_Sumatera' LIMIT 1)),
('14 NOP LAMPUNG', 'LMP', 2, (SELECT id FROM master_area WHERE name='A1_Sumatera' LIMIT 1)),
('15 NOP PALEMBANG', 'PLG', 2, (SELECT id FROM master_area WHERE name='A1_Sumatera' LIMIT 1)),
('16 NOP PANGKAL PINANG', 'PPG', 2, (SELECT id FROM master_area WHERE name='A1_Sumatera' LIMIT 1));

-- A2_Jabotabek Jabar → R03_Jakarta dan Banten, R12_Eastern Jabotabek, R04_Jawa Barat
INSERT INTO master_cluster_nop (name, code, regional_id, area_id) VALUES
('17 NOP NORTHERN JAKARTA', 'JKN', 3, (SELECT id FROM master_area WHERE name='A2_Jabotabek Jabar' LIMIT 1)),
('18 NOP SOUTHERN JAKARTA', 'JKS', 3, (SELECT id FROM master_area WHERE name='A2_Jabotabek Jabar' LIMIT 1)),
('19 NOP SERANG', 'SRG', 3, (SELECT id FROM master_area WHERE name='A2_Jabotabek Jabar' LIMIT 1)),
('20 NOP TANGERANG', 'TNG', 3, (SELECT id FROM master_area WHERE name='A2_Jabotabek Jabar' LIMIT 1)),
('21 NOP BEKASI', 'BKS', 12, (SELECT id FROM master_area WHERE name='A2_Jabotabek Jabar' LIMIT 1)),
('22 NOP BOGOR', 'BGR', 12, (SELECT id FROM master_area WHERE name='A2_Jabotabek Jabar' LIMIT 1)),
('23 NOP KARAWANG', 'KRW', 12, (SELECT id FROM master_area WHERE name='A2_Jabotabek Jabar' LIMIT 1)),
('24 NOP BANDUNG', 'BDG', 4, (SELECT id FROM master_area WHERE name='A2_Jabotabek Jabar' LIMIT 1)),
('25 NOP CIREBON', 'CRB', 4, (SELECT id FROM master_area WHERE name='A2_Jabotabek Jabar' LIMIT 1)),
('26 NOP SOREANG', 'SRN', 4, (SELECT id FROM master_area WHERE name='A2_Jabotabek Jabar' LIMIT 1)),
('27 NOP TASIKMALAYA', 'TSM', 4, (SELECT id FROM master_area WHERE name='A2_Jabotabek Jabar' LIMIT 1));

-- A3_Jawa Bali → R05_Jawa Tengah DIY, R06_Jawa Timur, R07_Bali Nusra
INSERT INTO master_cluster_nop (name, code, regional_id, area_id) VALUES
('28 NOP MAGELANG', 'MGL', 5, (SELECT id FROM master_area WHERE name='A3_Jawa Bali' LIMIT 1)),
('29 NOP PEKALONGAN', 'PKL', 5, (SELECT id FROM master_area WHERE name='A3_Jawa Bali' LIMIT 1)),
('30 NOP PURWOKERTO', 'PWK', 5, (SELECT id FROM master_area WHERE name='A3_Jawa Bali' LIMIT 1)),
('31 NOP SEMARANG', 'SMG', 5, (SELECT id FROM master_area WHERE name='A3_Jawa Bali' LIMIT 1)),
('32 NOP SURAKARTA', 'SRA', 5, (SELECT id FROM master_area WHERE name='A3_Jawa Bali' LIMIT 1)),
('33 NOP YOGYAKARTA', 'YGK', 5, (SELECT id FROM master_area WHERE name='A3_Jawa Bali' LIMIT 1)),
('34 NOP JEMBER', 'JMB', 6, (SELECT id FROM master_area WHERE name='A3_Jawa Bali' LIMIT 1)),
('35 NOP LAMONGAN', 'LMG', 6, (SELECT id FROM master_area WHERE name='A3_Jawa Bali' LIMIT 1)),
('36 NOP MADIUN', 'MDN', 6, (SELECT id FROM master_area WHERE name='A3_Jawa Bali' LIMIT 1)),
('37 NOP MALANG', 'MLG', 6, (SELECT id FROM master_area WHERE name='A3_Jawa Bali' LIMIT 1)),
('38 NOP SIDOARJO', 'SDA', 6, (SELECT id FROM master_area WHERE name='A3_Jawa Bali' LIMIT 1)),
('39 NOP SURABAYA', 'SBY', 6, (SELECT id FROM master_area WHERE name='A3_Jawa Bali' LIMIT 1)),
('40 NOP DENPASAR', 'DPS', 7, (SELECT id FROM master_area WHERE name='A3_Jawa Bali' LIMIT 1)),
('41 NOP FLORES', 'FLR', 7, (SELECT id FROM master_area WHERE name='A3_Jawa Bali' LIMIT 1)),
('42 NOP KUPANG', 'KPG', 7, (SELECT id FROM master_area WHERE name='A3_Jawa Bali' LIMIT 1)),
('43 NOP MATARAM', 'MTR', 7, (SELECT id FROM master_area WHERE name='A3_Jawa Bali' LIMIT 1));

-- A4_Pamasuka → R08_Kalimantan, R09_Sulawesi, R11_Maluku dan Papua
INSERT INTO master_cluster_nop (name, code, regional_id, area_id) VALUES
('44 NOP BALIKPAPAN', 'BLP', 8, (SELECT id FROM master_area WHERE name='A4_Pamasuka' LIMIT 1)),
('45 NOP BANJARMASIN', 'BJM', 8, (SELECT id FROM master_area WHERE name='A4_Pamasuka' LIMIT 1)),
('46 NOP PALANGKARAYA', 'PLK', 8, (SELECT id FROM master_area WHERE name='A4_Pamasuka' LIMIT 1)),
('47 NOP PALANGKALAN BUN', 'PLB', 8, (SELECT id FROM master_area WHERE name='A4_Pamasuka' LIMIT 1)),
('48 NOP PONTIANAK', 'PTK', 8, (SELECT id FROM master_area WHERE name='A4_Pamasuka' LIMIT 1)),
('49 NOP SAMARINDA', 'SMD', 8, (SELECT id FROM master_area WHERE name='A4_Pamasuka' LIMIT 1)),
('50 NOP TARAKAN', 'TRK', 8, (SELECT id FROM master_area WHERE name='A4_Pamasuka' LIMIT 1)),
('51 NOP BONE', 'BNE', 9, (SELECT id FROM master_area WHERE name='A4_Pamasuka' LIMIT 1)),
('52 NOP KENDARI', 'KDR', 9, (SELECT id FROM master_area WHERE name='A4_Pamasuka' LIMIT 1)),
('53 NOP MAKASSAR', 'MKS', 9, (SELECT id FROM master_area WHERE name='A4_Pamasuka' LIMIT 1)),
('54 NOP MANADO', 'MND', 9, (SELECT id FROM master_area WHERE name='A4_Pamasuka' LIMIT 1)),
('55 NOP PALU', 'PLU', 9, (SELECT id FROM master_area WHERE name='A4_Pamasuka' LIMIT 1)),
('56 NOP PARE-PARE', 'PRE', 9, (SELECT id FROM master_area WHERE name='A4_Pamasuka' LIMIT 1)),
('57 NOP TERNATE', 'TRT', 9, (SELECT id FROM master_area WHERE name='A4_Pamasuka' LIMIT 1)),
('58 NOP AMBON', 'AMB', 11, (SELECT id FROM master_area WHERE name='A4_Pamasuka' LIMIT 1)),
('59 NOP JAYAPURA', 'JYP', 11, (SELECT id FROM master_area WHERE name='A4_Pamasuka' LIMIT 1)),
('60 NOP SORONG', 'SRG', 11, (SELECT id FROM master_area WHERE name='A4_Pamasuka' LIMIT 1)),
('61 NOP TIMIKA', 'TMK', 11, (SELECT id FROM master_area WHERE name='A4_Pamasuka' LIMIT 1));