-- Migration: Create downstream_servers table
-- This migration creates the downstream_servers table to store regional downstream server information

CREATE TABLE IF NOT EXISTS downstream_servers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    province VARCHAR(255),
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    status VARCHAR(50) DEFAULT 'active',
    icon VARCHAR(50) DEFAULT 'server',
    color VARCHAR(20) DEFAULT '#ef4444',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_downstream_servers_name ON downstream_servers(name);

-- Add index on status for filtering
CREATE INDEX IF NOT EXISTS idx_downstream_servers_status ON downstream_servers(status);
