# ACS Monitoring System

Sistem monitoring Auto Configuration Server (ACS) dengan arsitektur Docker-based untuk deployment offline/air-gapped.

## Arsitektur

- **PostgreSQL**: Database utama (2 CPU, 4GB RAM) — container `mojojojo_postgres`
- **Redis**: Message broker untuk queue BullMQ (0.5 CPU, 1GB RAM) — container `mojojojo_redis`
- **Dashboard**: Next.js dashboard untuk monitoring + API config (2 CPU, 2GB RAM) — container `mojojojo_dashboard`
- **Dispatcher**: Node-cron yang men-dispatch task ke queue (0.5 CPU, 256MB RAM) — container `mojojojo_dispatcher`
- **Worker Fast**: Node.js worker untuk ping, traceroute, ont-status (1 CPU, 512MB RAM) — container `mojojojo_worker_fast`
- **Worker Download**: Node.js worker untuk download speed test (1 CPU, 512MB RAM) — container `mojojojo_worker_download`
- **Worker Upload**: Node.js worker untuk upload speed test (1 CPU, 512MB RAM) — container `mojojojo_worker_upload`
- **Direct Ping Worker**: ICMP ping loop dari server ke IP device (0.5 CPU, 256MB RAM) — container `mojojojo_direct_ping_worker`
- **Nginx**: Reverse proxy dengan security headers (opsional) — container terpisah

Semua service di atas dapat dijalankan sekaligus melalui satu file `docker-compose.yml` terpadu (lihat **Quick Start** di bawah).

**Database Tables:**
- Separate test results tables untuk menghindari race condition:
  - test_results_ping (ping test results)
  - test_results_speed_upload (upload speed test results)
  - test_results_speed_download (download speed test results)
  - test_results_traceroute (traceroute test results)
  - test_results_direct_ping (direct ping test results from server to device IP)

**Naming Convention**: Semua container dan database menggunakan prefix `mojojojo_`

## Quick Start (Unified Compose) — Recommended

Cara tercepat menjalankan seluruh stack (database + redis + dashboard + dispatcher + worker + direct-ping-worker) menggunakan satu file `docker-compose.yml`.

### 1. Siapkan `.env`

File `.env` berisi semua konfigurasi (kredensial DB/Redis, port, rate limit, dll). File ini sudah ada dan **di-gitignore**. Pastikan minimal variabel berikut terisi dengan benar:

```bash
# Database (DB_* HARUS sama dengan POSTGRES_*)
POSTGRES_USER=mojojojo_user
POSTGRES_PASSWORD=<password-kuat>
POSTGRES_DB=mojojojo_database
DB_USER=mojojojo_user
DB_PASSWORD=<password-kuat>     # WAJIB sama dengan POSTGRES_PASSWORD
DB_NAME=mojojojo_database

# Redis
REDIS_PASSWORD=<password-kuat>

# Worker -> Dashboard API (config Axiros/test-server)
API_BASE_URL=http://mojojojo_dashboard:3000
```

> **PENTING:** `DB_PASSWORD` harus identik dengan `POSTGRES_PASSWORD`, jika tidak worker/dashboard akan gagal autentikasi ke database.

### 2. Build & jalankan semua service

```bash
docker compose up -d --build
```

Network `mojojojo_network` dibuat otomatis oleh compose (tidak perlu `docker network create` manual).

### 3. Setup database (fresh install)

Hanya untuk instalasi baru dengan data kosong. Import schema lengkap:

**Windows/PowerShell:**
```powershell
Get-Content schema.sql | docker exec -i mojojojo_postgres psql -U mojojojo_user -d mojojojo_database
```

**Linux/Mac/Git Bash:**
```bash
docker exec -i mojojojo_postgres psql -U mojojojo_user -d mojojojo_database < schema.sql
```

> Catatan: `docker-compose.yml` me-mount folder `migrations/` sebagai initdb. Script di dalamnya hanya berjalan otomatis saat `data/postgres` benar-benar kosong. Untuk instalasi baru yang bersih, andalkan `schema.sql` di atas.

### 4. Akses & monitoring

```bash
# Dashboard
# http://localhost:3002

# Lihat log per service
docker compose logs -f mojo_worker
docker compose logs -f mojo_dispatcher
docker compose logs -f mojo_direct_ping_worker

# Status semua service
docker compose ps
```

### 5. Stop / scaling

```bash
# Stop seluruh stack
docker compose down

# Scale worker menjadi 5 instance
docker compose up -d --scale mojo_worker=5
```

