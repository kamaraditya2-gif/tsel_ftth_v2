-- 0002_master_tables.sql
-- Tabel master / konfigurasi: user & role, organisasi (area → regional → NOP),
-- referensi perangkat, threshold, dan setting aplikasi.

-- ---------------------------------------------------------------------------
-- Users & roles
-- ---------------------------------------------------------------------------
CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(100) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,              -- bcrypt hash
    role_id     INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    email       VARCHAR(100),
    full_name   VARCHAR(100),
    is_active   BOOLEAN DEFAULT true,
    last_login  TIMESTAMP,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE audit_trail (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username     VARCHAR(100),
    action       VARCHAR(50) NOT NULL,
    entity_type  VARCHAR(50) NOT NULL,
    entity_id    INTEGER,
    before_value JSONB,
    after_value  JSONB,
    ip_address   VARCHAR(50),
    created_at   TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_audit_trail_user    ON audit_trail(user_id);
CREATE INDEX idx_audit_trail_entity  ON audit_trail(entity_type, entity_id);
CREATE INDEX idx_audit_trail_created ON audit_trail(created_at);

-- ---------------------------------------------------------------------------
-- Organisasi: master_area → downstream_servers (regional) → master_cluster_nop
-- ---------------------------------------------------------------------------
CREATE TABLE master_area (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    code       VARCHAR(20) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Regional. Nama tabel historis; id-nya juga dipakai sebagai REGION_ID worker
-- regional dan disimpan di tasks.group_id.
CREATE TABLE downstream_servers (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    location   VARCHAR(255),
    province   VARCHAR(255),
    lat        DECIMAL(10, 8),
    lng        DECIMAL(11, 8),
    status     VARCHAR(50) DEFAULT 'active',
    icon       VARCHAR(50) DEFAULT 'server',
    color      VARCHAR(20) DEFAULT '#ef4444',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_downstream_servers_name   ON downstream_servers(name);
CREATE INDEX idx_downstream_servers_status ON downstream_servers(status);

CREATE TABLE master_cluster_nop (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    code        VARCHAR(20),
    regional_id INTEGER REFERENCES downstream_servers(id) ON DELETE SET NULL,
    area_id     INTEGER REFERENCES master_area(id) ON DELETE SET NULL,
    lat         DECIMAL(10, 8),
    lng         DECIMAL(11, 8),
    created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_master_cluster_nop_regional ON master_cluster_nop(regional_id);
CREATE INDEX idx_master_cluster_nop_area     ON master_cluster_nop(area_id);

-- ---------------------------------------------------------------------------
-- Referensi perangkat & paket
-- ---------------------------------------------------------------------------
CREATE TABLE group_devices (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    code        VARCHAR(50),
    description TEXT,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE speed_group (
    id                 SERIAL PRIMARY KEY,
    name               VARCHAR(100) NOT NULL,
    speed_limit        FLOAT,
    profile            VARCHAR(50),                 -- Platinum / Gold / Silver / Bronze
    upload_threshold   FLOAT,
    download_threshold FLOAT,
    description        TEXT,
    created_at         TIMESTAMP DEFAULT NOW(),
    updated_at         TIMESTAMP DEFAULT NOW()
);

CREATE TABLE manufacturer (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100)
);

CREATE TABLE ont_model (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    manufacturer_id INTEGER REFERENCES manufacturer(id) ON DELETE SET NULL,
    created_at      TIMESTAMP DEFAULT NOW(),
    created_by      VARCHAR(100)
);
CREATE INDEX idx_ont_model_name            ON ont_model(name);
CREATE INDEX idx_ont_model_manufacturer_id ON ont_model(manufacturer_id);

-- ---------------------------------------------------------------------------
-- Threshold alarm
-- ---------------------------------------------------------------------------
CREATE TABLE threshold_master (
    id             SERIAL PRIMARY KEY,
    category       VARCHAR(100) NOT NULL,
    alarm_name     VARCHAR(100) NOT NULL,
    profile        VARCHAR(50),
    brand          VARCHAR(100),
    ont_type       VARCHAR(50),
    threshold_type VARCHAR(20) NOT NULL CHECK (threshold_type IN ('UPPER', 'LOWER')),
    warning_value  DECIMAL NOT NULL,
    critical_value DECIMAL NOT NULL,
    unit           VARCHAR(20),
    status         VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    effective_date DATE DEFAULT CURRENT_DATE,
    updated_by     VARCHAR(100),
    updated_at     TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_threshold_master_category ON threshold_master(category);
CREATE INDEX idx_threshold_master_status   ON threshold_master(status);

-- ---------------------------------------------------------------------------
-- Setting aplikasi & integrasi
-- ---------------------------------------------------------------------------
CREATE TABLE app_settings (
    id          SERIAL PRIMARY KEY,
    app_name    VARCHAR(100) NOT NULL DEFAULT 'MojoJojo Monitor',
    logo_url    TEXT,
    favicon_url TEXT,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE axiros_server (
    id            SERIAL PRIMARY KEY,
    server_url    VARCHAR(255) NOT NULL,
    base_path     VARCHAR(255) NOT NULL DEFAULT '/live/AXAPI/Indihome',
    auth_username VARCHAR(100),
    auth_password VARCHAR(255),
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE integration_settings (
    id         SERIAL PRIMARY KEY,
    platform   VARCHAR(50) NOT NULL UNIQUE,         -- telegram / whatsapp / ticketing
    name       VARCHAR(100) NOT NULL,
    status     VARCHAR(20) DEFAULT 'inactive',
    config     JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE test_server (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    ip_address VARCHAR(255) NOT NULL,
    test_type  VARCHAR(20) DEFAULT 'igw',           -- igw / ebr
    is_active  BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255)
);

CREATE TABLE payloads (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    method      VARCHAR(10) NOT NULL,
    endpoint    TEXT NOT NULL,
    parameters  JSONB,
    headers     JSONB,
    description TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- updated_at otomatis
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_users_updated_at         BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_group_devices_updated_at BEFORE UPDATE ON group_devices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_app_settings_updated_at  BEFORE UPDATE ON app_settings  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
