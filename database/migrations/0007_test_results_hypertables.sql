-- 0007_test_results_hypertables.sql
-- Tabel hasil test (time-series) sebagai TimescaleDB hypertable.
--
-- Aturan hypertable yang memengaruhi desain di bawah:
--   * Setiap PRIMARY KEY / UNIQUE wajib memuat kolom waktu. Karena itu PK
--     menjadi (id, executed_at) dan upsert worker memakai
--     ON CONFLICT (queue_job_id, executed_at). executed_at diisi dari
--     queue_jobs.created_at, jadi nilainya tetap untuk job yang sama.
--   * Tidak ada FK ke queue_jobs/tasks: antrean itu sering dibersihkan, dan
--     ON DELETE SET NULL akan menulis ulang chunk lama (termasuk yang sudah
--     terkompresi). FK ke devices_ont tetap ada supaya hapus device ikut
--     menghapus histori-nya, seperti sebelumnya.

-- ---------------------------------------------------------------------------
-- Ping (latency & packet loss ke IGW / EBR) — volume terbesar, chunk 1 hari
-- ---------------------------------------------------------------------------
CREATE TABLE test_results_ping (
    id              SERIAL,
    task_id         INTEGER,
    device_id       INTEGER REFERENCES devices_ont(id) ON DELETE CASCADE,
    queue_job_id    UUID,
    run_id          TEXT,
    ping_igw        DECIMAL(10, 2),                 -- ms
    ping_ebr        DECIMAL(10, 2),                 -- ms
    packet_loss_igw DECIMAL(5, 2),                  -- %
    packet_loss_ebr DECIMAL(5, 2),                  -- %
    success         BOOLEAN DEFAULT false,
    executed_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (id, executed_at)
);
SELECT create_hypertable('test_results_ping', by_range('executed_at', INTERVAL '1 day'));
CREATE UNIQUE INDEX uq_test_results_ping_job     ON test_results_ping(queue_job_id, executed_at);
CREATE INDEX idx_test_results_ping_device_time   ON test_results_ping(device_id, executed_at DESC);
CREATE INDEX idx_test_results_ping_task_run      ON test_results_ping(task_id, run_id);

-- ---------------------------------------------------------------------------
-- Download speed
-- ---------------------------------------------------------------------------
CREATE TABLE test_results_speed_download (
    id                 SERIAL,
    task_id            INTEGER,
    device_id          INTEGER REFERENCES devices_ont(id) ON DELETE CASCADE,
    queue_job_id       UUID,
    run_id             TEXT,
    download_speed     DECIMAL(10, 2),              -- Mbps
    download_threshold DECIMAL(10, 2),
    success            BOOLEAN DEFAULT false,
    executed_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at         TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (id, executed_at)
);
SELECT create_hypertable('test_results_speed_download', by_range('executed_at', INTERVAL '7 days'));
CREATE UNIQUE INDEX uq_test_results_speed_download_job   ON test_results_speed_download(queue_job_id, executed_at);
CREATE INDEX idx_test_results_speed_download_device_time ON test_results_speed_download(device_id, executed_at DESC);
CREATE INDEX idx_test_results_speed_download_task_run    ON test_results_speed_download(task_id, run_id);

-- ---------------------------------------------------------------------------
-- Upload speed
-- ---------------------------------------------------------------------------
CREATE TABLE test_results_speed_upload (
    id               SERIAL,
    task_id          INTEGER,
    device_id        INTEGER REFERENCES devices_ont(id) ON DELETE CASCADE,
    queue_job_id     UUID,
    run_id           TEXT,
    upload_speed     DECIMAL(10, 2),                -- Mbps
    upload_threshold DECIMAL(10, 2),
    success          BOOLEAN DEFAULT false,
    executed_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (id, executed_at)
);
SELECT create_hypertable('test_results_speed_upload', by_range('executed_at', INTERVAL '7 days'));
CREATE UNIQUE INDEX uq_test_results_speed_upload_job   ON test_results_speed_upload(queue_job_id, executed_at);
CREATE INDEX idx_test_results_speed_upload_device_time ON test_results_speed_upload(device_id, executed_at DESC);
CREATE INDEX idx_test_results_speed_upload_task_run    ON test_results_speed_upload(task_id, run_id);

-- ---------------------------------------------------------------------------
-- Traceroute
-- ---------------------------------------------------------------------------
CREATE TABLE test_results_traceroute (
    id             SERIAL,
    task_id        INTEGER,
    device_id      INTEGER REFERENCES devices_ont(id) ON DELETE CASCADE,
    queue_job_id   UUID,
    run_id         TEXT,
    traceroute_raw JSONB,
    total_hops     INTEGER,
    total_rtt_ms   DECIMAL(10, 2),
    success        BOOLEAN DEFAULT false,
    executed_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at     TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (id, executed_at)
);
SELECT create_hypertable('test_results_traceroute', by_range('executed_at', INTERVAL '7 days'));
CREATE UNIQUE INDEX uq_test_results_traceroute_job   ON test_results_traceroute(queue_job_id, executed_at);
CREATE INDEX idx_test_results_traceroute_device_time ON test_results_traceroute(device_id, executed_at DESC);
CREATE INDEX idx_test_results_traceroute_task_run    ON test_results_traceroute(task_id, run_id);

-- ---------------------------------------------------------------------------
-- Direct ping dari worker regional (ICMP langsung ke IP ONT)
-- ---------------------------------------------------------------------------
CREATE TABLE test_results_direct_ping (
    id                   SERIAL,
    device_id            INTEGER REFERENCES devices_ont(id) ON DELETE CASCADE,
    downstream_server_id INTEGER,
    ip_address           VARCHAR(45),
    avg_latency_ms       DECIMAL(10, 2),
    packet_loss_percent  DECIMAL(5, 2),
    created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
);
SELECT create_hypertable('test_results_direct_ping', by_range('created_at', INTERVAL '1 day'));
CREATE INDEX idx_test_results_direct_ping_device_time ON test_results_direct_ping(device_id, created_at DESC);
CREATE INDEX idx_test_results_direct_ping_region_time ON test_results_direct_ping(downstream_server_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Agregat ping per jam dari edge node
-- ---------------------------------------------------------------------------
CREATE TABLE edge_ping_logs (
    id           BIGSERIAL,
    node_id      TEXT NOT NULL,
    target_ip    TEXT NOT NULL,
    bucket       TIMESTAMPTZ NOT NULL,
    avg_rtt_ms   DOUBLE PRECISION,                  -- NULL = target tidak membalas
    avg_loss_pct DOUBLE PRECISION,
    samples      INTEGER DEFAULT 0,
    ok_count     INTEGER DEFAULT 0,
    dedupe_key   TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, bucket),
    UNIQUE (dedupe_key, bucket)
);
SELECT create_hypertable('edge_ping_logs', by_range('bucket', INTERVAL '7 days'));
CREATE INDEX idx_edge_ping_logs_node_time   ON edge_ping_logs(node_id, bucket DESC);
CREATE INDEX idx_edge_ping_logs_target_time ON edge_ping_logs(target_ip, bucket DESC);