> Bagian **Deployment untuk Server Offline** dan **Cara Install Masing-Masing Service** di bawah masih relevan untuk skenario lama/per-service. Untuk deployment baru, gunakan `docker-compose.yml` terpadu ini.

## Migrasi ke Server Ubuntu Offline (Air-gapped)

Memindahkan seluruh stack (image + konfigurasi + data DB) dari mesin Windows berinternet ke server Ubuntu tanpa internet. Tersedia 3 berkas pendukung:

- `docker-compose.offline.yml` — varian compose untuk server tujuan: memakai image hasil `docker load` (tanpa `build:`) dan tanpa auto-init migrations.
- `package-offline.ps1` — dijalankan di Windows untuk mengemas bundle.
- `deploy-offline-ubuntu.sh` — dijalankan di Ubuntu untuk deploy.

### 1. Di mesin Windows (sumber) — buat bundle

```powershell
# Sertakan data database lama:
./package-offline.ps1

# Atau tanpa data (DB fresh di server tujuan):
./package-offline.ps1 -NoData
```

Script akan: build image -> dump database -> `docker save` image -> menyalin `docker-compose.offline.yml`, `.env`, `config/`, `migrations/`, `schema.sql` ke folder **`offline-bundle/`**.

### 2. Pindahkan ke server Ubuntu

Copy folder `offline-bundle/` ke server utama (via USB/SCP).

Isi `offline-bundle/`:
- `images.tar` — Docker images (dashboard, worker, postgres, redis)
- `db_dump.sql` — Dump database (schema + data)
- `docker-compose.offline.yml`, `.env`, `config/`, `migrations/`
- `deploy-offline-ubuntu.sh` — Script deploy otomatis

> Catatan: `offline-bundle-direct-ping/` adalah bundle terpisah untuk direct-ping worker di mesin lain (lihat bagian **Direct Ping Worker di Mesin Terpisah** di bawah).

### 3. Di server Ubuntu — deploy bundle utama

```bash
cd offline-bundle

# Normalkan line ending jika file .sh dibuat di Windows (opsional):
sed -i 's/\r$//' deploy-offline-ubuntu.sh

chmod +x deploy-offline-ubuntu.sh
./deploy-offline-ubuntu.sh
```

Script akan: `docker load` image → jalankan postgres & redis → restore `db_dump.sql` (atau `schema.sql` bila DB fresh) → jalankan seluruh service.

### Catatan
- File `.env` ikut dipindahkan (berisi password) — jaga kerahasiaannya.
- Image yang dibawa: `mojo-worker:latest`, `mojo-dashboard:latest`, `postgres:15-alpine`, `redis:7-alpine`.
- Update berikutnya: jalankan ulang `package-offline.ps1` di Windows, pindahkan `images.tar`, lalu di Ubuntu `docker load -i images.tar && docker compose -f docker-compose.offline.yml up -d`.

## Struktur Project

```
.
├── docker-compose.yml            # UNIFIED: db + redis + dashboard + dispatcher + worker + direct-ping-worker (RECOMMENDED)
├── .env                          # Environment variables (gitignored, berisi secret)
├── docker-compose-postgres.yml   # PostgreSQL (legacy / per-service)
├── docker-compose-redis.yml      # Redis (legacy / per-service)
├── docker-compose-worker.yml     # Worker (legacy / per-service)
├── docker-compose-dispatcher.yml # Dispatcher (legacy / per-service)
├── docker-compose-dashboard.yml  # Dashboard (legacy / per-service)
├── docker-compose-nginx.yml      # Nginx reverse proxy
├── docker-compose-infra.yml      # PostgreSQL + Redis (legacy)
├── docker-compose-app.yml        # Worker + Dashboard (legacy)
├── docker-compose.offline.yml              # Offline: bundle utama (db+redis+dashboard+worker+dispatcher)
├── docker-compose.offline-direct-ping.yml  # Offline: direct-ping worker terpisah
├── package-offline.ps1                     # Windows: kemas bundle offline (utama + direct-ping)
├── deploy-offline-ubuntu.sh              # Ubuntu: deploy bundle utama
├── deploy-offline-direct-ping.sh           # Ubuntu: deploy bundle direct-ping
├── schema.sql                    # Database schema (complete with all tables)
├── migrations/                  # Migration files (init/upgrade database)
├── config/                      # redis.conf
├── backup.sh                    # Script backup database
├── cleanup.sh                   # Script cleanup data lama
├── bundle-app.sh                # (legacy) build & save images per-file
├── deploy-offline.sh            # (legacy) deploy offline per-file
├── worker/                      # Node.js worker + dispatcher
│   ├── worker.js
│   ├── dispatcher.js
│   ├── direct-ping-worker.js
│   ├── start-direct-ping-worker.js
│   ├── db.js
│   ├── package.json
│   └── Dockerfile
├── dashboard/                   # Next.js dashboard
│   ├── app/
│   ├── components/
│   ├── package.json
│   └── Dockerfile
├── nginx/
│   └── conf.d/
│       └── default.conf
└── data/                        # Volume data
    ├── postgres/
    └── redis/
```

