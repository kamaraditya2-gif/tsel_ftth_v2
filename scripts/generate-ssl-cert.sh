#!/usr/bin/env bash
# =============================================================================
# Generate self-signed SSL certificate untuk internal/offline use
# =============================================================================
# Usage:
#   ./scripts/generate-ssl-cert.sh [IP|hostname ...]
#
# Isi argumen dengan IP/hostname yang dipakai browser dan mojo-edge untuk
# mengakses server ini, supaya sertifikat bisa diverifikasi (bukan di-skip):
#   ./scripts/generate-ssl-cert.sh 10.0.2.21 mojo-central.lan
#
# Tanpa argumen, IP utama server dideteksi otomatis.
# Masa berlaku: DAYS=3650 (default 10 tahun).
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SSL_DIR="$SCRIPT_DIR/../nginx/ssl"

mkdir -p "$SSL_DIR"

DAYS=${DAYS:-3650}
CERT_FILE="$SSL_DIR/cert.pem"
KEY_FILE="$SSL_DIR/key.pem"

NAMES=("$@")
if [ ${#NAMES[@]} -eq 0 ]; then
  detected=$(hostname -I 2>/dev/null | awk '{print $1}')
  [ -n "$detected" ] && NAMES=("$detected")
fi

SAN="DNS:localhost,IP:127.0.0.1"
for name in "${NAMES[@]}"; do
  if [[ "$name" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    SAN="$SAN,IP:$name"
  else
    SAN="$SAN,DNS:$name"
  fi
done
CN=${NAMES[0]:-localhost}

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
  echo "Sertifikat sudah ada:"
  echo "  $CERT_FILE"
  echo "  $KEY_FILE"
  read -rp "Generate ulang? (y/N): " confirm
  [ "$confirm" != "y" ] && [ "$confirm" != "Y" ] && { echo "Dibatalkan."; exit 0; }
fi

echo "Generate self-signed certificate (${DAYS} days)"
echo "  subjectAltName: $SAN"

openssl req -x509 -nodes -days "$DAYS" -newkey rsa:2048 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -subj "/C=ID/ST=Jakarta/L=Jakarta/O=Mojo-Central/OU=IT/CN=$CN" \
  -addext "subjectAltName=$SAN" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,digitalSignature,keyEncipherment,keyCertSign" \
  -addext "extendedKeyUsage=serverAuth"

chmod 600 "$KEY_FILE"

echo ""
echo "Selesai! Sertifikat tersimpan di:"
echo "  Cert: $CERT_FILE"
echo "  Key:  $KEY_FILE"
echo ""
echo "Salin $CERT_FILE ke mojo-edge sebagai CA yang dipercaya."
echo ""
echo "Jalankan ulang Nginx:"
echo "  docker compose -f docker-compose-nginx.yml restart"
