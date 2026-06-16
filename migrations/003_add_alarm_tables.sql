-- Migration: Add alarm tables for threshold monitoring
-- Date: 2026-06-11

-- Active alarms (currently above threshold)
CREATE TABLE IF NOT EXISTS active_alarms (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    alarm_type VARCHAR(20) NOT NULL, -- 'upload', 'download', 'latency'
    metric_value FLOAT NOT NULL,
    threshold_value FLOAT NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning',
    message TEXT,
    triggered_at TIMESTAMP DEFAULT NOW(),
    last_checked_at TIMESTAMP DEFAULT NOW(),
    run_id TEXT,
    UNIQUE(device_id, alarm_type)
);

CREATE INDEX IF NOT EXISTS idx_active_alarms_device_id ON active_alarms(device_id);
CREATE INDEX IF NOT EXISTS idx_active_alarms_type ON active_alarms(alarm_type);
CREATE INDEX IF NOT EXISTS idx_active_alarms_triggered_at ON active_alarms(triggered_at);

-- Alarm history (cleared alarms)
CREATE TABLE IF NOT EXISTS alarm_history (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    alarm_type VARCHAR(20) NOT NULL,
    metric_value FLOAT NOT NULL,
    threshold_value FLOAT NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning',
    message TEXT,
    triggered_at TIMESTAMP,
    cleared_at TIMESTAMP DEFAULT NOW(),
    cleared_value FLOAT,
    run_id TEXT,
    duration_seconds INTEGER
);

CREATE INDEX IF NOT EXISTS idx_alarm_history_device_id ON alarm_history(device_id);
CREATE INDEX IF NOT EXISTS idx_alarm_history_type ON alarm_history(alarm_type);
CREATE INDEX IF NOT EXISTS idx_alarm_history_cleared_at ON alarm_history(cleared_at);
CREATE INDEX IF NOT EXISTS idx_alarm_history_triggered_at ON alarm_history(triggered_at);