## Deployment untuk Server Offline (Legacy / Per-file)

> **Catatan:** Bagian ini memakai file `docker-compose-*.yml` lama dan script `bundle-app.sh`/`deploy-offline.sh`. Untuk deployment baru, gunakan **Quick Start (Unified Compose)** dan **Migrasi ke Server Ubuntu Offline** di atas.

### Prerequisites for Production

Sebelum deploy ke production, pastikan:

1. **Setup environment variables**:
   ```bash
   # Edit file .env dan isi semua password dengan secure values
   ```

2. **Generate secure passwords**:
   - Database password: Gunakan password minimal 16 karakter dengan kombinasi huruf, angka, dan simbol
   - Redis password: Gunakan password minimal 16 karakter
   - Admin user password: Ganti default password admin123

3. **Pastikan firewall dikonfigurasi**:
   - Hanya buka port yang diperlukan (80, 443 untuk nginx)
   - Port database (5432) dan Redis (6379) hanya accessible dari dalam network

### Metode 1: Menggunakan Script (Automated)

#### 1. Di Laptop/Server Berinternet

Build dan save semua Docker images:

```bash
chmod +x bundle-app.sh
./bundle-app.sh v1
```

Ini akan membuat file `mojo_update_v1.tar` yang berisi semua images yang dibutuhkan.

#### 2. Transfer ke Server Offline

Copy file `mojo_update_v1.tar`, semua file `docker-compose-*.yml`, dan folder `nginx/` ke server offline via flashdisk.

#### 3. Di Server Offline

Load images dan jalankan container:

```bash
chmod +x deploy-offline.sh
./deploy-offline.sh mojo_update_v1.tar
```

#### 4. Setup Database

Import schema database:

```bash
docker exec -i mojojojo_postgres psql -U mojojojo_user -d mojojojo_database < schema.sql
```

**Note**: Schema.sql sudah lengkap dengan semua tabel yang diperlukan termasuk:
- test_results_ping
- test_results_speed_upload
- test_results_speed_download
- test_results_traceroute

Untuk fresh installation, cukup jalankan schema.sql tanpa perlu menjalankan migration files secara terpisah. Migration files hanya diperlukan untuk upgrade existing database.

#### 5. Jalankan Nginx

```bash
docker compose -f docker-compose-nginx.yml up -d
```

### Metode 2: Manual Deployment

#### 1. Di Mesin Online - Build dan Export Docker Images

```bash
# Build images
docker-compose -f docker-compose-app.yml build
docker-compose -f docker-compose-infra.yml pull

# Export images ke tar file
docker save postgres:15-alpine redis:7-alpine mojo-worker:latest mojo-dashboard:latest -o mojo-images.tar
```

#### 2. Transfer ke Server Offline

Copy file `mojo-images.tar` dan seluruh project folder ke server offline (via USB, SCP, atau media lainnya).

#### 3. Import Images di Server Offline

```bash
# Import images
docker load -i mojo-images.tar

# Buat network
docker network create mojojojo_network
```

#### 4. Setup Infrastructure

```bash
# Buat folder yang diperlukan
mkdir -p data/postgres data/redis config migrations

# Copy redis.conf dan migrations ke server offline
# Copy config/redis.conf dan migrations/ folder

# Jalankan infrastructure
docker-compose -f docker-compose-infra.yml up -d
```

#### 5. Setup Database

```bash
# Import schema
docker exec -i mojojojo_postgres psql -U mojojojo_user -d mojojojo_database < schema.sql
```

**Note**: Schema.sql sudah lengkap dengan semua tabel yang diperlukan termasuk:
- test_results_ping
- test_results_speed_upload
- test_results_speed_download
- test_results_traceroute

Untuk fresh installation, cukup jalankan schema.sql tanpa perlu menjalankan migration files secara terpisah. Migration files hanya diperlukan untuk upgrade existing database.

#### 6. Jalankan Application

```bash
# Jalankan application
docker-compose -f docker-compose-app.yml up -d
```

#### 7. Jalankan Nginx (Opsional)

```bash
docker compose -f docker-compose-nginx.yml up -d
```

#### 8. Verifikasi

