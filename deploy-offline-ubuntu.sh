#!/usr/bin/env bash
#
# Deploy stack di server Ubuntu offline (air-gapped).
#
# Rekomendasi lokasi di server: /opt/mojojojo/
#   sudo mkdir -p /opt/mojojojo
#   sudo chown $USER:$USER /opt/mojojojo
#   cp -r offline-bundle/* /opt/mojojojo/
#   cd /opt/mojojojo
#   chmod +x deploy-offline-ubuntu.sh
#   ./deploy-offline-ubuntu.sh
#
# Prasyarat di server: docker + docker compose plugin sudah terpasang.

set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.offline.yml"

echo "=============================================="
echo " Deploy offline - MojoJojo Monitor"
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
until docker exec mojojojo_postgres pg_isready -U "${POSTGRES_USER:-mojojojo_user}" -d "${POSTGRES_DB:-mojojojo_database}" >/dev/null 2>&1; do
  sleep 2
done
echo "      Postgres siap."

# 4. Inisialisasi / restore database
echo ""
echo "[4/5] Setup database..."
DB_USER_EFF="${DB_USER:-mojojojo_user}"
DB_NAME_EFF="${DB_NAME:-mojojojo_database}"

# Cek apakah database sudah berisi tabel (skip jika sudah ada data, mis. data dir lama)
TABLE_COUNT=$(docker exec mojojojo_postgres psql -U "$DB_USER_EFF" -d "$DB_NAME_EFF" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "0")

if [ "${TABLE_COUNT:-0}" -gt 0 ]; then
  echo "      Database sudah berisi $TABLE_COUNT tabel -> lewati import."
elif [ -f db_dump.sql ]; then
  echo "      Restore dari db_dump.sql (schema + data)..."
  docker exec -i mojojojo_postgres psql -U "$DB_USER_EFF" -d "$DB_NAME_EFF" < db_dump.sql
elif [ -f schema.sql ]; then
  echo "      Import schema.sql (DB fresh)..."
  docker exec -i mojojojo_postgres psql -U "$DB_USER_EFF" -d "$DB_NAME_EFF" < schema.sql
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
