# Mojo-DB Database Server (PostgreSQL 16 + TimescaleDB)

Database berdiri sendiri di VM terpisah. Dashboard, dispatcher, worker, dan worker regional terhubung lewat jaringan memakai `DB_HOST`.

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

## 1. Setup server baru

```bash
cd database
cp env.example .env              # isi POSTGRES_PASSWORD
docker compose up -d db
docker compose run --rm migrate  # buat semua tabel + seed data referensi
docker compose run --rm migrate status
```

Container database tidak dibatasi CPU/RAM. Saat init pertama, `timescaledb-tune` membaca RAM dan CPU VM secara otomatis lalu mengatur `shared_buffers`, `effective_cache_size`, `work_mem`, dan worker paralel. Tuning ini hanya berjalan sekali, saat `PGDATA_DIR` masih kosong. Jika VM di-upgrade kemudian, atur ulang parameter itu lewat `ALTER SYSTEM SET ...` lalu restart container.

Seed membuat user **admin / admin123**. Ganti password ini segera setelah login pertama.

Batasi akses di `config/pg_hba.conf`: ganti baris `0.0.0.0/0` dengan IP server aplikasi dan regional. Setelah itu jalankan `docker compose exec db psql -U mojo_db_user -d mojo_db -c "SELECT pg_reload_conf()"`. Buka port 5432 di firewall hanya untuk IP tersebut.

## 2. Arahkan aplikasi ke server ini

Di server aplikasi (dan setiap regional), set di `.env`:

```env
DB_HOST=<IP server database>
DB_PORT=5432
DB_USER=mojo_db_user
DB_PASSWORD=<sama dengan POSTGRES_PASSWORD>
DB_NAME=mojo_db
```

Service `postgres` lama di `docker-compose.yml` / `docker-compose-infra.yml` tidak perlu dijalankan lagi.

> Worker dan dashboard di branch ini sudah disesuaikan dengan hypertable (`ON CONFLICT (queue_job_id, executed_at)` dan `ON CONFLICT (dedupe_key, bucket)`). Versi aplikasi lama **tidak** kompatibel dengan skema ini, begitu pula sebaliknya. Deploy keduanya bersamaan.

## 3. Pindahkan data dari database lama

Jalankan setelah langkah 1, saat dispatcher dan worker sudah dihentikan:

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

## 4. Menambah migrasi

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
