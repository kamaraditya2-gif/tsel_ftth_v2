---
marp: true
theme: uncover
class:
  - lead
  - invert
paginate: true
---

# Mojo-Central
## Low-Level Design

Database, API, Worker, & Infrastructure Detail

---

# Database Schema: 5 Categories

| Category | Tables |
|----------|--------|
| **Master** | roles, users, speed_group, devices, downstream_servers, master_area, master_cluster_nop |
| **Config** | threshold_master, app_settings, axiros_server, integration_settings, payloads |
| **Operational** | tasks, queue_jobs, queue_results (legacy) |
| **Results** | test_results_ping, test_results_speed_download, test_results_speed_upload, test_results_traceroute, test_results_direct_ping |
| **Alarms** | active_alarms, alarm_history, alarm_comments, root_causes |

---

# Key Tables: Devices

```sql
devices_ont (
  id, device_name, serial_number UNIQUE,
  ip_address INET, mac_address,
  speed_id → speed_group(id),
  downstream_server_id → downstream_servers(id),
  nop_city_id → master_cluster_nop(id),
  status, lat, lng, last_seen
)
```

26,000+ devices with geo-location + regional hierarchy

---

# Key Tables: Test Results

```sql
test_results_ping (
  device_id, ping_igw, ping_ebr,
  packet_loss_igw, packet_loss_ebr,
  executed_at
)
INDEX: (device_id, executed_at DESC)
```

Separate tables per test type **prevents race conditions** during concurrent execution.

---

# API: 89 Route Handlers

| Category | Routes | Example |
|----------|--------|---------|
| **Dashboard** | 8 | `/api/dashboard/summary` |
| **Devices** | 8 | `/api/devices`, `/api/devices/map` |
| **Alarms** | 11 | `/api/alarms/check`, `/api/alarms/mttr` |
| **Tasks** | 6 | `/api/tasks`, `/api/tasks/:id/run` |
| **Admin** | 12 | `/api/threshold`, `/api/users` |
| **Master Data** | 7 | `/api/speed-groups`, `/api/location/*` |
| **Auth** | 3 | `/api/auth/login` |

---

# Dispatcher Logic (cron 1 menit)

```
A. Scheduled Tasks
   → Query tasks WHERE next_run < NOW()
   → Dedup check (pending/processing queue_jobs)
   → Insert queue_jobs (chunks of 50)
   → Add BullMQ jobs (jobId dedup)
   → Update tasks.next_run

B. Pending Jobs
   → Query queue_jobs WHERE status='pending'
   → Add to BullMQ → mark 'processing'
```

Safety: MAX_PENDING_JOBS=50K, stale cleanup >1hr, legacy drain >10K

---

# Worker Job Processing

```
1. Check stop signal (Redis)
2. Update queue_jobs → 'processing'
3. Fetch device + Axiros config (cache 60s)
4. Execute test (ping/traceroute/download/upload)
5. Save results (ON CONFLICT DO UPDATE)
6. Check + update alarms
7. Send notifications
8. Update device last_seen + status
```

---

# Worker Rate Limiting (Redis)

| Limit | Key | Cooldown |
|-------|-----|----------|
| Ping | `ping:last:{deviceId}` | 10s |
| Speed (dl/ul) | `speed:last:{deviceId}` | 10s |

Circuit breaker: 5 failures → 30s timeout (Axiros config)

---

# Dockerfile: Dashboard

```
Stage 1: Builder (node:20-alpine)
  → npm install --legacy-peer-deps
  → next build

Stage 2: Runner (node:20-slim)
  → docker CLI + docker-compose (for scaling)
  → Copy .next + node_modules + public
  → npm start → port 3000
```

**Size**: ~800 MB (includes Docker binaries for admin scaling)

---

# Dockerfile: Worker

```
FROM node:20-alpine
RUN apk add --no-cache fping iputils
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
CMD ["node", "worker.js"]
```

**Size**: ~255 MB — single image for all worker types

---

# Container Dependencies

```
postgres ─── redis ─── mojo_dashboard ─── mojo_dispatcher
  │            │              │
  │            │              └── mojo_worker_fast
  │            │              └── mojo_worker_download
  │            │              └── mojo_worker_upload
  │            │
  └────────────┴── mojo_direct_ping_worker
```

Conditions: `service_healthy` / `service_started`

---

# Container Resource Limits

| Container | CPU | RAM | OOM |
|-----------|-----|-----|-----|
| postgres | 1 | 4G | Low |
| redis | 0.5 | 1G | Low |
| mojo_dashboard | 1 | 2G | Medium |
| dispatcher | 0.5 | 256M | Low |
| worker_fast | 1 | 512M | Medium |
| worker_dl/ul | 1 | 512M | Medium |
| direct_ping | 0.5 | 256M | Low |

---

# Volume Mounts

| Host Path | Container Path | Purpose |
|-----------|---------------|---------|
| `./data/postgres` | `/var/lib/postgresql/data` | DB persistence |
| `./data/redis` | `/data` | Redis RDB |
| `./config/redis.conf` | Redis config | Read-only |
| `./dashboard/.next` | `/app/.next` | Live rebuild |
| `/var/run/docker.sock` | Docker socket | Scaling ops |

---

# PostgreSQL Connection

```javascript
new Pool({
  host: process.env.DB_HOST,  // mojo-db
  port: 5432,
  max: 10,           // connections per worker
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000  // fail fast
})
```

**Risk**: N workers × 10 connections → mitigation: PgBouncer

---

# Health Checks

| Service | Command | Interval |
|---------|---------|----------|
| postgres | `pg_isready` | 10s |
| redis | `redis-cli ping` | 10s |
| dashboard | HTTP GET `/api/health` | 30s |

Start period: dashboard 40s (Next.js compile)

---

# Redis Security

```yaml
command: redis-server /usr/local/etc/redis/redis.conf
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs: /tmp
```

Config: `requirepass ${REDIS_PASSWORD}`

---

# Scaling: 34 Regional Workers

```yaml
mojo_direct_ping_worker_sumut:  DS_ID=2
mojo_direct_ping_worker_bali:   DS_ID=17
mojo_direct_ping_worker_jakarta: DS_ID=11
... (34 provinces)
```

Masing-masing filter by `DOWNSTREAM_SERVER_ID`

---

# Deployment Topology

```
CENTRAL: postgres + redis + dashboard + dispatcher + ACS workers
REGIONAL (×34): direct-ping-worker → ICMP → ONT devices
EXTERNAL: Axiros ACS API ← workers call via HTTPS
ACCESS: Browser → frp tunnel (gandooz.cloud:8804) → dashboard:3002
```

---

# Build & Deploy Commands

```bash
# Full stack
docker compose up -d --build

# Dashboard rebuild
sudo rm -rf dashboard/.next && npm run build
docker compose restart mojo_dashboard

# Worker rebuild
docker compose build mojo_worker_fast
docker compose up -d --force-recreate mojo_worker_fast

# Regional worker
docker run -e DOWNSTREAM_SERVER_ID=N mojo-worker
```
