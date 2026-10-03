#!/usr/bin/env bash
# =============================================================================
# Mojo-Central Installer
# ACS/FTTH Monitoring System – Online & Offline (Air-Gapped) Deployment
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'

PROJECT="Mojo-Central"
REPO="https://github.com/kamaraditya2-gif/tsel_ftth.git"
INSTALL_DIR="/opt/mojo-central"
BUNDLE_DIR="/opt/mojo-central-bundle"

log()   { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; }
header(){ echo -e "\n${BOLD}$1${NC}\n$(printf '%*s' ${#1} '' | tr ' ' '=')"; }

# ---- Prerequisite check ----
check_prereqs() {
  header "Memeriksa Prasyarat"

  if ! command -v docker &>/dev/null; then
    warn "Docker belum terinstall."
    echo "  Install Docker: curl -fsSL https://get.docker.com | sh"
    echo "  Atau: sudo apt-get install -y docker.io"
    return 1
  fi
  ok "Docker: $(docker --version)"

  if docker compose version &>/dev/null; then
    ok "Docker Compose plugin: $(docker compose version --short)"
  elif command -v docker-compose &>/dev/null; then
    ok "Docker Compose: $(docker-compose --version)"
  else
    warn "Docker Compose belum terinstall."
    echo "  sudo apt-get install -y docker-compose-plugin"
    return 1
  fi

  if ! command -v openssl &>/dev/null; then
    warn "openssl tidak ditemukan, pakai password statis."
  fi
  ok "openssl tersedia"

  return 0
}

# ---- Generate .env ----
gen_env() {
  local env_file="$1/.env"
  if [ -f "$env_file" ]; then
    warn ".env sudah ada, lewati."
    return
  fi

  local pg_pass rd_pass sess_sec
  pg_pass=$(openssl rand -base64 32 2>/dev/null | tr -dc 'a-zA-Z0-9' | head -c 24 || echo "Mojo2024Secure!")
  rd_pass=$(openssl rand -base64 32 2>/dev/null | tr -dc 'a-zA-Z0-9' | head -c 24 || echo "Redis2024Secure!")
  sess_sec=$(openssl rand -base64 32 2>/dev/null || echo "mojo-central-session-secret-2024")

  cat > "$env_file" <<EOF
# ===== Mojo-Central Environment =====
# Database
POSTGRES_USER=mojo_db_user
POSTGRES_PASSWORD=${pg_pass}
POSTGRES_DB=mojo_db
DB_HOST=mojo-db
DB_PORT=5432
DB_USER=mojo_db_user
DB_PASSWORD=${pg_pass}
DB_NAME=mojo_db

# Redis
REDIS_PASSWORD=${rd_pass}
REDIS_HOST=mojo-redis
REDIS_PORT=6379
REDIS_PORT_INTERNAL=6379

# Worker
API_BASE_URL=http://mojo-central-dashboard:3000
PING_RATE_LIMIT_SECONDS=10
SPEED_RATE_LIMIT_SECONDS=10
AXIROS_CONFIG_TTL_MS=60000

# Direct Ping
DIRECT_PING_INTERVAL_MINUTES=10
DOWNSTREAM_SERVER_ID=1

# Dashboard
NEXT_PUBLIC_API_URL=/api
INTERNAL_API_URL=http://mojo-central-worker:3000
SESSION_SECRET=${sess_sec}
TZ=Asia/Jakarta
DASHBOARD_PORT=3002

# Nginx (ubah port jika 80/443 sudah terpakai)
NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443

# AI Chatbot (opsional)
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat

# Axiros ACS (isi sesuai lingkungan)
AXIROS_BASE_URL=http://your-axiros-server:8080
AXIROS_USERNAME=admin
AXIROS_PASSWORD=admin
EOF
  ok ".env dibuat dengan password acak."
}

# ---- Setup direktori ----
setup_dirs() {
  local base="$1"
  mkdir -p "$base"/{data/postgres,data/redis,config,migrations}
  ok "Direktori: $base"
}

