# Low-Level Design — MojoJojoMonitor

## 1. Database Schema

### 1.1 Master/Configuration Tables

#### `roles`
```sql
id SERIAL PK
name VARCHAR(50) UNIQUE -- admin, operator, viewer, field
description TEXT
created_at TIMESTAMP DEFAULT NOW()
```

#### `users`
```sql
id SERIAL PK
username VARCHAR(100) UNIQUE
password VARCHAR(255) -- bcrypt hash
role_id INTEGER FK → roles(id)
email VARCHAR(100)
full_name VARCHAR(100)
is_active BOOLEAN DEFAULT true
last_login TIMESTAMP
created_at / updated_at TIMESTAMP
```

#### `speed_group`
```sql
id SERIAL PK
name VARCHAR(100) -- e.g. "10 Mbps", "20 Mbps"
speed_limit FLOAT
upload_threshold FLOAT
download_threshold FLOAT
description TEXT
created_at / updated_at TIMESTAMP
```

#### `devices_ont` (actual table name in production: `devices`)
```sql
id SERIAL PK
device_name VARCHAR(100)
serial_number VARCHAR(100) UNIQUE
mac_address VARCHAR(17) UNIQUE
ip_address INET
group_id INTEGER FK → group_devices(id)
speed_id INTEGER FK → speed_group(id) -- references speed_group
indihome_id VARCHAR(100)
cpe_type VARCHAR(50)
manufacturer VARCHAR(100)
model VARCHAR(100)
status VARCHAR(20) -- online, offline, unknown
last_seen TIMESTAMP
latitude DECIMAL, longitude DECIMAL -- geo location
downstream_server_id INTEGER FK → downstream_servers(id)
nop_city_id INTEGER FK → master_cluster_nop(id)
alias VARCHAR(100)
created_at / updated_at TIMESTAMP
```

#### `downstream_servers`
```sql
id SERIAL PK
name VARCHAR(100) -- e.g. "R01 Sumut", "R07 Bali"
location VARCHAR(100)
province VARCHAR(100)
lat DECIMAL, lng DECIMAL
status VARCHAR(20)
icon VARCHAR(50), color VARCHAR(20)
```

#### `master_cluster_nop`
```sql
id SERIAL PK
name VARCHAR(100) -- NOP/City name
area_id INTEGER FK → master_area(id)
regional_id INTEGER FK → downstream_servers(id)
```

#### `master_area`
```sql
id SERIAL PK
name VARCHAR(100)
```

#### `threshold_master`
```sql
id SERIAL PK
type VARCHAR(20) -- UPPER or LOWER
metric VARCHAR(50) -- latency, packet_loss, download_speed, upload_speed
profile VARCHAR(20) -- Bronze, Silver, Gold, Platinum, or null
warning_value FLOAT
critical_value FLOAT
unit VARCHAR(20)
speed_id INTEGER FK → speed_group(id) -- optional per-speed-group override
```

#### `app_settings`
```sql
id SERIAL PK
app_name VARCHAR(100) DEFAULT 'MojoJojo Monitor'
logo_url TEXT
favicon_url TEXT
created_at / updated_at TIMESTAMP
```

#### `axiros_server`
```sql
id SERIAL PK
server_url VARCHAR(255) -- https://acs.network.telkomsel.co.id
base_path VARCHAR(255) -- /live/AXAPI/Indihome
auth_username VARCHAR(100), auth_password VARCHAR(255)
is_active BOOLEAN DEFAULT true
created_at / updated_at TIMESTAMP
```

#### `integration_settings`
```sql
id SERIAL PK
platform VARCHAR(20) -- telegram, whatsapp, ticketing
config JSONB -- API keys, endpoints, chat IDs
is_active BOOLEAN
```

#### `payloads`
```sql
id SERIAL PK
name VARCHAR(100), method VARCHAR(10), endpoint TEXT
parameters JSONB, headers JSONB, description TEXT
created_at TIMESTAMP
```

### 1.2 Operational Tables

#### `tasks`
```sql
id SERIAL PK
title VARCHAR(100)
task_type VARCHAR(20) -- 'scheduled' or 'ondemand'
test_type VARCHAR(50) -- 'ping', 'traceroute', 'download', 'upload', 'ont-status', or comma-separated
group_id INTEGER FK → group_devices(id) -- target group
device_id INTEGER FK → devices(id) -- single device (for ondemand)
downstream_server_id INTEGER FK → downstream_servers(id) -- regional filter
payload_id INTEGER FK → payloads(id)
cron_time VARCHAR(50) -- cron expression for scheduled
scheduled_at TIMESTAMP -- for ondemand single execution
next_run TIMESTAMP -- next scheduled run time
is_active BOOLEAN DEFAULT true
created_by INTEGER FK → users(id)
deleted_at TIMESTAMP -- soft delete
created_at / updated_at TIMESTAMP
CONSTRAINT chk_target_not_null CHECK (group_id IS NOT NULL OR device_id IS NOT NULL)
```

#### `queue_jobs`
```sql
id UUID PK DEFAULT uuid_generate_v4()
task_id INTEGER FK → tasks(id) ON DELETE CASCADE
device_id INTEGER FK → devices(id) ON DELETE CASCADE
payload_data JSONB -- snapshot of payload at creation
execution_type VARCHAR(20) -- scheduled / ondemand
test_type VARCHAR(50) -- ping, download, upload, traceroute, speedtest, custom
run_id TEXT -- task_id-timestamp for grouping
group_id INTEGER FK → group_devices(id)
speed_id INTEGER FK → speed_group(id)
status VARCHAR(20) -- pending, processing, completed, failed
retry_count INTEGER DEFAULT 0
last_error TEXT
created_at TIMESTAMP
started_at TIMESTAMP
completed_at TIMESTAMP
```

