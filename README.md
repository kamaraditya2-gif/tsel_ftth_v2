# Mojo-Central — FTTH ACS Monitoring Dashboard

> Deploy ke production dengan database terpisah: lihat [🚀 Deploy Production](#-deploy-production-database-terpisah).

## 📍 Landing Page (Dashboard)

4 KPI cards + filters + map + advanced analytics.

### Filter Bar (Top)
| Filter | Fungsi |
|--------|--------|
| **Time Range** | 1h / 6h / 24h / 7d / 30d — periode data yang ditampilkan |
| **Location** | Multi-select Area → Regional → NOP City |
| **Speed Group** | Filter ONT berdasarkan paket speed langganan |
| **Brand** | Filter berdasarkan merek ONT |
| **ONT Model** | Filter berdasarkan tipe ONT |
| **Clear Filter** | Reset semua filter ke default |

---

### Card 1 — Latency
| Value | Penjelasan |
|-------|-----------|
| **Test Progress** | `X/Y (Z%)` — X ONT sudah dites ping dari total Y ONT dalam periode waktu |
| **IGW ms** | Rata-rata latency ke Internet Gateway (via ACS ping) |
| **EBR ms** | Rata-rata latency ke Edge Router (via ACS ping) |
| **SR** | Success Rate — persentase ping test yang berhasil |
| **Pkt Loss** | Rata-rata packet loss dari semua hasil ping |
| **Critical / Warning / Cleared** | Jumlah alarm latency kritis / warning / sudah selesai |

### Card 2 — Speed
| Value | Penjelasan |
|-------|-----------|
| **DL Test** | `X/Y (Z%)` — X ONT sudah dites download speed dari total Y |
| **Above DL / Below DL** | Jumlah ONT dengan download speed ≥ threshold (Above) / < threshold (Below) |
| **SR DL** | Success Rate download speed test |
| **UL Test** | `X/Y (Z%)` — X ONT sudah dites upload speed dari total Y |
| **Above UL / Below UL** | Jumlah ONT dengan upload speed ≥ threshold / < threshold |
| **SR UL** | Success Rate upload speed test |
| **Alarm / Avg DL / Cleared** | Total alarm speed, rata-rata download, alarm selesai |

### Card 3 — Packet Loss
| Value | Penjelasan |
|-------|-----------|
| **Avg Loss %** | Rata-rata packet loss dari semua ONT |
| **Alarms** | Total alarm packet loss aktif |
| **Online / Cleared** | Device online, alarm yang sudah selesai |

### Card 4 — Devices
| Value | Penjelasan |
|-------|-----------|
| **Test Success Rate** | Persentase job test (ping/download/upload) yang berhasil dieksekusi |
| **Total Up** | Device dengan status online |
| **Down** | Device dengan status offline |
| **Total** | Jumlah seluruh device |
| **Alarm** | Total semua alarm aktif |
| **Cleared** | Total alarm yang sudah selesai |

### Network Topology
Diagram visual arsitektur jaringan: **ONT → BNG → IGW → File Server**
- **Upstream mode**: ONT initiate test → IGW/BNG → File Server
- **Downstream mode**: File Server initiate ping → IGW/BNG → ONT

### Device Heatmap
Peta sebaran ONT dengan warna:
- 🟢 Hijau = ≥80% metrics OK
- 🟡 Kuning = 50-80% OK
- 🔴 Merah = <50% OK
- ⚫ Abu = No data

Klik ONT → popup detail (status, ping, download, upload, packet loss, latency)

### Top 5 Devices
5 device terburuk per kategori: Latency IGW, Latency EBR, Packet Loss, Download Below Threshold, Upload Below Threshold

---

## 📍 Performance Test (`/testing/performance`)

Daftar semua device dengan hasil test terbaru.

| Kolom | Penjelasan |
|-------|-----------|
| **Device** | Nama device + serial number |
| **Alias** | Nama alias dari device |
| **Brand** | Merek + tipe ONT |
| **Speed Plan** | Paket speed langganan |
| **Latency** | Ping IGW (ms) + threshold, EBR (ms) + threshold |
| **Download** | Download speed (Mbps) + threshold |
| **Upload** | Upload speed (Mbps) + threshold |
| **Packet Loss** | Packet loss (%) + threshold |
| **Traceroute** | Jumlah hop traceroute |
| **Status** | Success / No Data |
| **Last Check** | Waktu test terakhir |
| **History** | Riwayat test sebelumnya (modal + download CSV) |

Warna value berdasarkan threshold dari `threshold_master`:
- 🟢 Hijau = di bawah warning
- 🟡 Kuning = antara warning & critical
- 🔴 Merah = di atas critical

---

## 📍 Devices (`/devices`)

Management device ONT.

### Filter (2 baris)
| Filter | Fungsi |
|--------|--------|
| **Search** | Cari nama / serial / IP / IndiHome ID |
| **Location** | Multi-select Area → Regional → NOP |
| **Status** | Online / Offline |
| **Speed** | Filter paket speed |
| **Brand** | Merek ONT |
| **ONT Type** | Tipe ONT |
| **Model** | Text filter model |
| **IP** | Text filter IP address |
| **IndiHome** | Text filter IndiHome ID |

### Tabel Device
| Kolom | Penjelasan |
|-------|-----------|
| **Device** | Nama device + serial |
| **Alias** | Nama alias (bisa diedit inline) |
| **Serial** | Serial number |
| **IP Address** | IP device |
| **Model** | Model ONT (link biru = ada datasheet) |
| **IndiHome ID** | ID IndiHome |
| **Speed** | Paket speed langganan |
| **Region** | Region / area |
| **Status** | Online / Offline |

---

## 📍 Alarms (`/alarms/v2`)

Management alarm dan threshold violation.

### Fitur
| Fitur | Penjelasan |
|-------|-----------|
| **Tab Active / Cleared** | Beralih antara alarm aktif dan yang sudah selesai |
| **Location Filter** | Multi-select area/regional/nop |
| **Search** | Cari device name atau serial |
| **Severity Filter** | All / Critical / Warning |
| **Expand Row** | Klik chevron untuk detail: Root Cause, Comment, Retest |
| **Root Cause** | L1 (category) → L2 (specific cause) dropdown cascade |
| **Action** | Catat tindakan yang diambil |
| **PIC** | Person in charge |
| **Save Root Cause** | Simpan + tampilkan saved info dengan timestamp |
| **Comment / Reply** | Diskusi per-device |
| **Retest On-Demand** | Jalankan ulang test untuk device |
| **Create Ticket** | Buat ticket dengan root cause analysis |
| **History** | Riwayat alarm per device (modal) |

### Root Cause Hierarchy
```
Availability        → FO Cut, Module Faulty, High Temp, PLN Down
Capacity            → Link Occupancy Over Capacity, Link Unbalanced
Interface/Port Problem → Interface CRC Error, Packet Discard
Other               → Free Text
```

---

## 📍 Scheduled Test (`/testing/scheduled`)

Penjadwalan test periodik per region.

| Fitur | Penjelasan |
|-------|-----------|
| **Add Schedule** | Buat task baru: pilih region, NOP, test type, interval, start date/time |
| **Edit Schedule** | Ubah title, test type, interval. Start date/time tidak bisa diubah |
| **Pause / Activate** | Nonaktifkan / aktifkan task |
| **Delete** | Hapus task |
| **Duplicate Check** | Cegah task dengan region + test type yang sama |
| **ONT Count** | Tampilkan jumlah ONT per region di dropdown |

### Task List Info
| Info | Penjelasan |
|------|-----------|
| **Region** | Nama downstream server |
| **NOP City** | Filter NOP (jika ada) |
| **ONT Count** | Jumlah device yang kena test |
| **Test Types** | Ping, traceroute, download, upload |
| **Interval** | Frekuensi pengulangan |
| **Start** | Waktu mulai task |
| **Next** | Jadwal eksekusi berikutnya |
| **Status** | Active / Inactive + dispatch count + completed/failed |

### 24h Schedule Timeline
Gantt chart per-test-type dengan warna:
- 🟦 Ping = Cyan
- 🟪 Traceroute = Violet
- 🟩 Download = Emerald
- 🟨 Upload = Amber
- 🟥 Ont-Status = Rose

---

## 📍 On Demand Test (`/testing/on-demand`)

Test langsung ke device tertentu (real-time).

---

## 📍 Queueing (`/testing/queueing`)

Monitor antrian job test yang sedang berjalan dan pending.

---

## 📍 Reports (`/reports/v2`)

Laporan agregat per:
- Alarm per Area / Regional / NOP / Brand / ONT Type
- Availability
- RCA Summary
- Performance Summary

**Export CSV**: Download summary + detail device per baris.

---

## 📍 Admin Menu

### Threshold (`/admin/threshold`)
Konfigurasi threshold untuk latency, packet loss, download/upload speed.
- Tipe: UPPER (nilai lebih tinggi = lebih buruk) / LOWER (nilai lebih rendah = lebih buruk)
- Profile: Bronze / Silver / Gold / Platinum (untuk speed threshold)

### Speed Group (`/admin/speed-groups`)
Management paket speed:
- Name, Speed Limit, Profile

### Worker (`/admin/worker`)
Monitor worker status + real-time logs dengan tab:
- All / API / FPING / FAST / DL / UL / REGIONAL
- **Clear All** — reset semua antrian + stop workers

### Download Raw Data (`/admin/download-data`)
Download data mentah ping / traceroute dalam CSV:
- Filter by Region + Time Range (1-7 days)
- Traceroute menyertakan detail hop

### Downstream Servers / Master Area / Master Cluster NOP
Management master data lokasi.

### Users & Roles
Management user + role-based access.

---

## 📍 Advanced Analytics

Tombol **"Advanced Analytics"** di dashboard (collapsible).

### Severity Summary
| Level | Kriteria |
|-------|----------|
| **Critical** | Latency >100ms / Packet Loss >5% / Speed <50% threshold |
| **Major** | Latency 50-100ms / Packet Loss 2-5% / Speed 50-80% threshold |
| **Minor** | Latency ≤50ms / Packet Loss ≤2% / Speed ≥80% threshold |

### Root Cause L1 Pie Chart
Distribusi root cause per kategori.

### Root Cause L2 Bar Chart
Distribusi root cause per penyebab spesifik.

### Availability
`Successful Ping / Total Ping × 100%`

### Top Alarm
Device yang gagal test ≥7 hari berturut-turut.

---

## 📍 Data Sources

| Tabel | Digunakan Untuk |
|-------|----------------|
| `devices_ont` | Data device, status, lokasi |
| `test_results_ping` | Hasil ping ACS (IGW, EBR, packet loss) |
| `test_results_speed_download` | Hasil download speed test |
| `test_results_speed_upload` | Hasil upload speed test |
| `test_results_traceroute` | Hasil traceroute |
| `test_results_direct_ping` | Hasil fping (direct ping) |
| `active_alarms` | Alarm yang sedang aktif |
| `alarm_history` | Riwayat alarm |
| `threshold_master` | Konfigurasi threshold |
| `queue_jobs` | Antrian job test |
| `tasks` | Scheduled tasks |
| `speed_group` | Paket speed langganan |
| `downstream_servers` | Regional server |
| `master_cluster_nop` | Data NOP/cluster |

---

## 🚀 Deploy Production (Database Terpisah)

Production memakai tiga server:

```
mojo-edge (regional) --(HTTPS /api/edge)--> mojo-central --(PostgreSQL 5432)--> mojo-db
```

| Server | Isi | Panduan |
|--------|-----|---------|
| **mojo-db** | PostgreSQL 16 + TimescaleDB | [database/README.md](database/README.md) |
| **mojo-central** | Dashboard, dispatcher, worker, Redis, Nginx (repo ini) | bagian ini |
| **mojo-edge** | Kirim data ke `/api/edge/*` dengan `EDGE_SYNC_TOKEN` | tidak butuh akses database |

Hanya mojo-central yang memegang kredensial database.

### 1. Siapkan mojo-db dulu

Ikuti [database/README.md](database/README.md) langkah 1–2 sampai migrasi 0001–0009 ter-apply, lalu batasi port 5432 hanya untuk IP mojo-central. Aplikasi di branch ini **tidak kompatibel** dengan skema database lama, jadi jangan arahkan ke DB lama.

### 2. Instal di `/opt/mojo-central`

Prasyarat:

- Docker + Docker Compose **v2.24+** (`docker compose version`) dan git. Cara instalnya sama dengan server mojo-db ([database/README.md langkah 1](database/README.md#1-clone-repo)), termasuk `usermod -aG docker $USER`.
- Akses baca ke repo GitHub (private). Pakai deploy key seperti di langkah yang sama, dengan nama key `mojo_central_deploy`.
- Akses ke port 5432 server mojo-db.

```bash
sudo mkdir -p /opt/mojo-central && sudo chown $USER: /opt/mojo-central
git clone -b fix-wahyudi-v3 \
  git@github.com:kamaraditya2-gif/tsel_ftth_v2.git /opt/mojo-central
cd /opt/mojo-central
```

Folder dimiliki user deploy (bukan root), jadi `git pull` dan `./deploy-central.sh` tidak butuh `sudo`. Semua perintah di bawah dijalankan dari `/opt/mojo-central`.

### 3. Isi `.env`

```bash
cp .env.example .env
```

| Variabel | Nilai |
|----------|-------|
| `DB_HOST` | IP server mojo-db (bukan `mojo-db`) |
| `DB_PASSWORD` | Sama dengan `POSTGRES_PASSWORD` di server mojo-db |
| `REDIS_PASSWORD` | `openssl rand -hex 24` |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `EDGE_SYNC_TOKEN` | `openssl rand -hex 32`, nilai yang sama diisi di mojo-edge |
| `DASHBOARD_PORT` | `127.0.0.1:3002` jika semua akses lewat Nginx |

`POSTGRES_*` tidak dipakai di server ini. Password jangan mengandung `#`.

### 4. Deploy

```bash
./deploy-central.sh
```

Script ini:

1. Mengecek versi Docker Compose dan isi `.env`.
2. Mengetes koneksi dan login ke mojo-db. Jika gagal, berhenti sebelum ada container yang dijalankan.
3. Build image dashboard dan worker.
4. Menyalin hasil build Next.js dari image ke `dashboard/.next`. Folder ini di-mount ke container, dan jika kosong dashboard gagal start (*"Could not find a production build"*).
5. Menjalankan stack tanpa Postgres lokal (`docker-compose.yml` + `docker-compose.remote-db.yml`).
6. Menunggu `/api/health` sehat (maks. 90 detik).

Restart tanpa build ulang: `./deploy-central.sh --no-build`.

### 5. Nginx + HTTPS

Nginx butuh `nginx/ssl/cert.pem` dan `nginx/ssl/key.pem`:

```bash
./scripts/letsencrypt-setup.sh <domain.com> [email]   # domain publik
# atau
./scripts/generate-ssl-cert.sh                        # self-signed (internal)

docker compose -f docker-compose-nginx.yml up -d
```

### 6. Verifikasi

```bash
docker compose -f docker-compose.yml -f docker-compose.remote-db.yml ps   # tidak ada container postgres
curl -k https://localhost/api/health
```

Login dengan **admin / admin123** (seed mojo-db) dan **segera ganti password**.

### Update aplikasi

```bash
cd /opt/mojo-central
git pull
./deploy-central.sh
```

### Catatan keamanan

- Port yang dibuka Docker **melewati UFW**. Tutup port dashboard dengan `DASHBOARD_PORT=127.0.0.1:3002`, bukan dengan `ufw deny`.
- Jika server ini sebelumnya menjalankan container `mojo-db` lokal, hentikan (`docker stop mojo-db`) setelah datanya dipindahkan ke mojo-db baru ([database/README.md langkah 4](database/README.md#4-pindahkan-data-dari-database-lama)).

### Troubleshooting

| Gejala | Penyebab |
|--------|----------|
| `mojo-db ... tidak merespons` | Firewall server mojo-db memblokir, atau container DB mati |
| `Login ke mojo-db gagal` | IP mojo-central belum ada di `pg_hba.conf`, atau `DB_PASSWORD` salah |
| `Could not find a production build` | `dashboard/.next` kosong; jalankan ulang `./deploy-central.sh` |
| `mojo-edge` dapat 401 | `EDGE_SYNC_TOKEN` kosong atau berbeda di kedua sisi |
| Nginx restart terus | `nginx/ssl/cert.pem` / `key.pem` belum ada |
