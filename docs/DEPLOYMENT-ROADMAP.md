# Deployment & Pengembangan Roadmap

---

## 1. Deployment Bertahap

### Fase 1: Single Regional (Pilot)

Target: **1 downstream server, 1 near BNG, 1 IGW** — ~500–1000 devices

#### Arsitektur Awal

```
┌──────────────────────────────────────────────────────┐
│              1 VM (Standalone)                        │
│                                                        │
│  ┌──────────────┐  ┌──────────────┐                   │
│  │  PostgreSQL   │  │    Redis     │                   │
│  │  :5432        │  │  :6379       │                   │
│  └──────┬───────┘  └──────┬───────┘                   │
│         │                  │                           │
│  ┌──────┴──────────────────┴───────┐                   │
│  │         Dispatcher (cron 1m)     │                   │
│  │         Worker acs-fast          │                   │
│  │         Worker acs-download      │                   │
│  │         Worker acs-upload        │                   │
│  └────────────────┬─────────────────┘                   │
│                   │                                     │
│  ┌────────────────┴─────────────────┐                   │
│  │   Dashboard (Next.js :3000)      │                   │
│  │   frp tunnel → gandooz.cloud:8804 │                  │
│  └──────────────────────────────────┘                   │
│                                                        │
│  ┌──────────────────────────────────┐                   │
│  │   Direct Ping Worker (regional)  │                   │
│  │   fping → ONT IPs (DS_ID=N)      │                   │
│  └──────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────┘
```

#### VM Spec (Pilot)

| Resource | Spec | Notes |
|----------|------|-------|
| CPU | 4 vCPU | Intel/AMD, 2.5GHz+ |
| RAM | 16 GB | |
| Storage | 200 GB SSD | OS + Docker images + DB |
| OS | Ubuntu 22.04 LTS | atau Debian 12 |
| Docker | 24+ dengan Compose v2 | |
| Network | 1 Gbps | Akses ke ACS API + frp |

#### Container Deployment

```bash
# 1. Clone repo
git clone https://github.com/kamaraditya2-gif/tsel_ftth_v2.git /opt/mojo
cd /opt/mojo

# 2. Copy env
cp .env.example .env
# Edit: DB_PASSWORD, REDIS_PASSWORD, AXIROS config, DS_ID=11 (misal)

# 3. Buat direktori data
mkdir -p data/postgres data/redis

# 4. Start full stack
docker compose up -d

# 5. Verify
docker compose ps
curl localhost:3000/api/health

# 6. Setup frp client untuk akses dashboard
# frpc.ini:
# [mojo_dashboard]
# type = tcp
# local_port = 3002
# remote_port = 8804
```

#### Registrasi Device & Test Server

```sql
-- Input test server (1 IGW + 1 BNG/near BNG)
INSERT INTO test_server (name, ip_address, test_type, is_active)
VALUES ('IGW-REG01', '10.11.12.13', 'igw', true),
       ('BNG-REG01', '10.22.33.44', 'ebr', true);

-- Input axiros server
INSERT INTO axiros_server (server_url, base_path, auth_username, auth_password, is_active)
VALUES ('https://acs.network.telkomsel.co.id', '/live/AXAPI/Indihome', 'user', 'pass', true);

-- Register downstream server (regional)
INSERT INTO downstream_servers (id, name, province, area_id)
VALUES (11, 'Jakarta', 'DKI Jakarta', 1);
```

#### Schedule Task Pertama

```sql
-- Task: Ping + Download + Upload untuk regional Jakarta
INSERT INTO tasks (title, task_type, test_type, group_id, cron_time, next_run, is_active)
VALUES (
  'R11 Jakarta - Ping + Speed',
  'scheduled',
  'ping,download,upload',
  11,                                    -- downstream_server_id
  '0 */6 * * *',                         -- every 6 hours
  NOW(),
  true
);
```

---

### Fase 2: Scale ke 5 Regional

Arsitektur setelah stabil di 1 regional:

