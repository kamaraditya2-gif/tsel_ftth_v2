-- Fix NOP coordinates (semua NULL karena migration 005 pake kode lama)
-- Setiap NOP diisi koordinat kota referensinya
-- HATI-HATI: ada kode duplikat (SRG=Serang&Sorong, JMB=Jambi&Jember)
-- Maka kita update by id (tidak by code) untuk yg duplikat

-- A1_Sumatera → R01_Sumbagut, R10_Sumbagteng, R02_Sumbagsel
UPDATE master_cluster_nop SET lat = 5.5500, lng = 95.3167 WHERE name = '01 NOP ACEH';
UPDATE master_cluster_nop SET lat = 3.6000, lng = 98.5000 WHERE name = '02 NOP BINJAI';
UPDATE master_cluster_nop SET lat = 3.5952, lng = 98.6722 WHERE name = '03 NOP MEDAN';
UPDATE master_cluster_nop SET lat = 1.1167, lng = 99.7333 WHERE name = '04 NOP PADANG SIDEMPUAN';
UPDATE master_cluster_nop SET lat = 2.9667, lng = 99.0667 WHERE name = '05 NOP PEMATANG SIANTAR';
UPDATE master_cluster_nop SET lat = 2.1000, lng = 99.8333 WHERE name = '06 NOP RANTAU PRAPAT';
UPDATE master_cluster_nop SET lat = 1.0833, lng = 104.0333 WHERE name = '07 NOP BATAM';
UPDATE master_cluster_nop SET lat = -0.3000, lng = 100.3667 WHERE name = '08 NOP BUKITTINGGI';
UPDATE master_cluster_nop SET lat = 1.6833, lng = 101.4500 WHERE name = '09 NOP DUMAI';
UPDATE master_cluster_nop SET lat = -0.9500, lng = 100.3500 WHERE name = '10 NOP PADANG';
UPDATE master_cluster_nop SET lat = 0.5333, lng = 101.4500 WHERE name = '11 NOP PEKANBARU';
UPDATE master_cluster_nop SET lat = -3.8000, lng = 102.2667 WHERE name = '12 NOP BENGKULU';
UPDATE master_cluster_nop SET lat = -1.6167, lng = 103.6167 WHERE name = '13 NOP JAMBI';
UPDATE master_cluster_nop SET lat = -5.4500, lng = 105.2667 WHERE name = '14 NOP LAMPUNG';
UPDATE master_cluster_nop SET lat = -2.9833, lng = 104.7500 WHERE name = '15 NOP PALEMBANG';
UPDATE master_cluster_nop SET lat = -2.1333, lng = 106.1167 WHERE name = '16 NOP PANGKAL PINANG';

-- A2_Jabotabek Jabar → R03_Jakarta dan Banten, R12_Eastern Jabotabek, R04_Jawa Barat
UPDATE master_cluster_nop SET lat = -6.1750, lng = 106.8286 WHERE name = '17 NOP NORTHERN JAKARTA';
UPDATE master_cluster_nop SET lat = -6.2615, lng = 106.8102 WHERE name = '18 NOP SOUTHERN JAKARTA';
UPDATE master_cluster_nop SET lat = -6.1167, lng = 106.1500 WHERE name = '19 NOP SERANG';
UPDATE master_cluster_nop SET lat = -6.1790, lng = 106.6300 WHERE name = '20 NOP TANGERANG';
UPDATE master_cluster_nop SET lat = -6.2349, lng = 106.9896 WHERE name = '21 NOP BEKASI';
UPDATE master_cluster_nop SET lat = -6.5972, lng = 106.8060 WHERE name = '22 NOP BOGOR';
UPDATE master_cluster_nop SET lat = -6.3333, lng = 107.3333 WHERE name = '23 NOP KARAWANG';
UPDATE master_cluster_nop SET lat = -6.9147, lng = 107.6098 WHERE name = '24 NOP BANDUNG';
UPDATE master_cluster_nop SET lat = -6.7150, lng = 108.5550 WHERE name = '25 NOP CIREBON';
UPDATE master_cluster_nop SET lat = -7.0167, lng = 107.5167 WHERE name = '26 NOP SOREANG';
UPDATE master_cluster_nop SET lat = -7.3274, lng = 108.2200 WHERE name = '27 NOP TASIKMALAYA';

