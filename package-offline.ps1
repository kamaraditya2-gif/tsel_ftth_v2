<#
.SYNOPSIS
  Mengemas seluruh stack ke folder offline-bundle/ untuk dipindahkan ke server Ubuntu air-gapped.

.DESCRIPTION
  Langkah yang dilakukan:
    1. Build image (mojo-worker, mojo-dashboard) dari docker-compose.yml
    2. Dump database (schema + data) ke db_dump.sql  (lewati dengan -NoData)
    3. docker save semua image -> offline-bundle/images.tar
    4. Salin file konfigurasi yang dibutuhkan ke offline-bundle/

.PARAMETER NoData
  Jangan ikutkan dump database (untuk instalasi DB fresh di server tujuan).

.EXAMPLE
  ./package-offline.ps1
  ./package-offline.ps1 -NoData
#>

param(
  [switch]$NoData
)

$ErrorActionPreference = 'Stop'
$Root   = $PSScriptRoot
$Bundle = Join-Path $Root 'offline-bundle'

$Images = @(
  'mojo-worker:latest',
  'mojo-dashboard:latest',
  'postgres:15-alpine',
  'redis:7-alpine'
)

Write-Host '==============================================' -ForegroundColor Cyan
Write-Host ' Packaging stack untuk deployment offline' -ForegroundColor Cyan
Write-Host '==============================================' -ForegroundColor Cyan

# 0. Reset folder bundle
if (Test-Path $Bundle) { Remove-Item -Recurse -Force $Bundle }
New-Item -ItemType Directory -Force -Path $Bundle | Out-Null

# 1. Build images
Write-Host "`n[1/4] Build images (mojo-worker, mojo-dashboard)..." -ForegroundColor Yellow
docker compose -f (Join-Path $Root 'docker-compose.yml') build
if ($LASTEXITCODE -ne 0) { throw 'Build image gagal' }

# 2. Dump database
if (-not $NoData) {
  Write-Host "`n[2/4] Dump database..." -ForegroundColor Yellow

  # Pastikan postgres berjalan untuk di-dump
  docker compose -f (Join-Path $Root 'docker-compose.yml') up -d postgres | Out-Null

  Write-Host '      Menunggu postgres siap...'
  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    docker exec mojo-db pg_isready -U mojo_db_user -d mojo_db *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 2
  }
  if (-not $ready) { throw 'Postgres tidak siap untuk di-dump' }

  # Dump ke dalam container lalu copy keluar (hindari masalah encoding redirect PowerShell)
  docker exec mojo-db sh -c 'pg_dump -U mojo_db_user --no-owner --no-privileges mojo_db > /tmp/db_dump.sql'
  if ($LASTEXITCODE -ne 0) { throw 'pg_dump gagal' }
  docker cp mojo-db:/tmp/db_dump.sql (Join-Path $Bundle 'db_dump.sql')
  docker exec mojo-db rm -f /tmp/db_dump.sql
  Write-Host '      db_dump.sql tersimpan.'
} else {
  Write-Host "`n[2/4] Lewati dump database (-NoData)." -ForegroundColor Yellow
}

# 3. Save images
Write-Host "`n[3/4] Menyimpan images ke images.tar (bisa beberapa menit)..." -ForegroundColor Yellow
docker save -o (Join-Path $Bundle 'images.tar') @Images
if ($LASTEXITCODE -ne 0) { throw 'docker save gagal' }

# 4. Salin file pendukung
Write-Host "`n[4/4] Menyalin file konfigurasi..." -ForegroundColor Yellow
Copy-Item (Join-Path $Root 'docker-compose.offline.yml') $Bundle
Copy-Item (Join-Path $Root '.env')                       $Bundle
Copy-Item (Join-Path $Root 'schema.sql')                 $Bundle -ErrorAction SilentlyContinue
Copy-Item (Join-Path $Root 'deploy-offline-ubuntu.sh')   $Bundle -ErrorAction SilentlyContinue
Copy-Item (Join-Path $Root 'config')     (Join-Path $Bundle 'config')     -Recurse
Copy-Item (Join-Path $Root 'migrations') (Join-Path $Bundle 'migrations') -Recurse

# 5. Bundle Direct Ping Worker (terpisah)
Write-Host "`n[5/5] Membuat bundle Direct Ping Worker terpisah..." -ForegroundColor Yellow
$BundleDP = Join-Path $Root 'offline-bundle-direct-ping'
if (Test-Path $BundleDP) { Remove-Item -Recurse -Force $BundleDP }
New-Item -ItemType Directory -Force -Path $BundleDP | Out-Null

Copy-Item (Join-Path $Root 'docker-compose.offline-direct-ping.yml') $BundleDP
Copy-Item (Join-Path $Root '.env')                                   $BundleDP
Copy-Item (Join-Path $Root 'deploy-offline-direct-ping.sh')          $BundleDP -ErrorAction SilentlyContinue

# Simpan hanya mojo-worker image untuk direct-ping bundle
$ImageFile = Join-Path $BundleDP 'direct-ping-image.tar'
docker save -o $ImageFile 'mojo-worker:latest'
if ($LASTEXITCODE -ne 0) { throw 'docker save direct-ping gagal' }

Write-Host '      direct-ping-image.tar tersimpan.'

# Summary
$sizeMain = (Get-ChildItem $Bundle -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
$sizeDP   = (Get-ChildItem $BundleDP -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB

Write-Host "`n==============================================" -ForegroundColor Green
Write-Host (' Bundle UTAMA   : {0} ({1:N1} MB)' -f $Bundle, $sizeMain)  -ForegroundColor Green
Write-Host (' Bundle DP      : {0} ({1:N1} MB)' -f $BundleDP, $sizeDP)    -ForegroundColor Green
Write-Host '==============================================' -ForegroundColor Green

Write-Host "`n--- BUNDLE UTAMA (dashboard + worker + dispatcher + postgres + redis) ---"
Write-Host 'Pindahkan SELURUH folder offline-bundle ke server Ubuntu, lalu jalankan:'
Write-Host '  chmod +x deploy-offline-ubuntu.sh && ./deploy-offline-ubuntu.sh'

Write-Host "`n--- BUNDLE DIRECT PING (hanya direct-ping-worker) ---"
Write-Host 'Pindahkan folder offline-bundle-direct-ping ke mesin terpisah yang bisa reach PostgreSQL.'
Write-Host 'Edit .env di dalamnya: DB_HOST=<IP_SERVER_POSTGRES> (bukan mojo-db).'
Write-Host 'Lalu jalankan:'
Write-Host '  chmod +x deploy-offline-direct-ping.sh && ./deploy-offline-direct-ping.sh'