```bash
# Cek status containers
docker ps

# Cek logs
docker-compose -f docker-compose-app.yml logs -f
docker-compose -f docker-compose-infra.yml logs -f
```

## Cara Install dan Run Masing-Masing Service

Setiap service dapat dijalankan secara terpisah menggunakan docker-compose file yang sesuai.

### Prerequisites

Buat Docker network untuk komunikasi antar container:

```bash
docker network create mojojojo_network
```

### 1. PostgreSQL

Start PostgreSQL:

```bash
docker compose -f docker-compose-postgres.yml up -d
```

Stop PostgreSQL:

```bash
docker compose -f docker-compose-postgres.yml down
```

View logs:

```bash
docker compose -f docker-compose-postgres.yml logs -f
```

### 2. Redis

Start Redis:

```bash
docker compose -f docker-compose-redis.yml up -d
```

Stop Redis:

```bash
docker compose -f docker-compose-redis.yml down
```

View logs:

```bash
docker compose -f docker-compose-redis.yml logs -f
```

### 3. Worker

Start Worker (pastikan PostgreSQL dan Redis sudah berjalan):

```bash
docker compose -f docker-compose-worker.yml up -d
```

Stop Worker:

```bash
docker compose -f docker-compose-worker.yml down
```

View logs:

```bash
docker compose -f docker-compose-worker.yml logs -f
```

### 3.1 Direct Ping Worker

Direct Ping Worker adalah worker khusus yang melakukan ping langsung dari server ke IP address device ONT/STB untuk memantau konektivitas jaringan.

**Fitur:**
- Ping langsung ke IP address device dari server
- Validasi IP address (IPv4 dan IPv6) sebelum ping
- Simpan hasil latency dan packet loss ke database
- Interval konfigurasi (default: 10 menit)
- Support fping untuk ping multiple IP sekaligus (lebih cepat)
- Fallback ke regular ping jika fping tidak tersedia
- Support Windows dan Linux ping command

**Install fping (Optional - Recommended for better performance):**

Linux (Ubuntu/Debian):
```bash
sudo apt-get update
sudo apt-get install fping
```

Linux (CentOS/RHEL):
```bash
sudo yum install fping
```

macOS:
```bash
brew install fping
```

Windows:
```bash
# Download from: https://fping.sourceforge.io/
# Extract and add to PATH
```

**Catatan:** Jika fping tidak diinstall, worker akan otomatis menggunakan regular ping (lebih lambat karena ping satu per satu).

**Database Table:**
- `test_results_direct_ping` - Menyimpan hasil direct ping

**Configuration:**
Tambahkan ke `.env`:
```bash
DIRECT_PING_INTERVAL_MINUTES=10  # Interval dalam menit (default: 10)
```

**Menjalankan via Unified Compose (Recommended):**
Direct ping worker sudah disertakan sebagai service `mojo_direct_ping_worker` di `docker-compose.yml` (menjalankan `start-direct-ping-worker.js`). Service ini diberi capability `NET_RAW` agar ICMP ping berfungsi di dalam container. Tidak perlu langkah manual — cukup `docker compose up -d`.

```bash
docker compose logs -f mojo_direct_ping_worker
```

**Menjalankan di Mesin Terpisah via Docker (Offline):**
Untuk deploy direct-ping worker di mesin Ubuntu terpisah (tanpa Redis/Dashboard), gunakan bundle `offline-bundle-direct-ping/` yang dihasilkan oleh `package-offline.ps1`. Lihat bagian **Direct Ping Worker di Mesin Terpisah (Offline)** di bawah untuk detail lengkap.

**Jalankan di Foreground (Development / tanpa Docker):**
```bash
cd worker
node direct-ping-worker.js
```

**Jalankan di Background (Production):**

**Option 1: Menggunakan PM2 (Recommended - Cross Platform)**
```bash
cd worker
npm install -g pm2
pm2 start direct-ping-worker.js --name direct-ping-worker
pm2 logs direct-ping-worker
pm2 stop direct-ping-worker
pm2 delete direct-ping-worker
```

**Option 2: Menggunakan nohup (Linux/Mac)**
```bash
cd worker
nohup node direct-ping-worker.js > direct-ping-worker.log 2>&1 &
tail -f direct-ping-worker.log
```

**Option 3: Menggunakan Windows PowerShell**
```powershell
cd worker
Start-Process node -ArgumentList "direct-ping-worker.js" -WindowStyle Hidden
```

**Migration:**
Jalankan migration untuk membuat tabel:
```bash
Get-Content migrations\create_test_results_direct_ping.sql | docker exec -i mojojojo_postgres psql -U mojojojo_user -d mojojojo_database
```

