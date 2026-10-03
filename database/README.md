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

Container database tidak dibatasi CPU/RAM. Saat init pertama, `timescaledb-tune` membaca RAM dan CPU VM secara otomatis lalu mengatur `shared_buffers`, `effective_cache_size`, `work_mem`, dan worker paralel. Tuning ini hanya berjalan sekali, saat `PGDATA_DIR` masih kosong. Jika VM di-upgrade kemudian, atur ulang parameter itu lewat `ALTER SYSTEM SET ...` lalu restart container.

Seed membuat user **admin / admin123**. Ganti password ini segera setelah login pertama.

Akses di `config/pg_hba.conf` defaultnya hanya untuk jaringan privat (10.0.0.0/8, 192.168.0.0/16). Jika server aplikasi terhubung lewat IP publik, tambahkan IP-nya sebagai `/32`. Setelah mengubah file itu, jalankan `docker compose exec db psql -U mojo_db_user -d mojo_db -c "SELECT pg_reload_conf()"`. Buka port 5432 di firewall hanya untuk IP tersebut.

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
docker compose -f docker-compose.yml -f docker-compose.remote-db.yml up -d
```

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
