#!/bin/bash

# Script untuk build dan save Docker images (dijalankan di laptop/server berinternet)
# Penggunaan: ./bundle-app.sh [version]
# Contoh: ./bundle-app.sh v2

VERSION=${1:-latest}
OUTPUT_FILE="mojo_update_$VERSION.tar"

echo "🚀 Memulai proses bundling versi: $VERSION..."
echo "=========================================="

# 1. Build Image Worker & Dashboard
echo "📦 Building worker image..."
docker build -t mojo-worker:$VERSION ./worker
if [ $? -ne 0 ]; then
    echo "❌ Gagal build worker image"
    exit 1
fi

echo "📦 Building dashboard image..."
docker build -t mojo-dashboard:$VERSION ./dashboard
if [ $? -ne 0 ]; then
    echo "❌ Gagal build dashboard image"
    exit 1
fi

# 2. Save images ke file TAR
echo "💾 Saving images to $OUTPUT_FILE..."
docker save -o $OUTPUT_FILE \
    mojo-worker:$VERSION \
    mojo-dashboard:$VERSION \
    postgres:15-alpine \
    redis:alpine \
    nginx:alpine

if [ $? -ne 0 ]; then
    echo "❌ Gagal save images"
    exit 1
fi

# 3. Tampilkan ukuran file
FILE_SIZE=$(du -h $OUTPUT_FILE | cut -f1)
echo "=========================================="
echo "✅ Selesai! File: $OUTPUT_FILE"
echo "📊 Ukuran: $FILE_SIZE"
echo "💡 Silakan pindahkan file $OUTPUT_FILE ke Flashdisk"
