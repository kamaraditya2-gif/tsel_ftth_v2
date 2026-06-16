-- Migration: Create ont_model table
-- This migration creates the ont_model table to store ONT device model information

CREATE TABLE IF NOT EXISTS ont_model (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    manufacturer_id INTEGER REFERENCES manufacturer(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- Add index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_ont_model_name ON ont_model(name);

-- Add index on manufacturer_id for faster joins
CREATE INDEX IF NOT EXISTS idx_ont_model_manufacturer_id ON ont_model(manufacturer_id);
