-- 0006_edge_nodes.sql
-- Status edge node yang mengirim data lewat /api/edge/* (lihat dashboard/lib/edge-sync.ts).
-- edge_ping_logs (time-series) ada di 0007.

CREATE TABLE edge_nodes (
    id           SERIAL PRIMARY KEY,
    node_id      TEXT UNIQUE NOT NULL,
    name         TEXT,
    location     TEXT,
    status       TEXT DEFAULT 'unknown',
    last_seen_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE edge_worker_status (
    id           SERIAL PRIMARY KEY,
    node_id      TEXT UNIQUE NOT NULL,
    state        TEXT,
    targets_up   INTEGER DEFAULT 0,
    targets_down INTEGER DEFAULT 0,
    cycle_ms     INTEGER DEFAULT 0,
    version      TEXT,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE edge_targets (
    id         SERIAL PRIMARY KEY,
    node_id    TEXT NOT NULL,
    target_id  INTEGER,
    name       TEXT,
    ip         TEXT NOT NULL,
    location   TEXT,
    enabled    BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (node_id, ip)
);
