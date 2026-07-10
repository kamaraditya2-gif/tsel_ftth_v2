# Deployment Planning — System Requirements & Scaling

---

## 1. Minimum Deployment (Pilot — 2.000 ONT)

### Arsitektur

```
┌──────────────────────────────────────────────────────┐
│              1 VM (All-in-One)                        │
│                                                        │
│  Semua service dalam 1 host:                           │
│    PostgreSQL + Redis + Dispatcher                     │
│    Dashboard + ACS Workers (fast, dl, ul)              │
│    Direct Ping Worker (1 regional)                     │
│                                                        │
│  Akses: frp tunnel → gandooz.cloud:8804               │
└──────────────────────────────────────────────────────────┘
```

### VM Specification — Minimum

| Item | Spec | Notes |
|------|------|-------|
| **CPU** | 4 vCPU | 2.5 GHz+ |
| **RAM** | 16 GB | |
| **Storage** | 200 GB SSD | OS + Docker images + DB |
| **Network** | 100 Mbps | Cukup untuk 2.000 ONT |
| **OS** | Ubuntu 22.04 LTS Server | atau Debian 12 |
| **Docker** | v24.0+ | Dengan Compose v2 plugin |
| **Runtime** | Docker (bukan containerd) | |

### Initial Setup Steps

```bash
# ============================================
# 1. OS Initial Setup
# ============================================
# Update system
sudo apt update && sudo apt upgrade -y

# Install essentials
sudo apt install -y \
  curl wget git vim htop iotop net-tools \
  dnsutils traceroute mtr tcpdump \
  ufw fail2ban unattended-upgrades

# Set timezone Jakarta
sudo timedatectl set-timezone Asia/Jakarta

# Optimize kernel
cat <<EOF | sudo tee -a /etc/sysctl.conf
net.core.somaxconn = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
vm.swappiness = 10
fs.file-max = 100000
EOF
sudo sysctl -p

# ============================================
# 2. Install Docker
# ============================================
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER

# ============================================
# 3. Clone repo & setup
# ============================================
git clone https://github.com/kamaraditya2-gif/tsel_ftth_v2.git /opt/mojo
cd /opt/mojo

cp .env.example .env
# EDIT .env dengan:
#   DB_PASSWORD, REDIS_PASSWORD
#   AXIROS server config
#   SESSION_SECRET
#   DOWNSTREAM_SERVER_ID=11 (contoh: Jakarta)

mkdir -p data/postgres data/redis

# ============================================
# 4. Start containers
# ============================================
docker compose up -d

# ============================================
# 5. frp client (akses dashboard)
# ============================================
# Install frpc
wget https://github.com/fatedier/frp/releases/.../frp_linux_amd64.tar.gz
# Config: local_port=3002, remote_port=8804
# Start: frpc -c frpc.ini

# ============================================
# 6. Verify
# ============================================
docker compose ps
curl localhost:3000/api/health
```

### Container Resource Allocation (2.000 ONT)

| Container | CPU | RAM | Replicas | Notes |
|-----------|-----|-----|----------|-------|
| PostgreSQL | 2 vCPU | 4 GB | 1 | Database |
| Redis | 0.5 vCPU | 1 GB | 1 | Queue + cache |
| Dashboard | 1 vCPU | 1 GB | 1 | Next.js |
| Dispatcher | 0.5 vCPU | 256 MB | 1 | Cron scheduler |
| Worker acs-fast | 1 vCPU | 512 MB | 2 | Ping + traceroute |
| Worker acs-download | 1 vCPU | 512 MB | 1 | Download speed |
| Worker acs-upload | 1 vCPU | 512 MB | 1 | Upload speed |
| Direct Ping | 0.5 vCPU | 256 MB | 1 | fping regional |
| **Total** | **~7.5 vCPU** | **~8 GB** | **9 containers** | |

### Database Sizing (2.000 ONT, 30 hari)

