import { NextRequest } from 'next/server';
import { gunzipSync } from 'zlib';
import { createHash, timingSafeEqual } from 'crypto';
import pool from '@/lib/db';

// Batas ukuran payload edge: body mentah dan hasil dekompresi gzip.
const MAX_RAW_BYTES = 8 * 1024 * 1024;
const MAX_DECOMPRESSED_BYTES = 32 * 1024 * 1024;
// Baris per satu query INSERT (jauh di bawah batas 65.535 parameter Postgres).
const INSERT_CHUNK_ROWS = 1000;

export async function parseEdgePayload(req: NextRequest) {
  const raw = Buffer.from(await req.arrayBuffer());
  if (raw.length > MAX_RAW_BYTES) {
    throw new Error('Payload too large');
  }
  const contentEncoding = req.headers.get('content-encoding') || '';

  let buffer = raw;
  if (contentEncoding.toLowerCase() === 'gzip') {
    try {
      buffer = gunzipSync(raw, { maxOutputLength: MAX_DECOMPRESSED_BYTES });
    } catch {
      throw new Error('Invalid or oversized gzip payload');
    }
  }

  const text = buffer.toString('utf8');
  if (!text.trim()) {
    throw new Error('Empty payload');
  }

  return JSON.parse(text);
}

const sha256 = (value: string) => createHash('sha256').update(value).digest();

export function verifyEdgeRequest(req: NextRequest) {
  // Tanpa EDGE_SYNC_TOKEN, endpoint edge menolak semua request (fail-closed).
  const expected = (process.env.EDGE_SYNC_TOKEN || '').trim();
  const auth = req.headers.get('authorization') || '';
  const token = /^Bearer\s+/i.test(auth) ? auth.replace(/^Bearer\s+/i, '').trim() : '';

  if (!expected || !token || !timingSafeEqual(sha256(token), sha256(expected))) {
    throw new Error('Unauthorized');
  }

  return true;
}

export function resolveNodeId(req: NextRequest, payload: any) {
  const headerNodeId = req.headers.get('x-node-id') || req.headers.get('X-Node-Id');
  const payloadNodeId = payload?.nodeId || payload?.node_id || payload?.nodeID;
  const nodeId = (headerNodeId || payloadNodeId || '').toString().trim();

  if (!nodeId) {
    throw new Error('Missing node id');
  }

  return nodeId;
}

let edgeTablesReady: Promise<void> | null = null;

/**
 * Buat tabel edge sekali per proses; jika gagal, dicoba lagi di request berikut.
 * Sumber utama skema adalah database/migrations (edge_ping_logs di sana berupa
 * hypertable); ini hanya fallback dan harus tetap sejalan dengan migrasi.
 */
export function ensureEdgeTables() {
  if (!edgeTablesReady) {
    edgeTablesReady = createEdgeTables().catch((err) => {
      edgeTablesReady = null;
      throw err;
    });
  }
  return edgeTablesReady;
}

