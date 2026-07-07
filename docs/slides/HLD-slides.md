---
marp: true
theme: uncover
class:
  - lead
  - invert
paginate: true
---

# MojoJojoMonitor
## High-Level Design

FTTH ACS Monitoring Dashboard

---

# System Overview

- **FTTH ACS Monitoring Dashboard** untuk ~26,000 ONT devices
- Monitoring jaringan fiber broadband **Telkomsel Indihome**
- Periodic network performance tests via **Axiros ACS API**
- **Real-time visibility**, alarm management, root cause analysis

---

# High-Level Architecture

```
Browser → Next.js API → PostgreSQL + Redis
                            ↓
                     Dispatcher (cron 1min)
                            ↓
              BullMQ Queues (fast/dl/ul/legacy)
                            ↓
              ACS Workers (Node.js + Axiros API)
                            ↓
                    ~26,000 ONT Devices
```

---

# Component Roles

| Komponen | Tech | Fungsi |
|----------|------|--------|
| Dashboard | Next.js 14 | Web UI + API handlers |
| PostgreSQL | 15 | Datastore: devices, results, alarms |
| Redis | 7 | BullMQ queue, rate limits, heartbeats |
| Dispatcher | Node.js cron | Job scheduler (1 menit) |
| ACS Workers | Node.js + BullMQ | Execute tests via Axiros API |
| Direct Ping | Node.js + fping | ICMP ping ke ONT |

---

# Data Flow: Scheduled Test

```
1. Dispatcher (cron 1 menit)
2. Query tasks yg due
3. Dedup check
4. Insert queue_jobs ke PostgreSQL
5. Add jobs ke BullMQ Redis
6. Worker consume dari queue
7. Call Axiros ACS API
8. Save test_results_*
9. Check + update alarms
10. Notify (Telegram/WA/Ticket)
```

---

# Queue System

| Queue | Test Types | Concurrency | Durasi |
|-------|-----------|-------------|--------|
| `acs-fast` | ping, traceroute, ont-status | 5 | 20-180s |
| `acs-download` | download speed | 2 | 300-480s |
| `acs-upload` | upload speed | 2 | 300-480s |
| `acs-queue` | legacy/fallback | auto-drain | - |

---

# FTTH Network Topology

```
ONT → ODP/ODC → OLT → BNG → IGW → Internet
                                    → EBR → Core Network
                                    → Axiros ACS (TR-069)
```

- **ONT**: Huawei, Nokia, ZTE, FiberHome (CPE)
- **Axiros ACS**: `https://acs.telkomsel.co.id`
- **Test types**: Ping, traceroute, download, upload, ont-status

---

# Deployment Architecture

| Service | Image | CPU | RAM |
|---------|-------|-----|-----|
| postgres | postgres:15-alpine | 1 | 4G |
| redis | redis:7-alpine | 0.5 | 1G |
| mojo_dashboard | mojo-dashboard | 1 | 2G |
| mojo_dispatcher | mojo-worker | 0.5 | 256M |
| mojo_worker_fast | mojo-worker | 1 | 512M |
| mojo_worker_download | mojo-worker | 1 | 512M |
| mojo_worker_upload | mojo-worker | 1 | 512M |
| direct_ping_worker | mojo-worker | 0.5 | 256M |

---

# Alarm Lifecycle

```
Metric cross threshold
→ active_alarms created
→ Notification (Telegram/WA/Ticket)
→ Root cause assigned (L1 → L2)
→ Action + PIC recorded
→ Metric normal → alarm cleared
→ Duration tracked → MTTR calculation
```

---

# Security

- Session-based auth (bcrypt + cookies)
- Role-based access: **admin**, **operator**, **viewer**, **field**
- Login rate limiting via Redis
- Redis: password, read-only FS, tmpfs, no-new-privileges
- frp tunnel untuk dashboard exposure

---

# Infrastructure Requirements

| Skenario | CPU | RAM | Storage |
|----------|-----|-----|---------|
| Current (single) | 4-8 vCPU | 16-32 GB | 200-500 GB SSD |
| Scaled (multi) | ~50 vCPU | ~60 GB | ~1.5 TB |

Regional deployment: 34 per-province direct ping workers

---

# High Availability (Planned)

| Komponen | Current | Target |
|----------|---------|--------|
| Dashboard | Single | 2× behind Nginx LB |
| PostgreSQL | Single | Primary + Replica + PgBouncer |
| Redis | Single | Sentinel cluster (3 nodes) |
| Dispatcher | Single | Active-passive (Redis lock) |
| Workers | Multiple | Auto-healing + HPA |
