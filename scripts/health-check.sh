#!/usr/bin/env bash
#
# MojoJojoMonitor - End-to-End Health Check
# ============================================================
# Script ini mengecek kesehatan seluruh stack MojoJojoMonitor
# dari sisi luar (host), mulai dari login aplikasi, koneksi API,
# koneksi & insertion ke PostgreSQL, koneksi Redis, status worker,
# sampai keterkaitan antar container.
#
# Cara pakai:
#   1. Jalankan dari root project MojoJojoMonitor:
#        ./scripts/health-check.sh
#
#   2. Kalau admin password berbeda, pass sebagai argumen:
#        ./scripts/health-check.sh http://localhost:3002 admin "passwordAdmin"
#
#   3. Atau lewat environment variable:
#        ADMIN_USER=admin ADMIN_PASS=passwordAdmin ./scripts/health-check.sh
#
# Catatan:
#   - Script mengasumsikan container sudah berjalan (docker compose up).
#   - Script akan membuat tabel sementara `health_check` di PostgreSQL,
#     insert 1 baris, lalu menghapusnya lagi agar tidak mengotori data.
#   - Script akan menulis/menghapus key `mojo:health:check` di Redis.
#   - Semua password DB/Redis dibaca dari file `.env` di root project.
#   - Nama container tidak di-hardcode secara kaku. Script mencari container
#     berdasarkan label `com.docker.compose.service`, sehingga cocok untuk
#     berbagai konfigurasi project name (mojojojo_* atau mojojojomonitor-*).
#

set -euo pipefail

# ------------------------------------------------------------------
# Warna untuk output
# ------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

pass() {
  echo -e "${GREEN}✅ PASS${NC}: $1"
  PASS=$((PASS + 1))
}

fail() {
  echo -e "${RED}❌ FAIL${NC}: $1"
  FAIL=$((FAIL + 1))
}

info() {
  echo -e "${YELLOW}ℹ️  INFO${NC}: $1"
}

# ------------------------------------------------------------------
# Load environment variables dari .env (jika ada)
# ------------------------------------------------------------------
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"