#### `queue_results` (LEGACY — backward compatibility)
```sql
id SERIAL PK
queue_job_id UUID FK → queue_jobs(id)
device_id INTEGER FK → devices(id)
ping_ms FLOAT, traceroute_hops TEXT
download_speed FLOAT, upload_speed FLOAT
packet_loss FLOAT
raw_response JSONB
success BOOLEAN NOT NULL DEFAULT false
error_message TEXT
executed_at TIMESTAMP DEFAULT NOW()
```

### 1.3 Test Results Tables (separate per type — prevents race conditions)

#### `test_results_ping`
```sql
id SERIAL PK
task_id INTEGER FK → tasks(id)
device_id INTEGER FK → devices(id)
queue_job_id UUID FK → queue_jobs(id)
ping_igw DECIMAL(10,2) -- latency to IGW (ms)
ping_ebr DECIMAL(10,2) -- latency to EBR (ms)
packet_loss_igw DECIMAL(5,2) -- packet loss % to IGW
packet_loss_ebr DECIMAL(5,2) -- packet loss % to EBR
success BOOLEAN DEFAULT false
executed_at TIMESTAMP DEFAULT NOW()
created_at TIMESTAMP DEFAULT NOW()
INDEX: (device_id, executed_at DESC)
```

#### `test_results_speed_download`
```sql
id SERIAL PK
task_id INTEGER FK → tasks(id)
device_id INTEGER FK → devices(id)
queue_job_id UUID FK → queue_jobs(id)
download_speed DECIMAL(10,2)
download_threshold DECIMAL(10,2)
run_id TEXT
success BOOLEAN DEFAULT false
executed_at / created_at TIMESTAMP
INDEX: (device_id, executed_at DESC)
```

#### `test_results_speed_upload`
```sql
(Same structure as download, but for upload_speed/upload_threshold)
```

#### `test_results_traceroute`
```sql
id SERIAL PK
task_id INTEGER FK → tasks(id)
device_id INTEGER FK → devices(id)
queue_job_id UUID FK → queue_jobs(id)
traceroute_raw JSONB -- array of hop objects
total_hops INTEGER
total_rtt_ms DECIMAL(10,2)
success BOOLEAN DEFAULT false
executed_at / created_at TIMESTAMP
GIN INDEX ON (traceroute_raw)
```

#### `test_results_direct_ping`
```sql
(Managed by direct-ping-worker; schema per worker implementation)
device_id INTEGER
ip_address INET
avg_latency_ms DECIMAL
packet_loss_percent DECIMAL
downstream_server_id INTEGER
executed_at TIMESTAMP
```

### 1.4 Alarm Tables

#### `active_alarms`
```sql
id SERIAL PK
device_id INTEGER FK → devices(id)
alarm_type VARCHAR(50) -- latency, packet_loss, download_speed, upload_speed
alarm_code VARCHAR(20) -- generated code
severity VARCHAR(20) -- critical, warning
metric_value FLOAT
threshold_value FLOAT
unit VARCHAR(20)
category VARCHAR(50) -- latency, speed, packet_loss
triggered_at TIMESTAMP
root_cause_id INTEGER FK → root_causes(id)
root_cause_note TEXT, action TEXT, pic VARCHAR(100), assigned_at TIMESTAMP
ticket_id INTEGER
```

#### `alarm_history`
```sql
(Same columns as active_alarms, plus:)
cleared_at TIMESTAMP
duration_seconds INTEGER -- calculated on clear
```

#### `alarm_comments`
```sql
id SERIAL PK
device_id INTEGER FK → devices(id)
parent_id INTEGER -- for replies
comment TEXT
created_by VARCHAR(100)
created_at TIMESTAMP
```

#### `root_causes`
```sql
id SERIAL PK
category VARCHAR(50) -- L1: Availability, Capacity, Interface/Port Problem, Other
name VARCHAR(100) -- L2: FO Cut, Module Faulty, High Temp, etc.
```

### 1.5 Key Views

#### `v_device_health`
Aggregates device test results within last 24h: avg ping, avg download/upload, success rate.

#### `v_task_summary`
Aggregates queue_job stats per task: total, completed, failed, pending, processing.

### 1.6 Critical Indexes
```sql
-- Devices
idx_devices_status ON devices(status)
idx_devices_serial ON devices(serial_number)

-- Queue Jobs
idx_queue_status ON queue_jobs(status) WHERE status = 'pending'
idx_queue_created ON queue_jobs(created_at)

-- Test Results (each type has similar pattern)
idx_test_results_ping_device_executed ON test_results_ping(device_id, executed_at DESC)

-- Alarms
(active_alarms queried by device_id, alarm_type)
```

---

## 2. API Route Map

### 2.1 Dashboard
| Method | Route | Purpose | Key Parameters |
|--------|-------|---------|---------------|
| GET | `/api/dashboard/summary` | Main KPI data | timeRange, areaIds, regionalIds, nopIds, speedGroupId, manufacturerId, ontModelId |
| GET | `/api/dashboard/v2` | Secondary dashboard KPIs | - |
| GET | `/api/dashboard/ont-type-comparison` | ONT type performance comparison | timeRange, location filters |
| GET | `/api/dashboard/ont-brand-comparison` | Brand performance comparison | timeRange, location filters |
| GET | `/api/system/status` | System health status | - |
| GET | `/api/performance` | Performance test data | location, device filters |
| POST/GET | `/api/devices/map` | Device geo data for heatmap | location, filter params |
| POST/GET | `/api/devices/map/ondemand` | On-demand test via heatmap | deviceId, testType |

