#!/bin/bash

# Script untuk deploy di server offline
# Penggunaan: ./deploy-offline.sh [nama_file_tar]
# Contoh: ./deploy-offline.sh mojo_update_v2.tar

INPUT_FILE=${1}

if [ -z "$INPUT_FILE" ]; then
    echo "❌ Error: Masukkan nama file tar"
    echo "💡 Contoh: ./deploy-offline.sh mojo_update_v2.tar"
    exit 1
fi

if [ ! -f "$INPUT_FILE" ]; then
    echo "❌ Error: File $INPUT_FILE tidak ditemukan"
    exit 1
fi

echo "📥 Loading images dari $INPUT_FILE..."
docker load -i $INPUT_FILE

if [ $? -ne 0 ]; then
    echo "❌ Gagal load images"
    exit 1
fi

echo "🔄 Menjalankan ulang container..."
docker compose -f docker-compose-app.yml up -d --remove-orphans

if [ $? -ne 0 ]; then
    echo "❌ Gagal restart container"
    exit 1
fi

echo "📊 Status Container:"
docker compose -f docker-compose-app.yml ps

echo ""
echo "✅ Deploy selesai!"
echo "💡 Cek logs dengan: docker compose -f docker-compose-app.yml logs -f"