```
┌───────────── VM Central ─────────────┐
│  PostgreSQL + Redis + Dispatcher     │
│  Dashboard + Workers (acs-*)         │
└──────┬──────────────────────┬────────┘
       │                      │
       ▼                      ▼
┌─────────── VM Reg-1 ────┐ ┌─────────── VM Reg-2 ────┐
│ Direct Ping Worker      │ │ Direct Ping Worker      │
│ DS_ID=11 (Jakarta)      │ │ DS_ID=2 (Sumut)         │
│ fping → 500 IPs         │ │ fping → 300 IPs         │
└─────────────────────────┘ └─────────────────────────┘
       │                      │
       ▼                      ▼
┌─────────── VM Reg-3 ────┐ ┌─────────── VM Reg-N ────┐
│ Direct Ping Worker      │ │ Direct Ping Worker      │
│ DS_ID=17 (Bali)         │ │ DS_ID=...               │
│ fping → 200 IPs         │ │ fping → ...             │
└─────────────────────────┘ └─────────────────────────┘
```

| VM | Spec | Fungsi |
|----|------|--------|
| Central | 8 vCPU, 32 GB RAM | DB, Queue, Dashboard, ACS Workers |
| Regional Worker | 2 vCPU, 4 GB RAM | Direct ping per-provinsi (10 menit) |

#### Container per Regional Worker

```yaml
# docker-compose.regional.yml
services:
  direct_ping_jakarta:
    image: mojo-worker:latest
    environment:
      DB_HOST: ${CENTRAL_DB_HOST}
      DOWNSTREAM_SERVER_ID: 11
    restart: unless-stopped

  direct_ping_sumut:
    image: mojo-worker:latest
    environment:
      DB_HOST: ${CENTRAL_DB_HOST}
      DOWNSTREAM_SERVER_ID: 2
    restart: unless-stopped
```

---

### Fase 3: Full Scale 34 Regional

```
┌────────────────── Data Center ──────────────────┐
│                                                   │
│  ┌──────────────┐    ┌──────────────┐             │
│  │ PostgreSQL    │    │ Redis         │            │
│  │ Master        │    │ Sentinel x3   │            │
│  │ PgBouncer     │    │               │            │
│  └──────┬───────┘    └──────┬───────┘             │
│         │                   │                     │
│  ┌──────┴───────────────────┴───────┐             │
│  │ Dispatcher (active)               │             │
│  │ Dispatcher (standby)              │             │
│  │ Dashboard Pod 1                   │             │
│  │ Dashboard Pod 2                   │             │
│  │ Workers: acs-fast (×5)            │             │
│  │ Workers: acs-download (×3)        │             │
│  │ Workers: acs-upload (×3)          │             │
│  └───────────────────────────────────┘             │
└────────────────────────────────────────────────────┘
        │            │            │            │
        ▼            ▼            ▼            ▼
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│ Reg1 │  │ Reg2 │  │ Reg3 │  │ ...  │  │ Reg34│
│ DP   │  │ DP   │  │ DP   │  │ DP   │  │ DP   │
│ 2vcpu│  │ 2vcpu│  │ 2vcpu│  │ 2vcpu│  │ 2vcpu│
└──────┘  └──────┘  └──────┘  └──────┘  └──────┘

  DP = Direct Ping Worker (fping)
  Setiap regional: berbeda downstream_server_id
```

#### Load Estimasi Full Scale

| Komponen | Jumlah | CPU | RAM |
|----------|--------|-----|-----|
| PostgreSQL | 1 | 4 vCPU | 16 GB |
| Redis Sentinel | 3 | 1 vCPU | 2 GB |
| Dashboard | 2 | 2 vCPU | 4 GB |
| Dispatcher | 2 | 1 vCPU | 1 GB |
| ACS Workers | 11 | 1 vCPU | 1 GB |
| Direct Ping Regional | 34 | 1 vCPU | 1 GB |
| **Total** | **53 containers** | **~58 vCPU** | **~70 GB** |

---

## 2. Pengembangan Sistem

### 2.1 Integrasi Notifikasi (Telegram)

#### Arsitektur

```
Worker (checkAndUpdateAlarm)
       │
       ├──► Telegram Bot
       │     POST https://api.telegram.org/bot{TOKEN}/sendMessage
       │     {
       │       chat_id: "-1001234567890",
       │       text: "🚨 Alarm Baru\nLatency: 150ms (threshold: 100ms)",
       │       parse_mode: "HTML"
       │     }
       │
       ├──► WhatsApp Gateway
       │     POST {api_url} (Fonnte/Wablas/Siren)
       │     { target: "08123456789", message: "..." }
       │
       └──► Ticketing System
             POST {api_url} (Jira/ServiceNow/Custom)
             { summary, description, priority, device_id }
```