| Table | Row Count | Size Estimate |
|-------|-----------|---------------|
| devices_ont | 2.000 | ~2 MB |
| test_results_ping | 480.000 (4×/hari × 30hr) | ~100 MB |
| test_results_speed_download | 240.000 (2×/hari × 30hr) | ~50 MB |
| test_results_speed_upload | 240.000 (2×/hari × 30hr) | ~50 MB |
| test_results_traceroute | 60.000 (1×/hari × 30hr) | ~80 MB |
| test_results_direct_ping | 360.000 (144×/hari × 30hr) | ~60 MB |
| queue_jobs (historical) | ~120.000 | ~30 MB |
| active_alarms + alarm_history | ~10.000 | ~5 MB |
| **Total per 30 hari** | | **~377 MB** |

---

## 2. Medium Scale (10.000 ONT)

### Arsitektur

```
┌──────────────────── VM Central ──────────────────┐
│  PostgreSQL + Redis + Dashboard + Dispatcher      │
│  ACS Workers (fast:3, dl:2, ul:2)                 │
│  frp client                                       │
└────────────────────┬──────────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Regional  │  │ Regional  │  │ Regional  │  ... (3-5)
│ Worker 1  │  │ Worker 2  │  │ Worker 3  │
│ DS_ID=11  │  │ DS_ID=2   │  │ DS_ID=17  │
└──────────┘  └──────────┘  └──────────┘
```

### VM Specification

#### Central VM

| Item | Spec | Alasan |
|------|------|--------|
| CPU | 8 vCPU | PostgreSQL + BullMQ processing |
| RAM | 32 GB | DB cache + queue memory |
| Storage | 500 GB SSD | Data retention 90 hari |
| Network | 1 Gbps | Banyak regional worker konek |

#### Regional Worker VM (per 3-5 region)

| Item | Spec | Alasan |
|------|------|--------|
| CPU | 2 vCPU | Cuma fping + insert DB |
| RAM | 4 GB | Minimal |
| Storage | 50 GB SSD | OS + Docker image |
| Network | 100 Mbps | ICMP outbound ke ONT |

### Container Resource Allocation (10.000 ONT)

| Container | CPU | RAM | Replicas | Total CPU | Total RAM |
|-----------|-----|-----|----------|-----------|-----------|
| PostgreSQL | 4 vCPU | 8 GB | 1 | 4 | 8 GB |
| Redis | 1 vCPU | 2 GB | 1 | 1 | 2 GB |
| Dashboard | 1 vCPU | 2 GB | 2 | 2 | 4 GB |
| Dispatcher | 0.5 vCPU | 256 MB | 1 | 0.5 | 256 MB |
| acs-fast | 1 vCPU | 512 MB | 3 | 3 | 1.5 GB |
| acs-download | 1 vCPU | 512 MB | 2 | 2 | 1 GB |
| acs-upload | 1 vCPU | 512 MB | 2 | 2 | 1 GB |
| Direct Ping | 1 vCPU | 512 MB | 5 | 5 | 2.5 GB |
| **Total Central** | | | **12** | **14.5 vCPU** | **~18 GB** |
| **Total Regional (5 VM)** | | | **5** | **10 vCPU** | **20 GB** |

---

## 3. Full Scale (26.000 ONT)

### Arsitektur

```
┌─────────────────── Data Center ───────────────────┐
│                                                      │
│  ┌──────────────┐  ┌──────────────┐                  │
│  │ PostgreSQL    │  │ Redis        │                  │
│  │ + PgBouncer   │  │ + Sentinel   │                  │
│  └──────┬───────┘  └──────┬───────┘                  │
│         │                 │                           │
│  ┌──────┴─────────────────┴───────────────────────┐  │
│  │  Docker Host 1 (App)                           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────┐ │  │
│  │  │Dashboard1│ │Dashboard2│ │ Nginx LB       │ │  │
│  │  └──────────┘ └──────────┘ └────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Docker Host 2 (Workers)                        │  │
│  │  acs-fast ×5 | acs-dl ×3 | acs-ul ×3          │  │
│  │  Dispatcher (active + standby)                  │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
└────────────────────────────────────────────────────────┘
        │           │           │           │
        ▼           ▼           ▼           ▼
   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
   │Reg-01  │ │Reg-02  │ │Reg-03  │ │...34   │
   │2vCPU   │ │2vCPU   │ │2vCPU   │ │2vCPU   │
   │4G RAM  │ │4G RAM  │ │4G RAM  │ │4G RAM  │
   │fping   │ │fping   │ │fping   │ │fping   │
   └────────┘ └────────┘ └────────┘ └────────┘
```