### 4. Dashboard

Start Dashboard (pastikan PostgreSQL dan Redis sudah berjalan):

```bash
docker compose -f docker-compose-dashboard.yml up -d
```

Stop Dashboard:

```bash
docker compose -f docker-compose-dashboard.yml down
```

View logs:

```bash
docker compose -f docker-compose-dashboard.yml logs -f
```

Dashboard akan dapat diakses di: http://localhost:3002

### 5. Nginx

Start Nginx (opsional, untuk reverse proxy):

```bash
docker compose -f docker-compose-nginx.yml up -d
```

Stop Nginx:

```bash
docker compose -f docker-compose-nginx.yml down
```

View logs:

```bash
docker compose -f docker-compose-nginx.yml logs -f
```

### Start Semua Service Sekaligus

Jika ingin menjalankan semua service sekaligus (urutan penting):

```bash
# Start infrastructure (PostgreSQL + Redis)
docker compose -f docker-compose-postgres.yml up -d
docker compose -f docker-compose-redis.yml up -d

# Tunggu hingga healthy, kemudian start application (Worker + Dashboard)
docker compose -f docker-compose-worker.yml up -d
docker compose -f docker-compose-dashboard.yml up -d

# Start Nginx (opsional)
docker compose -f docker-compose-nginx.yml up -d
```

### Stop Semua Service

```bash
docker compose -f docker-compose-postgres.yml down
docker compose -f docker-compose-redis.yml down
docker compose -f docker-compose-worker.yml down
docker compose -f docker-compose-dashboard.yml down
docker compose -f docker-compose-nginx.yml down
```

### Deployment Legacy (Menggunakan File Lama)

Jika masih menggunakan file lama (docker-compose-infra.yml dan docker-compose-app.yml):

```bash
# Start infrastructure + application (harus bersamaan karena ada dependensi)
docker compose -f docker-compose-infra.yml -f docker-compose-app.yml up -d

# Start nginx (opsional)
docker compose -f docker-compose-nginx.yml up -d
```

## Scaling Worker

Worker sudah dipecah menjadi 3 container dedicated:
- `mojojojo_worker_fast` → queue `acs-fast` (ping, traceroute, ont-status)
- `mojojojo_worker_download` → queue `acs-download` (download speed)
- `mojojojo_worker_upload` → queue `acs-upload` (upload speed)

Ini memastikan test cepat tidak tertahan oleh test lambat (speed test bisa memakan waktu 3-7 menit). Dispatcher dan direct-ping-worker cukup 1 instance (jangan di-scale).

## Maintenance

### Backup Database

```bash
chmod +x backup.sh
./backup.sh
```

### Cleanup Data Lama

```bash
chmod +x cleanup.sh
```

Script ini akan:
- Hapus log docker > 7 hari
- Hapus queue_results > 30 hari
- Hapus system_logs > 7 hari
- Hapus queue_jobs completed > 7 hari
- Hapus dangling docker images

### Cek Status Container

```bash
docker compose ps
```

### View Logs

```bash
# Worker logs
docker compose logs -f mojo_worker

# Dashboard logs
docker compose logs -f mojo_dashboard

# Semua logs
docker compose logs -f
```

## Update Kode

### Server online (unified compose)

Edit kode, lalu build & restart:

```bash
docker compose up -d --build
```

### Server offline (Ubuntu air-gapped)

**Rekomendasi lokasi di server Ubuntu:** `/opt/mojojojo/` untuk bundle utama, `/opt/mojojojo-dp/` untuk direct-ping.

1. **Di mesin Windows (development)**: jalankan packaging script:
   ```powershell
   ./package-offline.ps1
   ```
   > Gunakan `-NoData` jika tidak ingin ikutkan dump database.
   > Script akan menghasilkan **dua folder**: `offline-bundle/` (utama) dan `offline-bundle-direct-ping/` (terpisah).

2. **Pindahkan ke server Ubuntu** (via USB/SCP):
   ```bash
   # Bundle utama
   scp -r offline-bundle/ user@ubuntu-server:/tmp/

   # Bundle direct-ping (ke mesin terpisah, opsional)
   scp -r offline-bundle-direct-ping/ user@dp-server:/tmp/
   ```

3. **Di server Ubuntu**, pindahkan dan deploy bundle utama:
   ```bash
   sudo mkdir -p /opt/mojojojo
   sudo chown $USER:$USER /opt/mojojojo
   mv /tmp/offline-bundle/* /opt/mojojojo/
   cd /opt/mojojojo
   chmod +x deploy-offline-ubuntu.sh
   ./deploy-offline-ubuntu.sh
   ```