#### Konfigurasi di DB

```sql
-- Telegram
INSERT INTO integration_settings (platform, name, status, config)
VALUES ('telegram', 'Telegram Bot Alarm', 'active',
  '{
    "bot_token": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    "chat_id": "-1001234567890"
  }'
);

-- WhatsApp
INSERT INTO integration_settings (platform, name, status, config)
VALUES ('whatsapp', 'WA NOC Group', 'active',
  '{
    "api_url": "https://api.fonnte.com/send",
    "api_key": "xxx",
    "target_number": "08123456789"
  }'
);

-- Ticketing
INSERT INTO integration_settings (platform, name, status, config)
VALUES ('ticketing', 'Jira Service Desk', 'active',
  '{
    "api_url": "https://jira.company.com/rest/api/2/issue",
    "api_key": "xxx",
    "project_key": "NOC",
    "issue_type": "Incident"
  }'
);
```

#### Fitur Yang Dikembangkan

| Fitur | Status | Prioritas |
|-------|--------|-----------|
| Notifikasi alarm baru | ✅ Done | High |
| Notifikasi alarm clear | ✅ Done | High |
| Group chat per regional | 🔜 Planned | Medium |
| Command bot (cek device, status) | 🔜 Planned | Medium |
| Daily report otomatis | 🔜 Planned | Low |
| Escalation jika > 4 jam | 🔜 Planned | Medium |

---

### 2.2 Ticket Management

#### Workflow

```
Alarm triggered
       │
       ▼
Check existing ticket untuk device ini
       │
       ├── Tidak ada → Create ticket (open)
       │     └── Notifikasi ke PIC
       │
       └── Ada (open/in_progress) → Update ticket
             └── Tambah comment: "Alarm still active"
```

#### Schema (Existing — `alarm_tickets`)

```sql
CREATE TABLE alarm_tickets (
  id SERIAL PRIMARY KEY,
  device_id INTEGER REFERENCES devices_ont(id),
  ticket_number VARCHAR(50) UNIQUE,     -- INC-20260709-001
  summary TEXT NOT NULL,
  root_cause TEXT,
  status VARCHAR(20) DEFAULT 'open',    -- open → in_progress → resolved → closed
  created_by VARCHAR(100) DEFAULT 'admin',
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Pengembangan ke Depan

| Fitur | Description |
|-------|-------------|
| Auto-create ticket | Saat alarm baru muncul |
| Ticket number format | `INC-{YYYYMMDD}-{SEQ}` |
| Assignment to PIC | Round-robin berdasarkan region |
| SLA tracking | Response < 30m, Resolution < 4h |
| Escalation matrix | L1 → L2 → L3 otomatis |
| Ticket comment sync | Dari alarm_comments ke ticket |
| Dashboard ticket view | List open tickets, filter region |

---

### 2.3 Dashboard & Reporting

#### Existing
- Real-time alarm monitoring
- Performance charts (latency, speed)
- Root cause analytics (L1/L2 donut)
- Map heatmap
- Multi-select location filter
- On-demand device test
- Duration & MTTR

#### Planned Enhancements

| Fitur | Timeline | Notes |
|-------|----------|-------|
| **SLA Report** | Q1 2027 | Per-province, CSV/PDF export |
| **Scheduled PDF report** | Q1 2027 | Email tiap minggu |
| **Custom dashboard widgets** | Q1 2027 | Drag-drop layout |
| **Grafana datasource** | Q1 2027 | PostgreSQL direct query |
| **WebSocket real-time** | Q4 2027 | Live update tanpa refresh |
| **Mobile responsive** | Q2 2027 | Dedicated mobile view |
| **Batch test UI** | Q3 2026 | Test per-province dari dashboard |

---

### 2.4 Integration API

#### Planned External API

```yaml
openapi: 3.0.0
info:
  title: MojoMojoMonitor External API
  version: 1.0.0
paths:
  /api/v1/devices:
    get: Query devices (filter region, status, manufacturer)
  /api/v1/devices/{id}/performance:
    get: Get performance data (period, test_type)
  /api/v1/alarms:
    get: Active alarms
  /api/v1/alarms/history:
    get: Alarm history with duration
  /api/v1/tasks:
    post: Trigger on-demand test
  /api/v1/webhook/alarm:
    post: Webhook callback saat alarm