### VM Specification — Full Scale

#### Central Servers

| VM | Fungsi | CPU | RAM | Storage | Replicas |
|----|--------|-----|-----|---------|----------|
| **DB-1** | PostgreSQL Primary | 8 vCPU | 16 GB | 1 TB SSD | 1 |
| **DB-2** | PostgreSQL Replica | 8 vCPU | 16 GB | 1 TB SSD | 1 |
| **Cache-1** | Redis Sentinel | 2 vCPU | 4 GB | 50 GB SSD | 1 |
| **Cache-2** | Redis Sentinel | 2 vCPU | 4 GB | 50 GB SSD | 1 |
| **Cache-3** | Redis Sentinel | 2 vCPU | 4 GB | 50 GB SSD | 1 |
| **APP-1** | Dashboard + Nginx | 4 vCPU | 8 GB | 100 GB SSD | 1 |
| **APP-2** | Dashboard + Nginx | 4 vCPU | 8 GB | 100 GB SSD | 1 |
| **WRK-1** | Workers (fast×5, dl×3, ul×3) | 8 vCPU | 16 GB | 100 GB SSD | 1 |
| **WRK-2** | Workers (cadangan) | 8 vCPU | 16 GB | 100 GB SSD | 1 |
| **DSP** | Dispatcher | 2 vCPU | 2 GB | 50 GB SSD | 1 |
| **Total Central** | | **48 vCPU** | **94 GB** | **~2.6 TB** | **10 VM** |

#### Regional Servers (34 Provinces)

| Item | Spec |
|------|------|
| CPU | 2 vCPU |
| RAM | 4 GB |
| Storage | 50 GB SSD |
| Network | 100 Mbps |
| OS | Ubuntu 22.04 LTS minimal |
| Total | **68 vCPU / 136 GB RAM** |

#### Grand Total

| Layer | VM Count | Total CPU | Total RAM | Total Storage |
|-------|----------|-----------|-----------|---------------|
| Central | 10 | 48 vCPU | 94 GB | 2.6 TB |
| Regional | 34 | 68 vCPU | 136 GB | 1.7 TB |
| **Total** | **44 VM** | **116 vCPU** | **230 GB** | **4.3 TB** |

---

## 4. Phased Scaling Plan

### Phase 1: Pilot (0 → 2.000 ONT)

**Timeline**: Bulan 1
**VM**: 1 VM all-in-one + 1 regional worker

```
Budget:
  1 VM (4vCPU/16GB/200GB)   = ~$80/bln
  1 VM Regional (2vCPU/4GB) = ~$30/bln
  frp Server                 = ~$10/bln
  --------------------------------
  Total                      = ~$120/bln
```

**Test schedule**:
- Ping: 4×/hari (setiap 6 jam)
- Download + Upload: 2×/hari (setiap 12 jam)
- Traceroute: 1×/hari
- Direct ping: setiap 10 menit

**Job volume per hari**:
- ACS jobs: 2.000 × (4 + 2 + 2 + 1) = 18.000 jobs/hari
- Direct ping: 2.000 × 144 = 288.000 inserts/hari

### Phase 2: Early Scale (2.000 → 5.000 ONT)

**Timeline**: Bulan 2-3
**VM**: Split ke central + 2 regional worker

```
Changes from Phase 1:
  Central: upgrade ke 8vCPU/32GB/500GB = ~$150/bln
  +2 Regional VM                        = ~$60/bln
  ----------------------------------   = ~$210/bln
```

**What changes**:
- PostgreSQL perlu tuning: `shared_buffers=8GB, effective_cache_size=24GB`
- Tambah 1 worker acs-fast
- Direct ping: 2 regional worker (untuk 2 provinsi)

### Phase 3: Growth (5.000 → 10.000 ONT)

**Timeline**: Bulan 4-6
**VM**: Central + 5 regional worker

