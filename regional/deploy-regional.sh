#!/usr/bin/env bash
# =============================================================================
# Deploy Regional Direct Ping Worker
# =============================================================================
# Script ini dijalankan DI SERVER REGIONAL (bukan di VM pusat).
#
# Prasyarat:
#   - Docker sudah terinstall
#   - Network ke VM pusat port 5432 terbuka
#   - Image mojo-worker:latest sudah tersedia (via pull atau load tar)
#
# Cara pakai:
#   ./deploy-regional.sh                    # Prompt interaktif
#   ./deploy-regional.sh sumut 2            # Langsung: nama=sumut, id=2
#   ./deploy-regional.sh jateng 3           # Langsung: nama=jateng, id=3
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }

REGION_NAME="${1:-}"
REGION_ID="${2:-}"

if [ -z "$REGION_NAME" ]; then
  echo ""
  echo "=============================================="
  echo "  Deploy Regional Fping Worker"
  echo "=============================================="
  echo ""
  read -rp "Nama region (contoh: sumut): " REGION_NAME
  read -rp "ID region (angka, contoh: 2): " REGION_ID
fi

echo ""
log "Region : ${REGION_NAME^^} (ID: $REGION_ID)"

# ── 1. Check Prerequisites ──
log "Memeriksa Docker..."
if ! command -v docker &>/dev/null; then
  warn "Docker tidak ditemukan. Install dulu:"
  echo "  curl -fsSL https://get.docker.com | sh"
  exit 1
fi
ok "Docker tersedia"

# ── 2. Check Image ──
log "Memeriksa image mojo-worker:latest..."
if ! docker image inspect mojo-worker:latest &>/dev/null; then
  warn "Image mojo-worker:latest belum ada."
  echo ""
  echo "  Opsi 1: Pull dari registry (butuh internet)"
  echo "    docker pull mojo-worker:latest"
  echo ""
  echo "  Opsi 2: Load dari file .tar (offline)"
  echo "    docker load -i mojo-worker.tar"
  echo ""
  read -rp "  Load image dari file .tar? (y/N): " load_choice
  if [ "$load_choice" = "y" ] || [ "$load_choice" = "Y" ]; then
    read -rp "  Path file .tar: " tar_path
    docker load -i "$tar_path"
  else
    warn "Tidak bisa lanjut tanpa image. Jalankan ulang setelah image tersedia."
    exit 1
  fi
fi
ok "Image mojo-worker:latest siap"

# ── 3. Create docker-compose file ──
log "Membuat docker-compose.yml untuk region ${REGION_NAME^^}..."

cat > docker-compose.yml <<EOF
services:
  fping-${REGION_NAME}:
    image: mojo-worker:latest
    container_name: fping_${REGION_NAME}
    restart: always
    cap_add:
      - NET_RAW
    environment:
      DB_HOST: \${DB_HOST:-103.143.12.115}
      DB_PORT: \${DB_PORT:-5432}
      DB_USER: \${DB_USER:-mojo_db_user}
      DB_PASSWORD: \${DB_PASSWORD:-QG4CXVN4jbTKrjvdiiEjihOO}
      DB_NAME: \${DB_NAME:-mojo_db}
      DOWNSTREAM_SERVER_ID: ${REGION_ID}
      DIRECT_PING_INTERVAL_MINUTES: \${INTERVAL:-10}
      PING_BATCH_SIZE: \${BATCH:-500}
    command: ["node", "start-direct-ping-worker.js"]
EOF

ok "docker-compose.yml dibuat"

# ── 4. Test koneksi ke DB pusat ──
log "Test koneksi ke database pusat..."
DB_HOST="${DB_HOST:-103.143.12.115}"
DB_PORT="${DB_PORT:-5432}"

if timeout 5 bash -c "echo > /dev/tcp/${DB_HOST}/${DB_PORT}" 2>/dev/null; then
  ok "Koneksi ke ${DB_HOST}:${DB_PORT} berhasil"
else
  warn "Tidak bisa reach ${DB_HOST}:${DB_PORT}"
  echo "  Pastikan:"
  echo "  - Server pusat menyala"
  echo "  - Firewall VM pusat allow port 5432 dari IP server ini"
  echo "  - IP server ini: $(curl -s ifconfig.me 2>/dev/null || echo '?')"
  echo ""
  read -rp "  Tetap lanjut? (y/N): " proceed
  if [ "$proceed" != "y" ] && [ "$proceed" != "Y" ]; then
    warn "Dibatalkan."
    exit 1
  fi
fi

# ── 5. Start container ──
log "Menjalankan container fping_${REGION_NAME}..."
docker compose up -d
ok "Container fping_${REGION_NAME} started!"

# ── 6. Verify ──
sleep 3
log "Verifikasi..."
docker ps --filter "name=fping_${REGION_NAME}" --format '{{.Names}} {{.Status}}'

echo ""
echo "=============================================="
echo -e "  ${GREEN}Regional Worker ${REGION_NAME^^} Aktif!${NC}"
echo "=============================================="
echo ""
echo "  Container: fping_${REGION_NAME}"
echo "  Region ID: ${REGION_ID}"
echo "  DB Host:   ${DB_HOST}:${DB_PORT}"
echo "  Interval:  ${INTERVAL:-10} menit"
echo ""
echo "  Cek log:"
echo "    docker logs -f fping_${REGION_NAME}"
echo ""
echo "  Cek data masuk ke database:"
echo "    SELECT device_id, avg_latency_ms, packet_loss_percent"
echo "    FROM test_results_direct_ping"
echo "    WHERE downstream_server_id = ${REGION_ID}"
echo "    ORDER BY created_at DESC LIMIT 5;"
echo ""
echo "=============================================="
