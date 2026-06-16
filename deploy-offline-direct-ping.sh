#!/usr/bin/env bash
#
# Deploy Direct Ping Worker di mesin terpisah (offline).
#
# Prasyarat:
#   - docker + docker compose plugin sudah terpasang
#   - Mesin ini bisa reach PostgreSQL di bundle utama (DB_HOST di .env = IP server postgres)
#
# Jalankan dari DALAM folder offline-bundle-direct-ping:
#   chmod +x deploy-offline-direct-ping.sh
#   ./deploy-offline-direct-ping.sh
#
# PASTIKA .env sudah diedit:
#   DB_HOST=<IP_SERVER_POSTGRES>   (BUKAN mojojojo_postgres)
#   DB_PASSWORD=<password>

set -euo pipefail
cd "$(dirname "$0")"

echo "=============================================="
echo " Deploy Direct Ping Worker (offline)"
echo "=============================================="

# 1. Load image
echo ""
echo "[1/2] Memuat image..."
docker load -i direct-ping-image.tar

# 2. Start direct-ping-worker
echo ""
echo "[2/2] Menjalankan Direct Ping Worker..."
docker compose -f docker-compose.offline-direct-ping.yml up -d

echo ""
echo "=============================================="
echo " Selesai!"
echo "=============================================="
docker compose -f docker-compose.offline-direct-ping.yml ps
echo ""
echo "Direct Ping Worker berjalan dan akan ping semua device setiap ${DIRECT_PING_INTERVAL_MINUTES:-10} menit."
echo "Logs: docker compose -f docker-compose.offline-direct-ping.yml logs -f"