if [[ -f "$ENV_FILE" ]]; then
  info "Loading environment from ${ENV_FILE}"
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Lewati baris kosong dan komentar
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    # Lewati baris yang tidak valid (harus mengandung =)
    [[ "$line" != *=* ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    # Trim whitespace di key
    key="$(echo "$key" | sed 's/[[:space:]]*$//')"
    # Hanya export key yang valid
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    # Unescape docker-compose style $$ -> $ sebelum set variable
    value="${value//\$\$/\$}"
    # Set variable tanpa mengevaluasi value (aman untuk password spesial karakter)
    printf -v "$key" '%s' "$value"
    export "$key"
  done < "$ENV_FILE"
else
  info ".env tidak ditemukan, menggunakan default"
fi

# ------------------------------------------------------------------
# Konfigurasi
# ------------------------------------------------------------------
BASE_URL="${1:-http://localhost:${DASHBOARD_PORT:-3002}}"
ADMIN_USER="${ADMIN_USER:-${2:-admin}}"
ADMIN_PASS="${ADMIN_PASS:-${3:-}}"

COMPOSE_FILE="${PROJECT_DIR}/docker-compose.yml"
SCALING_FILE="${PROJECT_DIR}/docker-compose.scaling.yml"

COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

echo ""
echo "============================================================"
echo "MojoJojoMonitor Health Check"
echo "============================================================"
echo "Base URL      : $BASE_URL"
echo "Admin User    : $ADMIN_USER"
echo "Project Dir   : $PROJECT_DIR"
echo "Compose File  : $COMPOSE_FILE"
echo "============================================================"
echo ""

# ------------------------------------------------------------------
# Helper: cari ID container berdasarkan service label.
# Mengapa tidak pakai nama container kaku? Karena nama container bisa
# berbeda tergantung COMPOSE_PROJECT_NAME atau versi docker-compose
# (contoh: mojojojo_worker_fast vs mojojojomonitor-mojo_worker_fast-1).
# ------------------------------------------------------------------
container_id_by_service() {
  local service="$1"
  docker ps -q -f "label=com.docker.compose.service=${service}" 2>/dev/null | head -n1
}

DASHBOARD_CONTAINER=$(container_id_by_service "mojo_dashboard")
POSTGRES_CONTAINER=$(container_id_by_service "postgres")
REDIS_CONTAINER=$(container_id_by_service "redis")
WORKER_FAST_CONTAINER=$(container_id_by_service "mojo_worker_fast")

# ------------------------------------------------------------------
# 1. Cek status container
# ------------------------------------------------------------------
echo "--- 1. Container Status ---"

if [[ -n "$POSTGRES_CONTAINER" ]]; then
  pass "Service postgres berjalan (container: $POSTGRES_CONTAINER)"
else
  fail "Service postgres TIDAK berjalan"
fi

if [[ -n "$REDIS_CONTAINER" ]]; then
  pass "Service redis berjalan (container: $REDIS_CONTAINER)"
else
  fail "Service redis TIDAK berjalan"
fi

if [[ -n "$DASHBOARD_CONTAINER" ]]; then
  pass "Service mojo_dashboard berjalan (container: $DASHBOARD_CONTAINER)"
else
  fail "Service mojo_dashboard TIDAK berjalan"
fi

# Cek container worker (minimal 1 worker ACS dan 1 direct-ping)
WORKER_COUNT=$(docker ps -q -f "label=com.docker.compose.service=mojo_worker_fast" 2>/dev/null | wc -l)
DIRECT_PING_COUNT=$(docker ps -q -f "label=com.docker.compose.service=mojo_direct_ping_worker" 2>/dev/null | wc -l)

if [[ "$WORKER_COUNT" -ge 1 ]]; then
  pass "Ditemukan $WORKER_COUNT container ACS worker fast (label service)"
else
  fail "Tidak ada container ACS worker fast yang berjalan"
fi

if [[ "$DIRECT_PING_COUNT" -ge 1 ]]; then
  pass "Ditemukan $DIRECT_PING_COUNT container direct-ping worker default"
else
  fail "Tidak ada container direct-ping worker default yang berjalan"
fi

# ------------------------------------------------------------------
# 2. Keterkaitan antar container (internal DNS / port)
# ------------------------------------------------------------------
echo ""
echo "--- 2. Inter-Container Connectivity ---"

if [[ -n "$DASHBOARD_CONTAINER" ]]; then
  # Dashboard image node:20-slim tidak punya ping/nc, gunakan bash builtin /dev/tcp.
  if docker exec "$DASHBOARD_CONTAINER" bash -c "exec 3<>/dev/tcp/mojojojo_postgres/5432 && exec 3<&- && exec 3>&-" 2>/dev/null; then
    pass "Dashboard dapat terhubung ke mojojojo_postgres:5432"
  else
    fail "Dashboard TIDAK dapat terhubung ke mojojojo_postgres:5432"
  fi

  if docker exec "$DASHBOARD_CONTAINER" bash -c "exec 3<>/dev/tcp/mojojojo_redis/6379 && exec 3<&- && exec 3>&-" 2>/dev/null; then
    pass "Dashboard dapat terhubung ke mojojojo_redis:6379"
  else
    fail "Dashboard TIDAK dapat terhubung ke mojojojo_redis:6379"
  fi
fi

# Worker image (node:20-alpine) punya ping.
if [[ -n "$WORKER_FAST_CONTAINER" ]]; then
  if docker exec "$WORKER_FAST_CONTAINER" sh -c "ping -c1 -W2 mojojojo_postgres >/dev/null 2>&1"; then
    pass "Worker fast dapat menjangkau postgres"
  else
    fail "Worker fast TIDAK dapat menjangkau postgres"
  fi

  if docker exec "$WORKER_FAST_CONTAINER" sh -c "ping -c1 -W2 mojojojo_redis >/dev/null 2>&1"; then
    pass "Worker fast dapat menjangkau redis"
  else
    fail "Worker fast TIDAK dapat menjangkau redis"
  fi
else
  fail "Tidak bisa cek konektivitas worker fast karena container tidak ditemukan"
fi

# ------------------------------------------------------------------
# 3. Login aplikasi
# ------------------------------------------------------------------
echo ""
echo "--- 3. Application Login ---"

if [[ -z "$ADMIN_PASS" ]]; then
  fail "ADMIN_PASS kosong. Berikan password via argumen ke-3 atau env ADMIN_PASS."
  echo ""
  echo "============================================================"
  echo "Hasil Akhir: $PASS PASS, $FAIL FAIL"
  echo "============================================================"
  exit 1
fi

LOGIN_RESPONSE=$(curl -s --max-time 15 -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
  "$BASE_URL/api/auth/login" || true)

if echo "$LOGIN_RESPONSE" | grep -q '"user"'; then
  pass "Login admin berhasil"
else
  fail "Login admin gagal: $LOGIN_RESPONSE"
fi

# ------------------------------------------------------------------
# 4. Koneksi API dasar
# ------------------------------------------------------------------
echo ""
echo "--- 4. Basic API Connectivity ---"

HEALTH_RESPONSE=$(curl -s --max-time 10 -b "$COOKIE_JAR" "$BASE_URL/api/health" || true)
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
  pass "GET /api/health OK"
  info "Health detail: $HEALTH_RESPONSE"
else
  fail "GET /api/health gagal: $HEALTH_RESPONSE"
fi

# ------------------------------------------------------------------
# 5. Worker status API
# ------------------------------------------------------------------
echo ""
echo "--- 5. BullMQ Worker Status ---"

WORKER_STATUS=$(curl -s --max-time 10 -b "$COOKIE_JAR" "$BASE_URL/api/admin/worker/status" || true)
if echo "$WORKER_STATUS" | grep -q '"status":"running"'; then
  WORKER_COUNT_JSON=$(echo "$WORKER_STATUS" | grep -o '"count":[0-9]*' | head -1 | cut -d: -f2)
  pass "Worker status API OK (active workers: ${WORKER_COUNT_JSON:-?})"
else
  fail "Worker status API gagal: $WORKER_STATUS"
fi

# ------------------------------------------------------------------
# 6. Insertion / koneksi PostgreSQL
# ------------------------------------------------------------------
echo ""
echo "--- 6. PostgreSQL Insert/Select/Delete ---"

PG_USER="${DB_USER:-${POSTGRES_USER:-mojojojo_user}}"
PG_PASS="${DB_PASSWORD:-${POSTGRES_PASSWORD:-}}"
PG_DB="${DB_NAME:-${POSTGRES_DB:-mojojojo_database}}"
PG_HOST="${DB_HOST:-mojojojo_postgres}"

if [[ -z "$PG_PASS" ]]; then
  fail "Password PostgreSQL tidak ditemukan di .env"
else
  # Buat tabel sementara, insert, select, lalu hapus
  if [[ -z "$POSTGRES_CONTAINER" ]]; then
    fail "Container postgres tidak ditemukan, skip DB insertion test"
  else
  PG_RESULT=$(docker exec -i "$POSTGRES_CONTAINER" psql \
    "postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:5432/${PG_DB}" \
    -v ON_ERROR_STOP=1 \
    -c "CREATE TABLE IF NOT EXISTS health_check (id SERIAL PRIMARY KEY, checked_at TIMESTAMP DEFAULT NOW(), source TEXT);" \
    -c "INSERT INTO health_check (source) VALUES ('health-check-script') RETURNING id;" \
    -c "SELECT COUNT(*) AS total FROM health_check WHERE source = 'health-check-script';" \
    -c "DELETE FROM health_check WHERE source = 'health-check-script';" 2>&1) || PG_RESULT="ERROR: $PG_RESULT"

  if echo "$PG_RESULT" | grep -q 'INSERT 0 1' && echo "$PG_RESULT" | grep -q 'DELETE'; then
    pass "PostgreSQL insert/select/delete berhasil"
  else
    fail "PostgreSQL insert/select/delete gagal: $PG_RESULT"
  fi
  fi
fi

# ------------------------------------------------------------------
# 7. Koneksi Redis
# ------------------------------------------------------------------
echo ""
echo "--- 7. Redis Set/Get/Delete ---"

REDIS_PASS="${REDIS_PASSWORD:-}"

if [[ -z "$REDIS_PASS" ]]; then
  fail "Password Redis tidak ditemukan di .env"
elif [[ -z "$REDIS_CONTAINER" ]]; then
  fail "Container redis tidak ditemukan, skip Redis test"
else
  REDIS_RESULT=$(docker exec -i "$REDIS_CONTAINER" redis-cli \
    -a "$REDIS_PASS" \
    --no-auth-warning \
    SET mojo:health:check OK EX 60 2>&1)

  REDIS_GET=$(docker exec -i "$REDIS_CONTAINER" redis-cli \
    -a "$REDIS_PASS" \
    --no-auth-warning \
    GET mojo:health:check 2>&1)

  docker exec -i "$REDIS_CONTAINER" redis-cli \
    -a "$REDIS_PASS" \
    --no-auth-warning \
    DEL mojo:health:check >/dev/null 2>&1 || true

  if [[ "$REDIS_RESULT" == "OK" && "$REDIS_GET" == "OK" ]]; then
    pass "Redis set/get/delete berhasil"
  else
    fail "Redis set/get/delete gagal: SET=$REDIS_RESULT GET=$REDIS_GET"
  fi
fi

# ------------------------------------------------------------------
# 8. Job queue end-to-end (optional, ringan)
# ------------------------------------------------------------------
echo ""
echo "--- 8. BullMQ Queue Read-Only Check ---"

JOBS_RESPONSE=$(curl -s --max-time 20 -b "$COOKIE_JAR" "$BASE_URL/api/admin/worker/jobs?limit=1&state=all" || true)
if [[ -z "$JOBS_RESPONSE" ]]; then
  fail "GET /api/admin/worker/jobs timeout atau tidak ada response"
elif echo "$JOBS_RESPONSE" | grep -q '"jobs"'; then
  pass "GET /api/admin/worker/jobs OK (queue dapat dibaca)"
else
  fail "GET /api/admin/worker/jobs gagal: $JOBS_RESPONSE"
fi

# ------------------------------------------------------------------
# Ringkasan
# ------------------------------------------------------------------
echo ""
echo "============================================================"
if [[ "$FAIL" -eq 0 ]]; then
  echo -e "${GREEN}✅ SEMUA PEMERIKSAAN BERHASIL${NC}: $PASS PASS, $FAIL FAIL"
else
  echo -e "${RED}❌ ADA PEMERIKSAAN YANG GAGAL${NC}: $PASS PASS, $FAIL FAIL"
fi
echo "============================================================"

exit "$FAIL"
