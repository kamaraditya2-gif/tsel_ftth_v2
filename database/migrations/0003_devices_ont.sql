-- 0003_devices_ont.sql
-- Inventori ONT. Sumber utama untuk dispatcher, worker, dan dashboard.

CREATE TABLE devices_ont (
    id                   SERIAL PRIMARY KEY,
    device_name          VARCHAR(255) NOT NULL,
    alias_device         VARCHAR(255),
    serial_number        VARCHAR(255) UNIQUE,
    mac_address          VARCHAR(50),
    ip_address           VARCHAR(50),               -- teks; dashboard memfilter dengan ILIKE
    status               VARCHAR(50) DEFAULT 'offline',
    group_id             INTEGER REFERENCES group_devices(id) ON DELETE SET NULL,
    speed_id             INTEGER REFERENCES speed_group(id) ON DELETE SET NULL,
    indihome_id          VARCHAR(100),
    cpe_type             VARCHAR(100),              -- tipe ONT
    manufacturer         VARCHAR(255),              -- brand
    model                VARCHAR(255),
    cluster_nop_id       INTEGER REFERENCES master_cluster_nop(id) ON DELETE SET NULL,
    downstream_server_id INTEGER REFERENCES downstream_servers(id) ON DELETE SET NULL,
    lat                  DECIMAL(10, 8),
    lng                  DECIMAL(11, 8),
    last_seen            TIMESTAMP,
    created_at           TIMESTAMP DEFAULT NOW(),
    updated_at           TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_devices_ont_group_id             ON devices_ont(group_id);
CREATE INDEX idx_devices_ont_speed_id             ON devices_ont(speed_id);
CREATE INDEX idx_devices_ont_status               ON devices_ont(status);
CREATE INDEX idx_devices_ont_cluster_nop_id       ON devices_ont(cluster_nop_id);
CREATE INDEX idx_devices_ont_downstream_server_id ON devices_ont(downstream_server_id);
CREATE INDEX idx_devices_ont_manufacturer         ON devices_ont(manufacturer);
CREATE INDEX idx_devices_ont_cpe_type             ON devices_ont(cpe_type);
-- direct-ping worker: WHERE ip_address IS NOT NULL AND downstream_server_id = $1
CREATE INDEX idx_devices_ont_region_with_ip       ON devices_ont(downstream_server_id) WHERE ip_address IS NOT NULL;

CREATE TRIGGER trg_devices_ont_updated_at BEFORE UPDATE ON devices_ont FOR EACH ROW EXECUTE FUNCTION set_updated_at();
