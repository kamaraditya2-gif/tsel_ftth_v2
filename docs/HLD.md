# High-Level Design — MojoJojoMonitor

## 1. System Overview

MojoJojoMonitor is an **FTTH (Fiber-to-the-Home) ACS (Auto Configuration Server) Monitoring Dashboard** designed to monitor, test, and manage up to 26,000 ONT devices across a large-scale fiber broadband network (Telkomsel Indihome). The system periodically executes network performance tests (ping, traceroute, download/upload speed) via the Axiros ACS API and direct ICMP ping, analyzes results against configurable thresholds, generates alarms, and provides a centralized real-time dashboard for NOC operations.

### Primary Goals
- **Real-time visibility** into ONT device health, latency, speed, and packet loss
- **Automated testing** at scale via scheduled and on-demand test jobs
- **Alarm management** with root cause analysis, ticketing, and MTTR tracking
- **Location-based filtering** across multi-level hierarchy (Area → Regional/DS → NOP)
- **Scalability** to handle 26,000+ devices with horizontal worker scaling

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (Browser)                       │
│  Next.js App Router │ React 18 │ Tailwind CSS │ MapLibre GL │ SWR  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP (fetch)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API LAYER (Next.js Route Handlers)              │
│  ~89 API routes: /api/dashboard/*, /api/devices/*, /api/alarms/*,  │
│  /api/tasks/*, /api/admin/*, /api/auth/*, /api/reports/*           │
│  Server-side PostgreSQL queries (pg) + Redis (ioredis)             │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌────────────────────────┐ ┌──────────────┐ ┌──────────────────┐
│    PostgreSQL 15       │ │   Redis 7    │ │  Axiros ACS API  │
│  (Primary Datastore)   │ │  (Queue +    │ │  (External SOAP/ │
│  devices_ont           │ │   Cache)     │ │   REST API)      │
│  test_results_*        │ │              │ │                   │
│  active_alarms         │ │  BullMQ Q:   │ │  ┌─────────────┐ │
│  alarm_history         │ │  acs-fast    │ │  │  ~26K ONTs  │ │
│  queue_jobs            │ │  acs-download│ │  │  (CPE)      │ │
│  tasks                 │ │  acs-upload  │ │  └─────────────┘ │
│  threshold_master      │ │  acs-queue   │ │                   │
│  speed_group           │ │  (legacy)    │ │  IP Ping/Trace   │
│  downstream_servers    │ │              │ │  Download/Upload │
│  master_cluster_nop    │ │  Rate Limits │ │  Speed Tests     │
│  users, roles          │ │  Worker HB   │ └──────────────────┘
│  integration_settings  │ │  Stop Signal │
└────────────────────────┘ └──────────────┘
         ▲                                        ▲
         │                                        │
         ▼                                        ▼
┌────────────────────────┐            ┌──────────────────────────┐
│   WORKER LAYER         │            │ DIRECT PING WORKER       │
│  ┌─────────────────┐  │            │ (ICMP fping)             │
│  │  Dispatcher.js   │──┼─cron 1min─>│ Queries devices_ont     │
│  │  (Scheduler)     │  │            │ Runs ICMP ping/fping    │
│  └────────┬─────────┘  │            │ Stores in               │
│           │            │            │ test_results_direct_ping│
│           ▼            │            └──────────────────────────┘
│  ┌──────────────────┐ │
│  │ BullMQ Workers   │ │
│  │ acs-fast (ping/  │ │
│  │  traceroute/ont- │ │
│  │  status)         │ │
│  │ acs-download     │ │
│  │ acs-upload       │ │
│  └──────────────────┘ │
└────────────────────────┘
```

### Component Roles

| Component | Technology | Role |
|-----------|-----------|------|
| **Dashboard** | Next.js 14 (React 18) | Web UI, API route handlers, server-side rendering |
| **PostgreSQL** | PostgreSQL 15 | Primary datastore: devices, test results, alarms, tasks, users |
| **Redis** | Redis 7 | BullMQ job queues, distributed rate limiting, worker heartbeats, stop signals |
| **Dispatcher** | Node.js + node-cron | Schedules & dispatches test jobs; runs every 1 minute |
| **ACS Workers** | Node.js + BullMQ | Execute network tests via Axiros ACS API; 3 dedicated queues |
| **Direct Ping Worker** | Node.js | Standalone ICMP ping/fping executor; independent loop |
| **Axiros ACS** | External API | TR-069/ACS interface to ONT devices for ping, speed tests, traceroute |

---

## 3. Data Flow

### 3.1 Scheduled Test Flow
```
1. [Cron] Dispatcher runs every minute
2. [Query] Reads tasks table for due tasks (next_run < NOW())
3. [Dedup] Checks existing pending/processing queue_jobs
4. [Insert] Creates queue_jobs records in PostgreSQL (chunks of 50)
5. [Dispatch] Adds BullMQ jobs to Redis queue with jobId dedup
6. [Consume] Worker picks up job from Redis queue
7. [Execute] Worker calls Axiros ACS API for the test type
8. [Store] Worker saves results to test_results_* table
9. [Alarm] Worker checks thresholds & updates active_alarms
10. [Notify] Worker sends Telegram/WhatsApp/Ticket if configured
11. [Update] Dispatcher updates tasks.next_run for next cycle
```

### 3.2 On-Demand Test Flow
```
1. [User] Triggers test via Dashboard UI
2. [API] POST /api/tasks creates task with task_type='ondemand'
3. [API] POST /api/tasks/:id/run dispatches immediately
4. [Dispatcher] Picks up on-demand task next cron cycle
5. Same as 4-10 in scheduled flow above
```

### 3.3 Dashboard Data Flow
```
1. [Browser] User opens dashboard page
2. [Fetch] Component calls /api/dashboard/summary (every 30s)
3. [Query] API handler queries PostgreSQL aggregates
4. [Return] JSON response with KPI data
5. [Render] React components render charts, tables, maps
6. [Poll] Alarms, device status update every 30 seconds
```

---

## 4. Queue System Design

### 4.1 BullMQ Queues

| Queue Name | Purpose | Concurrency | Lock Duration | Typical Job Duration |
|-----------|---------|-------------|---------------|---------------------|
| `acs-fast` | Ping, traceroute, ont-status | 5 (default) | 5 min | 20-180s |
| `acs-download` | Download speed test | 2 (default) | 10 min | 300-480s |
| `acs-upload` | Upload speed test | 2 (default) | 10 min | 300-480s |
| `acs-queue` | Legacy/fallback | Auto-drained | - | - |

### 4.2 Job Deduplication
- BullMQ `jobId` format: `${deviceId}-${testType}-${taskId}`
- Database check: prevent duplicate pending/processing queue_jobs per device-test_type

### 4.3 Retry Strategy
- BullMQ: 2 attempts with exponential backoff (15s base)
- Dispatcher: stale pending jobs (>1hr) auto-deleted
- Individual API retries: ping targets retried up to 3×, speed test polled up to 15× at 30s intervals

---

## 5. Alarm System

### 5.1 Threshold Configuration
- Stored in `threshold_master` table
- UPPER type: higher value = worse (latency, packet loss)
- LOWER type: lower value = worse (download/upload speed)
- Profiles: Bronze / Silver / Gold / Platinum (for speed thresholds)
- Per-device thresholds via speed_group

### 5.2 Alarm Lifecycle
```
Metric crosses threshold
  → active_alarms created
  → Notification sent (Telegram/WhatsApp/Ticket)
  → Root cause assigned (L1 → L2 cascade)
  → Action + PIC recorded
  → Comments/discussion
  → Metric returns to normal
  → Alarm moved to alarm_history
  → Duration tracked for MTTR calculation
```

### 5.3 Notification Integrations
- Telegram bot
- WhatsApp API
- Ticketing system integration

---

## 6. Infrastructure Architecture

### 6.1 Infrastructure Requirements

#### Current (Production — Single Server)

| Resource | Spec | Notes |
|----------|------|-------|
| CPU | 4-8 vCPU | Intel/AMD x86_64 recommended |
| RAM | 16-32 GB | Peak usage: Postgres 4G + Redis 1G + Dashboard 2G + Workers ~3G |
| Storage | 200-500 GB SSD | Postgres data + Redis RDB + Docker images + Build cache |
| OS | Ubuntu 22.04 / Debian 12 | Docker + Compose native support |
| Network | 1 Gbps | Required for Axiros API calls + Dashboard access + Regional workers |
| Docker | 24+ | Compose V2 support required |

#### Scaled (26K Devices — Multi-Server)

| Server Role | CPU | RAM | Storage | Count |
|------------|-----|-----|---------|-------|
| Database + Redis | 8 vCPU | 32 GB | 1 TB SSD | 1 (primary) + 1 (replica) |
| Dashboard + Dispatcher | 4 vCPU | 8 GB | 100 GB | 1-2 (HA pair) |
| ACS Workers (fast) | 4 vCPU | 8 GB | 50 GB | 3-4 hosts (13 containers) |
| ACS Workers (dl/ul) | 4 vCPU | 8 GB | 50 GB | 2-3 hosts (12 containers) |
| Direct Ping (regional) | 2 vCPU | 4 GB | 50 GB | Per-province server |
| **Total** | ~50 vCPU | ~60 GB | ~1.5 TB | Multi-host |

#### Network Bandwidth Requirements

| Flow | Bandwidth | Latency | Notes |
|------|-----------|---------|-------|
| Worker → Axiros ACS API | 100 Mbps | < 50ms | SOAP/XML-RPC calls |
| Worker → PostgreSQL | 100 Mbps | < 5ms (local) / < 50ms (remote) | Transactional writes |
| Worker → Redis | 100 Mbps | < 1ms (local) / < 10ms (remote) | BullMQ queue ops |
| Dashboard ↔ Browser | 50 Mbps | < 100ms | Real-time UI updates |
| Regional Ping → Central DB | 10 Mbps | < 100ms | Test results inserts |
| Axiros API ↔ ONT Devices | Per-ISP network | Varies | TR-069/CWMP management |

### 6.2 Container Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      DEPLOYMENT TOPOLOGY                                 │
│                                                                          │
│  ┌──────────────────── CENTRAL SERVER ──────────────────────────────┐   │
│  │                                                                   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │   │
│  │  │  PostgreSQL   │  │    Redis     │  │   mojo_dashboard      │  │   │
│  │  │  15-alpine    │  │  7-alpine    │  │  Next.js :3002        │  │   │
│  │  │  :5432        │  │  :6379       │  │  frp → gandooz.cloud  │  │   │
│  │  │  Volume: data │  │  Volume: data│  │  Vol: .next, docker   │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────┬────────────┘  │   │
│  │         │                 │                      │               │   │
│  │         └─────────┬───────┴──────────┬───────────┘               │   │
│  │                   │                  │                           │   │
│  │  ┌────────────────▼─────────┐  ┌─────▼──────────────────────┐   │   │
│  │  │    mojo_dispatcher       │  │  mojo_worker_fast (×1-N)   │   │   │
│  │  │    Node.js + node-cron   │  │  BullMQ Worker (acs-fast)  │   │   │
│  │  │    Queue: all types      │  │  Queue: ping/traceroute    │   │   │
│  │  └──────────────────────────┘  └────────────────────────────┘   │   │
│  │                                                                   │   │
│  │  ┌──────────────────────────┐  ┌────────────────────────────┐   │   │
│  │  │ mojo_worker_download ×N  │  │  mojo_worker_upload ×N     │   │   │
│  │  │ BullMQ (acs-download)    │  │  BullMQ (acs-upload)       │   │   │
│  │  │ Queue: speed dl tests    │  │  Queue: speed ul tests     │   │   │
│  │  └──────────────────────────┘  └────────────────────────────┘   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────── REGIONAL SERVERS ────────────────────────────┐    │
│  │                                                                   │   │
│  │  ┌──────────────────────────────┐                                 │   │
│  │  │ mojo_direct_ping_worker (×N) │  ← One per province/region     │   │
│  │  │ ICMP fping → ONT devices     │     (R01 Sumut, R07 Bali, etc) │   │
│  │  │ Connects to CENTRAL Postgres │                                 │   │
│  │  │ DOWNSTREAM_SERVER_ID = N     │                                 │   │
│  │  └──────────────────────────────┘                                 │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────── EXTERNAL ─────────────────────────────────────┐   │
│  │                                                                   │   │
│  │  ┌──────────────────────────┐  ┌──────────────────────────────┐  │   │
│  │  │   Axiros ACS API         │  │   ONT Devices (~26K)         │  │   │
│  │  │   https://acs.telkomsel  │  │   TR-069 managed CPE         │  │   │
│  │  │   .co.id/live/AXAPI/     │  │   Ping/Speed/Traceroute      │  │   │
│  │  └──────────────────────────┘  └──────────────────────────────┘  │   │
│  └───────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Docker Images

#### `mojo-dashboard:latest` (Dashboard)

| Layer | Base | Size | Notes |
|-------|------|------|-------|
| Builder | `node:20-alpine` | ~300 MB | Full dev dependencies, `npm install --legacy-peer-deps` |
| Runner | `node:20-slim` | ~500 MB | Production only; includes Docker CLI + Compose for admin scaling |
| **Total** | - | **~800 MB** | Multi-stage build |

**Runner Dependencies:**
- `docker` CLI (static binary v29.1.3) — for scaling containers from admin UI
- `docker-compose` v2.35.1 — standalone binary for compose operations
- `ca-certificates`, `curl` — for HTTPS connectivity

**Cached Volumes:**
- `/app/.next` — Next.js build output (live rebuild mapping)
- Docker socket (`/var/run/docker.sock:ro`) — scaling management

#### `mojo-worker:latest` (Dispatcher + Workers)

| Layer | Base | Size | Notes |
|-------|------|------|-------|
| Runtime | `node:20-alpine` | ~200 MB | Minimal Alpine |
| Extras | `fping`, `iputils` | ~5 MB | ICMP ping tools for direct-ping-worker |
| NPM | production only | ~50 MB | bullmq, ioredis, pg, axios, pino, node-cron |
| **Total** | - | **~255 MB** | Single image for all worker types |

### 6.4 Container Service Dependencies

```
postgres ──────┬── mojo_dashboard ─── (exposes :3000 → :3002)
               ├── mojo_dispatcher ─── (creates BullMQ jobs)
               ├── mojo_worker_fast ─── (consumes acs-fast queue)
               ├── mojo_worker_download ─── (consumes acs-download queue)
               ├── mojo_worker_upload ─── (consumes acs-upload queue)
               └── mojo_direct_ping_worker ─── (independent loop)

redis ─────────┬── mojo_dashboard ─── (session cache, rate limits)
               ├── mojo_dispatcher ─── (BullMQ addJob)
               └── mojo_worker_* ─── (BullMQ Worker, rate limits, heartbeats)

mojo_dashboard ─── mojo_worker_fast/download/upload ─── (API_BASE_URL for
                    Axiros config, test server config)
```

### 6.5 Storage Architecture

| Volume | Path | Type | Size | Backup Strategy |
|--------|------|------|------|----------------|
| Postgres Data | `./data/postgres` | Bind mount (persistent) | 100-500 GB | pg_dump daily + WAL archiving |
| Redis Data | `./data/redis` | Bind mount (persistent) | 1-4 GB | RDB snapshots every 5 min |
| Dashboard Build | `./dashboard/.next` | Bind mount (ephemeral) | 300 MB | Not backed up; rebuild from source |
| Redis tmpfs | `/tmp` | tmpfs (ephemeral) | 64 MB | Lost on restart |

#### Backup Strategy
- **Daily**: `pg_dump` full database → compressed to S3-compatible storage (30-day retention)
- **Hourly**: WAL archive for point-in-time recovery
- **Continuous**: Redis RDB snapshots (every 5 min to data volume)
- **Application**: Source code in GitHub; `.next` can be rebuilt

### 6.6 FTTH Network Topology (Monitored Network)

```
┌────────────────── CUSTOMER PREMISE ───────────────────┐
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  ONT (Optical Network Terminal)                  │  │
│  │  • Router/CPE: Huawei, Nokia, ZTE, FiberHome     │  │
│  │  • TR-069 managed via Axiros ACS                 │  │
│  │  • IP: Private (CGNAT or Public per region)      │  │
│  │  • Speed Packages: 10/20/30/50/100 Mbps          │  │
│  └──────────────────────┬───────────────────────────┘  │
│                         │ Fiber (GPON)                 │
└─────────────────────────┼─────────────────────────────┘
                          │
┌────────────────── ODP / ODC ────────────────────────┐
│  Optical Distribution Point / Cabinet               │
│  • Passive splitter (1:8, 1:16, 1:32)               │
│  • Feeder/distribution fiber segments               │
└──────────────────────┬──────────────────────────────┘
                       │
┌────────────────── OLT ──────────────────────────────┐
│  Optical Line Terminal                               │
│  • Located in STO (Sentral Telepon)                  │
│  • GPON/XPON technology                             │
│  • Aggregates upstream traffic                       │
└──────────────────────┬──────────────────────────────┘
                       │
┌────────────────── BNG ──────────────────────────────┐
│  Broadband Network Gateway                           │
│  • PPPoE termination / IPoE                          │
│  • Subscriber management + QoS                      │
│  • Aggregation router                                │
└──────────────────────┬──────────────────────────────┘
                       │
┌────────────────── IGW ──────────────────────────────┐
│  Internet Gateway                                    │
│  • Route ke internet publik                         │
│  • NAT for CGNAT customers                          │
└──────────────────────┬──────────────────────────────┘
                       │
┌────────────────── SPEED TEST SERVER ────────────────┐
│  • Near IGW server for download/upload testing       │
│  • Ookla-based or custom speed test                  │
└─────────────────────────────────────────────────────┘

┌────────────────── EBR ──────────────────────────────┐
│  Edge Router                                         │
│  • Route ke jaringan internal TELKOMSEL              │
│  • Untuk traceroute ke arah core network            │
└──────────────────────────────────────────────────────┘

┌────────────────── AXIROS ACS ──────────────────────┐
│  Auto Configuration Server                           │
│  • TR-069 CWMP management                           │
│  • API: https://acs.telkomsel.co.id                 │
│  • Endpoints: IPPingTest, TraceRouteTest,           │
│    PostONTDownloadSpeed, PostONTUploadSpeed,         │
│    GetONTStatus                                      │
└──────────────────────────────────────────────────────┘
```

### 6.7 Network Topology (Monitoring System)

```
                          ┌─────────────────────────────┐
                          │     Browser (NOC User)       │
                          │   https://gandooz.cloud:8804 │
                          └─────────────┬───────────────┘
                                        │ HTTPS (frp tunnel)
                                        ▼
                          ┌─────────────────────────────┐
                          │       frp Server            │
                          │   gandooz.cloud:8804         │
                          └─────────────┬───────────────┘
                                        │ frp tunnel
                                        ▼
┌────────────────── CENTRAL SERVER ───────────────────────┐
│  ┌──────────────────────────────────────────────────┐   │
│  │   Docker Bridge Network: mojojojo_network        │   │
│  │   172.x.x.x/16 (internal)                       │   │
│  │                                                  │   │
│  │   mojo_dashboard:3000 ◄── frp client ── :3002   │   │
│  │       │                                          │   │
│  │   mojo_dispatcher ──► PostgreSQL:5432            │   │
│  │   mojo_worker_* ──► PostgreSQL:5432 + Redis:6379  │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
          │                                     │
          ▼                                     ▼
┌──────────────────┐  ┌──────────────────────────────┐
│  Axiros ACS API   │  │  Regional Servers (×34)     │
│  HTTPS:443        │  │  direct-ping-worker          │
│  acs.telkomsel.id  │  │  ICMP → ONT devices         │
└──────────────────┘  └──────────────────────────────┘
                                │
                          ┌─────┴─────┐
                          ▼           ▼
                    ONT Device 1  ONT Device N
                    (ICMP echo)   (ICMP echo)
```

### 6.8 Firewall & Port Requirements

| Source | Destination | Port | Protocol | Purpose |
|--------|-------------|------|----------|---------|
| All containers | PostgreSQL | 5432 | TCP | Database connection |
| All containers | Redis | 6379 | TCP | Queue + cache |
| Browser → Dashboard | :3002 / :8804 | 3002/443 | HTTPS | UI access |
| Dashboard → Docker socket | /var/run/docker.sock | - | Unix | Scaling management |
| Workers | Axiros ACS API | 443 | HTTPS | Test execution |
| Regional ping workers | Central PostgreSQL | 5432 | TCP | Test result storage |
| Direct ping workers | ONT devices | N/A | ICMP | ICMP echo (fping) |

### 6.9 High-Availability Design (Planned)

| Component | Current | Target HA |
|-----------|---------|-----------|
| Dashboard | Single container | 2× containers behind Nginx/HAProxy load balancer |
| PostgreSQL | Single instance | Primary + Streaming replica + PgBouncer pool |
| Redis | Single instance | Redis Sentinel cluster (3 nodes) |
| Dispatcher | Single instance | Active-passive with Redis lock |
| ACS Workers | Multiple containers (scalable) | Auto-healing via Docker restart policy |
| Direct Ping | Multiple regional workers | Built-in independent operation per region |

### 6.10 Environment Configuration

All tunables via `.env` file (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER/PASSWORD/DB` | `mojojojo_*` | Database credentials |
| `REDIS_PASSWORD` | (custom) | Redis auth |
| `DASHBOARD_PORT` | `3002` | Host port for Next.js |
| `PING_RATE_LIMIT_SECONDS` | `10` | Cooldown between pings per device |
| `SPEED_RATE_LIMIT_SECONDS` | `10` | Cooldown between speed tests per device |
| `AXIROS_CONFIG_TTL_MS` | `60000` | Axiros config cache duration |
| `DIRECT_PING_INTERVAL_MINUTES` | `10` | Regional ping interval |
| `DOWNSTREAM_SERVER_ID` | `1` | Regional server filter |

---

## 7. Security Architecture

### 7.1 Authentication
- Session-based auth via cookie (`user_session`)
- Passwords hashed with bcrypt
- Login rate limited via Redis (replaces in-memory Map)

### 7.2 Authorization (Role-Based)
| Role | Access Level |
|------|-------------|
| admin | Full access: all admin pages, user/role management |
| operator | Admin except Settings, Users, Roles |
| viewer | Read-only: dashboard, devices, alarms, reports only |
| field | Single page: Field Test |

### 7.3 Redis Security
- Password-protected (`REDIS_PASSWORD`)
- Runs with `no-new-privileges`, `read_only`, `tmpfs`

---

## 8. Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js (App Router) | 14.x |
| UI Library | React | 18.x |
| Styling | Tailwind CSS | 3.x |
| Charts | Recharts, Canvas 2D | 2.x |
| Map | MapLibre GL | 5.x |
| Backend | Next.js Route Handlers | 14.x |
| Workers | Node.js + BullMQ | Latest |
| Database | PostgreSQL | 15 |
| Cache/Queue | Redis | 7 |
| Auth | bcrypt + cookies | - |
| AI | Google Generative AI, OpenAI | - |
| Notification | Telegram, WhatsApp, Ticketing | - |
| Container | Docker + Docker Compose | Latest |
| Report Export | CSV, XLSX, PDF | - |