### 2.2 Devices
| Method | Route | Purpose | Key Parameters |
|--------|-------|---------|---------------|
| GET | `/api/devices` | List/search devices | search, status, speed, location, pagination |
| GET | `/api/devices/[id]` | Single device detail | id |
| POST | `/api/devices` | Create device | body: device data |
| PUT | `/api/devices/[id]` | Update device | body: fields to update |
| DELETE | `/api/devices/[id]` | Delete device | id |
| GET | `/api/devices/averages` | Aggregated device metrics | location, timeRange |
| POST | `/api/bulk-assign` | Bulk assign region | body: device IDs + region |

### 2.3 Alarms
| Method | Route | Purpose | Key Parameters |
|--------|-------|---------|---------------|
| GET | `/api/alarms/check` | List active/cleared alarms | area_ids, regional_ids, nop_ids, severity, search |
| GET | `/api/alarms/history` | Per-device alarm history | device_id |
| GET | `/api/alarms/mttr` | MTTR summary | (30-day default) |
| GET | `/api/alarms/stats` | Alarm count (sidebar badge) | - |
| GET | `/api/alarms/comments` | Device comments | device_id |
| POST | `/api/alarms/comments` | Add comment | device_id, comment, parent_id (optional) |
| DELETE | `/api/alarms/comments` | Delete comment | id |
| POST | `/api/alarms/root-cause/assign` | Assign root cause | device_id, root_cause_id, note, action, pic |
| POST | `/api/alarms/tickets` | Create ticket | device_id, summary, root_cause |
| POST | `/api/alarms/[id]/clear` | Clear alarm | id |

### 2.4 Tasks & Testing
| Method | Route | Purpose | Key Parameters |
|--------|-------|---------|---------------|
| GET | `/api/tasks` | List tasks | type, status |
| POST | `/api/tasks` | Create task | title, task_type, test_type, target, schedule |
| PUT | `/api/tasks/[id]` | Update task | body: fields |
| DELETE | `/api/tasks/[id]` | Delete task | id |
| POST | `/api/tasks/[id]/run` | Trigger immediate run | id |

### 2.5 Admin
| Method | Route | Purpose |
|--------|-------|---------|
| GET/PUT | `/api/app-settings` | App name, logo, favicon |
| GET/POST/PUT/DELETE | `/api/threshold` | Threshold CRUD |
| GET/POST/PUT/DELETE | `/api/users` | User management |
| GET/POST/PUT/DELETE | `/api/roles` | Role management |
| GET | `/api/redis/*` | Redis info, keys, flush |
| GET/POST | `/api/worker/*` | Worker status, stop/start |
| POST | `/api/scaling` | Docker compose scale |
| GET | `/api/health` | System health (services, containers) |

