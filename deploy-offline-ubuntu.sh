#!/usr/bin/env bash
#
# Deploy stack di server Ubuntu offline (air-gapped).
#
# Rekomendasi lokasi di server: /opt/mojo-central/
#   sudo mkdir -p /opt/mojo-central
#   sudo chown $USER:$USER /opt/mojo-central
#   cp -r offline-bundle/* /opt/mojo-central/
#   cd /opt/mojo-central
#   chmod +x deploy-offline-ubuntu.sh
#   ./deploy-offline-ubuntu.sh
#
# Prasyarat di server: docker + docker compose plugin sudah terpasang.

set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.offline.yml"

echo "=============================================="
echo " Deploy offline - Mojo-Central"
echo "=============================================="

# 1. Load images
echo ""
echo "[1/5] Memuat images dari images.tar..."
docker load -i images.tar

# 2. Siapkan folder data (bind mount)
echo ""
echo "[2/5] Menyiapkan folder data..."
mkdir -p data/postgres data/redis

# 3. Start database + redis lebih dulu
echo ""
echo "[3/5] Menjalankan postgres & redis..."
$COMPOSE up -d postgres redis

echo "      Menunggu postgres siap..."
until docker exec mojo-db pg_isready -U "${POSTGRES_USER:-mojo_db_user}" -d "${POSTGRES_DB:-mojo_db}" >/dev/null 2>&1; do
  sleep 2
done
echo "      Postgres siap."

# 4. Inisialisasi / restore database
echo ""
echo "[4/5] Setup database..."
DB_USER_EFF="${DB_USER:-mojo_db_user}"
DB_NAME_EFF="${DB_NAME:-mojo_db}"

# Cek apakah database sudah berisi tabel (skip jika sudah ada data, mis. data dir lama)
TABLE_COUNT=$(docker exec mojo-db psql -U "$DB_USER_EFF" -d "$DB_NAME_EFF" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "0")

if [ "${TABLE_COUNT:-0}" -gt 0 ]; then
  echo "      Database sudah berisi $TABLE_COUNT tabel -> lewati import."
elif [ -f db_dump.sql ]; then
  echo "      Restore dari db_dump.sql (schema + data)..."
  docker exec -i mojo-db psql -U "$DB_USER_EFF" -d "$DB_NAME_EFF" < db_dump.sql
elif [ -f schema.sql ]; then
  echo "      Import schema.sql (DB fresh)..."
  docker exec -i mojo-db psql -U "$DB_USER_EFF" -d "$DB_NAME_EFF" < schema.sql
else
  echo "      WARNING: tidak ada db_dump.sql / schema.sql. DB dibiarkan kosong."
fi

# 5. Start seluruh service
echo ""
echo "[5/5] Menjalankan seluruh service..."
$COMPOSE up -d

echo ""
echo "=============================================="
echo " Selesai!"
echo "=============================================="
$COMPOSE ps
echo ""
echo "Dashboard: http://<IP-SERVER>:${DASHBOARD_PORT:-3002}"
echo "Logs     : $COMPOSE logs -f mojo_worker"
