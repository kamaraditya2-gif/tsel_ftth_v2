#!/usr/bin/env bash
# =============================================================================
# Generate self-signed SSL certificate untuk internal/offline use
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SSL_DIR="$SCRIPT_DIR/../nginx/ssl"

mkdir -p "$SSL_DIR"

DAYS=${1:-3650}             # default 10 tahun
CERT_FILE="$SSL_DIR/cert.pem"
KEY_FILE="$SSL_DIR/key.pem"

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
  echo "Sertifikat sudah ada:"
  echo "  $CERT_FILE"
  echo "  $KEY_FILE"
  read -rp "Generate ulang? (y/N): " confirm
  [ "$confirm" != "y" ] && [ "$confirm" != "Y" ] && { echo "Dibatalkan."; exit 0; }
fi

echo "Generate self-signed certificate (${DAYS} days)..."

openssl req -x509 -nodes -days "$DAYS" -newkey rsa:2048 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -subj "/C=ID/ST=Jakarta/L=Jakarta/O=MojoJojoMonitor/OU=IT/CN=*" \
  -addext "subjectAltName=DNS:*,DNS:localhost,IP:127.0.0.1"

chmod 600 "$KEY_FILE"

echo ""
echo "Selesai! Sertifikat tersimpan di:"
echo "  Cert: $CERT_FILE"
echo "  Key:  $KEY_FILE"
echo ""
echo "Jalankan ulang Nginx:"
echo "  docker compose -f docker-compose-nginx.yml restart"