async function createEdgeTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS edge_nodes (
      id SERIAL PRIMARY KEY,
      node_id TEXT UNIQUE NOT NULL,
      name TEXT,
      location TEXT,
      status TEXT DEFAULT 'unknown',
      last_seen_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS edge_worker_status (
      id SERIAL PRIMARY KEY,
      node_id TEXT UNIQUE NOT NULL,
      state TEXT,
      targets_up INTEGER DEFAULT 0,
      targets_down INTEGER DEFAULT 0,
      cycle_ms INTEGER DEFAULT 0,
      version TEXT,
      last_seen_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS edge_ping_logs (
      id BIGSERIAL,
      node_id TEXT NOT NULL,
      target_ip TEXT NOT NULL,
      bucket TIMESTAMPTZ NOT NULL,
      avg_rtt_ms DOUBLE PRECISION,
      avg_loss_pct DOUBLE PRECISION,
      samples INTEGER DEFAULT 0,
      ok_count INTEGER DEFAULT 0,
      dedupe_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id, bucket),
      UNIQUE (dedupe_key, bucket)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS edge_targets (
      id SERIAL PRIMARY KEY,
      node_id TEXT NOT NULL,
      target_id INTEGER,
      name TEXT,
      ip TEXT NOT NULL,
      location TEXT,
      enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(node_id, ip)
    )
  `);
}

export const DEFAULT_EDGE_CONFIG = {
  'ping.enabled': 'true',
  'ping.interval_seconds': '30',
  'ping.timeout_ms': '1000',
  'ping.count': '1',
  'ping.retries': '1',
  'ping.chunk_size': '500',
  'sync.enabled': 'false',
  'sync.interval_seconds': '3600',
  'sync.backoff_max_multiplier': '6',
};

/**
 * Config yang ditarik edge lewat GET /api/edge/config. Edge MENIMPA config
 * lokalnya dengan setiap key yang dikembalikan di sini, jadi hanya kirim
 * override yang memang diset di pusat — bukan seluruh default. Mengirim
 * default (mis. sync.enabled=false) akan mematikan sync di edge dan
 * membatalkan pengaturan admin edge setiap worker restart.
 * Belum ada penyimpanan override per node, jadi untuk saat ini kosong.
 */
export function buildEdgeConfigResponse(): Record<string, string> {
  return {};
}

export async function ingestEdgeStatus(nodeId: string, payload: any) {
  await ensureEdgeTables();

  const values = {
    node_id: nodeId,
    state: payload?.state || 'unknown',
    targets_up: Number(payload?.targetsUp ?? payload?.targets_up ?? 0),
    targets_down: Number(payload?.targetsDown ?? payload?.targets_down ?? 0),
    cycle_ms: Number(payload?.cycleMs ?? payload?.cycle_ms ?? 0),
    version: payload?.version || null,
    last_seen_at: payload?.lastSeenAt || payload?.last_seen_at || new Date().toISOString(),
  };

  await pool.query(
    `INSERT INTO edge_worker_status (
      node_id, state, targets_up, targets_down, cycle_ms, version, last_seen_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (node_id)
    DO UPDATE SET
      state = EXCLUDED.state,
      targets_up = EXCLUDED.targets_up,
      targets_down = EXCLUDED.targets_down,
      cycle_ms = EXCLUDED.cycle_ms,
      version = EXCLUDED.version,
      last_seen_at = EXCLUDED.last_seen_at,
      updated_at = NOW()`,
    [values.node_id, values.state, values.targets_up, values.targets_down, values.cycle_ms, values.version, values.last_seen_at]
  );

  await pool.query(
    `INSERT INTO edge_nodes (node_id, status, last_seen_at, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (node_id)
     DO UPDATE SET status = EXCLUDED.status, last_seen_at = EXCLUDED.last_seen_at, updated_at = NOW()`,
    [nodeId, values.state, values.last_seen_at]
  );

  return { nodeId, accepted: true };
}

export async function ingestEdgePingLogs(nodeId: string, payload: any) {
  await ensureEdgeTables();

  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  if (rows.length === 0) {
    return { nodeId, accepted: true, inserted: 0 };
  }

  await pool.query(
    `INSERT INTO edge_nodes (node_id, status, last_seen_at, updated_at)
     VALUES ($1, 'online', NOW(), NOW())
     ON CONFLICT (node_id)
     DO UPDATE SET status = 'online', last_seen_at = NOW(), updated_at = NOW()`,
    [nodeId]
  );

  let inserted = 0;
  for (let offset = 0; offset < rows.length; offset += INSERT_CHUNK_ROWS) {
    const values: any[] = [];
    const inserts: string[] = [];

    rows.slice(offset, offset + INSERT_CHUNK_ROWS).forEach((row: any, index: number) => {
      const base = index * 8;
      const dedupeKey = (row?.dedupeKey || `${nodeId}:${row?.ip || 'unknown'}:${row?.bucket || new Date().toISOString()}`).toString();
      const bucket = row?.bucket || new Date().toISOString();
      const ip = row?.ip || row?.targetIp || 'unknown';
      // null = target tidak pernah membalas di bucket ini — simpan NULL, bukan 0 ms
      const rawRtt = row?.avgRttMs ?? row?.avg_rtt_ms;
      const avgRttMs = rawRtt == null || !Number.isFinite(Number(rawRtt)) ? null : Number(rawRtt);
      const avgLossPct = Number(row?.avgLossPct ?? row?.avg_loss_pct ?? 0);
      const samples = Number(row?.samples ?? 0);
      const okCount = Number(row?.okCount ?? row?.ok_count ?? 0);

      values.push(
        nodeId,
        ip,
        bucket,
        avgRttMs,
        avgLossPct,
        samples,
        okCount,
        dedupeKey
      );

      inserts.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`
      );
    });

    const result = await pool.query(
      `INSERT INTO edge_ping_logs (
          node_id, target_ip, bucket, avg_rtt_ms, avg_loss_pct, samples, ok_count, dedupe_key
        ) VALUES ${inserts.join(', ')}
        ON CONFLICT (dedupe_key, bucket) DO NOTHING`,
      values
    );
    inserted += result.rowCount ?? 0;
  }

  return { nodeId, accepted: true, inserted };
}

export async function ingestEdgeTargets(nodeId: string, payload: any) {
  await ensureEdgeTables();

  const items = Array.isArray(payload?.targets) ? payload.targets : [];
  if (items.length === 0) {
    return { nodeId, accepted: true, inserted: 0 };
  }

  // Satu IP hanya boleh muncul sekali per query upsert (data terakhir menang).
  const byIp = new Map<string, any>();
  for (const item of items) {
    const ip = (item?.ip ?? '').toString().trim();
    if (ip) byIp.set(ip, item);
  }
  const unique = Array.from(byIp.entries());

  for (let offset = 0; offset < unique.length; offset += INSERT_CHUNK_ROWS) {
    const values: any[] = [];
    const inserts: string[] = [];

    unique.slice(offset, offset + INSERT_CHUNK_ROWS).forEach(([ip, item], index) => {
      const base = index * 6;
      values.push(
        nodeId,
        item?.targetId ?? item?.target_id ?? null,
        item?.name || null,
        ip,
        item?.location || null,
        item?.enabled !== false
      );
      inserts.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, NOW())`
      );
    });

    await pool.query(
      `INSERT INTO edge_targets (node_id, target_id, name, ip, location, enabled, updated_at)
       VALUES ${inserts.join(', ')}
       ON CONFLICT (node_id, ip)
       DO UPDATE SET
         target_id = EXCLUDED.target_id,
         name = EXCLUDED.name,
         location = EXCLUDED.location,
         enabled = EXCLUDED.enabled,
         updated_at = NOW()`,
      values
    );
  }

  return { nodeId, accepted: true, inserted: unique.length };
}
