-- 0008_compression_policies.sql
-- Kompresi kolumnar TimescaleDB untuk chunk yang sudah tidak aktif ditulis.
-- Data tetap bisa di-query, di-UPDATE, dan di-DELETE seperti biasa; hanya
-- penyimpanannya yang dipadatkan (biasanya 90%+ lebih kecil).
--
-- segmentby = kolom yang paling sering dipakai di WHERE (per device / node).
--
-- Tidak ada retention policy (penghapusan data otomatis). Jika diperlukan,
-- tambahkan migrasi baru, misalnya:
--   SELECT add_retention_policy('test_results_ping', INTERVAL '365 days');

ALTER TABLE test_results_ping SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id',
    timescaledb.compress_orderby   = 'executed_at DESC'
);
SELECT add_compression_policy('test_results_ping', INTERVAL '7 days');

ALTER TABLE test_results_speed_download SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id',
    timescaledb.compress_orderby   = 'executed_at DESC'
);
SELECT add_compression_policy('test_results_speed_download', INTERVAL '14 days');

ALTER TABLE test_results_speed_upload SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id',
    timescaledb.compress_orderby   = 'executed_at DESC'
);
SELECT add_compression_policy('test_results_speed_upload', INTERVAL '14 days');

ALTER TABLE test_results_traceroute SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id',
    timescaledb.compress_orderby   = 'executed_at DESC'
);
SELECT add_compression_policy('test_results_traceroute', INTERVAL '14 days');

ALTER TABLE test_results_direct_ping SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id',
    timescaledb.compress_orderby   = 'created_at DESC'
);
SELECT add_compression_policy('test_results_direct_ping', INTERVAL '7 days');

ALTER TABLE edge_ping_logs SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'node_id',
    timescaledb.compress_orderby   = 'bucket DESC'
);
SELECT add_compression_policy('edge_ping_logs', INTERVAL '14 days');
