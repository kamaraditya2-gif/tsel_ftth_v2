-- Migration: Create devices_ont table
-- This migration creates the devices_ont table to store ONT device information

CREATE TABLE IF NOT EXISTS devices_ont (
    id SERIAL PRIMARY KEY,
    device_name VARCHAR(255) NOT NULL,
    serial_number VARCHAR(255) UNIQUE,
    mac_address VARCHAR(50),
    ip_address VARCHAR(50),
    status VARCHAR(50) DEFAULT 'offline',
    group_id INTEGER REFERENCES group_devices(id) ON DELETE SET NULL,
    speed_id INTEGER REFERENCES speed_group(id) ON DELETE SET NULL,
    indihome_id VARCHAR(100),
    cpe_type VARCHAR(100),
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    alias_device VARCHAR(255),
    cluster_nop_id INTEGER REFERENCES master_cluster_nop(id) ON DELETE SET NULL,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    downstream_server_id INTEGER REFERENCES downstream_servers(id) ON DELETE SET NULL,
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_devices_ont_serial_number ON devices_ont(serial_number);
CREATE INDEX IF NOT EXISTS idx_devices_ont_group_id ON devices_ont(group_id);
CREATE INDEX IF NOT EXISTS idx_devices_ont_speed_id ON devices_ont(speed_id);
CREATE INDEX IF NOT EXISTS idx_devices_ont_cluster_nop_id ON devices_ont(cluster_nop_id);
CREATE INDEX IF NOT EXISTS idx_devices_ont_downstream_server_id ON devices_ont(downstream_server_id);
CREATE INDEX IF NOT EXISTS idx_devices_ont_status ON devices_ont(status);
