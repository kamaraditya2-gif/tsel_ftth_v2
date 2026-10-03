# Roadmap — Deployment, Integrasi & Event Correlation

---

## Fase 1: Foundation & Pilot (Bulan 1-2)

### Tujuan
- Sistem live monitoring untuk 2.000 ONT
- Dashboard dasar + alarm
- Notifikasi sederhana

### Deliverables

| Item | Detail | Status |
|------|--------|--------|
| **Deployment** | 1 VM Central + 1 VM Regional (2.000 ONT pilot) | ✅ |
| **ACS Test** | Ping (IGW+EBR), Download, Upload, Traceroute | ✅ |
| **Direct Ping** | fping per regional, interval 10 menit | ✅ |
| **Dashboard v2** | Multi-select location, heatmap, performance charts | ✅ |
| **Alarm Dasar** | Threshold-based (latency >100ms, speed < threshold) | ✅ |
| **Alarm Duration + MTTR** | Tracking durasi alarm + summary MTTR | ✅ |
| **Root Cause L1/L2** | Canvas donut chart, assign action/PIC + timestamp | ✅ |
| **Dokumentasi** | HLD, LLD, Roadmap, Deployment Planning | ✅ |

### Architecture
```
1 VM Central (4vCPU/16GB) + 1 VM Regional (2vCPU/4GB)
  └── PostgreSQL + Redis + Dashboard + Workers + Direct Ping
  └── frp tunnel → gandooz.cloud:8804
```

---

## Fase 2: Notifikasi & Integrasi (Bulan 3-4)

### Tujuan
- Notifikasi real-time via Telegram, WhatsApp
- Ticketing system integration
- Multi-region scale (5.000 ONT)

### 2.1 Telegram Integration

**Flow**:
```
Worker (checkAndUpdateAlarm)
       │
       ▼
  POST https://api.telegram.org/bot{TOKEN}/sendMessage
  {
    "chat_id": "-1001234567890",
    "text": "🚨 Alarm Baru\nLatency: 150ms (threshold: 100ms)\nPerangkat: ONT-JKT-001",
    "parse_mode": "HTML"
  }
```

**Fitur**:
| Fitur | Priority | Notes |
|-------|----------|-------|
| Alarm baru → Telegram group | P0 | ✅ Done |
| Alarm clear → Telegram group | P0 | ✅ Done |
| Alarm per-region group chat | P1 | Filter by downstream_server_id |
| Command bot: /cek {sn} | P2 | Cek device status via bot |
| Command bot: /alarm | P2 | List active alarms |
| Daily summary report | P2 | Pukul 08:00 WIB |
| Escalation jika > 4 jam | P1 | Re-notify ke group terpisah |

**Konfigurasi DB**:
```sql
INSERT INTO integration_settings (platform, name, status, config)
VALUES ('telegram', 'Telegram NOC Group', 'active',
  '{
    "bot_token": "123456:ABC-DEF1234ghIkl",
    "chat_id": "-1001234567890",
    "region_groups": {
      "11": {"chat_id": "-100111111"},
      "2":  {"chat_id": "-100222222"}
    }
  }'
);
```

### 2.2 WhatsApp Integration

**Flow**:
```
Worker (checkAndUpdateAlarm)
       │
       ▼
  POST {api_url} (Fonnte / Wablas / Siren)
  {
    "target": "08123456789",
    "message": "🚨 Alarm Baru - Latency: 150ms\nONT-JKT-001"
  }
```

**Gateway Options**:
| Gateway | Kelebihan | Kekurangan |
|---------|-----------|------------|
| **Fonnte** | Stabil, API sederhana | Berbayar |
| **Wablas** | Support group | Delay kadang |
| **Siren** | Official API | Mahal |
| **WhatsApp Business API** | Resmi, reliable | Butuh approval Meta |

**Fitur**:
| Fitur | Priority | Notes |
|-------|----------|-------|
| Alarm → nomor NOC | P0 | ✅ Done |
| Alarm → group NOC | P1 | Wablas support group |
| Foto/screenshot dashboard | P2 | Kirim gambar chart |

### 2.3 Ticketing System Integration

**Flow**:
```
Alarm triggered > 30 menit
       │
       ▼
  Auto-create ticket di external system
  (Jira / ServiceNow / Custom API)
       │
       ▼
  Status ticket sync:
    open → in_progress → resolved → closed
       │
       ▼
  Alarm cleared → auto-resolve ticket
```

