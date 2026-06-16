#!/usr/bin/env bash
# =============================================================================
# Let's Encrypt SSL certificate — untuk production / public domain
# =============================================================================
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-admin@${DOMAIN}}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: $0 <domain.com> [email]"
  echo ""
  echo "Contoh: $0 monitoring.example.com admin@example.com"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."
SSL_DIR="$PROJECT_DIR/nginx/ssl"

mkdir -p "$SSL_DIR" "$PROJECT_DIR/data/certbot"

echo "=============================================="
echo " Let's Encrypt — $DOMAIN"
echo "=============================================="

# Pastikan Nginx jalan dengan config HTTP-only dulu
if ! docker ps --format '{{.Names}}' | grep -q mojojojo_nginx; then
  echo ""
  echo "Jalankan Nginx dulu dengan config yang support HTTP:"
  echo "  docker compose -f docker-compose-nginx.yml up -d"
  exit 1
fi

echo ""
echo "Step 1: Request certificate..."
echo ""

docker run --rm \
  -v "$SSL_DIR:/etc/letsencrypt/live/$DOMAIN" \
  -v "$PROJECT_DIR/data/certbot:/var/www/certbot" \
  -p 80:80 \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive \
  --cert-name "$DOMAIN" \
  --key-type rsa \
  2>&1 || true

# Copy cert ke direktori SSL
if [ -f "$SSL_DIR/fullchain.pem" ]; then
  cp "$SSL_DIR/fullchain.pem" "$SSL_DIR/cert.pem"
  cp "$SSL_DIR/privkey.pem" "$SSL_DIR/key.pem"
  chmod 600 "$SSL_DIR/key.pem"
  echo ""
  echo "Sertifikat tersimpan:"
  echo "  Cert: $SSL_DIR/cert.pem"
  echo "  Key:  $SSL_DIR/key.pem"
  echo ""
  echo "Restart Nginx:"
  echo "  docker compose -f docker-compose-nginx.yml restart"
else
  echo ""
  echo "ERROR: Gagal mendapatkan sertifikat."
  echo "Pastikan domain $DOMAIN mengarah ke IP server ini dan port 80 terbuka."
fi
