# 🔌 Cara Konektor & Arsitektur MojoJojoMonitor

## 📐 Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER BROWSER                                  │
│                    http://server-ip:3002                                │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────────┐
│                     🖥️ DASHBOARD (Next.js)                              │
│                    Container: mojojojo_dashboard                        │
│                    Port: 3002 → 3000                                    │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Login Page   │  │ Dashboard    │  │ Reports      │  │ Field Test │ │
│  │ /login       │  │ /            │  │ /reports     │  │ /field     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ REST API
┌─────────────────────────────▼───────────────────────────────────────────┐
│                    🐘 POSTGRESQL                                        │
│                    Container: mojojojo_postgres                         │
│                    Port: 5432                                           │
│                                                                         │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────┐  │
│  │ devices_ont     │  │ test_results_*   │  │ downstream_servers    │  │
│  │ users           │  │ queue_jobs       │  │ group_devices         │  │
│  │ tasks           │  │ test_results_    │  │ speed_group           │  │
│  │                 │  │   direct_ping    │  │                       │  │
│  └─────────────────┘  └──────────────────┘  └───────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼──────┐  ┌──────────▼──────────┐  ┌──────▼───────┐
│ 🧮 REDIS     │  │ ⚙️ WORKERS (3)      │  │ 📡 DIRECT PING│
│ mojojojo_    │  │                     │  │ mojojojo_     │
│ redis        │  │ • fast: ping/tr/ont │  │ direct_ping_  │
│              │  │ • download: speed ↓ │  │   worker      │
│ • BullMQ     │  │ • upload: speed ↑   │  │               │
│ • Rate Limit │  │                     │  │ • fping ICMP  │
│              │  │ mojojojo_worker_*   │  │ • Every 10min │
│              │  │                     │  │ • → DB        │
└──────────────┘  └─────────────────────┘  └───────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
     ┌────────▼─────────┐    ┌──────────▼──────────┐
     │ 📅 DISPATCHER    │    │ 🌐 AXiROS ACS API   │
     │ mojojojo_        │    │ (External Server)   │
     │ dispatcher       │    │                     │
     │                  │    │ • PostONTPing       │
     │ • Cron schedule  │    │ • PostONTTraceRoute │
     │ • Enqueue jobs   │    │ • PostONTDownload   │
     │                  │    │ • PostONTUpload     │
     └──────────────────┘    └─────────────────────┘
```

---

## 🔗 Cara Konektor

### 1. Dashboard → PostgreSQL
Dashboard (Next.js API Routes) langsung query ke PostgreSQL via `lib/db` (pg Pool).
```
Dashboard API → pool.connect() → mojojojo_postgres:5432
```

### 2. Worker → Redis → PostgreSQL
```
Dispatcher (cron) → Redis BullMQ queue → Worker consume → PostgreSQL
```
- Dispatcher setiap interval (misal 5 menit) enqueue job ke Redis
- Worker listen Redis queue dan execute task
- Hasil test disimpan ke PostgreSQL

### 3. Direct Ping Worker → PostgreSQL
```
Direct Ping Worker → fping/ping command → PostgreSQL (test_results_direct_ping)
```
- Independent loop, tidak melalui Redis
- Setiap 10 menit ping semua ONT
- Hasil disimpan langsung ke DB

### 4. Dashboard → AXiROS (Upstream Tests)
```
User click "Run Test" → Dashboard API → AXiROS ACS API → ONT
```
- Dashboard memanggil API AXiROS
- AXiros mengeksekusi test di ONT
- Hasil kembali ke Dashboard → simpan ke DB

---

## ⚡ fping vs Regular Ping

| Fitur | Regular Ping | fping |
|-------|-------------|-------|
| Cara kerja | 1 IP per command | Banyak IP sekaligus |
| Kecepatan | Lambat (30 device × 3 detik = 90 detik) | Cepat (30 device × 0.5 detik = 2 detik) |
| Resource | Tinggi (banyak child process) | Rendah (1 process) |
| Status | ✅ Fallback | ✅ Default (kalau tersedia) |

**Cara kerja fping:**
```bash
fping -c 4 -t 5000 8.8.8.8 1.1.1.1 8.8.4.4 ...
# Output: 192.168.1.1 : xmt/rcv/%loss = 4/4/0%, min/avg/max = 2.1/2.3/2.5 ms
```

**Install fping:**
```bash
# Di container (Alpine)
apk add --no-cache fping

# Di Dockerfile
RUN apk add --no-cache fping iputils
```

---

## 🗺️ Downstream Server (Direct Ping) Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           DOWNSTREAM SERVER 1 (TB Simatupang)               │
│           Lat: -6.2923, Lng: 106.8265                       │
│                                                             │
│  ┌──────────────┐      ICMP Ping (fping)                   │
│  │ Container    │ ───────────────────────────────►          │
│  │ mojojojo_    │        to all ONT IPs                    │
│  │ direct_ping_ │                                           │
│  │ worker       │ ◄───────────────────────────────          │
│  └──────────────┘      latency + packet_loss               │
│                              │                              │
│                              ▼                              │
│                    ┌──────────────────┐                     │
│                    │  PostgreSQL      │                     │
│                    │  test_results_   │                     │
│                    │  direct_ping     │                     │
│                    └──────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ REST API
                              ▼
                    ┌──────────────────┐
                    │  Dashboard Map   │
                    │  • Server icon   │
                    │  • ONT dots      │
                    │  • Dashed lines  │
                    └──────────────────┘
```

**Menambah Downstream Server Baru:**

1. **Deploy worker di lokasi baru:**
```bash
# Di server provinsi, clone repo
git clone https://github.com/kamaraditya2-gif/tsel_ftth.git
cd tsel_ftth

# Edit .env
DOWNSTREAM_SERVER_ID=2
DB_HOST=<IP DB utama>

# Jalankan hanya direct ping worker
docker compose up -d mojo_direct_ping_worker
```

2. **Register server di DB:**
```sql
INSERT INTO downstream_servers (name, location, province, lat, lng, status)
VALUES ('Downstream Server 2', 'Telkomsel Medan', 'Sumatera Utara', 3.5952, 98.6722, 'active');
```

3. **Map ONT ke server:**
```sql
UPDATE devices_ont SET downstream_server_id = 2 WHERE regional_name = 'Sumatera Utara';
```

4. **Dashboard otomatis** akan menampilkan icon server baru + garis ke ONT-nya!

---

## 🚀 One-Click Install

```bash
curl -fsSL https://raw.githubusercontent.com/kamaraditya2-gif/tsel_ftth/main/install.sh | bash
```

Atau manual:
```bash
git clone https://github.com/kamaraditya2-gif/tsel_ftth.git
cd tsel_ftth
chmod +x install.sh
./install.sh
```

Setelah install, buka: `http://<server-ip>:3002`

---

## 📡 Port & Koneksi

| Service | Container | Port | Koneksi Dari |
|---------|-----------|------|-------------|
| Dashboard | mojojojo_dashboard | 3002 | Browser user |
| PostgreSQL | mojojojo_postgres | 5432 | Dashboard, Worker |
| Redis | mojojojo_redis | 6379 | Dashboard, Worker, Dispatcher |
| Worker Fast | mojojojo_worker_fast | — | Redis queue (acs-fast) |
| Worker Download | mojojojo_worker_download | — | Redis queue (acs-download) |
| Worker Upload | mojojojo_worker_upload | — | Redis queue (acs-upload) |
| Dispatcher | mojojojo_dispatcher | — | Redis queue |
| Direct Ping | mojojojo_direct_ping_worker | — | PostgreSQL |