# ====================================================================
# HTTPS
# ====================================================================
setup_https() {
  header "HTTPS — Self-Signed Certificate"

  check_prereqs || { err "Prerequisite gagal."; exit 1; }

  local dir="${INSTALL_DIR}"
  if [ ! -d "$dir/nginx" ]; then
    warn "Direktori project tidak ditemukan di $dir."
    read -rp "Lokasi project: " dir
    dir="${dir:-$INSTALL_DIR}"
  fi

  cd "$dir"

  log "Generate self-signed certificate..."
  bash scripts/generate-ssl-cert.sh
  ok "Sertifikat dibuat."

  log "Start Nginx dengan HTTPS..."
  docker compose -f docker-compose-nginx.yml up -d
  ok "Nginx berjalan di port 443 (HTTPS)."

  echo ""
  echo "=============================================="
  echo " HTTPS aktif!"
  echo " Dashboard: https://<IP_SERVER>:443"
  echo "=============================================="
  echo "CATATAN: Sertifikat self-signed, browser akan"
  echo "menampilkan peringatan. Klik 'Advanced' →"
  echo "'Proceed anyway' untuk melanjutkan."
  echo ""
  echo "Untuk production, gunakan Let's Encrypt:"
  echo "  ./install.sh  → menu 5"
}

setup_letsencrypt() {
  header "HTTPS — Let's Encrypt"

  check_prereqs || { err "Prerequisite gagal."; exit 1; }

  read -rp "Domain (contoh: monitoring.example.com): " domain
  [ -z "$domain" ] && { err "Domain wajib diisi."; return; }

  local dir="${INSTALL_DIR}"
  if [ ! -d "$dir" ]; then
    warn "Project tidak ditemukan di $dir."
    read -rp "Lokasi project: " dir
  fi

  cd "$dir"

  # Pastikan Nginx running di port 80
  if ! docker ps --format '{{.Names}}' | grep -q mojo-central-nginx; then
    log "Start Nginx (HTTP only untuk verifikasi domain)..."
    docker compose -f docker-compose-nginx.yml up -d nginx
    sleep 3
  fi

  log "Minta sertifikat untuk $domain..."
  bash scripts/letsencrypt-setup.sh "$domain"

  log "Restart Nginx..."
  docker compose -f docker-compose-nginx.yml restart nginx
  ok "HTTPS aktif! Dashboard: https://$domain"
}

# ====================================================================
# REGIONAL WORKER
# ====================================================================
deploy_regional() {
  header "REGIONAL FPING WORKER"

  echo "Script ini jalan di SERVER REGIONAL, bukan di VM pusat."
  echo ""
  read -rp "Nama region (contoh: sumut): " rname
  read -rp "ID region (angka, contoh: 2): " rid
  [ -z "$rname" ] && { err "Nama region wajib."; return; }
  [ -z "$rid" ] && { err "ID region wajib."; return; }

  if [ -f "regional/deploy-regional.sh" ]; then
    bash regional/deploy-regional.sh "$rname" "$rid"
  else
    warn "File regional/deploy-regional.sh tidak ditemukan."
    echo "Clone dulu repo ini di server regional, lalu jalankan:"
    echo "  cd mojo-central && bash regional/deploy-regional.sh $rname $rid"
  fi
}

# ---- Menu ----
  echo ""
  echo "=============================================="
  echo -e "  ${BOLD}$PROJECT — Installer${NC}"
  echo "=============================================="
  echo ""
  echo "  1) Install ONLINE  — clone git, build & deploy"
  echo "  2) PACKAGE offline — build image + bundling untuk server offline"
  echo "  3) Deploy OFFLINE  — deploy dari bundle yang sudah di-copy"
  echo "  4) HTTPS setup     — generate self-signed cert + aktifkan Nginx"
  echo "  5) Let's Encrypt    — SSL untuk public domain"
  echo "  6) Regional worker — deploy fping worker di server regional"
  echo "  7) Update code + rebuild"
  echo "  8) Hapus semua container + data"
  echo ""
  echo "  q) Keluar"
  echo ""
  read -rp "Pilih [1-8]: " choice

  case "$choice" in
    1) install_online ;;
    2) package_offline ;;
    3) deploy_offline ;;
    4) setup_https ;;
    5) setup_letsencrypt ;;
    6) deploy_regional ;;
    7) update_stack ;;
    8) uninstall ;;
    q|Q) echo "Selesai."; exit 0 ;;
    *) warn "Pilihan tidak valid."; menu ;;
  esac
}

