# Mojo-DB Database Server (PostgreSQL 16 + TimescaleDB)

Database berdiri sendiri di server terpisah. Sistem terdiri dari tiga server:

```
mojo-edge (regional)  ──HTTPS /api/edge/*──►  mojo-central (pusat)  ──PostgreSQL 5432──►  mojo-db
 server sendiri          Bearer EDGE_SYNC_TOKEN   dashboard, dispatcher,  DB_HOST / DB_USER       PostgreSQL 16
                                                  worker, redis, nginx                            + TimescaleDB
```

| Dari → ke | Jalur | Yang dibuka |
|---|---|---|
| mojo-edge → mojo-central | HTTPS `POST /api/edge/{ping-logs,status,targets}`, `GET /api/edge/config` | port 443 di mojo-central |
| mojo-central → mojo-db | PostgreSQL, user `mojo_db_user` | port 5432 di mojo-db, **hanya** dari IP mojo-central |
| mojo-edge → mojo-db | tidak ada | jangan dibuka |

Hanya mojo-central yang punya kredensial database. mojo-edge cukup tahu URL mojo-central dan `EDGE_SYNC_TOKEN`; dashboard yang memverifikasi token lalu menulis datanya ke mojo-db.

```
database/
├── docker-compose.yml      # service db (TimescaleDB) + migrate (one-shot)
├── env.example             # salin ke .env
├── config/pg_hba.conf      # siapa yang boleh konek
├── migrations/             # NNNN_nama.sql — sumber kebenaran skema
└── scripts/
    ├── migrate.sh          # runner migrasi (up / status / new)
    └── import-legacy.sh    # pindahkan data dari database lama
```

## 1. Clone repo

Server mojo-db hanya butuh Docker (dengan Compose v2) dan git:

```bash
curl -fsSL https://get.docker.com | sh
sudo apt-get install -y git
sudo usermod -aG docker $USER    # supaya docker bisa dipakai tanpa sudo
```

Logout lalu login lagi agar grup `docker` aktif. Cek dengan `docker ps`: jika muncul `permission denied ... docker.sock`, berarti grup itu belum aktif.

Repo-nya private, jadi server perlu akses baca ke GitHub. Cara paling aman adalah **deploy key**, yaitu SSH key khusus server ini yang hanya bisa membaca satu repo:

```bash
ssh-keygen -t ed25519 -C "mojo-db" -f ~/.ssh/mojo_db_deploy -N ""
cat ~/.ssh/mojo_db_deploy.pub
```

Salin isi `.pub` ke GitHub: repo `kamaraditya2-gif/tsel_ftth_v2` → **Settings → Deploy keys → Add deploy key**. Biarkan **Allow write access** tidak dicentang. Lalu daftarkan key itu untuk github.com:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/mojo_db_deploy
  IdentitiesOnly yes
EOF
ssh -T git@github.com        # balasan "successfully authenticated" berarti sudah bisa
```

Ambil hanya folder `database/` (sparse checkout), karena server ini tidak butuh kode dashboard atau worker:

```bash
sudo mkdir -p /opt/mojo-db && sudo chown $USER: /opt/mojo-db
git clone --filter=blob:none --sparse -b fix-wahyudi-v3 \
  git@github.com:kamaraditya2-gif/tsel_ftth_v2.git /opt/mojo-db
