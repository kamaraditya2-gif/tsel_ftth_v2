#!/usr/bin/env bash
# =============================================================================
# Migration runner — Mojo-DB database
# =============================================================================
# Menjalankan file database/migrations/NNNN_nama.sql secara berurutan dan
# mencatat yang sudah ter-apply di tabel schema_migrations. Setiap file
# dijalankan dalam satu transaksi bersama pencatatannya: jika gagal, tidak ada
# perubahan yang tersimpan.
#
# Koneksi memakai variabel standar libpq: PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
#
#   migrate.sh up             apply semua migrasi yang belum jalan (default)
#   migrate.sh status         daftar migrasi dan statusnya
#   migrate.sh new <nama>     buat file migrasi kosong berikutnya
#
# Migrasi bersifat forward-only: untuk membatalkan perubahan, buat migrasi baru.
# Jangan mengubah file yang sudah ter-apply — runner akan menolak (checksum).
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$SCRIPT_DIR/../migrations}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 --no-psqlrc)
# Sembunyikan NOTICE ("already exists, skipping"); WARNING dan ERROR tetap tampil
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"

die() { echo "ERROR: $*" >&2; exit 1; }

checksum() { sha256sum "$1" | cut -d' ' -f1; }

migration_files() {
  local f
  for f in "$MIGRATIONS_DIR"/[0-9][0-9][0-9][0-9]_*.sql; do
    [[ -f "$f" ]] && basename "$f"
  done | sort
}

ensure_table() {
  "${PSQL[@]}" -c "
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     TEXT PRIMARY KEY,
      checksum    TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )" >/dev/null
}

# Cetak "version checksum" untuk setiap migrasi yang sudah ter-apply
applied() {
  "${PSQL[@]}" -At -F ' ' -c "SELECT version, checksum FROM schema_migrations ORDER BY version"
}

cmd_up() {
  ensure_table
  # Ditampung di variabel dulu supaya kegagalan query/listing menghentikan skrip (set -e)
  local applied_list files
  applied_list="$(applied)"
  files="$(migration_files)"

  declare -A done_sum=()
  while read -r v s; do
    [[ -n "$v" ]] && done_sum["$v"]="$s"
  done <<< "$applied_list"

  local count=0
  while read -r file; do
    [[ -z "$file" ]] && continue
    local version="${file%.sql}"
    local path="$MIGRATIONS_DIR/$file"
    local sum
    sum="$(checksum "$path")"

    if [[ -n "${done_sum[$version]:-}" ]]; then
      [[ "${done_sum[$version]}" == "$sum" ]] \
        || die "$file sudah ter-apply tetapi isinya berubah. Kembalikan file aslinya dan buat migrasi baru."
      continue
    fi

    echo "→ applying $file"
    # --single-transaction membungkus file + INSERT pencatatan dalam satu transaksi.
    # Advisory lock mencegah dua runner meng-apply migrasi yang sama bersamaan.
    "${PSQL[@]}" --single-transaction \
      -c "SELECT pg_advisory_xact_lock(hashtext('mojo_db_schema_migrations'))" \
      -f "$path" \
      -c "INSERT INTO schema_migrations (version, checksum) VALUES ('$version', '$sum')" \
      >/dev/null
    count=$((count + 1))
  done <<< "$files"

  if [[ $count -eq 0 ]]; then
    echo "Database sudah up to date."
  else
    echo "✓ $count migrasi ter-apply."
  fi
}

cmd_status() {
  ensure_table
  local applied_list files
  applied_list="$("${PSQL[@]}" -At -c "SELECT version, to_char(applied_at, 'YYYY-MM-DD HH24:MI:SS') FROM schema_migrations")"
  files="$(migration_files)"

  declare -A done_at=()
  while IFS='|' read -r v at; do
    [[ -n "$v" ]] && done_at["$v"]="$at"
  done <<< "$applied_list"

  printf '%-45s %s\n' "MIGRATION" "APPLIED AT"
  while read -r file; do
    [[ -z "$file" ]] && continue
    local version="${file%.sql}"
    printf '%-45s %s\n' "$version" "${done_at[$version]:-(pending)}"
    unset 'done_at[$version]'
  done <<< "$files"

  for v in "${!done_at[@]}"; do
    printf '%-45s %s  (file tidak ditemukan!)\n' "$v" "${done_at[$v]}"
  done
}

cmd_new() {
  local name="${1:-}"
  [[ "$name" =~ ^[a-z0-9_]+$ ]] || die "nama migrasi wajib huruf kecil/angka/underscore, contoh: migrate.sh new add_index_foo"
  local last next
  last="$(migration_files | tail -n1 | cut -c1-4)"
  next="$(printf '%04d' $((10#${last:-0} + 1)))"
  local path="$MIGRATIONS_DIR/${next}_${name}.sql"
  printf -- '-- %s\n-- Migration: %s\n\n' "${next}_${name}.sql" "$name" > "$path"
  echo "Dibuat: $path"
}

[[ -d "$MIGRATIONS_DIR" ]] || die "folder migrasi tidak ditemukan: $MIGRATIONS_DIR"

case "${1:-up}" in
  up)     cmd_up ;;
  status) cmd_status ;;
  new)    shift; cmd_new "$@" ;;
  *)      die "perintah tidak dikenal: $1 (pakai: up | status | new <nama>)" ;;
esac
