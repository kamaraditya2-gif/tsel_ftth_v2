-- Migration: Add integration settings table
-- Date: 2026-06-11

CREATE TABLE IF NOT EXISTS integration_settings (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL UNIQUE, -- 'telegram', 'whatsapp', 'ticketing'
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'inactive', -- 'active', 'inactive'
    config JSONB DEFAULT '{}', -- store api keys, webhooks, etc. for future use
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default rows for the 3 platforms
INSERT INTO integration_settings (platform, name, status, config)
VALUES
    ('telegram', 'Telegram Bot', 'inactive', '{}'),
    ('whatsapp', 'WhatsApp API', 'inactive', '{}'),
    ('ticketing', 'Ticketing System', 'inactive', '{}')
ON CONFLICT (platform) DO NOTHING;