git -C /opt/mojo-db sparse-checkout set database
```

Pastikan hasilnya benar:

```bash
git -C /opt/mojo-db branch --show-current    # fix-wahyudi-v3
ls /opt/mojo-db/database                     # README.md  config  docker-compose.yml  env.example  migrations  scripts
```

File di root repo (`docker-compose.yml`, `install.sh`, dan lain-lain) memang selalu ikut terbawa dalam sparse checkout. Itu normal; server ini hanya memakai isi folder `database/`.

Jika folder `database/` tidak ada, biasanya karena salah satu dari dua hal ini:

| Gejala | Perbaikan |
|---|---|
| branch bukan `fix-wahyudi-v3` | `git -C /opt/mojo-db checkout fix-wahyudi-v3` |
| `git -C /opt/mojo-db sparse-checkout list` kosong | `git -C /opt/mojo-db sparse-checkout set database` |

Jika ingin clone seluruh repo, hilangkan `--filter=blob:none --sparse` dan baris `git sparse-checkout`.

Untuk memperbarui kode di kemudian hari (misalnya ada migrasi baru):

```bash
cd /opt/mojo-db && git pull
cd database && docker compose run --rm migrate
```

`.env` dan folder `data/` tidak ikut di-commit, jadi `git pull` tidak menimpa password maupun data database.

## 2. Setup server baru

Semua perintah `docker compose` di bawah dijalankan dari folder `database/`, bukan dari root repo. `env.example` dan `docker-compose.yml` ada di folder ini.

```bash
cd /opt/mojo-db/database
cp env.example .env
openssl rand -base64 24          # salin hasilnya
nano .env                        # tempel di POSTGRES_PASSWORD=..., simpan
```

Jalankan database dan buat skema:

```bash
docker compose up -d db
docker compose logs -f db        # tunggu "database system is ready to accept connections", lalu Ctrl+C
docker compose run --rm migrate  # buat semua tabel + seed data referensi
docker compose run --rm migrate status
```

Simpan password tersebut; nilai yang sama dipakai sebagai `DB_PASSWORD` di server mojo-central (langkah 3).

Seed membuat user dashboard **admin / admin123**. Ganti password ini segera setelah login pertama.

### WARNING saat migrasi

Migrasi selesai dengan baris `✓ 9 migrasi ter-apply.` dan `migrate status` menampilkan 0001–0009. Di tengahnya muncul dua jenis WARNING. Keduanya bukan error dan tidak perlu ditindaklanjuti:

| WARNING | Arti |
|---|---|
| `column type "timestamp without time zone" ... does not follow best practices` (juga `character varying` untuk `ip_address`) | Disengaja. Kolom waktu tetap `TIMESTAMP` seperti database lama supaya query dan jam di dashboard tidak berubah (lihat [Skema TimescaleDB](#skema-timescaledb)). |
| `column "id" / "queue_job_id" / "dedupe_key" should be used for segmenting or ordering` | Kolom unique key tidak ikut setting kompresi. Pengecekan duplikat jadi lebih lambat **hanya** saat upsert ke chunk yang sudah dikompres (lebih tua dari 7/14 hari), misalnya retest job lama atau mojo-edge mengirim ulang data lama. Upsert tetap berhasil, dan data baru tidak terpengaruh. |

### Verifikasi

```bash
# Hasil tuning otomatis: harus sesuai RAM/CPU VM (shared_buffers ≈ 25% RAM)
docker compose exec db psql -U mojo_db_user -d mojo_db \
  -c "SHOW shared_buffers" -c "SHOW effective_cache_size" -c "SHOW max_worker_processes"

# Enam hypertable dan job kompresinya
docker compose exec db psql -U mojo_db_user -d mojo_db \
  -c "SELECT hypertable_name, compression_enabled FROM timescaledb_information.hypertables" \
  -c "SELECT hypertable_name, schedule_interval FROM timescaledb_information.jobs WHERE proc_name = 'policy_compression'"
