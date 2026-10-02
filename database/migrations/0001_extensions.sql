-- 0001_extensions.sql
-- Extension yang dibutuhkan aplikasi.

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- queue_jobs.id DEFAULT uuid_generate_v4()

-- Dipakai trigger updated_at di beberapa tabel
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
