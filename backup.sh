#!/bin/bash

# Script untuk backup database PostgreSQL
# Penggunaan: ./backup.sh

BACKUP_DIR="./backups"
BACKUP_NAME="backup_acs_$(date +%Y%m%d_%H%M%S).sql"

# Buat folder backup jika belum ada
mkdir -p $BACKUP_DIR

echo "🗄️  Memulai backup database..."
docker exec mojojojo_postgres pg_dump -U mojojojo_user mojojojo_database > $BACKUP_DIR/$BACKUP_NAME

if [ $? -ne 0 ]; then
    echo "❌ Gagal backup database"
    exit 1
fi

# Kompres backup
gzip $BACKUP_DIR/$BACKUP_NAME
BACKUP_NAME_GZ="$BACKUP_NAME.gz"

FILE_SIZE=$(du -h $BACKUP_DIR/$BACKUP_NAME_GZ | cut -f1)
echo "✅ Backup selesai: $BACKUP_DIR/$BACKUP_NAME_GZ"
echo "📊 Ukuran: $FILE_SIZE"

# Cek apakah USB terpasang (opsional)
if [ -d "/media/usb" ] || [ -d "/mnt/usb" ]; then
    USB_MOUNT="/media/usb"
    if [ ! -d "/media/usb" ]; then
        USB_MOUNT="/mnt/usb"
    fi
    echo "💾 USB terdeteksi di $USB_MOUNT"
    cp $BACKUP_DIR/$BACKUP_NAME_GZ $USB_MOUNT/
    echo "✅ Berhasil disalin ke USB!"
fi
