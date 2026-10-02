-- 0005_alarms.sql
-- Alarm aktif, histori alarm, root cause, komentar, dan tiket.

CREATE TABLE active_alarms (
    id              SERIAL PRIMARY KEY,
    device_id       INTEGER REFERENCES devices_ont(id) ON DELETE CASCADE,
    alarm_type      VARCHAR(20) NOT NULL,           -- upload / download / latency / packet_loss
    metric_value    FLOAT NOT NULL,
    threshold_value FLOAT NOT NULL,
    severity        VARCHAR(20) DEFAULT 'warning',
    message         TEXT,
    triggered_at    TIMESTAMP DEFAULT NOW(),
    last_checked_at TIMESTAMP DEFAULT NOW(),
    run_id          TEXT,
    UNIQUE (device_id, alarm_type)
);
CREATE INDEX idx_active_alarms_type         ON active_alarms(alarm_type);
CREATE INDEX idx_active_alarms_triggered_at ON active_alarms(triggered_at);

CREATE TABLE alarm_history (
    id               SERIAL PRIMARY KEY,
    device_id        INTEGER REFERENCES devices_ont(id) ON DELETE CASCADE,
    alarm_type       VARCHAR(20) NOT NULL,
    metric_value     FLOAT NOT NULL,
    threshold_value  FLOAT NOT NULL,
    severity         VARCHAR(20) DEFAULT 'warning',
    message          TEXT,
    triggered_at     TIMESTAMP,
    cleared_at       TIMESTAMP DEFAULT NOW(),
    cleared_value    FLOAT,
    run_id           TEXT,
    duration_seconds INTEGER
);
CREATE INDEX idx_alarm_history_device_id    ON alarm_history(device_id);
CREATE INDEX idx_alarm_history_type         ON alarm_history(alarm_type);
CREATE INDEX idx_alarm_history_cleared_at   ON alarm_history(cleared_at);
CREATE INDEX idx_alarm_history_triggered_at ON alarm_history(triggered_at);

CREATE TABLE alarm_root_cause (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    category   VARCHAR(50) DEFAULT 'L1',            -- L1 / L2
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (name, category)
);

CREATE TABLE device_alarm_root_cause (
    id              SERIAL PRIMARY KEY,
    device_id       INTEGER UNIQUE REFERENCES devices_ont(id) ON DELETE CASCADE,
    root_cause_id   INTEGER REFERENCES alarm_root_cause(id) ON DELETE SET NULL,
    root_cause_note TEXT,
    action          TEXT,
    pic             VARCHAR(100),
    assigned_by     VARCHAR(100) DEFAULT 'admin',
    assigned_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE alarm_comments (
    id         SERIAL PRIMARY KEY,
    device_id  INTEGER REFERENCES devices_ont(id) ON DELETE CASCADE,
    parent_id  INTEGER REFERENCES alarm_comments(id) ON DELETE CASCADE,
    comment    TEXT NOT NULL,
    created_by VARCHAR(100) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_alarm_comments_device ON alarm_comments(device_id);

CREATE TABLE alarm_tickets (
    id            SERIAL PRIMARY KEY,
    device_id     INTEGER REFERENCES devices_ont(id) ON DELETE CASCADE,
    ticket_number VARCHAR(50) UNIQUE,
    summary       TEXT NOT NULL,
    root_cause    TEXT,
    status        VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_by    VARCHAR(100) DEFAULT 'admin',
    resolved_at   TIMESTAMP,
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_alarm_tickets_device ON alarm_tickets(device_id);
CREATE INDEX idx_alarm_tickets_status ON alarm_tickets(status);