-- A3_Jawa Bali → R05_Jawa Tengah DIY, R06_Jawa Timur, R07_Bali Nusra
UPDATE master_cluster_nop SET lat = -7.4667, lng = 110.2167 WHERE name = '28 NOP MAGELANG';
UPDATE master_cluster_nop SET lat = -6.8917, lng = 109.6683 WHERE name = '29 NOP PEKALONGAN';
UPDATE master_cluster_nop SET lat = -7.4167, lng = 109.2333 WHERE name = '30 NOP PURWOKERTO';
UPDATE master_cluster_nop SET lat = -6.9667, lng = 110.4167 WHERE name = '31 NOP SEMARANG';
UPDATE master_cluster_nop SET lat = -7.5700, lng = 110.8260 WHERE name = '32 NOP SURAKARTA';
UPDATE master_cluster_nop SET lat = -7.8000, lng = 110.3667 WHERE name = '33 NOP YOGYAKARTA';
UPDATE master_cluster_nop SET lat = -8.1833, lng = 113.6833 WHERE name = '34 NOP JEMBER';
UPDATE master_cluster_nop SET lat = -6.8833, lng = 112.0500 WHERE name = '35 NOP LAMONGAN';
UPDATE master_cluster_nop SET lat = -7.6300, lng = 111.5300 WHERE name = '36 NOP MADIUN';
UPDATE master_cluster_nop SET lat = -7.9797, lng = 112.6304 WHERE name = '37 NOP MALANG';
UPDATE master_cluster_nop SET lat = -7.4667, lng = 112.7167 WHERE name = '38 NOP SIDOARJO';
UPDATE master_cluster_nop SET lat = -7.2575, lng = 112.7528 WHERE name = '39 NOP SURABAYA';
UPDATE master_cluster_nop SET lat = -8.6500, lng = 115.2167 WHERE name = '40 NOP DENPASAR';
UPDATE master_cluster_nop SET lat = -8.3500, lng = 121.0000 WHERE name = '41 NOP FLORES';
UPDATE master_cluster_nop SET lat = -10.1667, lng = 123.5833 WHERE name = '42 NOP KUPANG';
UPDATE master_cluster_nop SET lat = -8.5833, lng = 116.1167 WHERE name = '43 NOP MATARAM';

-- A4_Pamasuka → R08_Kalimantan, R09_Sulawesi, R11_Maluku dan Papua
UPDATE master_cluster_nop SET lat = -1.2667, lng = 116.8333 WHERE name = '44 NOP BALIKPAPAN';
UPDATE master_cluster_nop SET lat = -3.3167, lng = 114.5833 WHERE name = '45 NOP BANJARMASIN';
UPDATE master_cluster_nop SET lat = -1.8833, lng = 113.5333 WHERE name = '46 NOP PALANGKARAYA';
UPDATE master_cluster_nop SET lat = -2.2167, lng = 113.9167 WHERE name = '47 NOP PALANGKALAN BUN';
UPDATE master_cluster_nop SET lat = -0.0333, lng = 109.3333 WHERE name = '48 NOP PONTIANAK';
UPDATE master_cluster_nop SET lat = -0.5000, lng = 117.1500 WHERE name = '49 NOP SAMARINDA';
UPDATE master_cluster_nop SET lat = 3.3167, lng = 117.6000 WHERE name = '50 NOP TARAKAN';
UPDATE master_cluster_nop SET lat = -4.5333, lng = 120.3333 WHERE name = '51 NOP BONE';
UPDATE master_cluster_nop SET lat = -3.9667, lng = 122.5167 WHERE name = '52 NOP KENDARI';
UPDATE master_cluster_nop SET lat = -5.1333, lng = 119.4167 WHERE name = '53 NOP MAKASSAR';
UPDATE master_cluster_nop SET lat = 1.4833, lng = 124.8500 WHERE name = '54 NOP MANADO';
UPDATE master_cluster_nop SET lat = -0.9000, lng = 119.8667 WHERE name = '55 NOP PALU';
UPDATE master_cluster_nop SET lat = -3.7167, lng = 119.6667 WHERE name = '56 NOP PARE-PARE';
UPDATE master_cluster_nop SET lat = 0.8000, lng = 127.3833 WHERE name = '57 NOP TERNATE';
UPDATE master_cluster_nop SET lat = -3.7000, lng = 128.1833 WHERE name = '58 NOP AMBON';
UPDATE master_cluster_nop SET lat = -2.5920, lng = 140.7014 WHERE name = '59 NOP JAYAPURA';
UPDATE master_cluster_nop SET lat = -0.8667, lng = 131.2500 WHERE name = '60 NOP SORONG';
UPDATE master_cluster_nop SET lat = -4.5333, lng = 136.8833 WHERE name = '61 NOP TIMIKA';

-- ============================================================
-- Fix: device ID 10 (ZTEGD06280A5)
-- ga punya cluster_nop_id, device_name, dan lat/lng-nya di Jakarta bukan Sulawesi
-- ============================================================
UPDATE devices_ont SET cluster_nop_id = (SELECT id FROM master_cluster_nop WHERE name = '53 NOP MAKASSAR' LIMIT 1)
WHERE id = 10;

UPDATE devices_ont SET device_name = 'ZTEGD06280A5' WHERE id = 10 AND device_name IS NULL;

-- Update lat/lng device ID 10 ke area Makassar dengan random offset
UPDATE devices_ont SET
  lat = -5.1333 + (random() - 0.5) * 0.05,
  lng = 119.4167 + (random() - 0.5) * 0.05
WHERE id = 10;

-- ============================================================
-- Generate random lat/lng untuk device yang masih NULL
-- (dari data di atas, semua device udah punya lat/lng, tapi jaga2)
-- ============================================================
UPDATE devices_ont d SET
  lat = n.lat + (random() - 0.5) * 0.05,
  lng = n.lng + (random() - 0.5) * 0.05
FROM master_cluster_nop n
WHERE d.cluster_nop_id = n.id
  AND (d.lat IS NULL OR d.lng IS NULL);