```

Container database tidak dibatasi CPU/RAM. Saat init pertama, `timescaledb-tune` membaca RAM dan CPU VM secara otomatis lalu mengatur `shared_buffers`, `effective_cache_size`, `work_mem`, dan worker paralel. Tuning ini hanya berjalan sekali, saat `PGDATA_DIR` masih kosong. Jika VM di-upgrade kemudian, atur ulang parameter itu lewat `ALTER SYSTEM SET ...` lalu restart container.

### Batasi akses ke port 5432

Hanya mojo-central yang boleh konek. mojo-edge tidak perlu akses sama sekali.

**pg_hba.conf.** Defaultnya hanya jaringan privat (10.0.0.0/8, 192.168.0.0/16) yang diizinkan. Jika mojo-central terhubung lewat IP publik, tambahkan baris ini di `config/pg_hba.conf`:

```
host  mojo_db  mojo_db_user  <IP_MOJO_CENTRAL>/32  scram-sha-256
```

Lalu muat ulang konfigurasinya (tanpa restart):

```bash
docker compose exec db psql -U mojo_db_user -d mojo_db -c "SELECT pg_reload_conf()"
```

**Firewall.** Port yang dibuka Docker **melewati aturan UFW**, jadi `ufw deny 5432` tidak berpengaruh. Pilih salah satu:

- Jika kedua server punya jaringan privat, isi `POSTGRES_BIND=<IP privat mojo-db>` di `.env`, lalu `docker compose up -d db`.
- Jika lewat IP publik, blokir di chain `DOCKER-USER`. Urutannya penting: `-I` menaruh aturan di paling atas, jadi ACCEPT ditulis terakhir.

  ```bash
  sudo iptables -I DOCKER-USER -p tcp --dport 5432 -j DROP
  sudo iptables -I DOCKER-USER -p tcp --dport 5432 -s <IP_MOJO_CENTRAL> -j ACCEPT
  sudo apt-get install -y iptables-persistent && sudo netfilter-persistent save   # agar bertahan setelah reboot
  ```

### Tes koneksi dari mojo-central

Jalankan di server mojo-central:

```bash
# 1. Port terbuka?
docker run --rm postgres:16-alpine pg_isready -h <IP_MOJO_DB> -p 5432
# <IP_MOJO_DB>:5432 - accepting connections

# 2. Login berhasil? (pg_isready tidak mengecek pg_hba.conf maupun password)
docker run --rm -it postgres:16-alpine psql "postgres://mojo_db_user@<IP_MOJO_DB>:5432/mojo_db" -c "SELECT version()"
```

| Hasil | Penyebab |
|---|---|
| `no response` | Firewall memblokir, atau container `mojo-db` mati |
| `no pg_hba.conf entry for host "..."` | IP mojo-central belum ada di `pg_hba.conf`, atau belum `pg_reload_conf()` |
| `password authentication failed` | `DB_PASSWORD` tidak sama dengan `POSTGRES_PASSWORD` |

Pastikan juga dari IP lain (misalnya laptop atau server mojo-edge) hasil `pg_isready` adalah `no response`.

## 3. Arahkan aplikasi ke server ini

Di server aplikasi, set di `.env`:

```env
DB_HOST=<IP server database>
DB_PORT=5432
DB_USER=mojo_db_user
DB_PASSWORD=<sama dengan POSTGRES_PASSWORD>
DB_NAME=mojo_db
```

Jalankan aplikasi dengan override `docker-compose.remote-db.yml`. Override ini mematikan service `postgres` lokal dan menghapus `depends_on: postgres` di dashboard, dispatcher, dan worker (butuh Docker Compose v2.24+):

```bash
./deploy-central.sh
```

Script ini mengecek `.env`, mengetes login ke mojo-db, build image, menyalin `.next` dari image ke `dashboard/.next`, lalu menjalankan:

```bash
docker compose -f docker-compose.yml -f docker-compose.remote-db.yml up -d
```

Langkah salin `.next` wajib karena `docker-compose.yml` me-mount `./dashboard/.next` ke `/app/.next`. Di clone baru folder itu kosong dan menutupi hasil build di image, sehingga dashboard gagal dengan *"Could not find a production build"*. Jika menjalankan `docker compose ... build` secara manual, salin juga `.next` setelahnya.

Container `mojo-db` lama di server aplikasi bisa dihentikan setelah data dipindahkan (`docker stop mojo-db`).

> Worker dan dashboard di branch ini sudah disesuaikan dengan hypertable (`ON CONFLICT (queue_job_id, executed_at)` dan `ON CONFLICT (dedupe_key, bucket)`). Versi aplikasi lama **tidak** kompatibel dengan skema ini, begitu pula sebaliknya. Deploy keduanya bersamaan.

## 4. Pindahkan data dari database lama

Jalankan setelah langkah 2, saat dispatcher dan worker sudah dihentikan:

```bash
cd database
docker compose run --rm \
  -e SOURCE_URL=postgres://mojo_db_user:PASSWORD_LAMA@IP_LAMA:5432/mojo_db \
  --entrypoint bash migrate /scripts/import-legacy.sh --yes