# ====================================================================
# 1) ONLINE INSTALL
# ====================================================================
install_online() {
  header "ONLINE INSTALL"

  check_prereqs || { err "Prerequisite gagal."; exit 1; }

  if [ -d "$INSTALL_DIR" ]; then
    warn "Direktori $INSTALL_DIR sudah ada. Update kode..."
    cd "$INSTALL_DIR" && git pull origin main
  else
    log "Clone repository..."
    sudo mkdir -p "$INSTALL_DIR"
    sudo git clone "$REPO" "$INSTALL_DIR"
    sudo chown -R "$(whoami)" "$INSTALL_DIR"
    ok "Repository di-clone ke $INSTALL_DIR"
  fi

  cd "$INSTALL_DIR"
  gen_env "$INSTALL_DIR"
  setup_dirs "$INSTALL_DIR"

  # Copy config & migrations
  cp -n config/redis.conf.example config/redis.conf 2>/dev/null || true

  log "Build & start semua service..."
  docker compose up -d --build
  ok "Service started."

  log "Setup database..."
  sleep 5
  until docker exec mojo-db pg_isready -U mojo_db_user -d mojo_db &>/dev/null; do
    sleep 3
  done

  if [ -f schema.sql ]; then
    log "Import schema..."
    docker exec -i mojo-db psql -U mojo_db_user -d mojo_db < schema.sql
    ok "Schema imported."
  fi

  print_summary
}