4. **Setelah deploy selesai**, dashboard dapat diakses di:
   `http://<IP-SERVER>:3002`

**File di dalam `offline-bundle/`:**
- `images.tar` — Docker images (dashboard, worker, postgres, redis)
- `db_dump.sql` — Dump database (schema + data)
- `docker-compose.offline.yml` — Compose file untuk offline
- `.env` — Konfigurasi environment
- `config/` — Konfigurasi Redis
- `migrations/` — File migrasi SQL
- `deploy-offline-ubuntu.sh` — Script deploy otomatis

**Update direct-ping worker** (jika ada di mesin terpisah):
```bash
cd /opt/mojojojo-dp
# Ganti images.tar dari bundle baru
docker load -i images.tar
docker compose -f docker-compose.offline-direct-ping.yml up -d
```

## Direct Ping Worker di Mesin Terpisah (Offline)

Direct Ping Worker dapat di-deploy di **mesin Ubuntu terpisah** yang hanya butuh koneksi ke PostgreSQL (tidak butuh Redis / Dashboard / Worker utama).

### 1. Prasyarat di Mesin Ubuntu (Offline)

Pastikan Docker dan Docker Compose plugin sudah terpasang sebelum mesin offline (saat masih terhubung internet):

```bash
# Install Docker (jalankan saat masih online)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt-get update
sudo apt-get install -y docker-compose-plugin

# Verifikasi
docker --version
docker compose version
```

> Jika mesin sudah offline dan belum ada Docker, unduh `.deb` package Docker dari mesin lain lalu install manual via `dpkg -i`.

### 2. Di mesin Windows — buat bundle

`package-offline.ps1` otomatis membuat **dua folder bundle**:
- `offline-bundle/` — Bundle utama (sudah dijelaskan di atas)
- `offline-bundle-direct-ping/` — Bundle direct-ping worker saja

### 3. Transfer ke mesin Ubuntu (Offline)

Copy folder `offline-bundle-direct-ping/` ke mesin Ubuntu via USB atau SCP:

```bash
# Contoh via SCP dari mesin lain yang bisa bridge
scp -r offline-bundle-direct-ping/ user@dp-server:/tmp/
```

Pindahkan ke lokasi kerja yang direkomendasikan:

```bash
sudo mkdir -p /opt/mojojojo-dp
sudo chown $USER:$USER /opt/mojojojo-dp
mv /tmp/offline-bundle-direct-ping/* /opt/mojojojo-dp/
cd /opt/mojojojo-dp
```

### 4. Edit `.env`

Sebelum deploy, **wajib edit** `.env` di dalam folder tersebut:

```bash
nano .env
```

Ganti nilai berikut:

```bash
# Ganti DB_HOST dari container name -> IP server PostgreSQL (bundle utama)
DB_HOST=<IP_SERVER_POSTGRES>

# Pastikan kredensial DB sama persis dengan bundle utama
DB_USER=mojojojo_user
DB_PASSWORD=<SAMADENGAN_BUNDLE_UTAMA>
DB_NAME=mojojojo_database

# Interval ping (menit)
DIRECT_PING_INTERVAL_MINUTES=10
```

> **PENTING:** Mesin ini harus bisa reach PostgreSQL di port `5432` (cek firewall jika perlu).

### 5. Deploy

```bash
cd /opt/mojojojo-dp

# Normalkan line ending jika file dibuat di Windows (opsional):
sed -i 's/\r$//' deploy-offline-direct-ping.sh

chmod +x deploy-offline-direct-ping.sh
./deploy-offline-direct-ping.sh
```

Script akan memuat image `mojo-worker:latest` dan menjalankan container `mojojojo_direct_ping_worker` dengan capability `NET_RAW`.

### 6. Verifikasi & Monitoring

```bash
# Cek status container
docker compose -f docker-compose.offline-direct-ping.yml ps

# Lihat logs real-time
docker compose -f docker-compose.offline-direct-ping.yml logs -f

# Restart service
docker compose -f docker-compose.offline-direct-ping.yml restart

# Stop service
docker compose -f docker-compose.offline-direct-ping.yml down
```

### Troubleshooting Direct Ping Offline

**Container tidak bisa konek ke PostgreSQL:**
```bash
# Test konektivitas dari mesin direct-ping
telnet <IP_SERVER_POSTGRES> 5432
```
Jika gagal, periksa:
- Firewall di server PostgreSQL (allow port 5432 dari IP mesin direct-ping)
- `pg_hba.conf` di PostgreSQL (tambahkan entry untuk IP mesin direct-ping)