**Schema Existing** (`alarm_tickets`):
```sql
CREATE TABLE alarm_tickets (
  id SERIAL PRIMARY KEY,
  device_id INTEGER REFERENCES devices_ont(id),
  ticket_number VARCHAR(50) UNIQUE,  -- INC-20260709-001
  summary TEXT NOT NULL,
  root_cause TEXT,
  status VARCHAR(20) DEFAULT 'open',
  created_by VARCHAR(100) DEFAULT 'admin',
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Fitur**:
| Fitur | Priority | Notes |
|-------|----------|-------|
| Auto-create ticket on alarm | P0 | Via webhook ke external API |
| Auto-resolve on alarm clear | P0 | |
| Ticket number format `INC-{YYYYMMDD}-{SEQ}` | P1 | Sequence per hari |
| Assignment PIC round-robin per region | P2 | |
| SLA tracking: response <30m, resolve <4h | P1 | |
| Escalation L1 → L2 → L3 otomatis | P1 | Berdasarkan durasi alarm |
| Dashboard ticket view | P2 | List open tickets |
| Comment sync (alarm_comments ↔ ticket) | P2 | |

**Integrasi dengan External Ticketing**:
```javascript
// Worker notify — ticketing API call
async function createTicket(device, alarmType, metricValue) {
  const payload = {
    project_key: "NOC",
    issue_type: "Incident",
    summary: `[ALARM] ${alarmType.toUpperCase()} - ${device.device_name}`,
    description: `
Device: ${device.device_name} (${device.serial_number})
Alarm Type: ${alarmType}
Value: ${metricValue}
Threshold: ${thresholdValue}
Region: ${device.region_name}
NOP: ${device.nop_name}
Triggered: ${new Date().toISOString()}
    `,
    priority: metricValue > thresholdValue * 2 ? "Critical" : "Major",
    custom_fields: {
      device_id: device.id,
      region_id: device.downstream_server_id,
    }
  };

  await axios.post(ticketingConfig.api_url + "/issue", payload, {
    headers: { Authorization: `Bearer ${ticketingConfig.api_key}` }
  });
}
```

### 2.4 Infrastructure Scale

**Target**: 5.000 ONT, 2-3 regional worker

| VM | Spec | Fungsi |
|----|------|--------|
| Central | 8vCPU/32GB/500GB | DB + App + Workers |
| Regional (×2-3) | 2vCPU/4GB/50GB | Direct ping |

---

## Fase 3: Event Correlation & Root Cause (Bulan 5-7)

### Tujuan
- Correlation engine untuk mendeteksi pola gangguan
- Root cause suggestion berdasarkan historical + NMS data
- Regional anomaly detection

### 3.1 Rule-Based Correlation Engine

**Konsep**: Deteksi pola dari multiple data source tanpa ML.

```
Data Sources:
  ├── test_results_ping (latency, packet loss)
  ├── test_results_speed_download/upload
  ├── active_alarms + alarm_history
  ├── test_results_direct_ping (regional ICMP)
  └── NMS external data (OLT status, port down, dll)
          │
          ▼
  Correlation Rules:
  ┌──────────────────────────────────────────────┐
  │  Rule 1: Multi-device in same NOP            │
  │  IF >5 devices in same cluster_nop_id        │
  │  AND alarm_type = 'latency'                  │
  │  THEN suspect OLT/gangguan feeder            │
  ├──────────────────────────────────────────────┤
  │  Rule 2: Asymmetric speed                    │
  │  IF download rendah AND upload normal        │
  │  THEN suspect speed profile / OLT port       │
  ├──────────────────────────────────────────────┤
  │  Rule 3: Flapping detection                  │
  │  IF status changes >5× dalam 24 jam          │
  │  THEN suspect ONT hardware failure           │
  ├──────────────────────────────────────────────┤
  │  Rule 4: Regional latency spike              │
  │  IF avg ping per region > 3× baseline        │
  │  THEN suspect BNG/IGW regional issue         │
  ├──────────────────────────────────────────────┤
  │  Rule 5: Packet loss correlation             │
  │  IF packet_loss > 20% AND latency > 200ms    │
  │  THEN suspect FO Cut / dirty connector       │
  └──────────────────────────────────────────────┘
          │
          ▼
  Output:
  - Correlation ID (grouped events)
  - Suspected root cause
  - Confidence score (0-100%)
  - Recommended action
