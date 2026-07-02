-- Migration: Default Users
-- This migration ensures default roles and users exist in the database
-- Run this on existing databases to add default users
--
-- ⚠️ SECURITY WARNING FOR PRODUCTION:
-- The default admin password is 'admin123' (bcrypt hash)
-- For production, either:
-- 1. Change this password immediately after first login
-- 2. Remove this migration and create users manually in production
-- 3. Use environment-specific migrations that don't include default credentials

-- Add full_name column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'full_name'
    ) THEN
        ALTER TABLE users ADD COLUMN full_name VARCHAR(100);
    END IF;
END $$;

-- Add last_login column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_login'
    ) THEN
        ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
    END IF;
END $$;

-- Insert default roles if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'admin') THEN
        INSERT INTO roles (name, description) VALUES
        ('admin', 'Full access to all features');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'operator') THEN
        INSERT INTO roles (name, description) VALUES
        ('operator', 'Can manage devices and tasks');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'viewer') THEN
        INSERT INTO roles (name, description) VALUES
        ('viewer', 'Read-only access to dashboard');
    END IF;
END $$;

-- Insert default admin user if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin') THEN
        -- Password: admin123 (bcrypt hash)
        INSERT INTO users (username, password, role_id, email, full_name, is_active) VALUES
        ('admin', '$2b$10$ReHCkVPOEEKjLBRCyDTcXeS/.ilZoGJbDzgStdynUzNEtZuxmVhJe',
         (SELECT id FROM roles WHERE name = 'admin' LIMIT 1),
         'admin@mojojojo.local',
         'Administrator',
         true);
    END IF;
END $$;

-- Update existing admin user to have admin role and full_name
DO $$
BEGIN
    UPDATE users
    SET role_id = (SELECT id FROM roles WHERE name = 'admin' LIMIT 1),
        full_name = 'Administrator'
    WHERE username = 'admin' AND full_name IS NULL;
END $$;