**ICMP ping tidak berfungsi di container:**
Pastikan `cap_add: [NET_RAW]` ada di `docker-compose.offline-direct-ping.yml`. Tanpa capability ini, `ping` akan gagal dengan `Operation not permitted`.

**Update image direct-ping worker:**
```bash
cd /opt/mojojojo-dp
docker load -i images.tar
docker compose -f docker-compose.offline-direct-ping.yml up -d
```

## Database Schema

Schema terdiri dari tabel-tabel berikut:

**Master Tables:**
- **users, roles**: Manajemen user
- **group_devices**: Pengelompokan perangkat
- **speed_group**: Grup speed dengan threshold
- **devices**: Data perangkat (ONT/STB)
- **network_targets**: Target jaringan (IGW, EBR, Axiros)
- **payloads**: Definisi API payload (legacy)
- **tasks**: Definisi task (scheduled/ondemand)

**Execution Tables:**
- **queue_jobs**: Antrean jobs untuk Redis
- **queue_results**: Hasil test untuk dashboard (legacy)
- **test_results_ping**: Hasil test ping (terpisah untuk menghindari race condition)
- **test_results_speed_upload**: Hasil test upload speed (terpisah)
- **test_results_speed_download**: Hasil test download speed (terpisah)
- **test_results_traceroute**: Hasil test traceroute (terpisah)
- **test_results_direct_ping**: Hasil direct ping dari server ke device IP
- **system_logs**: Log sistem

**Database Setup:**
- Untuk fresh installation: Cukup jalankan schema.sql (sudah lengkap dengan semua tabel)
- Untuk existing database: Jalankan migration files di folder migrations/ untuk upgrade

Lihat `schema.sql` untuk detail lengkap.

## API Endpoints Dashboard

- `GET /api/system/status` - Status sistem (CPU, RAM, Disk)
- `GET /api/dashboard/summary` - Summary dashboard (KPI, chart data)
- `GET /api/devices` - List devices dengan status

## Alur Kerja

1. User buat task via dashboard (scheduled/ondemand)
2. Dispatcher (node-cron) cek task setiap menit
3. Jika task scheduled jatuh tempo, dispatcher urai group ke individual device
4. Buat queue_jobs di PostgreSQL
5. Kirim queue_job_id ke Redis (BullMQ)
6. Worker ambil dari Redis → query PostgreSQL → eksekusi test (mengambil config Axiros/test-server dari dashboard via `API_BASE_URL`)
7. Simpan hasil ke tabel `test_results_*` yang sesuai (ping/traceroute/speed_upload/speed_download) menggunakan upsert `ON CONFLICT (queue_job_id)`
8. Dashboard tampilkan data real-time

Secara paralel, **Direct Ping Worker** melakukan ICMP ping langsung dari server ke IP device pada interval `DIRECT_PING_INTERVAL_MINUTES` dan menyimpan ke `test_results_direct_ping`.

## Environment Variables

Semua service membaca konfigurasi dari satu file `.env` di root. Tabel berikut adalah variabel yang dipakai oleh `docker-compose.yml` terpadu (semua punya default di compose, tetapi nilai sensitif sebaiknya di-set eksplisit).

### Database
```
POSTGRES_USER=mojojojo_user
POSTGRES_PASSWORD=<password-kuat>
POSTGRES_DB=mojojojo_database
POSTGRES_PORT=5432              # host port mapping
DB_HOST=mojojojo_postgres
DB_PORT=5432
DB_USER=mojojojo_user
DB_PASSWORD=<password-kuat>     # WAJIB sama dengan POSTGRES_PASSWORD
DB_NAME=mojojojo_database
```

### Redis
```
REDIS_PASSWORD=<password-kuat>
REDIS_HOST=mojojojo_redis
REDIS_PORT=6379                 # host port mapping (mis. 127.0.0.1:6379)
REDIS_PORT_INTERNAL=6379        # port koneksi internal antar-service
```

### Worker & Dispatcher
```
API_BASE_URL=http://mojojojo_dashboard:3000  # endpoint config Axiros/test-server
PING_RATE_LIMIT_SECONDS=10      # rate limit ping per device
SPEED_RATE_LIMIT_SECONDS=10     # rate limit speed test (upload/download) per device
AXIROS_CONFIG_TTL_MS=60000      # TTL cache config Axiros (ms)
```

### Direct Ping Worker
```
DIRECT_PING_INTERVAL_MINUTES=10 # interval ICMP ping (menit)
```

