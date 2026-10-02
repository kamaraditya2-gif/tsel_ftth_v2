#!/usr/bin/env bash
# =============================================================================
# Import data dari database lama (postgres:15 di server aplikasi) ke server
# TimescaleDB baru yang sudah dimigrasi.
# =============================================================================
# Per tabel, hanya kolom yang ada di KEDUA database yang disalin, jadi kolom
# legacy yang tidak dipakai lagi diabaikan dan kolom baru memakai default.
# Baris yang FK-nya menunjuk ke data yang sudah tidak ada (orphan) dilewati.
#
# PERINGATAN: semua tabel aplikasi di database TUJUAN dikosongkan dulu
# (termasuk seed admin/area/regional/NOP) lalu diganti dengan data sumber.
#
#   SOURCE_URL=postgres://user:pass@ip-lama:5432/mojojojo_database \
#   TARGET_URL=postgres://user:pass@ip-baru:5432/mojojojo_database \
#   ./import-legacy.sh --yes
#
# Atau dari folder database/ (TARGET otomatis = container db):
#   docker compose run --rm -e SOURCE_URL=postgres://... --entrypoint bash migrate \
#     /scripts/import-legacy.sh --yes
# =============================================================================
set -euo pipefail

die() { echo "ERROR: $*" >&2; exit 1; }

[[ "${1:-}" == "--yes" ]] || die "script ini mengosongkan database tujuan. Jalankan dengan --yes untuk melanjutkan."
[[ -n "${SOURCE_URL:-}" ]] || die "SOURCE_URL belum diisi"
TARGET_URL="${TARGET_URL:-}"   # kosong = pakai PGHOST/PGUSER/... (service migrate)

PSQL_OPTS=(-X -q -v ON_ERROR_STOP=1 --no-psqlrc)
src() { psql "${PSQL_OPTS[@]}" "$SOURCE_URL" "$@"; }
dst() { if [[ -n "$TARGET_URL" ]]; then psql "${PSQL_OPTS[@]}" "$TARGET_URL" "$@"; else psql "${PSQL_OPTS[@]}" "$@"; fi; }

# Urutan mengikuti dependensi FK (parent dulu)
TABLES=(
  roles users audit_trail
  master_area downstream_servers master_cluster_nop
  group_devices speed_group manufacturer ont_model
  threshold_master app_settings axiros_server integration_settings test_server payloads
  devices_ont
  tasks queue_jobs
  active_alarms alarm_history alarm_root_cause device_alarm_root_cause alarm_comments alarm_tickets
  edge_nodes edge_worker_status edge_targets
  test_results_ping test_results_speed_download test_results_speed_upload
  test_results_traceroute test_results_direct_ping edge_ping_logs
)

# Ekspresi khusus untuk kolom NOT NULL yang di database lama bisa NULL
declare -A COLUMN_EXPR=(
  [devices_ont.device_name]="COALESCE(device_name, serial_number, 'ONT-' || id)"
)

# Kolom waktu hypertable wajib terisi
declare -A TIME_COLUMN=(
  [test_results_ping]=executed_at [test_results_speed_download]=executed_at
  [test_results_speed_upload]=executed_at [test_results_traceroute]=executed_at
  [test_results_direct_ping]=created_at [edge_ping_logs]=bucket
)

columns_of() { # $1=src|dst $2=table → daftar kolom, satu per baris
  "$1" -At -c "SELECT column_name FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = '$2' ORDER BY ordinal_position"
}

table_exists() { # $1=src|dst $2=table
  [[ "$("$1" -At -c "SELECT to_regclass('public.$2') IS NOT NULL")" == "t" ]]
}

echo "Memeriksa koneksi..."
src -c "SELECT 1" >/dev/null || die "tidak bisa konek ke SOURCE_URL"
dst -c "SELECT 1" >/dev/null || die "tidak bisa konek ke database tujuan"
table_exists dst schema_migrations || die "database tujuan belum dimigrasi (jalankan migrate.sh up dulu)"

echo "Mengosongkan tabel tujuan..."
dst -c "TRUNCATE $(IFS=,; echo "${TABLES[*]}") RESTART IDENTITY CASCADE"

for table in "${TABLES[@]}"; do
  if ! table_exists src "$table"; then
    printf '  %-30s dilewati (tidak ada di sumber)\n' "$table"
    continue
  fi

  mapfile -t src_cols < <(columns_of src "$table")
  mapfile -t dst_cols < <(columns_of dst "$table")

  cols=(); select_exprs=()
  for c in "${dst_cols[@]}"; do
    if printf '%s\n' "${src_cols[@]}" | grep -qx "$c"; then
      cols+=("$c")
      select_exprs+=("${COLUMN_EXPR[$table.$c]:-$c}")
    fi
  done
  [[ ${#cols[@]} -gt 0 ]] || { printf '  %-30s dilewati (tidak ada kolom yang sama)\n' "$table"; continue; }

  # Filter orphan berdasarkan FK satu-kolom di database tujuan
  where=("TRUE")
  while IFS='|' read -r col parent pcol; do
    [[ -z "$col" ]] && continue
    printf '%s\n' "${cols[@]}" | grep -qx "$col" || continue
    table_exists src "$parent" || continue
    where+=("($col IS NULL OR $col IN (SELECT $pcol FROM $parent))")
  done < <(dst -At -F '|' -c "
      SELECT a.attname, cl.relname, pa.attname
      FROM pg_constraint c
      JOIN pg_class cl      ON cl.oid = c.confrelid
      JOIN pg_attribute a   ON a.attrelid = c.conrelid  AND a.attnum = c.conkey[1]
      JOIN pg_attribute pa  ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
      WHERE c.contype = 'f' AND c.conrelid = 'public.$table'::regclass
        AND array_length(c.conkey, 1) = 1 AND c.confrelid <> c.conrelid")
  [[ -n "${TIME_COLUMN[$table]:-}" ]] && where+=("${TIME_COLUMN[$table]} IS NOT NULL")

  col_list="$(IFS=,; echo "${cols[*]}")"
  select_list="$(IFS=,; echo "${select_exprs[*]}")"
  where_sql="$(printf '%s AND ' "${where[@]}")"; where_sql="${where_sql% AND }"

  total="$(src -At -c "SELECT count(*) FROM $table")"
  src -c "\\copy (SELECT $select_list FROM $table WHERE $where_sql ORDER BY 1) TO STDOUT" \
    | dst -c "\\copy $table ($col_list) FROM STDIN"
  copied="$(dst -At -c "SELECT count(*) FROM $table")"
  printf '  %-30s %8s / %-8s baris' "$table" "$copied" "$total"
  [[ "$copied" != "$total" ]] && printf '  (%s dilewati: orphan/waktu kosong)' "$((total - copied))"
  echo
done

echo "Menyesuaikan sequence..."
dst -At -c "
  SELECT format('SELECT setval(%L, GREATEST((SELECT COALESCE(MAX(%I), 0) FROM %I), 1), (SELECT MAX(%I) IS NOT NULL FROM %I));',
                pg_get_serial_sequence(c.table_name, c.column_name), c.column_name, c.table_name, c.column_name, c.table_name)
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND pg_get_serial_sequence(c.table_name, c.column_name) IS NOT NULL
    AND c.table_name <> 'schema_migrations'" | dst >/dev/null

echo "✓ Import selesai. Chunk lama akan dikompresi otomatis oleh policy TimescaleDB."