```

- Autentikasi: API Key (header `X-API-Key`)
- Rate limit: 100 req/min per key
- Format: JSON, pagination cursor-based

---

## 3. Event Correlation & AI

### 3.1 Anomaly Detection Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Data Source│    │  Processing │    │  Detection  │
│             │    │             │    │             │
│ PostgreSQL  │───▶│ Python ETL  │───▶│ ML Model    │
│ test_results│    │ 15m window  │    │ (Isolation  │
│ active_alarm│    │ feature eng │    │  Forest /   │
│             │    │             │    │  LSTM-AE)   │
└─────────────┘    └─────────────┘    └──────┬──────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │  Output          │
                                    │                  │
                                    │ Anomaly Score    │
                                    │ Root Cause Prob  │
                                    │ Recommendation   │
                                    └─────────────────┘
```

#### Feature Engineering

Dari data 15 menit per device:

```python
features = {
  # Latency features
  "ping_igw_mean_15m", "ping_igw_std_15m", "ping_igw_max_15m",
  "ping_ebr_mean_15m", "ping_ebr_packet_loss_15m",

  # Speed features
  "download_speed_mean_15m", "download_speed_min_15m",
  "upload_speed_mean_15m", "upload_speed_min_15m",

  # Temporal features
  "hour_of_day", "day_of_week", "is_weekend",

  # Device context
  "manufacturer_encoded", "region_encoded", "speed_group",

  # Alarm context
  "active_alarm_count", "last_alarm_hours_ago",
}
```

#### Model Comparison

| Model | Use Case | Accuracy | Latency |
|-------|----------|----------|---------|
| **Isolation Forest** | Real-time anomaly | 85-90% | < 100ms |
| **LSTM Autoencoder** | Time series pattern | 90-95% | ~5s (batch) |
| **XGBoost Classifier** | Root cause prediction | 80-85% | < 50ms |
| **Moving Average + 3σ** | Threshold drift | 95% | Real-time |

#### Detection Rules (Rule-based, no ML needed)

```sql
-- 1. Latency spike: > 3× historical avg
SELECT device_id, ping_igw
FROM test_results_ping
WHERE ping_igw > (
  SELECT AVG(ping_igw) * 3
  FROM test_results_ping t2
  WHERE t2.device_id = test_results_ping.device_id
    AND t2.executed_at > NOW() - INTERVAL '7 days'
) AND executed_at > NOW() - INTERVAL '15 minutes';

-- 2. Speed degradation: < 50% dari threshold
SELECT device_id, download_speed
FROM test_results_speed_download
WHERE download_speed < (
  SELECT download_threshold * 0.5
  FROM speed_group sg
  JOIN devices_ont d ON d.speed_id = sg.id
  WHERE d.id = test_results_speed_download.device_id
) AND executed_at > NOW() - INTERVAL '15 minutes';

-- 3. Packet loss tiba-tiba
SELECT device_id, packet_loss_igw
FROM test_results_ping
WHERE packet_loss_igw > 20
  AND executed_at > NOW() - INTERVAL '30 minutes';

-- 4. Multiple device alarm dalam satu region
SELECT d.downstream_server_id, COUNT(*) as alarm_count
FROM active_alarms a
JOIN devices_ont d ON d.id = a.device_id
GROUP BY d.downstream_server_id
HAVING COUNT(*) > 5;
```

---

### 3.2 AI Summary Generation

#### Input: Data window 1 jam

```json
{
  "region": "Jakarta",
  "device_count_alarmed": 15,
  "total_devices": 500,
  "alarm_types": {
    "latency": 10,
    "download": 3,
    "upload": 2
  },
  "common_root_causes": ["High Temperature", "FO Cut"],
  "top_anomalies": [
    {
      "device": "ONT-JKT-001",
      "metric": "latency",
      "current": 350,
      "baseline": 25,
      "severity": "critical"
    }
  ],
  "regional_avg_ping": 85,
  "regional_avg_ping_baseline": 20,
  "mttr_trending": "increasing_last_24h"
}
```

#### Output: AI Summary