```
Budget:
  Central DB (8vCPU/32GB)         = ~$150/bln
  Central App (4vCPU/8GB)         = ~$80/bln
  Central Worker (4vCPU/8GB)      = ~$80/bln
  +5 Regional VM                   = ~$150/bln
  Redis Sentinel (3× 2vCPU/4GB)    = ~$90/bln
  -------------------------------- = ~$550/bln
```

**What changes**:
- Split dashboard ke VM terpisah
- Redis Sentinel cluster (3 nodes)
- Dashboard HA (2 replicas)
- Tambah worker pool

### Phase 4: Full Scale (10.000 → 26.000 ONT)

**Timeline**: Bulan 7-12
**VM**: Multi-host central + 34 regional worker

**Province Distribution**:

| Tier | Jumlah ONT | Provinsi | Jumlah |
|------|------------|----------|--------|
| **Large** (>2.000) | Jakarta, Jawa Barat, Jawa Timur | 3 | |
| **Medium** (1.000-2.000) | Sumut, Jateng, Jabar-2, Sulsel, dll | 8 | |
| **Small** (500-1.000) | Sumbar, Riau, Lampung, Bali, dll | 12 | |
| **Mini** (<500) | Papua, Maluku, Gorontalo, dll | 11 | |

**Regional Worker Strategy**:
```
Large provinces:   1 VM per province (dedicated)
Medium provinces:  2 provinces per VM
Small provinces:   3-4 provinces per VM
Mini provinces:    All mini in 1-2 VM
Total VM:          ~34 container instances on ~12-15 host VM
```

---

## 5. Tabel Lengkap Per Phase

| Parameter | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|-----------|---------|---------|---------|---------|
| **ONT Devices** | 2.000 | 5.000 | 10.000 | 26.000 |
| **Timeline** | Bulan 1 | Bulan 2-3 | Bulan 4-6 | Bulan 7-12 |
| **Central VM** | 1 | 1 | 3 | 10 |
| **Regional VM** | 1 | 2 | 5 | 34 (12-15 host) |
| **Total VM** | 2 | 3 | 8 | 44 |
| **Total vCPU** | 6 | 12 | 28 | 116 |
| **Total RAM** | 20 GB | 40 GB | 80 GB | 230 GB |
| **Total Storage** | 250 GB | 600 GB | 1.5 TB | 4.3 TB |
| **DB Size/30hr** | ~400 MB | ~1 GB | ~2 GB | ~5 GB |
| **Monthly Budget** | ~$120 | ~$210 | ~$550 | ~$1.500 |
| **Ping SLA** | 2.000/30mnt | 5.000/45mnt | 10.000/60mnt | 26.000/90mnt |
| **Speed SLA** | 2.000/60mnt | 5.000/90mnt | 10.000/2jam | 26.000/3jam |

---

## 6. Software Stack per VM

### Central Servers

```bash
# Semua central server
OS: Ubuntu 22.04 LTS
Kernel: 6.2+ (HWE)
Docker: 24.0+ dengan Compose v2
Monitoring: prometheus-node-exporter (opsional)
Security: ufw, fail2ban, unattended-upgrades
Logging: journald + logrotate
Backup: pg_dump (cron harian) + WAL archiving

# DB Server tambahan
PostgreSQL 15 client tools
pgBackRest atau barman (jika butuh PITR)

# Regional Server
OS: Ubuntu 22.04 LTS minimal (no GUI)
Docker: 24.0+ (hanya perlu runtime)
SSH key-based auth (no password)
```

### Environment Variables per Service

