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

## 9. Docker & Infrastructure

### 9.1 Container Architecture
```
docker-compose.yml (unified stack)
  ├── postgres (mojojojo_postgres) — port 5432
  ├── redis (mojojojo_redis) — port 6379
  ├── mojo_dashboard (mojojojo_dashboard) — port 3002→3000
  ├── mojo_dispatcher (mojojojo_dispatcher)
  ├── mojo_worker_fast (mojojojo_worker_fast)
  ├── mojo_worker_download (mojojojo_worker_download)
  ├── mojo_worker_upload (mojojojo_worker_upload)
  └── mojo_direct_ping_worker (mojojojo_direct_ping_worker)
```

### 9.2 Build & Deploy
```
Dashboard build:
  sudo rm -rf .next && npm run build (host)
  docker-compose restart mojo_dashboard

Worker rebuild:
  docker-compose build mojo_worker_fast
  docker-compose up -d --force-recreate mojo_worker_fast
  (repeat for download, upload, dispatcher)

Volume mounts:
  .next → live rebuilds (EACCES fix: sudo chown -R webapp:webapp .next)
  ./data/postgres → persistent DB
  ./data/redis → persistent cache
```

---

## 10. Integration Points

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

## 11. Circuit Breaker Pattern

```javascript
// Axiros config caching with circuit breaker
const AXIROS_CONFIG_TTL_MS = 60000;  // 60s cache
const CB_FAILURE_THRESHOLD = 5;       // 5 failures to open
const CB_RESET_TIMEOUT = 30000;       // 30s reset

// State: CLOSED → OPEN (5 failures) → HALF_OPEN (30s wait) → CLOSED
```

## 12. Key Edge Cases & Error Handling

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