### 2.6 Master Data
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/manufacturer` | ONT manufacturer list |
| GET | `/api/ont-model` | ONT model list |
| GET | `/api/speed-groups` | Speed package list |
| GET | `/api/location/*` | Area/Regional/NOP hierarchy |
| GET | `/api/downstream-servers` | Regional server list |

### 2.7 Auth
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/auth/login` | Login (sets cookie) |
| POST | `/api/auth/logout` | Logout (clears cookie) |
| GET | `/api/user-role` | Current user info + role |

---

## 3. Dispatcher Logic (`worker/dispatcher.js`)

### 3.1 Flow
```
cron.schedule('* * * * *')
  │
  ├── A. Scheduled Task Processing
  │   1. Query: tasks WHERE is_active=true AND next_run < NOW()
  │   2. For each task:
  │      a. Dedup check: pending/processing queue_jobs already exist?
  │      b. Gather device IDs (from downstream_server_id + optional nop_city, or single device_id)
  │      c. Check global pending cap (MAX_PENDING_JOBS = 50,000)
  │      d. Delete stale pending jobs >1hr old
  │      e. Insert queue_jobs in chunks of 50 (CHUNK_SIZE) with 500ms delay
  │      f. Add BullMQ jobs with jobId = ${deviceId}-${testType}-${taskId}
  │      g. Update tasks.next_run (cron parsing) or set is_active=false (ondemand)
  │
  └── B. Pending Queue Job Dispatch
      1. Query: queue_jobs WHERE status='pending' ORDER BY created_at LIMIT 100
      2. For each: add BullMQ job → update status to 'processing'
```

### 3.2 Queue Mapping
```
testType → Queue
─────────   ─────
ping        → acs-fast
traceroute  → acs-fast
ont-status  → acs-fast (via legacy queue in some cases)
download    → acs-download
upload      → acs-upload
default     → acs-queue (legacy)
```

### 3.3 Safety Mechanisms
- **Dedup**: Checks for existing pending/processing queue_jobs per device-test_type pair before inserting
- **Global cap**: 50,000 max pending jobs across all queues
- **Stale cleanup**: Deletes pending jobs >1 hour old (not associated with any active task)
- **Legacy drain**: Auto-drains acs-queue if >10,000 stale jobs accumulated
- **Chunk delay**: 500ms sleep between chunks to prevent CPU spikes

---

## 4. Worker Processing Logic (`worker/worker.js`)

### 4.1 Job Processing Flow
```
Worker picks up job from BullMQ queue
  │
  1. Check stop signal: redis.get('worker:stop-signal') → if set, abort
  2. Update queue_jobs: status = 'processing', started_at = NOW()
  3. Fetch device data from devices_ont
  4. Fetch Axiros server config (cached 60s, circuit breaker protected)
  5. Execute test based on testType:
  │
  ├── executePing(device, queueJobId)
  │   • Fetch near IGW server + near EBR server from /api/test-server
  │   • Call IGW ping: POST IPPingTest to Axiros API
  │   • Call EBR ping: POST IPPingTest to Axiros API
  │   • Each target: up to 3 retries with 10s delay
  │   • Redis rate limit: 10s gap between pings per device
  │   • Returns: ping_igw, ping_ebr, packet_loss_igw, packet_loss_ebr
  │
  ├── executeTraceroute(device, queueJobId)
  │   • Call TraceRouteTest RPC to Axiros API (to near EBR host)
  │   • Parse hop data (address, hostname, error code, RTT)
  │   • Returns: traceroute_hops array
  │
  ├── executeDownload(device, queueJobId)
  │   • Call PostONTDownloadSpeed to start test
  │   • Retry up to 5× (30s delay) for "Device Not Ready"
  │   • Poll GetONTDownloadSpeedResult up to 15× (every 30s)
  │   • Returns: download_speed in Mbps
  │
  ├── executeUpload(device, queueJobId)
  │   • Same pattern as download but for upload
  │   • Call PostONTUploadSpeed → poll GetONTUploadSpeedResult
  │   • Returns: upload_speed in Mbps
  │
  └── executeOntStatus(device)
      • Call GetONTStatus API
      • Updates device status + cpe_type in devices_ont
  
  6. Save results to test_results_* table (ON CONFLICT DO UPDATE)
  7. Check alarms: checkAndUpdateAlarm()
     • Compare metric values against speed_group thresholds
     • Default thresholds: upload < 10 Mbps, download < 50 Mbps, latency > 100 ms
     • If threshold breached + no existing alarm → CREATE active_alarm
     • If value normal + existing alarm → CLEAR (move to alarm_history with duration)
  8. Send notifications if configured (Telegram, WhatsApp, Ticketing)
  9. Update device last_seen + set status = 'online'
  10. Update queue_jobs: status = 'completed'/'failed', last_error, raw_response
```

### 4.2 Worker Configuration

| Parameter | Fast Queue | Speed Queues (dl/ul) |
|-----------|------------|---------------------|
| concurrency | 5 (default) | 2 (default) |
| lockDuration | 300,000ms (5 min) | 600,000ms (10 min) |
| stalledInterval | 120,000ms (2 min) | 300,000ms (5 min) |
| maxStalledCount | 1 | 1 |
| attempts | 2 | 2 |
| backoff | Exponential, 15s base | Exponential, 15s base |

### 4.3 Distributed Rate Limiting (Redis)
- Ping: `ping:last:{deviceId}` — 10s cooldown
- Speed (shared dl/ul): `speed:last:{deviceId}` — 10s cooldown

### 4.4 Circuit Breaker (Axiros Config)
- 5 consecutive failures → open circuit (30s timeout)
- Cache Axiros config for 60s (`AXIROS_CONFIG_TTL_MS`)

### 4.5 Heartbeat
Worker registers in Redis hash `acs-workers` every 60s with 120s TTL:
```json
{ workerId, status: 'online', concurrency, queueName, uptime }
```

---

## 5. Direct Ping Worker (`worker/direct-ping-worker.js`)

### 5.1 Flow
```
1. Startup: Immediate run, then loop every DIRECT_PING_INTERVAL_MINUTES (default: 10)
2. Query devices_ont WHERE ip_address IS NOT NULL (filtered by DOWNSTREAM_SERVER_ID)
3. Validate IP addresses
4. Execute ping:
   ├── If fping available: single fping command for all IPs → parse combined output
   └── If fping unavailable: sequential ping, 100ms delay between each
5. Insert results into test_results_direct_ping
6. Update heartbeat in Redis
7. Check stop signal before each cycle
```

### 5.2 Configuration
| Parameter | Default |
|-----------|---------|
| DIRECT_PING_INTERVAL_MINUTES | 10 |
| PING_COUNT | 4 |
| PING_TIMEOUT_MS | 5000 |
| DOWNSTREAM_SERVER_ID | 0 (all) |
| Capability | NET_RAW (Docker) |

---

## 6. Frontend Component Hierarchy

```
RootLayout (app/layout.tsx)
├── ThemeProvider
├── ServiceWorkerRegister
└── DashboardLayout
    ├── Sidebar
    │   ├── Logo + App Name
    │   ├── Menu Items (role-filtered)
    │   │   ├── Main Menu: Dashboard, Performance Test, Devices, Alarms, Reports
    │   │   ├── Testing: Scheduled Test, On Demand Test, Queueing
    │   │   └── Administrator: Setting, Threshold, Users, Roles, etc.
    │   ├── Theme Toggle (dark/light)
    │   └── Logout Button
    ├── AnimatedBackground
    ├── ChatbotWidget (AI assistant)
    └── Page Content (children)
```

### 6.1 Dashboard Page Components (`/`)
```
DashboardPage
├── Filter Bar
│   ├── TimeRange Dropdown (1h/6h/24h/7d/30d)
│   ├── LocationFilter (Area → Regional → NOP multi-select modal)
│   ├── SpeedGroup Dropdown
│   ├── Manufacturer Dropdown
│   ├── ONTModel Dropdown
│   └── Clear Filter Button
├── TopCards (4 KPI cards: Latency, Speed, Packet Loss, Devices)
│   ├── KPIBigCard / KPICard
│   ├── PerformanceAnalytics
│   └── AvailabilityCard
├── NetworkDiagram (SVG topology: ONT → BNG → IGW → File Server)
├── DeviceHeatmap (MapLibre GL map with device markers + popups)
├── ONT Type Comparison (Recharts BarChart × 3: speed, latency, packet loss)
├── ONT Brand Comparison (Recharts BarChart × 3)
├── Latency Trend Chart (PingChart — Recharts Line/ComposedChart)
├── Speed Trend Chart (PingChart)
├── Packet Loss Chart (PingChart)
├── SeveritySummary
├── RootCauseAnalytics (Canvas 2D donut + bar charts)
├── Top Alarm List
└── Top Devices (worst performers per metric)
```

### 6.2 Alarms v2 Page (`/alarms/v2`)
```
AlarmsV2Page
├── Header (title + total counts + refresh button)
├── Filter Bar (LocationFilter + Severity dropdown + Search input)
├── Tab: Active / Cleared
├── MTTR Summary Card (cleared tab only)
├── Alarms Table
│   └── Expandable Row →
│       ├── Root Cause Section
│       │   ├── L1 Category Dropdown (Availability/Capacity/Interface/Other)
│       │   ├── L2 Root Cause Dropdown (per category)
│       │   ├── Note Input (for "Other" category)
│       │   ├── Action TextArea
│       │   ├── PIC Input
│       │   ├── Save Root Cause Button
│       │   └── Saved RC Display (with timestamp)
│       ├── Retest Button (creates on-demand task)
│       ├── Comments Section
│       │   ├── Comment List (with replies, hover delete)
│       │   └── Add Comment Input
│       └── Create Ticket Button (opens slide-in panel)
├── History Modal (per-device alarm history with duration column)
└── Ticket Panel (slide-in form)
```

### 6.3 Devices Page (`/devices`)
```
DevicesPage
├── Filter Bar (2 rows: search, location, status, speed, brand, ONT type, model, IP, IndiHome ID)
├── Action Bar (Add Device, Export CSV, Bulk Assign)
├── Paginated Device Table
│   ├── Inline Alias Editing
│   └── Row Actions: Detail, Edit, On-Demand Test, Delete
├── Device Detail Modal
│   ├── ONT Architecture Diagram (SVG)
│   ├── Device Info + Location
│   ├── Historical Charts (ping/speed over time)
│   └── Latest Results (ping, download, upload, traceroute)
└── Quick Edit Modal
```

### 6.4 Key Shared Components
| Component | File | Lines | Tech |
|-----------|------|-------|------|
| LocationFilter | components/LocationFilter.tsx | ~300 | Multi-select checkbox modal with counts |
| DeviceHeatmap | components/DeviceHeatmap.tsx | 605 | MapLibre GL, createRoot for popup React content |
| PingChart | components/PingChart.tsx | 314 | Recharts LineChart/ComposedChart, custom legend |
| NetworkDiagram | components/NetworkDiagram.tsx | 182 | Custom SVG, upstream/downstream mode toggle |
| RootCauseAnalytics | components/RootCauseAnalytics.tsx | 120 | Canvas 2D: solid donut (L1) + horizontal bars (L2) |
| TopCards | components/TopCards.tsx | 167 | 4 grid KPI cards |
| ConfirmDialog | components/ConfirmDialog.tsx | - | Reusable confirmation modal |

---

## 7. Authentication & Authorization Flow

### 7.1 Login
```
1. POST /api/auth/login { username, password }
2. Verify bcrypt hash against users table
3. Create user_session (cookie-based, httpOnly)
4. Return { success: true, role, username, full_name }
```

### 7.2 Session Verification
```
1. Cookie 'user_session' sent with every request
2. API route reads cookie → queries active session
3. Returns 401 if invalid/expired
4. Login page redirects unauthenticated users
```

### 7.3 Role-Based Access
```
Sidebar:
  field     → show only "Field Test" link
  viewer    → hide all "Administrator" sections
  operator  → show admin section excluding Setting, Users, Roles
  admin     → show all

API Protection:
  Admin routes use useRequireAdmin() hook
  Backend checks role on sensitive endpoints
```

---

## 8. Frontend Data Flow Patterns

### 8.1 Data Fetching
- **Primary method**: `fetch()` in `useEffect` with 30s auto-refresh interval
- **SWR**: Used on some pages for stale-while-revalidate pattern
- **SSR**: `generateMetadata()` in layout fetches app settings server-side
- **Dynamic imports**: `DeviceHeatmap` dynamically imported with `ssr: false`

### 8.2 State Management
- **Local state**: `useState` & `useRef` per component (no Redux/Zustand)
- **`filtersRef` pattern**: refs used to avoid stale closure in callbacks
- **`locRef` pattern**: same ref approach for location filters

### 8.3 Formatting Utilities
- WIB timezone (Asia/Jakarta) used throughout
- Duration formatting: `Xd Yh Zm Zs` pattern
- Metric coloring: red/amber/green based on matching alarm_type in device alarms array

---

## 9. Container & Infrastructure Detail

### 9.1 Dockerfile Analysis

#### Dashboard (`dashboard/Dockerfile`) — Multi-stage Build

**Stage 1: Builder**
- Base: `node:20-alpine`
- Runs `npm install --legacy-peer-deps` (full dev dependencies)
- Builds Next.js with dummy env vars (DB/REDIS dummies for build-time resolution)
- Output: `.next` build artifacts, `node_modules`

**Stage 2: Runner**
- Base: `node:20-slim` (Debian-based, larger than Alpine but required for Docker CLI)
- Includes:
  - `docker` CLI (static binary v29.1.3) — for `docker compose scale` from admin UI
  - `docker-compose` (standalone v2.35.1) — scaling operations
  - `ca-certificates`, `curl` — HTTPS connectivity
- Copies only: `.next`, `node_modules` (production), `public/`, `package.json`, `next.config.js`
- Startup: `npm start` → `next start` on port 3000

#### Worker (`worker/Dockerfile`) — Single Stage

- Base: `node:20-alpine`
- Installs OS deps: `fping`, `iputils` (for ICMP ping + fping)
- `npm install --production` (no dev deps)
- Single image used for all worker types (queue selection via `QUEUE_NAME` env var)
- Startup: `node worker.js` or `node dispatcher.js` or `node start-direct-ping-worker.js`

### 9.2 Container Environment Variables

#### PostgreSQL (`postgres:15-alpine`)

| Variable | Value | Purpose |
|----------|-------|---------|
| `POSTGRES_USER` | `${POSTGRES_USER:-mojojojo_user}` | Database user |
| `POSTGRES_PASSWORD` | `${POSTGRES_PASSWORD}` | Database password |
| `POSTGRES_DB` | `${POSTGRES_DB:-mojojojo_database}` | Database name |
| `TZ` | `Asia/Jakarta` | Timezone |
| `POSTGRES_PORT` | `5432` | Port (internal) |

**Command args:** `postgres -c timezone=Asia/Jakarta`

#### Redis (`redis:7-alpine`)

| Variable | Value | Purpose |
|----------|-------|---------|
| `REDIS_PASSWORD` | `${REDIS_PASSWORD}` | Auth password |

**Command:** `redis-server /usr/local/etc/redis/redis.conf`
**Config file:** `./config/redis.conf` (mounted read-only)
```
requirepass ${REDIS_PASSWORD}
```
**Security opts:** `no-new-privileges:true`, `read_only: true`, `tmpfs: /tmp`

#### Dashboard (Next.js)

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | `http://localhost/api` | Public API base URL |
| `INTERNAL_API_URL` | `http://localhost:3000` | Internal API URL for workers |
| `DB_HOST` | `mojojojo_postgres` | PostgreSQL hostname |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `mojojojo_user` | Database user |
| `DB_PASSWORD` | - | Database password |
| `DB_NAME` | `mojojojo_database` | Database name |
| `REDIS_HOST` | `mojojojo_redis` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | - | Redis password |
| `SESSION_SECRET` | - | Auth session encryption |
| `DEEPSEEK_API_KEY` | - | AI chatbot API key |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | AI API base URL |
| `DEEPSEEK_MODEL` | `deepseek-chat` | AI model name |

#### Workers (Dispatcher + ACS Workers)

| Variable | Default | Purpose |
|----------|---------|---------|
| `QUEUE_NAME` | (varies) | BullMQ queue: acs-fast/acs-download/acs-upload |
| `DB_HOST/PORT/USER/PASSWORD/NAME` | - | PostgreSQL connection |
| `REDIS_HOST/PORT/PASSWORD` | - | Redis + BullMQ connection |
| `API_BASE_URL` | `http://mojojojo_dashboard:3000` | Dashboard API for config |
| `PING_RATE_LIMIT_SECONDS` | `10` | Per-device ping cooldown |
| `SPEED_RATE_LIMIT_SECONDS` | `10` | Per-device speed test cooldown |
| `AXIROS_CONFIG_TTL_MS` | `60000` | Axiros config cache TTL |

#### Direct Ping Worker

| Variable | Default | Purpose |
|----------|---------|---------|
| `DIRECT_PING_INTERVAL_MINUTES` | `10` | Interval between ping cycles |
| `DOWNSTREAM_SERVER_ID` | `1` | Regional server filter (0=all) |

### 9.3 Volume Mounts & Data Persistence

| Volume Path | Container Path | Type | Purpose |
|------------|---------------|------|---------|
| `./data/postgres` | `/var/lib/postgresql/data` | Bind | Persistent database files |
| `./data/redis` | `/data` | Bind | Redis RDB snapshots |
| `./config/redis.conf` | `/usr/local/etc/redis/redis.conf` | Bind ro | Redis configuration |
| `./migrations` | `/docker-entrypoint-initdb.d` | Bind ro | SQL init scripts (first-run only) |
| `./dashboard/.next` | `/app/.next` | Bind | Next.js build output (live rebuild) |
| `/var/run/docker.sock` | `/var/run/docker.sock` | Bind ro | Docker daemon access |
| `./docker-compose.yml` | `/app/docker-compose.yml` | Bind ro | Scaling operations |
| `./docker-compose.scaling.yml` | `/app/docker-compose.scaling.yml` | Bind ro | Scaling operations |
| Redis tmpfs | `/tmp` | tmpfs | Redis temp files |

### 9.4 Service Dependency Graph

```
postgres (healthcheck: pg_isready)
  │
  ├── redis (healthcheck: redis-cli ping)
  │     │
  │     ├── mojo_dashboard (healthcheck: /api/health)
  │     │     │
  │     │     ├── mojo_worker_fast (depends_on: started)
  │     │     ├── mojo_worker_download (depends_on: started)
  │     │     └── mojo_worker_upload (depends_on: started)
  │     │
  │     ├── mojo_dispatcher (depends_on: healthy)
  │     ├── mojo_worker_fast (depends_on: healthy)
  │     ├── mojo_worker_download (depends_on: healthy)
  │     └── mojo_worker_upload (depends_on: healthy)
  │
  ├── mojo_dispatcher (depends_on: healthy)
  ├── mojo_worker_fast (depends_on: healthy)
  ├── mojo_worker_download (depends_on: healthy)
  ├── mojo_worker_upload (depends_on: healthy)
  └── mojo_direct_ping_worker (depends_on: healthy)
```

**Conditions:**
- `service_healthy` — waits for healthcheck to pass before starting
- `service_started` — waits for container to start (no healthcheck required)

### 9.5 Health Check Configuration

#### PostgreSQL
```yaml
test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
interval: 10s, timeout: 5s, retries: 5, start_period: 0s
```

#### Redis
```yaml
test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
interval: 10s, timeout: 5s, retries: 5, start_period: 0s
```

#### Dashboard
```yaml
test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health',
      r => {process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"]
interval: 30s, timeout: 10s, retries: 5, start_period: 40s
```

### 9.6 Container Networking

#### Network Topology
```
mojojojo_network (bridge, 172.x.x.x/16)
  │
  ├── postgres:5432 (exposed host: 5432)
  ├── redis:6379 (exposed host: 127.0.0.1:6379)
  ├── mojo_dashboard:3000 (exposed host: 3002)
  ├── mojo_dispatcher (no ports exposed)
  ├── mojo_worker_fast (no ports exposed)
  ├── mojo_worker_download (no ports exposed)
  ├── mojo_worker_upload (no ports exposed)
  └── mojo_direct_ping_worker (no ports exposed)
```

#### External Access
- Dashboard: host port `3002` → container port `3000`
- Externally accessible via frp tunnel at `gandooz.cloud:8804`
- Workers DO NOT expose ports (internal only)
- PostgreSQL port 5432 exposed to host (for external tools like DBeaver)
- Redis bound to `127.0.0.1:6379` (host-local only, not network-accessible)

### 9.7 Resource Limits

| Container | CPU Limit | Memory Limit | Memory Reservation | OOM Priority |
|-----------|-----------|--------------|---------------------|--------------|
| postgres | 1 | 4G | 512M | Low (critical DB) |
| redis | 0.5 | 1G | 256M | Low (critical queue) |
| mojo_dashboard | 1 | 2G | - | Medium |
| mojo_dispatcher | 0.5 | 256M | - | Low (can restart) |
| mojo_worker_fast | 1 | 512M | - | Medium |
| mojo_worker_download | 1 | 512M | - | Medium |
| mojo_worker_upload | 1 | 512M | - | Medium |
| direct_ping_worker | 0.5 | 256M | - | Low (non-critical) |

### 9.8 Scaling Configuration (`docker-compose.scaling.yml`)

Defines worker-only services for scaling via dashboard admin UI. Contains:
- 3 ACS worker types (fast, download, upload) with identical config
- 34 per-province direct ping workers (Sumut, Sumbar, Riau, Jambi, Sumsel, Bengkulu, Lampung, Babel, Kepri, DKI Jakarta, Jabar, Jateng, DIY, Jatim, Banten, Bali, NTB, NTT, Kalbar, Kalteng, Kalsel, Kaltim, Kaltara, Sulut, Sulteng, Sulsel, Sultra, Gorontalo, Sulbar, Maluku, Malut, Papua, Papua Barat)
- Each direct ping worker has `DOWNSTREAM_SERVER_ID` set to its province ID

### 9.9 Build & Deploy Commands

#### Initial Build
```bash
# Unified stack
docker compose up -d --build

# Or modular deployment
docker compose -f docker-compose-infra.yml up -d  # postgres + redis first
docker compose -f docker-compose-app.yml up -d     # dashboard + workers
docker compose -f docker-compose-dispatcher.yml up -d  # dispatcher
```

#### Rebuild Cycle
```bash
# Dashboard (code change)
sudo rm -rf dashboard/.next
npm run build           # Run on host (outside container)
docker compose restart mojo_dashboard

# Worker (code change)
docker compose build mojo_worker_fast
docker compose up -d --force-recreate mojo_worker_fast
# Repeat for: mojo_worker_download, mojo_worker_upload, mojo_dispatcher
```

#### Permission Fixes
```bash
# .next volume mount EACCES
sudo chown -R webapp:webapp dashboard/.next

# Postgres data directory
sudo chown -R 999:999 data/postgres   # UID 999 = postgres user inside container
```

---

## 10. Deployment Topology

### 10.1 Physical Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CENTRAL DATACENTER                              │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  HOST SERVER 1 (Primary)                                        │   │
│  │  ┌──────────┐  ┌───────┐  ┌──────────┐  ┌──────────┬──────────┐ │   │
│  │  │PostgreSQL│  │ Redis │  │Dashboard │  │Dispatcher│Worker_F  │ │   │
│  │  │   :5432  │  │:6379  │  │  :3002   │  │          │ (×N)     │ │   │
│  │  └──────────┘  └───────┘  └──────────┘  └──────────┴──────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  HOST SERVER 2 (Worker Pool)                                   │   │
│  │  ┌──────────┬──────────┬──────────┬──────────┬──────────┐      │   │
│  │  │Worker_F  │Worker_F  │Worker_F  │Worker_D  │Worker_U  │      │   │
│  │  │  (fast)  │  (fast)  │  (fast)  │  (dl)    │  (ul)    │      │   │
│  │  └──────────┴──────────┴──────────┴──────────┴──────────┘      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
          │
          │ Internet / VPN
          │
┌─────────────────────────────────────────────────────────────────────────┐
│                     REGIONAL DATACENTERS (×34 Provinces)                │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  REGIONAL SERVER (e.g., R01 Sumut, R07 Bali, ...)              │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │  mojo_direct_ping_worker                                  │  │   │
│  │  │  ├── Connects to CENTRAL PostgreSQL (via VPN/WAN)        │  │   │
│  │  │  ├── DOWNSTREAM_SERVER_ID = province_id                  │  │   │
│  │  │  ├── DIRECT_PING_INTERVAL_MINUTES = 10                   │  │   │
│  │  │  └── ICMP fping → ONT devices in region                 │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.2 PostgreSQL Connection Pooling

Worker uses `pg.Pool` configured as:
```javascript
new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10,                 // Max concurrent connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Fail fast if DB unreachable
})
```

Without PgBouncer: N workers × 10 connections = high connection count. Planned for Phase 1.

### 10.3 Redis Configuration

```
# config/redis.conf
requirepass ${REDIS_PASSWORD}

# Container security:
security_opt:
  - no-new-privileges:true
read_only: true     # Read-only filesystem
tmpfs: /tmp         # Writable temp only
```

Redis stores:
- **BullMQ queues**: acs-fast, acs-download, acs-upload, acs-queue (legacy)
- **Worker heartbeats**: Hash `acs-workers`
- **Stop signals**: Key `worker:stop-signal`
- **Rate limits**: Keys `ping:last:{deviceId}`, `speed:last:{deviceId}` (10s TTL)
- **Session cache**: User sessions (if configured)

### 10.4 Docker Compose Files Reference

| File | Services | Usage |
|------|----------|-------|
| `docker-compose.yml` | All 8 services | Unified deployment |
| `docker-compose-infra.yml` | postgres, redis | Infrastructure-only |
| `docker-compose-app.yml` | dashboard + workers | Application layer (ext network) |
| `docker-compose-dispatcher.yml` | dispatcher | Dispatcher-only |
| `docker-compose-worker.yml` | worker (generic) | Manual worker deployment |
| `docker-compose-dashboard.yml` | dashboard | Dashboard-only |
| `docker-compose-nginx.yml` | nginx | Reverse proxy (optional) |
| `docker-compose.offline.yml` | all | Offline/air-gapped deployment |
| `docker-compose.scaling.yml` | workers × 34+ | Scaling management |
| `docker-compose.regional-r3-r12.yml` | regional | Regional-specific configs |

### 10.5 Environment File Structure

```
.env (not in git — gitignored)
├── POSTGRES_USER/PASSWORD/DB/PORT
├── DB_HOST/PORT/USER/PASSWORD/NAME
├── REDIS_HOST/PORT/PASSWORD
├── DASHBOARD_PORT / NEXT_PUBLIC_API_URL
├── SESSION_SECRET / TZ / NODE_ENV
├── PING_RATE_LIMIT_SECONDS / SPEED_RATE_LIMIT_SECONDS
├── AXIROS_CONFIG_TTL_MS
├── DIRECT_PING_INTERVAL_MINUTES / DOWNSTREAM_SERVER_ID
└── Optional: DEEPSEEK_API_KEY, NGINX configs
```

### 10.6 Container Startup Sequence

```
1. postgres starts → healthcheck pg_isready
2. redis starts → healthcheck redis-cli ping
3. mojo_dashboard starts (depends: postgres+redis healthy)
   → healthcheck /api/health (after 40s start_period)
4. mojo_dispatcher starts (depends: postgres+redis healthy)
5. mojo_worker_fast/download/upload start
   (depends: postgres+redis healthy + dashboard started)
6. mojo_direct_ping_worker starts (depends: postgres healthy)
   → Requires NET_RAW capability for ICMP
```

### 10.7 Regional Worker Deployment

Each regional server runs a single `mojo_direct_ping_worker` container:
```bash
# On regional server (e.g., R01 Sumut):
docker run -d \
  --name mojojojo_direct_ping_worker \
  --network host \
  --cap-add NET_RAW \
  -e DB_HOST=<central_db_ip> \
  -e DB_PORT=5432 \
  -e DB_USER=mojojojo_user \
  -e DB_PASSWORD=<password> \
  -e DB_NAME=mojojojo_database \
  -e DIRECT_PING_INTERVAL_MINUTES=10 \
  -e DOWNSTREAM_SERVER_ID=2 \
  mojo-worker:latest \
  node start-direct-ping-worker.js
```

Or using `install.sh` for automated setup.

### 10.8 frp Tunnel Configuration

```
# frpc (on central server)
[dashboard]
type = tcp
local_ip = 127.0.0.1
local_port = 3002
remote_port = 8804

# Access: https://gandooz.cloud:8804
```

---

## 11. Integration Points

### 10.1 Axiros ACS API
| Test Type | API Endpoint | Method |
|-----------|-------------|--------|
| Ping | `IPPingTest` | RPC/TR-069 |
| Traceroute | `TraceRouteTest` | RPC/TR-069 |
| Download Speed | `PostONTDownloadSpeed` / `GetONTDownloadSpeedResult` | REST |
| Upload Speed | `PostONTUploadSpeed` / `GetONTUploadSpeedResult` | REST |
| ONT Status | `GetONTStatus` | RPC/TR-069 |

### 10.2 Notifications
- **Telegram**: Sends alarm create/clear messages to configured group
- **WhatsApp**: Sends alarm notifications via WhatsApp API
- **Ticketing**: Creates/updates tickets in external ticketing system

### 10.3 AI Chatbot
- Google Generative AI (`@google/generative-ai`) and OpenAI (`openai`)
- Floating chatbot widget accessible from any page
- Context-aware responses based on dashboard data

---

## 12. Circuit Breaker Pattern

```javascript
// Axiros config caching with circuit breaker
const AXIROS_CONFIG_TTL_MS = 60000;  // 60s cache
const CB_FAILURE_THRESHOLD = 5;       // 5 failures to open
const CB_RESET_TIMEOUT = 30000;       // 30s reset

// State: CLOSED → OPEN (5 failures) → HALF_OPEN (30s wait) → CLOSED
```

## 13. Key Edge Cases & Error Handling

### 12.1 ACS API Failures
- "Ticket Expired" → worker circuit breaker trips after 5 failures
- "Device Not Ready" → speed test retries up to 5× with 30s delay
- DNS resolution failures → circuit breaker prevents cascading

### 12.2 Queue Stability
- Auto-drain legacy queue when >10,000 stale jobs
- Dispatcher dedup before creating queue_jobs
- Dispatcher marks queue_jobs as `processing` immediately after BullMQ dispatch
- Stale pending jobs (>1hr) deleted before dispatching
- BullMQ stalled job detection (stalledInterval per queue)

### 12.3 Race Conditions
- Separate test_results tables per test type (no cross-type contention)
- `ON CONFLICT (queue_job_id) DO UPDATE` for idempotent result storage
- BullMQ `jobId` dedup prevents duplicate queue entries
- Database-level check prevents duplicate pending/processing queue_jobs
