#!/usr/bin/env bash
# =============================================================================
# Deploy mojo-central tanpa database lokal (DB di server mojo-db terpisah)
# =============================================================================
# Jalankan dari root repo di server mojo-central:
#
#   ./deploy-central.sh            # cek koneksi DB, build, start
#   ./deploy-central.sh --no-build # restart pakai image yang sudah ada
#
# Butuh .env dengan DB_HOST mengarah ke server mojo-db (lihat database/README.md).
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

DC="docker compose -f docker-compose.yml -f docker-compose.remote-db.yml"
BUILD=1
[ "${1:-}" = "--no-build" ] && BUILD=0

fail() { echo "✗ $*" >&2; exit 1; }
ok()   { echo "✓ $*"; }

# Ambil nilai dari .env tanpa source (baris .env boleh berisi komentar di belakang)
env_get() {
  grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed 's/[[:space:]]*#.*$//; s/^"//; s/"$//'
}

# --- 1. Cek prasyarat ---------------------------------------------------------
[ -f .env ] || fail ".env belum ada. Jalankan: cp .env.example .env lalu isi DB_HOST, DB_PASSWORD, dst."

ver=$(docker compose version --short 2>/dev/null) || fail "docker compose v2 tidak ditemukan"
major=${ver%%.*}; rest=${ver#*.}; minor=${rest%%.*}
if [ "$major" -lt 2 ] || { [ "$major" -eq 2 ] && [ "$minor" -lt 24 ]; }; then
  fail "Docker Compose $ver terlalu lama, butuh v2.24+ (untuk !override/!reset)"
fi
ok "Docker Compose $ver"

DB_HOST=$(env_get DB_HOST);         DB_PORT=$(env_get DB_PORT);   DB_PORT=${DB_PORT:-5432}
DB_USER=$(env_get DB_USER);         DB_USER=${DB_USER:-mojo_db_user}
DB_NAME=$(env_get DB_NAME);         DB_NAME=${DB_NAME:-mojo_db}
DB_PASSWORD=$(env_get DB_PASSWORD)

case "$DB_HOST" in
  ""|mojo-db|localhost|127.0.0.1) fail "DB_HOST=$DB_HOST di .env harus berisi IP server mojo-db" ;;
esac
for key in DB_PASSWORD REDIS_PASSWORD SESSION_SECRET; do
  case "$(env_get $key)" in
    ""|CHANGE_THIS*) fail "$key di .env masih default/kosong" ;;
  esac
done
[ -n "$(env_get EDGE_SYNC_TOKEN)" ] || echo "! EDGE_SYNC_TOKEN kosong: semua request dari mojo-edge akan ditolak"

# --- 2. Tes koneksi ke mojo-db ------------------------------------------------
docker run --rm postgres:16-alpine pg_isready -h "$DB_HOST" -p "$DB_PORT" -t 5 >/dev/null \
  || fail "mojo-db $DB_HOST:$DB_PORT tidak merespons (firewall / container mati)"
docker run --rm -e PGPASSWORD="$DB_PASSWORD" postgres:16-alpine \
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT 1" >/dev/null \
  || fail "Login ke mojo-db gagal (cek pg_hba.conf dan DB_PASSWORD, lihat database/README.md)"
ok "Koneksi ke mojo-db $DB_HOST:$DB_PORT"

# --- 3. Build -----------------------------------------------------------------
if [ "$BUILD" = 1 ]; then
  $DC build
  ok "Build image selesai"
fi

# --- 4. Salin hasil build Next.js ke host -------------------------------------
# docker-compose.yml me-mount ./dashboard/.next ke /app/.next; jika folder host
# kosong, hasil build di dalam image tertutup dan dashboard gagal start.
# Hapus lewat container karena folder ini bisa dibuat Docker sebagai root.
docker run --rm -v "$PWD/dashboard:/d" alpine rm -rf /d/.next
cid=$(docker create mojo-dashboard:latest)
docker cp "$cid:/app/.next" dashboard/.next
docker rm "$cid" >/dev/null
ok "dashboard/.next disalin dari image"

# --- 5. Start -----------------------------------------------------------------
$DC up -d --remove-orphans
ok "Container berjalan"

# --- 6. Health check ----------------------------------------------------------
port=$(env_get DASHBOARD_PORT); port=${port:-3002}; port=${port##*:}
echo -n "Menunggu dashboard di localhost:$port "
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:$port/api/health" >/dev/null 2>&1; then
    echo; ok "Dashboard sehat"
    $DC ps
    exit 0
  fi
  echo -n "."; sleep 3
done
echo
$DC ps
fail "Dashboard belum sehat setelah 90 detik. Cek: docker logs mojo-central-dashboard"