```
🧠 Analisis Otomatis — JAKARTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ 2026-07-09 10:00 - 11:00 WIB

📊 Ringkasan:
• 15 device alarm aktif (3% dari 500 device)
• Latency rata-rata regional: 85ms (naik 325% dari baseline 20ms)
• Download speed rata-rata: 35 Mbps (turun 30% dari normal)

🔍 Anomali Terdeteksi:
1. CRITICAL — ONT-JKT-001 (SN: HWTxxx)
   Latency: 350ms (baseline 25ms) — 14× dari normal
   Rekomendasi: ⚡ Periksa FO, kemungkinan FO Cut

2. WARNING — ONT-JKT-015 (SN: NOKxxx)
   Download: 5 Mbps (threshold: 50 Mbps)
   Rekomendasi: ⚡ Cek speed profile, kemungkinan bandwidth congestion

📈 Trend:
• MTTR meningkat 20% dalam 24 jam terakhir
• 3 device dengan latency > 200ms sudah > 4 jam

🏢 Regional Event Correlation:
• 8 dari 15 device alarmed berada di cluster NOP yang sama
• Kemungkinan: Gangguan OLT atau FO feeder

✅ Rekomendasi:
1. Prioritaskan pemeriksaan OLT di cluster JKP
2. Dispatch crew ke ONT-JKT-001 (latency critical)
3. Cek bandwidth utilization di BNG Jakarta
```

#### Implementation Approach

| Layer | Tech | Fungsi |
|-------|------|--------|
| **Data aggregation** | Python + Pandas | Window 1h, group by region |
| **Rule engine** | Python (if-else + scoring) | Detect pattern: multi-device, same NOP |
| **LLM summary** | OpenAI API / Local LLM | Generate human-readable summary |
| **Scheduling** | Celery / APScheduler | Tiap 1 jam |

#### Prompt Template

```
System: Anda adalah asisten analisis jaringan FTTH. 
Berdasarkan data berikut, buat summary dalam Bahasa Indonesia 
dengan format yang terstruktur. Sertakan rekomendasi.

Data:
{json_data}

Output format:
- Ringkasan (3 bullet point)
- Anomali terdeteksi (per device, severity, rekomendasi)
- Trend
- Regional event correlation
- Rekomendasi
```

---

### 3.3 Predictive Recommendations

#### Use Cases

| Kasus | Deteksi | Rekomendasi |
|-------|---------|-------------|
| **Latency meningkat gradual** | Trend analysis 7 hari | "Periksa FO, kemungkinan FO Cut progresif" |
| **Download rendah tapi upload normal** | Asymmetric degradation | "Kemungkinan speed profile mismatch, cek di OLT" |
| **ONT sering offline** | Pattern flapping | "ONT tidak stabil, rekomendasikan replacement" |
| **Packet loss tinggi, latency normal** | Layer 1/2 issue | "Cek physical link, kemungkinan dirty connector" |
| **Banyak device 1 OLT alarm bersamaan** | Correlation | "Gangguan OLT port/feeder, dispatch ke site OLT" |
| **MTTR meningkat untuk region tertentu** | Trend | "Evaluasi SLA kontraktor di region tersebut" |

#### Rule Scoring Engine

```python
def score_device_risk(device_id, window_hours=24):
    score = 0
    reasons = []

    # 1. Latency trend
    ping_data = query_ping(device_id, window_hours)
    if ping_data.avg > 100:
        score += 20
        reasons.append(f"Latency tinggi ({ping_data.avg}ms)")
    if ping_data.trend_slope > 5:
        score += 15
        reasons.append("Latency meningkat secara gradual")

    # 2. Speed degradation
    speed_data = query_speed(device_id, window_hours)
    if speed_data.download_avg < speed_data.threshold * 0.7:
        score += 20
        reasons.append(f"Download rendah ({speed_data.download_avg} Mbps)")

    # 3. Flapping
    status_changes = query_status_changes(device_id, 48)
    if status_changes > 5:
        score += 25
        reasons.append(f"ONT flapping ({status_changes}x dalam 48 jam)")

    # 4. Recurring alarms
    alarm_count = query_alarm_history(device_id, 7)
    if alarm_count > 3:
        score += 15
        reasons.append(f"Alarm berulang ({alarm_count}x dalam 7 hari)")

    # 5. Regional correlation
    region_alarms = query_region_alarms(device_id)
    if region_alarms > 10:
        score += 5
        reasons.append("Banyak device alarm di region yang sama")

    severity = "LOW"
    if score >= 80: severity = "CRITICAL"
    elif score >= 50: severity = "HIGH"
    elif score >= 30: severity = "MEDIUM"

    return {
        "device_id": device_id,
        "risk_score": score,
        "severity": severity,
        "reasons": reasons,
        "recommendation": generate_recommendation(reasons)
    }
```