```bash
# ============ Central .env ============
# Database
POSTGRES_USER=mojojojo_user
POSTGRES_PASSWORD=<random-32-char>
POSTGRES_DB=mojojojo_database
DB_HOST=mojojojo_postgres
DB_PORT=5432

# Redis
REDIS_HOST=mojojojo_redis
REDIS_PORT=6379
REDIS_PASSWORD=<random-32-char>

# Dashboard
DASHBOARD_PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:3000
SESSION_SECRET=<random-64-char>

# Axiros
AXIROS_SERVER_URL=https://acs.telkomsel.co.id
AXIROS_BASE_PATH=/live/AXAPI/Indihome
AXIROS_AUTH_USERNAME=<user>
AXIROS_AUTH_PASSWORD=<base64-pass>

# Worker tuning
PING_RATE_LIMIT_SECONDS=10
SPEED_RATE_LIMIT_SECONDS=10
AXIROS_CONFIG_TTL_MS=60000
WORKER_CONCURRENCY=5

# ============ Regional Worker .env ============
DB_HOST=<central_db_ip>
DB_PORT=5432
DB_USER=mojojojo_user
DB_PASSWORD=<password>
DB_NAME=mojojojo_database
DOWNSTREAM_SERVER_ID=<province_id>
DIRECT_PING_INTERVAL_MINUTES=10
```

---

## 7. Cost Optimization

### VM Sizing Guide

```
ONT Count  │  Central VM        │  Regional VM
───────────┼────────────────────┼────────────────────
  2.000    │  4vCPU / 16GB      │  1× 2vCPU / 4GB
  5.000    │  8vCPU / 32GB      │  2× 2vCPU / 4GB
 10.000    │  3 host (total     │  5× 2vCPU / 4GB
           │   20vCPU / 48GB)   │
 26.000    │  10 host (total    │  12-15 host
           │   48vCPU / 94GB)   │  34 worker containers
```

### Tips Cost Saving

| Strategy | Hemat | Cara |
|----------|-------|------|
| **Spot/preemptible VM** | 50-70% | Untuk regional worker (stateless) |
| **Reserved instance** | 30-40% | Untuk central (1 tahun) |
| **ARM-based VM** | 20-30% | Graviton/Ampere untuk regional worker |
| **Shared regional host** | 40% | Gabung 2-3 province per VM |
| **Compress old data** | 50% | Partisi + compress data > 90 hari |
| **Auto-scale down** | 20% | Kurangi worker di jam sepi |

---

## 8. Monitoring & Alerting Infra

Setiap VM harus di-monitoring:

```bash
# Install node_exporter untuk Prometheus
wget https://github.com/prometheus/node_exporter/releases/.../node_exporter.tar.gz
./node_exporter --web.listen-address=:9100 &

# Atau pakai telegraf (InfluxDB)
# Atau minimal: htop + nmon + dstat
```

**Alert threshold per VM**:
```
CPU > 80% selama 5 menit    → WARNING
RAM > 90%                    → WARNING
Disk > 85%                   → WARNING → AUTO CLEANUP
Disk > 95%                   → CRITICAL
Docker container restart     → WARNING
PostgreSQL connection > 80%  → WARNING
Redis memory > 80%           → WARNING
```

---

## 9. Database Migration Plan per Phase

```
Phase 1 → 2:
  • Add indexes untuk performance
  • Setup cron VACUUM ANALYZE

Phase 2 → 3:
  • Setup PgBouncer connection pooling
  • Tuning: shared_buffers, work_mem, effective_cache_size
  • Partition test_results_* by month
  • Archive data > 90 hari ke tabel_history

Phase 3 → 4:
  • Setup PostgreSQL streaming replica
  • WAL archiving untuk PITR
  • pg_partman untuk auto-partitioning
  • Consider read replica untuk dashboard queries

Phase 4 → Full:
  • PgBouncer → multi-host connection routing
  • Read/write splitting
  • Query optimization untuk dashboard aggregate
```

---

## 10. Recommended Deployment Order

```
Bulan 1:
  Week 1: Setup 1 VM → Docker → PostgreSQL + Redis
  Week 2: Deploy Dashboard + frp → verify akses
  Week 3: Deploy Dispatcher + Workers → test ping 100 ONT
  Week 4: Deploy Direct Ping → test 500 ONT

Bulan 2:
  Week 1-2: Scale ke 2.000 ONT → stabilkan
  Week 3-4: Tambah regional worker ke-2 → 5.000 ONT

Bulan 3-4:
  Split central ke multi-host
  Setup PgBouncer + partition
  Scale workers

Bulan 5-12:
  Regional deployment bertahap
  Tambah 3-5 province tiap bulan
  Target: 26.000 ONT di bulan 12
```
