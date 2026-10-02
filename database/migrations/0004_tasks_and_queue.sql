-- 0004_tasks_and_queue.sql
-- Jadwal test (tasks) dan antrean eksekusi (queue_jobs).

CREATE TABLE tasks (
    id           SERIAL PRIMARY KEY,
    title        VARCHAR(100) NOT NULL,
    task_type    VARCHAR(20) NOT NULL,              -- scheduled / ondemand
    test_type    VARCHAR(100) NOT NULL,             -- ping,download,upload,traceroute,ont-status (dipisah koma)
    -- group_id berisi id REGIONAL (downstream_servers), bukan group_devices —
    -- lihat worker/dispatcher.js. Sengaja tanpa FK supaya task lama tidak ikut terhapus.
    group_id     INTEGER,
    nop_city     TEXT,                              -- id master_cluster_nop dalam bentuk teks, opsional
    device_id    INTEGER REFERENCES devices_ont(id) ON DELETE SET NULL,
    cron_time    VARCHAR(50),
    scheduled_at TIMESTAMP,
    started_at   TIMESTAMP,
    next_run     TIMESTAMP,
    is_active    BOOLEAN DEFAULT true,
    created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    deleted_at   TIMESTAMP,
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tasks_active_next_run ON tasks(next_run) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_tasks_group           ON tasks(group_id);
CREATE INDEX idx_tasks_device          ON tasks(device_id);

CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Antrean job. Baris sering di-UPDATE dan dihapus, jadi tetap tabel biasa (bukan hypertable).
CREATE TABLE queue_jobs (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id        INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    device_id      INTEGER REFERENCES devices_ont(id) ON DELETE CASCADE,
    payload_data   JSONB,
    execution_type VARCHAR(20) NOT NULL,            -- scheduled / ondemand
    test_type      VARCHAR(50),
    run_id         TEXT,                            -- "<task_id>-<timestamp>"
    group_id       INTEGER,
    speed_id       INTEGER,
    status         VARCHAR(20) DEFAULT 'pending',   -- pending / processing / completed / failed
    retry_count    INTEGER DEFAULT 0,
    is_retest      BOOLEAN DEFAULT false,
    last_error     TEXT,
    raw_response   JSONB,
    created_at     TIMESTAMP DEFAULT NOW(),
    started_at     TIMESTAMP,
    completed_at   TIMESTAMP
);

CREATE INDEX idx_queue_jobs_status_created_at ON queue_jobs(status, created_at);
CREATE INDEX idx_queue_jobs_task_id           ON queue_jobs(task_id);
CREATE INDEX idx_queue_jobs_device_id         ON queue_jobs(device_id);
CREATE INDEX idx_queue_jobs_created_at        ON queue_jobs(created_at);
CREATE INDEX idx_queue_jobs_test_type         ON queue_jobs(test_type);
CREATE INDEX idx_queue_jobs_task_device_run   ON queue_jobs(task_id, device_id, run_id);
CREATE INDEX idx_queue_jobs_run_id            ON queue_jobs(run_id);