```

**SQL Implementation**:
```sql
-- Rule 1: Multi-device in same NOP
SELECT
  d.cluster_nop_id,
  n.name as nop_name,
  COUNT(*) as device_count,
  array_agg(DISTINCT a.alarm_type) as alarm_types
FROM active_alarms a
JOIN devices_ont d ON d.id = a.device_id
LEFT JOIN master_cluster_nop n ON n.id = d.cluster_nop_id
GROUP BY d.cluster_nop_id, n.name
HAVING COUNT(*) > 5;

-- Rule 4: Regional avg ping spike
SELECT
  ds.id, ds.name,
  AVG(pr.ping_igw) as current_avg,
  (SELECT AVG(ping_igw) FROM test_results_ping
   WHERE executed_at > NOW() - INTERVAL '7 days'
   AND device_id IN (SELECT id FROM devices_ont WHERE downstream_server_id = ds.id)
  ) as baseline_avg
FROM devices_ont d
JOIN downstream_servers ds ON ds.id = d.downstream_server_id
JOIN test_results_ping pr ON pr.device_id = d.id
WHERE pr.executed_at > NOW() - INTERVAL '15 minutes'
GROUP BY ds.id, ds.name
HAVING AVG(pr.ping_igw) > (
  SELECT AVG(ping_igw) * 3 FROM test_results_ping
  WHERE executed_at > NOW() - INTERVAL '7 days'
  AND device_id IN (SELECT id FROM devices_ont WHERE downstream_server_id = ds.id)
);
```

### 3.2 NMS Integration (External Alarm Data)

**Konsep**: Import alarm dari NMS (Network Management System) existing — OLT alarm, port down, SNR rendah, dll.

```
NMS System (External)
       │
       │ Format: JSON / CSV / API
       │ Contoh payload:
       │ {
       │   "source": "NMS-OLT",
       │   "alarm_type": "LOS",
       │   "olt_id": "STO-JKP-01",
       │   "port": 5,
       │   "timestamp": "2026-07-10T08:00:00Z",
       │   "severity": "critical",
       │   "description": "Loss of Signal - OLT JLKP01 port 5"
       │ }
       │
       ▼
  NMS Collector Service (new container)
       │
       │ 1. Receive via webhook (POST /api/nms/alarm)
       │ 2. Or poll NMS API periodically
       │ 3. Store in nms_alarms table
       │
       ▼
  Correlation Engine
       │
       │ Match NMS alarm ↔ monitoring alarm:
       │   NMS: OLT port down
       │   Monitoring: >10 devices in same NOP alarm latency
       │   → Correlation: OLT feeder fault
       │
       ▼
  Output: Enriched root cause + recommendation
```

**NMS Data Schema**:
```sql
CREATE TABLE nms_alarms (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL,         -- 'nms-olt', 'nms-odp', 'external'
  source_id VARCHAR(100),              -- original ID from NMS
  alarm_type VARCHAR(50) NOT NULL,     -- 'LOS', 'SNR_LOW', 'PORT_DOWN'
  olt_id VARCHAR(100),                 -- OLT identifier
  port INTEGER,
  nop_id INTEGER REFERENCES master_cluster_nop(id),
  description TEXT,
  severity VARCHAR(20),                -- 'critical', 'major', 'minor', 'warning'
  raw_payload JSONB,
  received_at TIMESTAMP DEFAULT NOW(),
  event_time TIMESTAMP                 -- when NMS detected it
);

CREATE INDEX idx_nms_alarms_event ON nms_alarms(event_time DESC);
CREATE INDEX idx_nms_alarms_nop ON nms_alarms(nop_id);
CREATE INDEX idx_nms_alarms_type ON nms_alarms(alarm_type);
```

**Correlation SQL** (NMS + Monitoring):
```sql
-- Find NMS alarms that correlate with active monitoring alarms
SELECT
  n.id as nms_alarm_id,
  n.alarm_type as nms_type,
  n.olt_id,
  n.port,
  n.description,
  COUNT(DISTINCT a.device_id) as affected_devices,
  array_agg(DISTINCT a.alarm_type) as alarm_types
FROM nms_alarms n
JOIN master_cluster_nop nop ON nop.id = n.nop_id
JOIN devices_ont d ON d.cluster_nop_id = n.nop_id
JOIN active_alarms a ON a.device_id = d.id
WHERE n.event_time > NOW() - INTERVAL '1 hour'
  AND a.triggered_at > n.event_time - INTERVAL '30 minutes'