#### Output ke Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│ 🔮 Prediksi & Rekomendasi                                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ⚠ HIGH — ONT-JKT-001 (Score: 65/100)                       │
│   • Latency meningkat gradual (15ms→45ms 7 hari)            │
│   • 3x alarm dalam 7 hari                                   │
│   • Rekomendasi: ⚡ Periksa FO Cut progresif                 │
│                                                              │
│ 🔴 CRITICAL — ONT-JKT-015 (Score: 85/100)                   │
│   • Flapping 8x dalam 48 jam                                │
│   • Download rendah (5 Mbps dari threshold 50)              │
│   • Rekomendasi: 🔧 Ganti ONT — kemungkinan hardware rusak  │
│                                                              │
│ ℹ️ Regional Insight — JAKARTA                                │
│   • 12 device di cluster JKP terindikasi FO Cut             │
│   • Kemungkinan gangguan OLT JLKP-01                         │
│   • ✅ Crew sudah di-dispatch                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### 3.4 Auto-Tuning Threshold

Sistem bisa suggest adjustment threshold berdasarkan historical data:

```sql
-- Hitung P95 latency per speed group dalam 30 hari
SELECT
  sg.name as speed_group,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY p.ping_igw) as p95_latency,
  PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY sd.download_speed) as p5_download,
  PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY su.upload_speed) as p5_upload
FROM devices_ont d
JOIN speed_group sg ON sg.id = d.speed_id
JOIN test_results_ping p ON p.device_id = d.id
JOIN test_results_speed_download sd ON sd.device_id = d.id
JOIN test_results_speed_upload su ON su.device_id = d.id
WHERE p.executed_at > NOW() - INTERVAL '30 days'
GROUP BY sg.name;

-- Output:
-- speed_group | p95_latency | p5_download | p5_upload
-- 50 Mbps     | 85          | 30.5        | 8.2
-- 100 Mbps    | 45          | 65.2        | 15.8
```

Saran: Jika P95 latency < threshold, threshold bisa diturunkan.
Jika P5 speed jauh di atas threshold, threshold bisa dinaikkan.

---

### 3.5 Implementation Timeline

| Phase | Fitur | Timeline | Dependency |
|-------|-------|----------|------------|
| **P1** | Rule-based anomaly detection | Q4 2026 | Data > 3 bulan |
| **P2** | Regional correlation engine | Q4 2026 | Multi-region deployed |
| **P3** | AI Summary (LLM) | Q1 2027 | OpenAI API / Local LLM |
| **P4** | Predictive risk scoring | Q1 2027 | Historical data > 6 bulan |
| **P5** | Auto-threshold tuning | Q2 2027 | Phase 1-4 stable |
| **P6** | Recommendation engine | Q2 2027 | Root cause data lengkap |
| **P7** | Full automation (dispatch) | Q3 2027 | Integrasi ticketing |

---

## Ringkasan Tahapan

```
Q3 2026 ─── Fase 1: Pilot 1 Regional
              ├── 1 VM, Docker Compose
              ├── 1 IGW + 1 near BNG
              ├── Ping, Download, Upload test
              └── Dashboard + Alarm dasar

Q4 2026 ─── Fase 2: Scale 5 Regional
              ├── Central VM + Regional VM
              ├── Direct ping per provinsi
              ├── Telegram/WA notifikasi
              └── Multi-region dashboard

Q1 2027 ─── Fase 3: Full 34 Regional
              ├── PostgreSQL Partitioning
              ├── PgBouncer connection pool
              ├── 34 direct ping workers
              └── SLA Reporting

Q2 2027 ─── Fase 4: Analytics
              ├── Rule-based anomaly detection
              ├── Regional correlation
              ├── AI Summary (LLM)
              └── Auto-threshold tuning

Q3 2027 ─── Fase 5: Maturity
              ├── Predictive risk scoring
              ├── Auto-dispatch recommendation
              ├── Ticketing integration
              └── High availability

Q4 2027+ ── Fase 6: Innovation
              ├── Full ML pipeline
              ├── Customer-facing portal
              ├── WebSocket real-time
              └── K8s migration
```
