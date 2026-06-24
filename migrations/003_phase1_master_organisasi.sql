-- =============================================================================
-- Phase 1: Master Organisasi + Threshold Management
-- =============================================================================
-- Tidak menghapus/mengubah tabel existing.
-- Semua tambahan via CREATE TABLE IF NOT EXISTS dan ALTER TABLE ADD COLUMN.
-- =============================================================================

-- 1. MASTER AREA (diatas Regional)
CREATE TABLE IF NOT EXISTS master_area (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Seed Area
INSERT INTO master_area (name, code) VALUES
    ('Sumatera', 'SMA'),
    ('Jawa', 'JWA'),
    ('Kalimantan', 'KLM'),
    ('Sulawesi', 'SLW'),
    ('Bali & Nusa Tenggara', 'BLN'),
    ('Maluku & Papua', 'MLP')
ON CONFLICT (code) DO NOTHING;

-- 2. MASTER CLUSTER NOP
CREATE TABLE IF NOT EXISTS master_cluster_nop (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20),
    regional_id INTEGER REFERENCES downstream_servers(id) ON DELETE SET NULL,
    area_id INTEGER REFERENCES master_area(id) ON DELETE SET NULL,
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Seed Cluster NOP (61 NOP dari 12 Regional)
INSERT INTO master_cluster_nop (name, code, regional_id, area_id) VALUES
    -- R01_Sumbagut (id=1) -> Sumatera (id=1)
    ('NOP_Medan', 'MDN', 1, 1),
    ('NOP_Aceh', 'ACH', 1, 1),
    ('NOP_Medan_Utara', 'MDU', 1, 1),
    ('NOP_Siantar', 'SNT', 1, 1),
    ('NOP_Sibolga', 'SBG', 1, 1),
    -- R02_Sumbagsel (id=2) -> Sumatera (id=1)
    ('NOP_Palembang', 'PLG', 2, 1),
    ('NOP_Lampung', 'LMP', 2, 1),
    ('NOP_Jambi', 'JMB', 2, 1),
    ('NOP_Bengkulu', 'BKL', 2, 1),
    ('NOP_Bangka', 'BNK', 2, 1),
    -- R03_Jabotabek (id=3) -> Jawa (id=2)
    ('NOP_Jakarta_Pusat', 'JKP', 3, 2),
    ('NOP_Jakarta_Selatan', 'JKS', 3, 2),
    ('NOP_Jakarta_Utara', 'JKU', 3, 2),
    ('NOP_Jakarta_Barat', 'JKB', 3, 2),
    ('NOP_Jakarta_Timur', 'JKT', 3, 2),
    ('NOP_Bogor', 'BGR', 3, 2),
    ('NOP_Tangerang', 'TNG', 3, 2),
    ('NOP_Bekasi', 'BKS', 3, 2),
    ('NOP_Depok', 'DPK', 3, 2),
    -- R04_Jabar (id=4) -> Jawa (id=2)
    ('NOP_Bandung', 'BDG', 4, 2),
    ('NOP_Cimahi', 'CMI', 4, 2),
    ('NOP_Tasikmalaya', 'TSK', 4, 2),
    ('NOP_Cirebon', 'CRB', 4, 2),
    ('NOP_Sukabumi', 'SKB', 4, 2),
    -- R05_Jateng (id=5) -> Jawa (id=2)
    ('NOP_Semarang', 'SMG', 5, 2),
    ('NOP_Solo', 'SOL', 5, 2),
    ('NOP_Purwokerto', 'PWK', 5, 2),
    ('NOP_Salatiga', 'SLT', 5, 2),
    ('NOP_Pekalongan', 'PKL', 5, 2),
    -- R06_Jatim (id=6) -> Jawa (id=2)
    ('NOP_Surabaya', 'SBY', 6, 2),
    ('NOP_Malang', 'MLG', 6, 2),
    ('NOP_Kediri', 'KDR', 6, 2),
    ('NOP_Madiun', 'MDN', 6, 2),
    ('NOP_Banyuwangi', 'BYW', 6, 2),
    -- R07_BaliNusra (id=7) -> Bali & Nusa Tenggara (id=5)
    ('NOP_Denpasar', 'DPS', 7, 5),
    ('NOP_Mataram', 'MTR', 7, 5),
    ('NOP_Kupang', 'KPG', 7, 5),
    -- R08_Kalimantan (id=8) -> Kalimantan (id=3)
    ('NOP_Balikpapan', 'BPP', 8, 3),
    ('NOP_Samarinda', 'SMD', 8, 3),
    ('NOP_Pontianak', 'PTK', 8, 3),
    ('NOP_Banjarmasin', 'BJM', 8, 3),
    ('NOP_Palangkaraya', 'PLK', 8, 3),
    -- R09_Sulawesi (id=9) -> Sulawesi (id=4)
    ('NOP_Makassar', 'MKS', 9, 4),
    ('NOP_Manado', 'MND', 9, 4),
    ('NOP_Palu', 'PLU', 9, 4),
    ('NOP_Kendari', 'KDR', 9, 4),
    ('NOP_Gorontalo', 'GRT', 9, 4),
    -- R10_Sumbagteng (id=10) -> Sumatera (id=1)
    ('NOP_Pekanbaru', 'PBU', 10, 1),
    ('NOP_Padang', 'PDG', 10, 1),
    ('NOP_Dumai', 'DMI', 10, 1),
    ('NOP_Batam', 'BTM', 10, 1),
    ('NOP_Tanjung_Pinang', 'TJP', 10, 1),
    -- R11_MalukuPapua (id=11) -> Maluku & Papua (id=6)
    ('NOP_Ambon', 'AMB', 11, 6),
    ('NOP_Ternate', 'TRT', 11, 6),
    ('NOP_Sorong', 'SRG', 11, 6),
    ('NOP_Manokwari', 'MNK', 11, 6),
    ('NOP_Merauke', 'MRK', 11, 6),
    -- R12_Jabodetabek (id=12) -> Jawa (id=2)
    ('NOP_Bekasi_Timur', 'BKT', 12, 2),
    ('NOP_Tangerang_Selatan', 'TGS', 12, 2),
    ('NOP_Karawang', 'KRW', 12, 2),
    ('NOP_Purwakarta', 'PRW', 12, 2)
ON CONFLICT DO NOTHING;

-- 3. THRESHOLD MASTER (dinamis dari database)
CREATE TABLE IF NOT EXISTS threshold_master (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    alarm_name VARCHAR(100) NOT NULL,
    profile VARCHAR(50),
    brand VARCHAR(100),
    ont_type VARCHAR(50),
    threshold_type VARCHAR(20) NOT NULL CHECK (threshold_type IN ('UPPER', 'LOWER')),
    warning_value DECIMAL NOT NULL,
    critical_value DECIMAL NOT NULL,
    unit VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    effective_date DATE DEFAULT CURRENT_DATE,
    updated_by VARCHAR(100),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed Threshold default
INSERT INTO threshold_master (category, alarm_name, profile, threshold_type, warning_value, critical_value, unit) VALUES
    -- Latency
    ('Performance', 'Latency', NULL, 'UPPER', 50, 100, 'ms'),
    ('Performance', 'Latency_IGW', NULL, 'UPPER', 30, 60, 'ms'),
    ('Performance', 'Latency_EBR', NULL, 'UPPER', 80, 150, 'ms'),
    -- Packet Loss
    ('Performance', 'Packet_Loss', NULL, 'UPPER', 3, 5, '%'),
    ('Performance', 'Packet_Loss_IGW', NULL, 'UPPER', 2, 4, '%'),
    ('Performance', 'Packet_Loss_EBR', NULL, 'UPPER', 5, 10, '%'),
    -- Jitter
    ('Performance', 'Jitter', NULL, 'UPPER', 10, 20, 'ms'),
    -- Throughput
    ('Throughput', 'Download_Speed', 'Platinum', 'LOWER', 80, 50, 'Mbps'),
    ('Throughput', 'Download_Speed', 'Gold', 'LOWER', 60, 30, 'Mbps'),
    ('Throughput', 'Download_Speed', 'Silver', 'LOWER', 40, 20, 'Mbps'),
    ('Throughput', 'Download_Speed', 'Bronze', 'LOWER', 20, 10, 'Mbps'),
    ('Throughput', 'Upload_Speed', 'Platinum', 'LOWER', 40, 20, 'Mbps'),
    ('Throughput', 'Upload_Speed', 'Gold', 'LOWER', 30, 15, 'Mbps'),
    ('Throughput', 'Upload_Speed', 'Silver', 'LOWER', 20, 10, 'Mbps'),
    ('Throughput', 'Upload_Speed', 'Bronze', 'LOWER', 10, 5, 'Mbps'),
    -- Capacity
    ('Capacity', 'CPU_Utilization', NULL, 'UPPER', 70, 85, '%'),
    ('Capacity', 'Memory_Utilization', NULL, 'UPPER', 70, 85, '%'),
    -- Hardware
    ('Hardware', 'Temperature', NULL, 'UPPER', 55, 65, '°C'),
    ('Hardware', 'CRC_Error', NULL, 'UPPER', 100, 1000, 'count'),
    -- Availability
    ('Availability', 'Uptime', NULL, 'LOWER', 95, 90, '%'),
    ('Availability', 'Ping_Success_Rate', NULL, 'LOWER', 98, 95, '%')
ON CONFLICT DO NOTHING;

-- 4. Relasi devices_ont -> cluster_nop (tambah kolom, tidak drop)
ALTER TABLE devices_ont ADD COLUMN IF NOT EXISTS cluster_nop_id INTEGER REFERENCES master_cluster_nop(id) ON DELETE SET NULL;

-- 5. Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_master_cluster_nop_regional ON master_cluster_nop(regional_id);
CREATE INDEX IF NOT EXISTS idx_master_cluster_nop_area ON master_cluster_nop(area_id);
CREATE INDEX IF NOT EXISTS idx_devices_ont_cluster_nop ON devices_ont(cluster_nop_id);
CREATE INDEX IF NOT EXISTS idx_threshold_master_category ON threshold_master(category);
CREATE INDEX IF NOT EXISTS idx_threshold_master_status ON threshold_master(status);

-- 6. Audit Trail table
CREATE TABLE IF NOT EXISTS audit_trail (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    before_value JSONB,
    after_value JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_user ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity ON audit_trail(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created ON audit_trail(created_at);