### Dashboard
```
DASHBOARD_PORT=3002             # host port (mapped ke 3000 di container)
NEXT_PUBLIC_API_URL=http://localhost/api
INTERNAL_API_URL=http://localhost:3000
SESSION_SECRET=<random-secret>
AI_INTEGRATIONS_GEMINI_API_KEY= # opsional
AI_INTEGRATIONS_GEMINI_BASE_URL=# opsional
```

### Umum
```
TZ=Asia/Jakarta
NODE_ENV=production
```

**Catatan Penting:**
- `DB_PASSWORD` **wajib** identik dengan `POSTGRES_PASSWORD` (worker/dashboard pakai DB_*, Postgres di-init dengan POSTGRES_*).
- `API_BASE_URL` di Docker harus menunjuk ke dashboard (`http://mojojojo_dashboard:3000`); untuk run lokal tanpa Docker default-nya `http://localhost:3000`.
- Jika value `.env` mengandung karakter khusus (mis. `$`, `|`, `}`), bungkus dengan tanda kutip tunggal agar konsisten.
- Worker utama dan direct ping worker **tidak memerlukan API_KEY**; semua test type (ping, traceroute, download, upload, ont-status) berjalan tanpa API_KEY.
- `.env` di-gitignore — jangan commit secret ke repository.

## Troubleshooting

### Container tidak start

Cek logs (unified compose):
```bash
docker compose logs mojo_worker
docker compose logs mojo_dispatcher
docker compose logs postgres
docker compose logs redis
```

### Database connection failed

- Pastikan `DB_PASSWORD` di `.env` identik dengan `POSTGRES_PASSWORD`.
- Pastikan service postgres sudah `healthy`:
```bash
docker compose ps
```

### Redis connection failed

Cek status Redis (pakai password karena Redis di-set `requirepass`):
```bash
docker exec mojojojo_redis redis-cli -a "$REDIS_PASSWORD" ping
```

### Worker gagal ambil config Axiros / test-server

Worker mengambil config dari dashboard via `API_BASE_URL`. Di Docker, pastikan `API_BASE_URL=http://mojojojo_dashboard:3000` (bukan `localhost`) dan service dashboard sudah berjalan.

### Hasil test tidak tersimpan ke `test_results_*`

Pastikan kolom `queue_job_id` punya UNIQUE constraint (dibutuhkan oleh upsert `ON CONFLICT`). Jalankan:
```bash
Get-Content migrations\add_unique_queue_job_id_to_test_results.sql | docker exec -i mojojojo_postgres psql -U mojojojo_user -d mojojojo_database
```

### Disk penuh

Jalankan cleanup script:
```bash
./cleanup.sh
```

Hapus docker images lama:
```bash
docker image prune -a
```

## Default Credentials

**⚠️ PENTING**: Ganti semua password default di production!

### Development (Default)
- **Database User**: mojojojo_user
- **Database Password**: mojojojo_password
- **Database Name**: mojojojo_database
- **Redis Password**: mojojojo_redis_password
- **Default Admin User**: admin
- **Default Admin Password**: admin123

### Production (Secure)
Semua nilai di atas dapat di-override lewat file `.env`:

```bash
# Edit file .env dan ganti semua password dengan secure values
# Ingat: DB_PASSWORD harus sama dengan POSTGRES_PASSWORD
```

**Security Requirements for Production:**
- Database password: Minimal 16 karakter, kombinasi huruf besar/kecil, angka, dan simbol
- Redis password: Minimal 16 karakter, kombinasi huruf besar/kecil, angka, dan simbol
- Admin password: Minimal 12 karakter, kombinasi huruf besar/kecil, angka, dan simbol
- Gunakan password generator atau password manager untuk generate secure passwords

### Reset Admin Password

Jika perlu mereset password admin yang sudah ada:

**Windows/PowerShell:**
```powershell
# Update password admin menjadi admin123
Get-Content migrations\update_admin_password.sql | docker exec -i mojojojo_postgres psql -U mojojojo_user -d mojojojo_database
```

**Linux/Mac/Git Bash:**
```bash
# Update password admin menjadi admin123
docker exec -i mojojojo_postgres psql -U mojojojo_user -d mojojojo_database < migrations/update_admin_password.sql
```

**Custom Password:**
Untuk mengubah ke password custom, generate bcrypt hash terlebih dahulu:
```bash
# Di dalam dashboard container
docker exec -it mojojojo_dashboard node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your_password', 10).then(h => console.log(h))"
```

Kemudian update di database:
```sql
UPDATE users SET password = '$2b$10$...' WHERE username = 'admin';
```

## License

Internal use only