# ====================================================================
# 2) PACKAGE OFFLINE
# ====================================================================
package_offline() {
  header "PACKAGE OFFLINE BUNDLE"

  check_prereqs || { err "Prerequisite gagal."; exit 1; }

  local bundle="${BUNDLE_DIR}"
  rm -rf "$bundle"
  mkdir -p "$bundle"

  log "Build images (mojo-worker, mojo-dashboard)..."
  cd "$INSTALL_DIR"
  if [ ! -d "$INSTALL_DIR" ]; then
    warn "$INSTALL_DIR tidak ditemukan. Clone dulu..."
    sudo mkdir -p "$INSTALL_DIR"
    sudo git clone "$REPO" "$INSTALL_DIR"
    sudo chown -R "$(whoami)" "$INSTALL_DIR"
  fi
  cd "$INSTALL_DIR"
  docker compose build
  ok "Build selesai."

  log "Dump database..."
  docker compose up -d postgres 2>/dev/null || true
  for i in $(seq 1 30); do
    docker exec mojo-db pg_isready -U mojo_db_user -d mojo_db &>/dev/null && break
    sleep 2
  done
  docker exec mojo-db sh -c 'pg_dump -U mojo_db_user --no-owner --no-privileges mojo_db > /tmp/db_dump.sql' 2>/dev/null
  docker cp mojo-db:/tmp/db_dump.sql "$bundle/db_dump.sql" 2>/dev/null || warn "DB dump gagal/tidak ada data."
  docker exec mojo-db rm -f /tmp/db_dump.sql 2>/dev/null || true

  log "Save images (butuh waktu)..."

  log "  Save mojo-dashboard:latest..."
  docker save mojo-dashboard:latest -o "$bundle/mojo-dashboard.tar" &

  log "  Save mojo-worker:latest..."
  docker save mojo-worker:latest -o "$bundle/mojo-worker.tar" &

  log "  Save postgres:15-alpine..."
  docker save postgres:15-alpine -o "$bundle/postgres.tar" &

  log "  Save redis:7-alpine..."
  docker save redis:7-alpine -o "$bundle/redis.tar" &

  wait
  ok "Semua image tersimpan."

  log "Salin konfigurasi..."
  cp docker-compose.offline.yml "$bundle/"
  cp deploy-offline.sh "$bundle/"
  cp -r config "$bundle/" 2>/dev/null || true
  cp -r migrations "$bundle/" 2>/dev/null || true
  cp schema.sql "$bundle/" 2>/dev/null || true
  rm -f "$bundle/config/redis.conf"
  [ -f config/redis.conf ] && cp config/redis.conf "$bundle/config/" || true
  gen_env "$bundle"

  # Buat deploy-offline.sh otomatis
  cat > "$bundle/deploy.sh" <<'DEPLOY'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "=============================================="
echo " Mojo-Central — Offline Deploy"
echo "=============================================="

[ ! -f .env ] && { echo "ERROR: .env tidak ditemukan."; exit 1; }

export $(grep -v '^\s*#' .env | xargs)

echo "[1/4] Load Docker images..."
for f in mojo-dashboard.tar mojo-worker.tar postgres.tar redis.tar; do
  [ -f "$f" ] && { echo "  Load $f..."; docker load -i "$f"; } || echo "  Skip $f (not found)"
done

echo "[2/4] Setup direktori..."
mkdir -p data/postgres data/redis config migrations

echo "[3/4] Start infrastructure..."
docker compose -f docker-compose.offline.yml up -d postgres redis

echo "  Tunggu postgres..."
until docker exec mojo-db pg_isready -U "${POSTGRES_USER:-mojo_db_user}" -d "${POSTGRES_DB:-mojo_db}" >/dev/null 2>&1; do sleep 2; done

echo "[4/4] Restore database & start services..."
if [ -f db_dump.sql ]; then
  echo "  Restore db_dump.sql..."
  docker exec -i mojo-db psql -U "${POSTGRES_USER:-mojo_db_user}" -d "${POSTGRES_DB:-mojo_db}" < db_dump.sql
elif [ -f schema.sql ]; then
  echo "  Import schema.sql..."
  docker exec -i mojo-db psql -U "${POSTGRES_USER:-mojo_db_user}" -d "${POSTGRES_DB:-mojo_db}" < schema.sql
fi

docker compose -f docker-compose.offline.yml up -d

echo ""
echo "=============================================="
echo " SELESAI! Dashboard: http://<IP>:3002"
echo "=============================================="
docker compose -f docker-compose.offline.yml ps
DEPLOY
  chmod +x "$bundle/deploy.sh"

  local size
  size=$(du -sh "$bundle" | cut -f1)
  ok "Bundle siap: $bundle ($size)"
  echo ""
  echo "------------------------------------------------------"
  echo " Cara deploy di server OFFLINE:"
  echo "  1. Copy folder $bundle ke server tujuan"
  echo "  2. cd ke folder bundle"
  echo "  3. chmod +x deploy.sh && ./deploy.sh"
  echo "------------------------------------------------------"
}

