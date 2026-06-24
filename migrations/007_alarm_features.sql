-- Alarm comments (threaded per device)
CREATE TABLE IF NOT EXISTS alarm_comments (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices_ont(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES alarm_comments(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_by VARCHAR(100) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alarm_comments_device ON alarm_comments(device_id);

-- Root cause definitions
CREATE TABLE IF NOT EXISTS alarm_root_cause (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) DEFAULT 'L1',
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO alarm_root_cause (name, category) VALUES
    ('High Temperature', 'L1'),
    ('PLN Down', 'L1'),
    ('NE Faulty', 'L1'),
    ('FO Cut', 'L1'),
    ('Flicker', 'L1'),
    ('Capacity Utilization', 'L1'),
    ('Interface CRC Error', 'L1'),
    ('Interface Error', 'L1'),
    ('Packet Discard', 'L1'),
    ('ONT Obsolete', 'L2'),
    ('Power Down', 'L2'),
    ('FO Cut', 'L2'),
    ('NE Faulty', 'L2')
ON CONFLICT DO NOTHING;

-- Device alarm root cause assignments
CREATE TABLE IF NOT EXISTS device_alarm_root_cause (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices_ont(id) ON DELETE CASCADE,
    root_cause_id INTEGER REFERENCES alarm_root_cause(id) ON DELETE SET NULL,
    root_cause_note TEXT,
    assigned_by VARCHAR(100) DEFAULT 'admin',
    assigned_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_alarm_root_cause_device ON device_alarm_root_cause(device_id);

-- Tickets
CREATE TABLE IF NOT EXISTS alarm_tickets (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices_ont(id) ON DELETE CASCADE,
    ticket_number VARCHAR(50) UNIQUE,
    summary TEXT NOT NULL,
    root_cause TEXT,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_by VARCHAR(100) DEFAULT 'admin',
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alarm_tickets_device ON alarm_tickets(device_id);
CREATE INDEX IF NOT EXISTS idx_alarm_tickets_status ON alarm_tickets(status);