GROUP BY n.id, n.alarm_type, n.olt_id, n.port, n.description
HAVING COUNT(DISTINCT a.device_id) > 3;
```

### 3.3 Predictive Root Cause

**Konsep**: Dari historical data, predict root cause based on alarm pattern.

```python
ROOT_CAUSE_PATTERNS = {
    "FO Cut": {
        "signals": ["latency > 200ms", "packet_loss > 50%", "multiple_devices_same_nop"],
        "confidence_weight": 0.9,
        "recommendation": "Dispatch FO splicing crew, check ODP/ODC"
    },
    "OLT Port Failure": {
        "signals": ["all_devices_same_olt_offline", "nms_olt_port_down"],
        "confidence_weight": 0.95,
        "recommendation": "Check OLT port, reset port, dispatch ke STO"
    },
    "ONT Hardware Fault": {
        "signals": ["flapping > 5x_24h", "single_device_affected", "power_cycle_pattern"],
        "confidence_weight": 0.85,
        "recommendation": "Replace ONT, send CPE ke lokasi"
    },
    "Bandwidth Congestion": {
        "signals": ["download_low_upload_normal", "peak_hours", "multiple_devices_same_bng"],
        "confidence_weight": 0.75,
        "recommendation": "Check BNG bandwidth utilization, upgrade speed profile"
    },
    "Power Issue (PLN)": {
        "signals": ["intermittent_offline", "night_time_pattern", "regional_power_outage"],
        "confidence_weight": 0.8,
        "recommendation": "Koordinasi dengan tim PLN, cek backup battery OLT"
    }
}
```

### 3.4 Architecture Phase 3

```
┌─────────────────── Central ───────────────────┐
│                                                  │
│  ┌──────────────┐  ┌──────────────┐              │
│  │  PostgreSQL   │  │    Redis     │              │
│  │  + partition  │  │  + Sentinel  │              │
│  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                       │
│  ┌──────┴─────────────────┴───────────────────┐  │
│  │  Correlation Engine (Python)                │  │
│  │  ├── Rule-based correlation (celery setiap  │  │
│  │  │    5 menit)                              │  │
│  │  ├── NMS webhook receiver                   │  │
│  │  ├── Pattern matching                       │  │
│  │  └── Recommendation generator               │  │
│  └─────────────────────────────────────────────┘  │
│                                                  │
│  ┌─────────────────────────────────────────────┐  │
│  │  Dashboard + Workers + Dispatcher            │  │
│  └─────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
┌──────────────┐      ┌──────────────────┐
│  34 Regional  │      │  NMS External     │
│  Direct Ping  │      │  OLT/SNMP Alarms  │
│  Workers      │      │  Webhook/Poll     │
└──────────────┘      └──────────────────┘
```

---

## Fase 4: AI/ML Analytics (Bulan 8-10)

### Tujuan
- Machine learning untuk anomaly detection
- Auto root cause suggestion
- AI summary generation

### 4.1 Anomaly Detection Pipeline

```
┌──────────┐   ┌──────────┐   ┌──────────┐
│ History  │   │ Feature  │   │ Model    │
│ Data     │──▶│ Engineer │──▶│ Predict  │
│ 90 hari  │   │ 15m win  │   │ Score    │
└──────────┘   └──────────┘   └────┬─────┘
                                   │
                          ┌────────┴────────┐
                          │ Anomaly Score    │
                          │ 0-100 per device │
                          │                  │
                          │ >80: Critical    │
                          │ >50: Warning     │
                          │ >30: Watch       │
                          └─────────────────┘
```

**Model**: Isolation Forest (real-time, <100ms inference)
**Features**: latency mean/std/max, speed mean/min, packet loss, hour_of_day, day_of_week

### 4.2 AI Summary (LLM)

**Trigger**: Setiap ada correlation event atau setiap 6 jam

**Prompt Template**:
```
System: Anda adalah asisten NOC untuk jaringan FTTH.
Analisis data berikut dan berikan:

1. Ringkasan eksekutif (2-3 kalimat)
2. Alarm yang perlu prioritas (top 3)
3. Root cause yang paling mungkin
4. Rekomendasi tindakan

Data:
- Region: {region}
- Active alarms: {count}
- Alarm types: {types}
- Top anomalies: {anomalies}
- NMS events: {nms_events}
- Correlation results: {correlations}
```

**Output Example**:
```
🧠 Analisis NOC — 10 Juli 2026 08:00 WIB