```

Script ini:

- mengosongkan semua tabel aplikasi di database baru (termasuk seed), lalu mengisinya dengan data dari database lama;
- per tabel hanya menyalin kolom yang ada di kedua database;
- melewati baris orphan (FK menunjuk data yang sudah dihapus) dan menampilkan jumlahnya;
- menyesuaikan semua sequence `id`.

## 5. Menambah migrasi

```bash
./scripts/migrate.sh new add_index_foo    # → migrations/0010_add_index_foo.sql
# tulis SQL-nya, lalu
docker compose run --rm migrate
```

Aturan:

- **Forward-only.** Untuk membatalkan perubahan, buat migrasi baru. Jangan mengedit file yang sudah ter-apply; runner menolak jika checksum berubah.
- Setiap file berjalan dalam satu transaksi. Jika gagal, tidak ada yang tersimpan, jadi perbaiki filenya lalu jalankan lagi.
- Jangan pakai `CREATE INDEX CONCURRENTLY`, karena tidak bisa berjalan di dalam transaksi.

Runner juga bisa dijalankan langsung dari host yang punya `psql`. Koneksinya memakai variabel `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, dan `PGDATABASE`.

## Skema TimescaleDB

| Hypertable | Kolom waktu | Chunk | Kompresi setelah | segmentby |
|---|---|---|---|---|
| `test_results_ping` | `executed_at` | 1 hari | 7 hari | `device_id` |
| `test_results_speed_download` | `executed_at` | 7 hari | 14 hari | `device_id` |
| `test_results_speed_upload` | `executed_at` | 7 hari | 14 hari | `device_id` |
| `test_results_traceroute` | `executed_at` | 7 hari | 14 hari | `device_id` |
| `test_results_direct_ping` | `created_at` | 1 hari | 7 hari | `device_id` |
| `edge_ping_logs` | `bucket` | 7 hari | 14 hari | `node_id` |

Tabel lain (master, `devices_ont`, `tasks`, `queue_jobs`, alarm) adalah tabel PostgreSQL biasa.

Konsekuensi desain:

- PK hypertable berupa `(id, kolom_waktu)`, dan unique key harus memuat kolom waktu. Itu sebabnya upsert worker memakai `(queue_job_id, executed_at)`. `executed_at` diisi dari `queue_jobs.created_at`, jadi tetap untuk job yang sama, termasuk saat retest.
- Hypertable tidak punya FK ke `queue_jobs` atau `tasks`, karena antrean sering dibersihkan. FK ke `devices_ont` tetap ada, sehingga menghapus device ikut menghapus histori test-nya.
- Kolom waktu memakai `TIMESTAMP` (tanpa zona), sama seperti database lama, supaya query dan tampilan jam tidak berubah. Zona waktu server diset `Asia/Jakarta`. TimescaleDB akan menampilkan WARNING "does not follow best practices" saat migrasi; itu memang disengaja.
- Tidak ada retention policy, jadi data tidak pernah dihapus otomatis. Jika dibutuhkan, tambahkan lewat migrasi baru:
  `SELECT add_retention_policy('test_results_ping', INTERVAL '365 days');`

## Operasional

```bash
# Efek kompresi satu hypertable
docker compose exec db psql -U mojo_db_user -d mojo_db -c \
  "SELECT pg_size_pretty(before_compression_total_bytes) AS sebelum,
          pg_size_pretty(after_compression_total_bytes) AS sesudah
   FROM hypertable_compression_stats('test_results_ping')"

# Backup
docker compose exec db pg_dump -U mojo_db_user -Fc mojo_db > backup_$(date +%F).dump
```

Restore dump TimescaleDB ke database baru memerlukan `SELECT timescaledb_pre_restore();` sebelum `pg_restore` dan `SELECT timescaledb_post_restore();` sesudahnya.
