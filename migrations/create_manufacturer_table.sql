-- Migration: Create manufacturer table
-- This migration creates the manufacturer table to store device manufacturer information

CREATE TABLE IF NOT EXISTS manufacturer (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- Add index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_manufacturer_name ON manufacturer(name);