📊 Ringkasan:
15 alarm aktif di Jakarta. 12 device di cluster JKP
mengalami latency spike bersamaan (avg 350ms).
Berkorelasi dengan NMS alarm "LOS OLT JLKP01 port 5".

🔍 Prioritas:
1. 🔴 CRITICAL — Cluster JKP (12 device)
   Root Cause: OLT port failure (confirmed by NMS)
   Action: Dispatch ke STO JAKPUS, reset OLT port

2. ⚠️ HIGH — ONT-JKT-015
   Flapping 8x dalam 24 jam
   Action: Siapkan ONT replacement

3. ⚠️ MEDIUM — ONT-JKT-022
   Download 5 Mbps (threshold 50)
   Action: Cek speed profile di BNG

✅ Rekomendasi:
- Prioritaskan OLT JLKP01
- Update ticket INC-20260710-001
- Follow-up dalam 2 jam
```

### 4.3 Dashboard Enrichment

```
┌──────────────────────────────────────────────────────────────┐
│ 🔮 Correlation Insights (NEW)                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ 🔴 CLUSTER JKP — 12 devices affected                        │
│   ├─ Root Cause: OLT Port Failure (confirmed by NMS)        │
│   ├─ Confidence: 95%                                         │
│   ├─ Devices: ONT-JKT-001, ONT-JKT-002, ... +12             │
│   └─ Action: ✅ Crew dispatched | ⏳ ETA 30 menit           │
│                                                              │
│ ⚠️ ONT-JKT-015 — Flapping detected                          │
│   ├─ Pattern: 8 status changes in 24h                       │
│   ├─ Prediction: Hardware failure in 7 days (85% confidence) │
│   └─ Action: 🔧 Schedule replacement                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Timeline Summary

```
Bulan 1-2  ─── Fase 1: Foundation
  ├── Deploy 1 VM Central + 1 Regional
  ├── 2.000 ONT pilot
  ├── Dashboard v2 + Alarm + Root Cause
  └── Docs lengkap

Bulan 3-4  ─── Fase 2: Notifikasi & Integrasi
  ├── Telegram (alarm + command bot)
  ├── WhatsApp gateway
  ├── Ticketing integration (auto create/resolve)
  ├── NMS data receiver webhook
  └── Scale 5.000 ONT

Bulan 5-7  ─── Fase 3: Event Correlation
  ├── Rule-based correlation engine
  ├── NMS alarm matching
  ├── Predictive root cause
  ├── Regional anomaly rules
  └── Scale 10.000 ONT

Bulan 8-10 ─── Fase 4: AI/ML Analytics
  ├── Isolation Forest anomaly detection
  ├── AI Summary (LLM) per 6 jam
  ├── Dashboard correlation insights
  └── Scale 26.000 ONT

Bulan 11-12 ─ Fase 5: Maturity
  ├── Auto-dispatch recommendation
  ├── SLA reporting
  ├── High availability
  └── Full coverage 34 provinsi
```

---

## Resource Requirements

### Additional Services (Fase 2-4)

| Service | CPU | RAM | Type | Fase |
|---------|-----|-----|------|------|
| Correlation Engine | 2 vCPU | 4 GB | Python/Celery | 3 |
| NMS Webhook Receiver | 0.5 vCPU | 1 GB | Node.js | 3 |
| ML Inference | 2 vCPU | 4 GB | Python + ONNX | 4 |
| LLM Gateway | 1 vCPU | 2 GB | Python + OpenAI | 4 |
| **Total additional** | **5.5 vCPU** | **11 GB** | | |

### Integration Points

```
┌──────────────────────┐
│    Mojo-Central   │
├──────────────────────┤
│ Outbound Integrations│
│ ├── Telegram API      │  HTTPS 443
│ ├── WhatsApp Gateway  │  HTTPS 443
│ ├── Ticketing System  │  HTTPS 443 (Jira/SN)
│ ├── NMS System        │  HTTPS/SNMP
│ └── OpenAI/LLM API    │  HTTPS 443
│                      │
│ Inbound Webhooks     │
│ └── POST /api/nms/   │  HTTPS
│     alarm            │
└──────────────────────┘
```

### Security Considerations

| Integration | Auth Method | Data Sensitivity |
|-------------|-------------|-----------------|
| Telegram | Bot Token | Device serial number, latency |
| WhatsApp | API Key | Device serial number |
| Ticketing | API Key + Basic Auth | Full device data |
| NMS | Mutual TLS / API Key | OLT/network data |
| OpenAI/LLM | API Key | Anonymized metrics (no PII) |