# ====================================================================
# 3) DEPLOY OFFLINE
# ====================================================================
deploy_offline() {
  header "DEPLOY OFFLINE"

  check_prereqs || { err "Prerequisite gagal."; exit 1; }

  local dir
  read -rp "Lokasi folder bundle [${BUNDLE_DIR}]: " dir
  dir="${dir:-$BUNDLE_DIR}"

  if [ ! -f "$dir/docker-compose.offline.yml" ]; then
    err "Folder bundle tidak valid (tidak ada docker-compose.offline.yml)."
    exit 1
  fi

  cd "$dir"

  log "Load images dari file .tar..."
  for f in mojo-dashboard.tar mojo-worker.tar postgres.tar redis.tar; do
    [ -f "$f" ] && { docker load -i "$f"; ok "Loaded $f"; } || warn "$f tidak ditemukan"
  done

  setup_dirs "$dir"

  [ ! -f .env ] && gen_env "$dir"

  log "Start infrastructure..."
  docker compose -f docker-compose.offline.yml up -d postgres redis

  log "Tunggu postgres..."
  until docker exec mojo-db pg_isready -U mojo_db_user -d mojo_db &>/dev/null; do
    sleep 2
  done
  ok "Postgres siap."

  log "Setup database..."
  if [ -f db_dump.sql ]; then
    docker exec -i mojo-db psql -U mojo_db_user -d mojo_db < db_dump.sql
    ok "Restore db_dump.sql."
  elif [ -f schema.sql ]; then
    docker exec -i mojo-db psql -U mojo_db_user -d mojo_db < schema.sql
    ok "Schema imported."
  else
    warn "Tidak ada database dump/schema. DB kosong."
  fi

  log "Start semua service..."
  docker compose -f docker-compose.offline.yml up -d

  print_summary
}

# ====================================================================
# 4) UPDATE
# ====================================================================
update_stack() {
  header "UPDATE"

  if [ ! -d "$INSTALL_DIR" ]; then
    err "Belum ada instalasi di $INSTALL_DIR."
    exit 1
  fi

  cd "$INSTALL_DIR"
  log "Git pull..."
  git pull origin main
  ok "Code updated."

  log "Rebuild & restart..."
  docker compose up -d --build
  ok "Service restarted."
}

# ====================================================================
# 5) UNINSTALL
# ====================================================================
uninstall() {
  header "UNINSTALL"
  echo -e "${RED}PERINGATAN: Ini akan menghapus SEMUA container, volume, dan data!${NC}"
  read -rp "Lanjutkan? (ketik 'HAPUS'): " confirm
  [ "$confirm" != "HAPUS" ] && { warn "Dibatalkan."; return; }

  cd "$INSTALL_DIR" 2>/dev/null || true
  docker compose down -v 2>/dev/null || true
  sudo rm -rf "$INSTALL_DIR" "$BUNDLE_DIR" 2>/dev/null || true
  ok "Semua data dan container dihapus."
}

# ====================================================================
# SUMMARY
# ====================================================================
print_summary() {
  local ip
  ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

  echo ""
  echo "=============================================="
  echo -e "  ${GREEN}${BOLD}$PROJECT — Selesai!${NC}"
  echo "=============================================="
  echo ""
  echo -e "  ${CYAN}Dashboard:${NC}  http://${ip}:${DASHBOARD_PORT:-3002}"
  echo -e "  ${CYAN}Login:${NC}      admin / admin123"
  echo ""
  echo "  Container:"
  echo "    mojo-central-dashboard          (Dashboard)"
  echo "    mojo-central-worker-fast        (Ping/Traceroute/ONT)"
  echo "    mojo-central-worker-download    (Speed Download)"
  echo "    mojo-central-worker-upload      (Speed Upload)"
  echo "    mojo-central-direct-ping-worker (Direct ICMP Ping)"
  echo "    mojo-central-dispatcher         (Cron Scheduler)"
  echo "    mojo-db           (Database)"
  echo "    mojo-redis              (Queue Broker)"
  echo ""
  echo "  Perintah:"
  echo "    cd ${INSTALL_DIR:-.}/ && docker compose logs -f"
  echo "    cd ${INSTALL_DIR:-.}/ && docker compose ps"
  echo "=============================================="
}

# ====================================================================
# MAIN
# ====================================================================
if [ $# -gt 0 ]; then
  case "$1" in
    online)     install_online ;;
    package)    package_offline ;;
    offline)    deploy_offline ;;
    https)      setup_https ;;
    letsencrypt) setup_letsencrypt ;;
    regional)   deploy_regional ;;
    update)     update_stack ;;
    uninstall)  uninstall ;;
    *)          echo "Usage: $0 {online|package|offline|https|letsencrypt|regional|update|uninstall}"; exit 1 ;;
  esac
else
  menu
fi
