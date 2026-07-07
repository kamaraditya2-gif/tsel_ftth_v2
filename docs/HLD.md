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

## 6. Deployment Architecture

### 6.1 Docker Services

| Service | Image | CPU | Memory | Scaling |
|---------|-------|-----|--------|---------|
| postgres | postgres:15-alpine | 1 | 4G | Vertical |
| redis | redis:7-alpine | 0.5 | 1G | Vertical |
| mojo_dashboard | mojo-dashboard (Next.js) | 1 | 2G | 1 instance |
| mojo_dispatcher | mojo-worker (Node.js) | 0.5 | 256M | 1 instance |
| mojo_worker_fast | mojo-worker | 1 | 512M | 13 (planned) |
| mojo_worker_download | mojo-worker | 1 | 512M | 6 (planned) |
| mojo_worker_upload | mojo-worker | 1 | 512M | 6 (planned) |
| direct_ping_worker | mojo-worker | 0.5 | 256M | 5-10 sharded |

### 6.2 Network
- All services on shared bridge network `mojojojo_network`
- Dashboard port 3002:3000 mapped; exposed via frp at `gandooz.cloud:8804`
- Workers use `NET_RAW` capability for ICMP ping
- Postgres data persisted to `./data/postgres`, Redis to `./data/redis`

### 6.3 Regional Deployment
- Direct-ping-worker runs on regional servers
- Connects to central database via DB_HOST configuration
- DOWNSTREAM_SERVER_ID filters per-region devices

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
