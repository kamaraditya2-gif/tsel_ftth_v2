require('dotenv').config();
const { Worker } = require('bullmq');
const axios = require('axios');
const pool = require('./db');
const crypto = require('crypto');
const redis = require('./lib/redis');
const { circuitBreakers } = require('./lib/circuit-breaker');
const { logger } = require('./lib/logger');

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
};

// Generate unique worker ID
const workerId = `mojo-worker-${Date.now()}`;
const WORKER_START_TIME = Date.now().toString();

// Distributed rate limiting configuration
const PING_RATE_LIMIT_SECONDS = parseInt(process.env.PING_RATE_LIMIT_SECONDS) || 10; // 10 seconds between pings per device
const SPEED_RATE_LIMIT_SECONDS = parseInt(process.env.SPEED_RATE_LIMIT_SECONDS) || 10; // 10 seconds between speed tests (upload/download) per device

// Alarm thresholds (hardcoded global)
const ALARM_THRESHOLDS = {
  upload: 10,      // Mbps — below this = alarm
  download: 50,    // Mbps — below this = alarm
  latency: 100,    // ms — above this = alarm
};

logger.info({
  workerId,
  redis: `${redisConnection.host}:${redisConnection.port}`,
  postgres: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  pingRateLimit: PING_RATE_LIMIT_SECONDS,
  speedRateLimit: SPEED_RATE_LIMIT_SECONDS
}, 'Worker Configuration');

// Base URL of the dashboard/Next.js API that serves config endpoints.
// Defaults to localhost for local runs; in Docker set API_BASE_URL to the
// dashboard service, e.g. http://mojojojo_dashboard:3000
const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

// Helper function for circuit breaker protected axios calls
async function safeTestServerGet() {
  return await circuitBreakers.testServer.execute(() =>
    axios.get(`${API_BASE_URL}/api/test-server`)
  );
}

// Cached, circuit-breaker-protected Axiros server config getter.
// The config rarely changes, so caching avoids an HTTP round-trip on every job.
const AXIROS_CONFIG_TTL_MS = parseInt(process.env.AXIROS_CONFIG_TTL_MS) || 60000; // 60s
let axirosConfigCache = { data: null, fetchedAt: 0 };

async function getAxirosServer() {
  const now = Date.now();
  if (axirosConfigCache.data && (now - axirosConfigCache.fetchedAt) < AXIROS_CONFIG_TTL_MS) {
    return axirosConfigCache.data;
  }

  const response = await circuitBreakers.axiros.execute(() =>
    axios.get(`${API_BASE_URL}/api/axiros-server`)
  );
  const axirosServer = response.data;

  if (!axirosServer) {
    throw new Error('Axiros server configuration not found');
  }
  if (!axirosServer.server_url || !axirosServer.base_path) {
    throw new Error('Invalid Axiros server configuration: missing server_url or base_path');
  }

  axirosConfigCache = { data: axirosServer, fetchedAt: now };
  return axirosServer;
}

// Distributed rate limiting function using Redis
async function waitForPingRateLimit(deviceId, deviceSerial) {
  const redisKey = `ping:last:${deviceId}`;
  
  try {
    // Get last ping timestamp for this device
    const lastPing = await redis.get(redisKey);
    
    if (lastPing) {
      const lastPingTime = parseInt(lastPing);
      const currentTime = Date.now();
      const timeSinceLastPing = (currentTime - lastPingTime) / 1000; // in seconds
      
      if (timeSinceLastPing < PING_RATE_LIMIT_SECONDS) {
        const waitTime = PING_RATE_LIMIT_SECONDS - timeSinceLastPing;
        console.log(`⏳ Device ${deviceSerial} (ID: ${deviceId}) was last pinged ${timeSinceLastPing.toFixed(1)}s ago. Waiting ${waitTime.toFixed(1)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        console.log(`✅ Rate limit wait complete for device ${deviceSerial}`);
      }
    }
    
  } catch (error) {
    console.error('Error checking rate limit in Redis:', error);
    // Continue anyway if Redis check fails
  }
}

async function waitForSpeedRateLimit(deviceId, deviceSerial) {
  const redisKey = `speed:last:${deviceId}`;
  
  try {
    // Get last speed test timestamp for this device (shared for upload/download)
    const lastSpeed = await redis.get(redisKey);
    
    if (lastSpeed) {
      const lastSpeedTime = parseInt(lastSpeed);
      const currentTime = Date.now();
      const timeSinceLastSpeed = (currentTime - lastSpeedTime) / 1000; // in seconds
      
      if (timeSinceLastSpeed < SPEED_RATE_LIMIT_SECONDS) {
        const waitTime = SPEED_RATE_LIMIT_SECONDS - timeSinceLastSpeed;
        console.log(`⏳ Device ${deviceSerial} (ID: ${deviceId}) was last speed tested ${timeSinceLastSpeed.toFixed(1)}s ago. Waiting ${waitTime.toFixed(1)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        console.log(`✅ Rate limit wait complete for device ${deviceSerial}`);
      }
    }
  
  } catch (error) {
    console.error('Error checking rate limit in Redis:', error);
    // Continue anyway if Redis check fails
  }
}

// Update the ping timestamp after sending a ping request
async function updatePingTimestamp(deviceId) {
  const redisKey = `ping:last:${deviceId}`;
  
  try {
    // Update the last ping timestamp
    await redis.set(redisKey, Date.now(), 'EX', PING_RATE_LIMIT_SECONDS + 60); // TTL = rate limit + buffer
  } catch (error) {
    console.error('Error updating rate limit timestamp in Redis:', error);
    // Continue anyway if Redis update fails
  }
}

// Queue name from environment (allows multiple dedicated workers)
const QUEUE_NAME = process.env.QUEUE_NAME || 'acs-queue';

// Queue-specific tuning: download/upload tests can take several minutes,
// so we use a longer job lock to prevent multiple workers from picking up
// the same stalled job and wasting resources.
const isSpeedQueue = QUEUE_NAME === 'acs-download' || QUEUE_NAME === 'acs-upload';
const WORKER_CONCURRENCY = isSpeedQueue
  ? parseInt(process.env.WORKER_CONCURRENCY) || 2
  : parseInt(process.env.WORKER_CONCURRENCY) || 5;
const WORKER_LOCK_DURATION = isSpeedQueue
  ? parseInt(process.env.WORKER_LOCK_DURATION) || 600000 // 10 minutes
  : parseInt(process.env.WORKER_LOCK_DURATION) || 300000; // 5 minutes
const WORKER_STALLED_INTERVAL = isSpeedQueue
  ? parseInt(process.env.WORKER_STALLED_INTERVAL) || 300000 // 5 minutes
  : parseInt(process.env.WORKER_STALLED_INTERVAL) || 120000; // 2 minutes

logger.info({
  queue: QUEUE_NAME,
  concurrency: WORKER_CONCURRENCY,
  lockDuration: WORKER_LOCK_DURATION,
  stalledInterval: WORKER_STALLED_INTERVAL
}, 'Worker tuning');

// Main worker for all test types (ping, traceroute, download, upload, ont-status)
const worker = new Worker(QUEUE_NAME, async (job) => {
  // Check for stop signal from dashboard
  try {
    const stopSignal = await redis.get('worker:stop-signal');
    if (stopSignal && parseInt(stopSignal) > parseInt(WORKER_START_TIME)) {
      logger.info('Stop signal received from dashboard, shutting down...');
      await worker.close();
      await pool.end();
      process.exit(0);
    }
  } catch (e) {
    // ignore redis errors
  }

  const { queueJobId, deviceId, testType } = job.data;
  
  // Tandai job dengan worker yang memprosesnya agar dashboard bisa menampilkannya
  try {
    await job.updateData({ ...job.data, processedBy: workerId });
  } catch (updateErr) {
    // Non-critical: lanjut proses meski gagal update metadata
    logger.warn({ jobId: job.id, error: updateErr.message }, 'Failed to set processedBy metadata');
  }
  
  console.log(`📋 Processing Job ID: ${job.id}, QueueJobID: ${queueJobId}, DeviceID: ${deviceId}, Worker: ${workerId}`);
  
  let client;
  try {
    // 1. Update status to processing
    client = await pool.connect();
    await client.query(
      'UPDATE queue_jobs SET status = $1, started_at = NOW() WHERE id = $2',
      ['processing', queueJobId]
    );

    // 2. Ambil data device
    const deviceRes = await client.query('SELECT * FROM devices_ont WHERE id = $1', [deviceId]);
    const device = deviceRes.rows[0];
    
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    // 3. Eksekusi test berdasarkan testType
    let result = {};

    switch (testType) {
      case 'ping':
        result = await executePing(device, queueJobId);
        break;
      case 'traceroute':
        result = await executeTraceroute(device, queueJobId);
        break;
      case 'download':
        result = await executeDownload(device, queueJobId);
        break;
      case 'upload':
        result = await executeUpload(device, queueJobId);
        break;
      case 'ont-status':
        result = await executeOntStatus(device);
        break;
      default:
        throw new Error(`Unknown test type for acs-queue: ${testType}`);
    }

    // 6. Update queue_jobs status dan raw_response
    const finalStatus = result.success ? 'completed' : 'failed';
    await client.query(
      'UPDATE queue_jobs SET status = $1, completed_at = NOW(), last_error = $2, raw_response = $3 WHERE id = $4',
      [finalStatus, result.error_message || null, JSON.stringify(result.raw_response || {}), queueJobId]
    );

    // 7. Simpan hasil langsung ke tabel test_results sesuai test_type (skip ont-status)
    let taskId = null;
    let runId = null;
    let executedAt = new Date();
    if (testType !== 'ont-status' && result.success) {
      try {
        const jobInfo = await client.query(
          'SELECT task_id, run_id, created_at FROM queue_jobs WHERE id = $1',
          [queueJobId]
        );
        taskId = jobInfo.rows[0]?.task_id;
        runId = jobInfo.rows[0]?.run_id;
        executedAt = jobInfo.rows[0]?.created_at || new Date();

        switch (testType) {
          case 'ping':
            if (result.ping_igw !== null || result.ping_ebr !== null) {
              await client.query(
                `INSERT INTO test_results_ping
                 (task_id, device_id, queue_job_id, run_id, ping_igw, ping_ebr, packet_loss_igw, packet_loss_ebr, success, executed_at, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 ON CONFLICT (queue_job_id) DO UPDATE SET
                   ping_igw = EXCLUDED.ping_igw,
                   ping_ebr = EXCLUDED.ping_ebr,
                   packet_loss_igw = EXCLUDED.packet_loss_igw,
                   packet_loss_ebr = EXCLUDED.packet_loss_ebr,
                   success = EXCLUDED.success,
                   executed_at = EXCLUDED.executed_at`,
                [
                  taskId, deviceId, queueJobId, runId,
                  result.ping_igw, result.ping_ebr,
                  result.packet_loss_igw, result.packet_loss_ebr,
                  result.success, executedAt, executedAt
                ]
              );
            }
            break;

          case 'traceroute':
            if (result.traceroute_hops) {
              const hops = Array.isArray(result.traceroute_hops) ? result.traceroute_hops : [];
              const totalHops = hops.length;
              const totalRtt = hops.reduce((sum, h) => sum + (parseFloat(h.rt_times?.replace('ms', '')) || 0), 0);
              await client.query(
                `INSERT INTO test_results_traceroute
                 (task_id, device_id, queue_job_id, run_id, traceroute_raw, total_hops, total_rtt_ms, success, executed_at, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 ON CONFLICT (queue_job_id) DO UPDATE SET
                   traceroute_raw = EXCLUDED.traceroute_raw,
                   total_hops = EXCLUDED.total_hops,
                   total_rtt_ms = EXCLUDED.total_rtt_ms,
                   success = EXCLUDED.success,
                   executed_at = EXCLUDED.executed_at`,
                [
                  taskId, deviceId, queueJobId, runId,
                  JSON.stringify(hops), totalHops, totalRtt,
                  result.success, executedAt, executedAt
                ]
              );
            }
            break;

          case 'download':
            if (result.download_speed !== null) {
              await client.query(
                `INSERT INTO test_results_speed_download
                 (task_id, device_id, queue_job_id, run_id, download_speed, success, executed_at, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (queue_job_id) DO UPDATE SET
                   download_speed = EXCLUDED.download_speed,
                   success = EXCLUDED.success,
                   executed_at = EXCLUDED.executed_at`,
                [
                  taskId, deviceId, queueJobId, runId,
                  result.download_speed, result.success, executedAt, executedAt
                ]
              );
            }
            break;

          case 'upload':
            if (result.upload_speed !== null) {
              await client.query(
                `INSERT INTO test_results_speed_upload
                 (task_id, device_id, queue_job_id, run_id, upload_speed, success, executed_at, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (queue_job_id) DO UPDATE SET
                   upload_speed = EXCLUDED.upload_speed,
                   success = EXCLUDED.success,
                   executed_at = EXCLUDED.executed_at`,
                [
                  taskId, deviceId, queueJobId, runId,
                  result.upload_speed, result.success, executedAt, executedAt
                ]
              );
            }
            break;
        }
      } catch (saveErr) {
        console.error('Error saving test result:', saveErr.message);
      }
    }

    // 8. Check alarms after storing results
    if (result.success && testType !== 'ont-status') {
      try {
        await checkAndUpdateAlarm(client, deviceId, testType, result, runId);
      } catch (alarmErr) {
        console.error('Alarm check error:', alarmErr.message);
      }
    }

    // 9. Update device last_seen jika success
    if (result.success) {
      await client.query(
        'UPDATE devices_ont SET status = $1, last_seen = NOW() WHERE id = $2',
        ['online', deviceId]
      );
    }

    console.log(`✅ Job ${job.id} completed with status: ${finalStatus}`);
    
    if (!result.success) {
      throw new Error(result.error_message || 'Test failed');
    }

  } catch (error) {
    console.error(`❌ Job ${job.id} failed:`, error.message);
    
    // Update status ke failed
    if (client) {
      try {
        await client.query(
          'UPDATE queue_jobs SET status = $1, last_error = $2, completed_at = NOW() WHERE id = $3',
          ['failed', error.message, queueJobId]
        );
      } catch (updateErr) {
        console.error('Failed to update job status:', updateErr.message);
      }
    }
    
    throw error; // Re-throw untuk BullMQ retry
  } finally {
    if (client) {
      client.release();
    }
  }
}, {
  connection: redisConnection,
  concurrency: WORKER_CONCURRENCY,
  lockDuration: WORKER_LOCK_DURATION,
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
  stalledInterval: WORKER_STALLED_INTERVAL,
  maxStalledCount: 1, // Allow 1 stalled before marking as failed
  attempts: 2, // Retry failed jobs once (original + 1 retry)
  backoff: { type: 'exponential', delay: 15000 } // Exponential backoff starting at 15 seconds
});

// Heartbeat mechanism - update worker status every minute
const updateHeartbeat = async () => {
  try {
    // Use shared Redis client for heartbeat
    await redis.hset('acs-workers', workerId, JSON.stringify({
      id: workerId,
      status: 'running',
      lastHeartbeat: new Date().toISOString(),
      concurrency: WORKER_CONCURRENCY,
      queue: QUEUE_NAME
    }));
    
    // Set expiration to 2 minutes (heartbeat interval + buffer)
    await redis.expire('acs-workers', 120);
    
    console.log(`💓 Heartbeat updated for worker ${workerId}`);
  } catch (error) {
    console.error('Failed to update heartbeat:', error.message);
  }
};

// Update heartbeat every minute
setInterval(updateHeartbeat, 60000);

// Initial heartbeat
updateHeartbeat();

// Event listeners
worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Job completed successfully');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Job failed');
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.warn({ signal }, 'Received shutdown signal, closing worker...');
  await worker.close();
  await pool.end();
  logger.info('Worker and pool closed gracefully');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

logger.info('Worker ACS ready to process jobs');

// ============================================
// NOTIFICATION INTEGRATIONS
// ============================================

let integrationSettingsCache = null;
let integrationSettingsCacheTime = 0;
const INTEGRATION_CACHE_TTL_MS = 60_000; // 1 minute

async function getIntegrationSettings(client) {
  const now = Date.now();
  if (integrationSettingsCache && (now - integrationSettingsCacheTime) < INTEGRATION_CACHE_TTL_MS) {
    return integrationSettingsCache;
  }
  try {
    const result = await client.query(
      `SELECT platform, status, config FROM integration_settings WHERE status = 'active'`
    );
    integrationSettingsCache = result.rows;
    integrationSettingsCacheTime = now;
    return integrationSettingsCache;
  } catch (err) {
    logger.error({ err }, 'Failed to load integration settings');
    return [];
  }
}

async function sendTelegram(config, text) {
  try {
    const botToken = config.bot_token;
    const chatId = config.chat_id;
    if (!botToken || !chatId) {
      logger.warn('Telegram config missing bot_token or chat_id');
      return;
    }
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await axios.post(url, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
    }, { timeout: 10000 });
    logger.info('Telegram notification sent');
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to send Telegram notification');
  }
}

async function sendWhatsApp(config, text) {
  try {
    const apiUrl = config.api_url;
    const apiKey = config.api_key;
    const target = config.target_number || config.target;
    if (!apiUrl) {
      logger.warn('WhatsApp config missing api_url');
      return;
    }

    // Generic WhatsApp gateway POST. Supports Fonnte, Wablas, etc.
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = apiKey;

    let body = {};
    if (target) {
      body = { target: target, message: text };
    } else {
      body = { message: text };
    }

    // Allow custom headers and body override from config
    if (config.headers) Object.assign(headers, config.headers);
    if (config.body_template) Object.assign(body, config.body_template);

    await axios.post(apiUrl, body, { headers, timeout: 15000 });
    logger.info('WhatsApp notification sent');
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to send WhatsApp notification');
  }
}

async function sendTicketing(config, payload) {
  try {
    const apiUrl = config.api_url;
    if (!apiUrl) {
      logger.warn('Ticketing config missing api_url');
      return;
    }
    const headers = { 'Content-Type': 'application/json' };
    if (config.api_key) headers['Authorization'] = config.api_key;
    if (config.headers) Object.assign(headers, config.headers);

    await axios.post(apiUrl, payload, { headers, timeout: 15000 });
    logger.info('Ticketing notification sent');
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to send Ticketing notification');
  }
}

async function notifyAlarm(client, eventType, deviceInfo, alarmType, metricValue, thresholdValue, durationSeconds) {
  const settings = await getIntegrationSettings(client);
  if (!settings || settings.length === 0) return;

  const alarmLabel = alarmType === 'latency' ? 'Latency' : alarmType === 'upload' ? 'Upload Speed' : 'Download Speed';
  const unit = alarmType === 'latency' ? 'ms' : 'Mbps';
  const deviceLabel = `${deviceInfo.device_name || 'Unknown'} (${deviceInfo.serial_number || 'N/A'})`;

  let telegramText = '';
  let whatsappText = '';
  let ticketingPayload = {};

  if (eventType === 'created') {
    const emoji = alarmType === 'latency' ? '⏱️' : alarmType === 'upload' ? '⬆️' : '⬇️';
    telegramText = `🚨 <b>Alarm Baru</b>\n\n${emoji} <b>${alarmLabel}</b>\nPerangkat: <code>${deviceLabel}</code>\nNilai: <b>${metricValue} ${unit}</b>\nThreshold: <b>${thresholdValue} ${unit}</b>\nWaktu: ${new Date().toLocaleString('id-ID')}`;
    whatsappText = `🚨 *Alarm Baru*\n\n${emoji} *${alarmLabel}*\nPerangkat: ${deviceLabel}\nNilai: *${metricValue} ${unit}*\nThreshold: *${thresholdValue} ${unit}*\nWaktu: ${new Date().toLocaleString('id-ID')}`;
    ticketingPayload = {
      event: 'alarm_created',
      device_id: deviceInfo.id,
      device_name: deviceInfo.device_name,
      serial_number: deviceInfo.serial_number,
      alarm_type: alarmType,
      metric_value: metricValue,
      threshold_value: thresholdValue,
      unit,
      severity: 'warning',
      message: `${alarmLabel} alarm: ${metricValue} ${unit} (threshold: ${thresholdValue})`,
      triggered_at: new Date().toISOString(),
    };
  } else if (eventType === 'cleared') {
    telegramText = `✅ <b>Alarm Clear</b>\n\n<b>${alarmLabel}</b>\nPerangkat: <code>${deviceLabel}</code>\nNilai saat clear: <b>${metricValue} ${unit}</b>\nThreshold: <b>${thresholdValue} ${unit}</b>\nDurasi: <b>${durationSeconds || 0}s</b>\nWaktu: ${new Date().toLocaleString('id-ID')}`;
    whatsappText = `✅ *Alarm Clear*\n\n*${alarmLabel}*\nPerangkat: ${deviceLabel}\nNilai saat clear: *${metricValue} ${unit}*\nThreshold: *${thresholdValue} ${unit}*\nDurasi: *${durationSeconds || 0}s*\nWaktu: ${new Date().toLocaleString('id-ID')}`;
    ticketingPayload = {
      event: 'alarm_cleared',
      device_id: deviceInfo.id,
      device_name: deviceInfo.device_name,
      serial_number: deviceInfo.serial_number,
      alarm_type: alarmType,
      metric_value: metricValue,
      threshold_value: thresholdValue,
      unit,
      severity: 'warning',
      message: `${alarmLabel} alarm cleared: ${metricValue} ${unit} (threshold: ${thresholdValue})`,
      cleared_at: new Date().toISOString(),
      duration_seconds: durationSeconds || 0,
    };
  }

  for (const setting of settings) {
    if (setting.platform === 'telegram') {
      await sendTelegram(setting.config || {}, telegramText);
    } else if (setting.platform === 'whatsapp') {
      await sendWhatsApp(setting.config || {}, whatsappText);
    } else if (setting.platform === 'ticketing') {
      await sendTicketing(setting.config || {}, ticketingPayload);
    }
  }
}

// ============================================
// ALARM CHECK FUNCTIONS
// ============================================

async function checkAndUpdateAlarm(client, deviceId, testType, result, runId) {
  // Fetch device speed group thresholds + device info
  const deviceRes = await client.query(
    `SELECT d.id, d.device_name, d.serial_number, d.speed_id, sg.upload_threshold, sg.download_threshold, sg.speed_limit
     FROM devices_ont d
     LEFT JOIN speed_group sg ON sg.id = d.speed_id
     WHERE d.id = $1`,
    [deviceId]
  );
  const sg = deviceRes.rows[0];

  const thresholds = {
    upload: sg?.upload_threshold ?? ALARM_THRESHOLDS.upload,
    download: sg?.download_threshold ?? ALARM_THRESHOLDS.download,
    latency: ALARM_THRESHOLDS.latency,
  };

  let alarmType = null;
  let metricValue = null;
  let thresholdValue = null;

  if (testType === 'upload' && result.upload_speed !== null) {
    alarmType = 'upload';
    metricValue = parseFloat(result.upload_speed);
    thresholdValue = thresholds.upload;
  } else if (testType === 'download' && result.download_speed !== null) {
    alarmType = 'download';
    metricValue = parseFloat(result.download_speed);
    thresholdValue = thresholds.download;
  } else if (testType === 'ping' && result.ping_igw !== null) {
    alarmType = 'latency';
    metricValue = parseFloat(result.ping_igw);
    thresholdValue = thresholds.latency;
  }

  if (!alarmType || metricValue === null || isNaN(metricValue) || thresholdValue === null || thresholdValue === undefined) return;

  const isAlarm = (alarmType === 'latency') ? metricValue > thresholdValue : metricValue < thresholdValue;

  const existing = await client.query(
    'SELECT id, triggered_at FROM active_alarms WHERE device_id = $1 AND alarm_type = $2',
    [deviceId, alarmType]
  );

  if (isAlarm) {
    const message = `${alarmType.toUpperCase()} alarm: ${metricValue} ${alarmType === 'latency' ? 'ms' : 'Mbps'} (threshold: ${thresholdValue})`;
    if (existing.rows.length > 0) {
      await client.query(
        `UPDATE active_alarms SET metric_value = $1, threshold_value = $2, message = $3, last_checked_at = NOW(), run_id = $4 WHERE id = $5`,
        [metricValue, thresholdValue, message, runId, existing.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO active_alarms (device_id, alarm_type, metric_value, threshold_value, severity, message, triggered_at, last_checked_at, run_id)
         VALUES ($1, $2, $3, $4, 'warning', $5, NOW(), NOW(), $6)`,
        [deviceId, alarmType, metricValue, thresholdValue, message, runId]
      );
      console.log(`🚨 Alarm created: ${message} (device_id=${deviceId})`);
      // Kirim notifikasi alarm baru
      try {
        await notifyAlarm(client, 'created', sg, alarmType, metricValue, thresholdValue);
      } catch (notifyErr) {
        logger.error({ err: notifyErr.message }, 'Notify alarm created error');
      }
    }
  } else {
    if (existing.rows.length > 0) {
      const old = existing.rows[0];
      const duration = Math.floor((new Date() - new Date(old.triggered_at)) / 1000);
      await client.query(
        `INSERT INTO alarm_history (device_id, alarm_type, metric_value, threshold_value, severity, message, triggered_at, cleared_at, cleared_value, run_id, duration_seconds)
         VALUES ($1, $2, $3, $4, 'warning', $5, $6, NOW(), $7, $8, $9)`,
        [deviceId, alarmType, metricValue, thresholdValue, old.message || `${alarmType} alarm cleared`, old.triggered_at, metricValue, runId, duration]
      );
      await client.query('DELETE FROM active_alarms WHERE id = $1', [old.id]);
      console.log(`✅ Alarm cleared: ${alarmType} for device_id=${deviceId} (duration ${duration}s)`);
      // Kirim notifikasi alarm clear
      try {
        await notifyAlarm(client, 'cleared', sg, alarmType, metricValue, thresholdValue, duration);
      } catch (notifyErr) {
        logger.error({ err: notifyErr.message }, 'Notify alarm cleared error');
      }
    }
  }
}

// ============================================
// TEST EXECUTION FUNCTIONS
// ============================================

async function executePing(device, queueJobId) {
  console.log(`🔔 Executing ping for device ${device.serial_number}`);
  
  let client;
  try {
    client = await pool.connect();

    // Get Axiros server configuration (cached)
    const axirosServer = await getAxirosServer();

    // Get test server configuration from API
    const testServerResponse = await safeTestServerGet();
    const testServers = testServerResponse.data;

    if (!testServers || testServers.length === 0) {
      throw new Error('No test server configuration found');
    }

    // Filter active test servers by type
    const igwServers = testServers.filter(s => s.is_active && s.test_type === 'igw');
    const ebrServers = testServers.filter(s => s.is_active && s.test_type === 'ebr');

    if (igwServers.length === 0) {
      throw new Error('No active near IGW test server found');
    }
    if (ebrServers.length === 0) {
      throw new Error('No active near EBR test server found');
    }

    // Construct URL properly for ping (uses Portal base path)
    const serverUrl = axirosServer.server_url.replace(/\/$/, '');
    const basePath = axirosServer.base_path.replace(/^\//, '');
    // For ping, use Portal instead of Indihome
    const pingBasePath = basePath.replace('/Indihome', '/Portal');
    const pingUrl = `${serverUrl}/${pingBasePath}/DeviceManagement/TR069/RPC/IPPingTest`;

    // Perform 2 pings: near IGW and near EBR with individual retry logic
    const pingResults = {};
    const maxRetries = 2;
    
    // Helper function to retry individual ping
    const retryPing = async (config, name) => {
      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          console.log(`${name} attempt ${attempt}/${maxRetries + 1}`);
          const response = await axios(config);
          console.log(`${name} Response:`, JSON.stringify(response.data));
          return response;
        } catch (error) {
          console.error(`${name} attempt ${attempt} failed:`, error.message);
          if (attempt < maxRetries + 1) {
            console.log(`Retrying ${name}...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
          } else {
            console.error(`${name} failed after ${maxRetries + 1} attempts`);
            throw error;
          }
        }
      }
    };
    
    // Ping near IGW with retry
    let igwSuccess = false;
    let igwResponse = null;
    try {
      console.log(`Pinging near IGW for device ${device.serial_number}`);
      const igwHost = igwServers[0].ip_address;
      console.log(`near IGW Host: ${igwHost}, Ping URL: ${pingUrl}`);
      
      // Wait for distributed rate limit before near IGW ping
      await waitForPingRateLimit(device.id, device.serial_number);
      
      const igwConfig = {
        method: 'POST',
        url: pingUrl,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${axirosServer.auth_password}`
        },
        data: {
          identifiers: device.serial_number,
          host: igwHost
        },
        timeout: 120000 // 120 seconds timeout — longer for hop-by-hop visibility
      };
      console.log('near IGW Request:', JSON.stringify(igwConfig.data));
      igwResponse = await retryPing(igwConfig, 'near IGW');
      
      // Update timestamp after near IGW ping
      await updatePingTimestamp(device.id);
      
      if (igwResponse.data.status === 'success' && igwResponse.data.data.post) {
        pingResults.ping_igw = igwResponse.data.data.post.details.AverageResponseTime;
        const failureCount = igwResponse.data.data.post.details.FailureCount || 0;
        if (failureCount > 0) {
          pingResults.packet_loss_igw = (failureCount / 4) * 100;
        } else {
          pingResults.packet_loss_igw = 0;
        }
        igwSuccess = true;
      }
    } catch (error) {
      console.error('near IGW ping failed after all retries');
      pingResults.igw_error = error.message;
    }

    // Ping near EBR with retry
    let ebrSuccess = false;
    let ebrResponse = null;
    try {
      console.log(`Pinging near EBR for device ${device.serial_number}`);
      const ebrHost = ebrServers[0].ip_address;
      console.log(`near EBR Host: ${ebrHost}, Ping URL: ${pingUrl}`);
      
      // Wait for distributed rate limit before near EBR ping
      await waitForPingRateLimit(device.id, device.serial_number);
      
      const ebrConfig = {
        method: 'POST',
        url: pingUrl,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${axirosServer.auth_password}`
        },
        data: {
          identifiers: device.serial_number,
          host: ebrHost
        },
        timeout: 200000 // 200 seconds timeout
      };
      console.log('near EBR Request:', JSON.stringify(ebrConfig.data));
      ebrResponse = await retryPing(ebrConfig, 'near EBR');
      
      // Update timestamp after near EBR ping
      await updatePingTimestamp(device.id);
      
      if (ebrResponse.data.status === 'success' && ebrResponse.data.data.post) {
        pingResults.ping_ebr = ebrResponse.data.data.post.details.AverageResponseTime;
        const failureCount = ebrResponse.data.data.post.details.FailureCount || 0;
        if (failureCount > 0) {
          pingResults.packet_loss_ebr = (failureCount / 4) * 100;
        } else {
          pingResults.packet_loss_ebr = 0;
        }
        ebrSuccess = true;
      }
    } catch (error) {
      console.error('near EBR ping failed after all retries');
      pingResults.ebr_error = error.message;
    }

    // Check if at least one ping succeeded
    if (!igwSuccess && !ebrSuccess) {
      throw new Error(`Both near IGW and near EBR pings failed. near IGW: ${pingResults.igw_error || 'Unknown'}, near EBR: ${pingResults.ebr_error || 'Unknown'}`);
    }

    // Get tasks.started_at from queue_jobs relation for executed_at
    let taskStartedAt = null;
    if (queueJobId) {
      const taskResult = await client.query(
        'SELECT t.started_at FROM tasks t JOIN queue_jobs qj ON t.id = qj.task_id WHERE qj.id = $1',
        [queueJobId]
      );
      if (taskResult.rows.length > 0) {
        taskStartedAt = taskResult.rows[0].started_at;
      }
    }

    // Return results without INSERT (consolidation will be done by main handler)
    return {
      success: true,
      ping_igw: pingResults.ping_igw ?? null,
      ping_ebr: pingResults.ping_ebr ?? null,
      packet_loss_igw: pingResults.packet_loss_igw ?? null,
      packet_loss_ebr: pingResults.packet_loss_ebr ?? null,
      task_started_at: taskStartedAt,
      raw_response: { igw: igwResponse?.data ?? null, ebr: ebrResponse?.data ?? null }
    };
  } catch (error) {
    console.error('Ping test failed:', error.message);
    console.error('Ping error details:', error);
    return {
      success: false,
      error_message: error.message || 'Unknown error',
      raw_response: { error: error.message || 'Unknown error', details: error.toString() }
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function executeTraceroute(device, queueJobId) {
  console.log(`🔍 Executing traceroute for device ${device.serial_number}`);

  let client;
  try {
    client = await pool.connect();

    // Get Axiros server configuration (cached)
    const axirosServer = await getAxirosServer();

    // Get test server configuration from API
    const testServerResponse = await safeTestServerGet();
    const testServers = testServerResponse.data;

    if (!testServers || testServers.length === 0) {
      throw new Error('No test server configuration found');
    }

    // Filter active test servers by type (use near EBR for traceroute)
    const ebrServers = testServers.filter(s => s.is_active && s.test_type === 'ebr');

    if (ebrServers.length === 0) {
      throw new Error('No active near EBR test server found for traceroute');
    }

    // Construct URL properly for traceroute (uses Portal base path)
    const serverUrl = axirosServer.server_url.replace(/\/$/, '');
    const basePath = axirosServer.base_path.replace(/^\//, '');
    // For traceroute, use Portal instead of Indihome
    const tracerouteBasePath = basePath.replace('/Indihome', '/Portal');
    const tracerouteUrl = `${serverUrl}/${tracerouteBasePath}/DeviceManagement/TR069/RPC/TraceRouteTest`;

    // Execute traceroute test
    const ebrHost = ebrServers[0].ip_address;
    const tracerouteConfig = {
      method: 'POST',
      url: tracerouteUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${axirosServer.auth_password}`
      },
      data: {
        identifiers: device.serial_number,
        host: ebrHost
      },
      timeout: 200000 // 200 seconds timeout
    };

    console.log(`Executing traceroute for device ${device.serial_number}`);
    console.log(`Traceroute URL: ${tracerouteUrl}`);
    console.log(`Traceroute request data: ${JSON.stringify(tracerouteConfig.data)}`);

    const tracerouteResponse = await axios(tracerouteConfig);
    console.log('Traceroute Response:', JSON.stringify(tracerouteResponse.data));

    // Extract traceroute hops from response
    let tracerouteHops = [];
    let diagnosticsState = null;
    if (tracerouteResponse.data.status === 'success' && tracerouteResponse.data.data.post) {
      const post = tracerouteResponse.data.data.post;
      const details = post.details;
      diagnosticsState = details?.DiagnosticsState || null;
      
      // Parse hop data if available, regardless of DiagnosticsState
      // Axiros often returns Requested state but with valid hop data
      const numberOfHops = details?.RouteHopsNumberOfEntries || 0;
      if (numberOfHops > 0 && details) {
        for (let i = 1; i <= numberOfHops; i++) {
          const hop = {
            hop_no: i,
            address: details[`${i}.HopHostAddress`] || null,
            hostname: details[`${i}.HopHost`] || null,
            error_code: details[`${i}.HopErrorCode`] || 0,
            rt_times: details[`${i}.HopRTTimes`] || null
          };
          tracerouteHops.push(hop);
        }
      }
      
      // Log state for debugging
      console.log(`Traceroute state: ${diagnosticsState}, hops: ${tracerouteHops.length}, post code: ${post.code}, message: ${post.message || 'N/A'}`);
    }

    // Get tasks.started_at from queue_jobs relation for executed_at
    let taskStartedAt = null;
    if (queueJobId) {
      const taskResult = await client.query(
        'SELECT t.started_at FROM tasks t JOIN queue_jobs qj ON t.id = qj.task_id WHERE qj.id = $1',
        [queueJobId]
      );
      if (taskResult.rows.length > 0) {
        taskStartedAt = taskResult.rows[0].started_at;
      }
    }

    // Return results without INSERT (consolidation will be done by main handler)
    return {
      success: true,
      traceroute_hops: tracerouteHops,
      diagnostics_state: diagnosticsState,
      task_started_at: taskStartedAt,
      raw_response: tracerouteResponse.data.data.post
    };

  } catch (error) {
    console.error('Traceroute test failed:', error.message);
    console.error('Traceroute error details:', error);
    return {
      success: false,
      error_message: error.message || 'Unknown error',
      raw_response: { error: error.message || 'Unknown error', details: error.toString() }
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function executeDownload(device, queueJobId) {
  console.log(`⚡ Executing download test for device ${device.serial_number}`);

  // Wait for distributed rate limit before download test (shared with upload)
  await waitForSpeedRateLimit(device.id, device.serial_number);

  // Defer DB connection until needed (end of test) to avoid holding a pool
  // client during the ~90s polling loop and starving the pool.
  let client;
  try {
    // Get Axiros server configuration (cached)
    const axirosServer = await getAxirosServer();

    // Construct URL properly
    const serverUrl = axirosServer.server_url.replace(/\/$/, '');
    const basePath = axirosServer.base_path.replace(/^\//, '');
    const startUrl = `${serverUrl}/${basePath}/PostONTDownloadSpeed`;

    // Start download test
    const startConfig = {
      method: 'POST',
      url: startUrl,
      headers: {
        'accept': 'application/json',
        'Authorization': `Basic ${axirosServer.auth_password}`,
        'Content-Type': 'application/json'
      },
      data: {
        cpe_id: device.serial_number,
        service_id: ''
      }
    };

    console.log(`Starting download test for ${device.serial_number}`);

    // Retry start request up to 5 times with 30s delay for "Device Not Ready"
    let startResponse = null;
    let deviceNotReadyCount = 0;
    const maxStartRetries = 5;
    for (let attempt = 1; attempt <= maxStartRetries; attempt++) {
      try {
        console.log(`Download start attempt ${attempt}/${maxStartRetries}`);
        startResponse = await axios(startConfig);
        console.log(`Download start response:`, JSON.stringify(startResponse.data));

        if (startResponse.data.status === 'success' && startResponse.data.code === '0') {
          break; // success
        }

        console.log(`Download start attempt ${attempt} returned non-success: ${JSON.stringify(startResponse.data)}`);
      } catch (err) {
        console.error(`Download start attempt ${attempt} error: ${err.message}`);
        const errMsg = (err.response?.data?.data?.message || err.response?.data?.message || err.response?.data?.data?.message_details || '').toLowerCase();
        if (errMsg.includes("doesn't ready") || errMsg.includes("not ready") || errMsg.includes("badrequest") || errMsg.includes("device doesn't ready to this action")) {
          deviceNotReadyCount++;
          console.log(`Device ${device.serial_number} reported NOT READY (count: ${deviceNotReadyCount})`);
        }
        if (err.response) {
          console.error(`Status: ${err.response.status}, Data: ${JSON.stringify(err.response.data)}`);
        }
      }

      if (attempt < maxStartRetries) {
        console.log(`Retrying download start in 30 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    if (!startResponse || startResponse.data.status !== 'success' || startResponse.data.code !== '0') {
      if (deviceNotReadyCount > 0) {
        return {
          success: false,
          error_message: 'Device Not Ready',
          download_speed: 0,
          raw_response: { error: 'Device Not Ready', message: `Device ${device.serial_number} is not ready for download test after ${maxStartRetries} attempts` }
        };
      }
      const lastData = startResponse ? JSON.stringify(startResponse.data) : 'no response';
      throw new Error(`Failed to start download test after ${maxStartRetries} attempts - ${lastData}`);
    }

    const ticketId = startResponse.data?.data?.post?.ticket_id;
    if (!ticketId) {
      throw new Error(`Download start succeeded but ticket_id is missing in response: ${JSON.stringify(startResponse.data)}`);
    }
    console.log(`Download test started, ticket ID: ${ticketId}`);

    // Adaptive polling: check every 30s for up to ~7.5 minutes (15 attempts)
    const MAX_POLL_ATTEMPTS = 15;
    const INITIAL_DELAY_MS = 5000;
    const POLL_INTERVAL_MS = 30000;

    let downloadSpeed = 0;
    let downloadStatus = '';
    let ticketStatus = '';
    let success = false;

    await new Promise(resolve => setTimeout(resolve, INITIAL_DELAY_MS));

    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
      const resultUrl = `${serverUrl}/${basePath}/GetONTDownloadSpeedResult?id=${ticketId}`;
      console.log(`Checking download result for ticket ${ticketId}, attempt ${attempt}/${MAX_POLL_ATTEMPTS}, URL: ${resultUrl}`);

      const resultConfig = {
        method: 'GET',
        url: resultUrl,
        headers: {
          'accept': 'application/json',
          'Authorization': `Basic ${axirosServer.auth_password}`
        },
        timeout: 30000
      };

      try {
        const resultResponse = await axios(resultConfig);
        const resultData = resultResponse.data;

        if (resultData.status === 'success' && resultData.data && resultData.data.post) {
          const post = resultData.data.post;
          ticketStatus = post.ticket_status || '';
          downloadStatus = post.download_status || '';

          if (post.download_speed) {
            downloadSpeed = post.download_speed;
          }

          console.log(`Download test check ${attempt}: ticketStatus=${ticketStatus}, downloadStatus=${downloadStatus}, speed=${downloadSpeed} Mbps`);

          if (downloadStatus === 'Completed' || downloadStatus === 'Success' && downloadSpeed > 0) {
            console.log(`Download test completed at check ${attempt}, speed=${downloadSpeed} Mbps`);
            success = true;
            break;
          }

          // Terminal failure states
          if (ticketStatus === 'Failed' || ticketStatus === 'Error' || downloadStatus === 'Failed') {
            console.log(`Download test failed at check ${attempt}: ticketStatus=${ticketStatus}`);
            break;
          }
        } else {
          console.log(`Download test check ${attempt}: response not successful - ${JSON.stringify(resultData)}`);
        }
      } catch (error) {
        console.error(`Download test check ${attempt} error: ${error.message}`);
        if (error.response) {
          console.error(`Response status: ${error.response.status}, data: ${JSON.stringify(error.response.data)}`);
        }
      }

      if (attempt < MAX_POLL_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    if (!success) {
      return {
        success: false,
        error_message: `Download test did not complete. Final status: ${ticketStatus || 'unknown'}`,
        download_speed: downloadSpeed,
        raw_response: { ticket_status: ticketStatus, download_status: downloadStatus, download_speed: downloadSpeed, ticket_id: ticketId }
      };
    }

    // Get tasks.started_at from queue_jobs relation for executed_at
    let taskStartedAt = null;
    if (queueJobId) {
      client = await pool.connect();
      const taskResult = await client.query(
        'SELECT t.started_at FROM tasks t JOIN queue_jobs qj ON t.id = qj.task_id WHERE qj.id = $1',
        [queueJobId]
      );
      if (taskResult.rows.length > 0) {
        taskStartedAt = taskResult.rows[0].started_at;
      }
    }

    // Return results without INSERT (consolidation will be done by main handler)
    return {
      success: true,
      download_speed: downloadSpeed,
      task_started_at: taskStartedAt,
      raw_response: { ticket_status: ticketStatus, download_status: downloadStatus, download_speed: downloadSpeed, ticket_id: ticketId }
    };

  } catch (error) {
    console.error('Download test failed:', error.message);
    console.error('Download error details:', error);
    return {
      success: false,
      error_message: error.message || 'Unknown error',
      raw_response: { error: error.message || 'Unknown error', details: error.toString() }
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function executeUpload(device, queueJobId) {
  console.log(`📤 Executing upload test for device ${device.serial_number}`);

  // Wait for distributed rate limit before upload test (shared with download)
  await waitForSpeedRateLimit(device.id, device.serial_number);

  // Defer DB connection until needed (end of test) to avoid holding a pool
  // client during the ~90s polling loop and starving the pool.
  let client;
  try {
    // Get Axiros server configuration (cached)
    const axirosServer = await getAxirosServer();

    // Construct URL properly
    const serverUrl = axirosServer.server_url.replace(/\/$/, ''); // Remove trailing slash
    const basePath = axirosServer.base_path.replace(/^\//, ''); // Remove leading slash
    const startUrl = `${serverUrl}/${basePath}/PostONTUploadSpeed`;
    const startConfig = {
      method: 'POST',
      url: startUrl,
      headers: {
        'accept': 'application/json',
        'Authorization': `Basic ${axirosServer.auth_password}`,
        'Content-Type': 'application/json'
      },
      data: {
        cpe_id: device.serial_number,
        service_id: ''
      }
    };

    console.log(`Starting upload test for ${device.serial_number}`);
    console.log(`Upload test request URL: ${startUrl}`);
    console.log(`Upload test request data: ${JSON.stringify(startConfig.data)}`);

    // Retry start request up to 5 times with 30s delay for "Device Not Ready"
    let startResponse = null;
    let deviceNotReadyCount = 0;
    const maxStartRetries = 5;
    for (let attempt = 1; attempt <= maxStartRetries; attempt++) {
      try {
        console.log(`Upload start attempt ${attempt}/${maxStartRetries}`);
        startResponse = await axios(startConfig);
        console.log(`Upload start response:`, JSON.stringify(startResponse.data));

        if (startResponse.data.status === 'success' && startResponse.data.code === '0') {
          break; // success
        }

        console.log(`Upload start attempt ${attempt} returned non-success: ${JSON.stringify(startResponse.data)}`);
      } catch (err) {
        console.error(`Upload start attempt ${attempt} error: ${err.message}`);
        const errMsg = (err.response?.data?.data?.message || err.response?.data?.message || err.response?.data?.data?.message_details || '').toLowerCase();
        if (errMsg.includes("doesn't ready") || errMsg.includes("not ready") || errMsg.includes("badrequest") || errMsg.includes("device doesn't ready to this action")) {
          deviceNotReadyCount++;
          console.log(`Device ${device.serial_number} reported NOT READY (count: ${deviceNotReadyCount})`);
        }
        if (err.response) {
          console.error(`Status: ${err.response.status}, Data: ${JSON.stringify(err.response.data)}`);
        }
      }

      if (attempt < maxStartRetries) {
        console.log(`Retrying upload start in 30 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    if (!startResponse || startResponse.data.status !== 'success' || startResponse.data.code !== '0') {
      if (deviceNotReadyCount > 0) {
        return {
          success: false,
          error_message: 'Device Not Ready',
          upload_speed: 0,
          raw_response: { error: 'Device Not Ready', message: `Device ${device.serial_number} is not ready for upload test after ${maxStartRetries} attempts` }
        };
      }
      const lastData = startResponse ? JSON.stringify(startResponse.data) : 'no response';
      throw new Error(`Failed to start upload test after ${maxStartRetries} attempts - ${lastData}`);
    }

    const ticketId = startResponse.data?.data?.post?.ticket_id;
    if (!ticketId) {
      throw new Error(`Upload start succeeded but ticket_id is missing in response: ${JSON.stringify(startResponse.data)}`);
    }
    console.log(`Upload test started with ticket_id: ${ticketId}`);

    // Adaptive polling: check every 30s for up to ~7.5 minutes (15 attempts)
    const MAX_POLL_ATTEMPTS = 15;
    const INITIAL_DELAY_MS = 5000;
    const POLL_INTERVAL_MS = 30000;

    let uploadSpeed = 0;
    let uploadStatus = '';
    let ticketStatus = '';
    let success = false;

    await new Promise(resolve => setTimeout(resolve, INITIAL_DELAY_MS));

    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
      const resultUrl = `${serverUrl}/${basePath}/GetONTUploadSpeedResult?id=${ticketId}`;
      console.log(`Checking upload result for ticket ${ticketId}, attempt ${attempt}/${MAX_POLL_ATTEMPTS}, URL: ${resultUrl}`);

      const resultConfig = {
        method: 'GET',
        url: resultUrl,
        headers: {
          'accept': 'application/json',
          'Authorization': `Basic ${axirosServer.auth_password}`
        },
        timeout: 30000
      };

      try {
        const resultResponse = await axios(resultConfig);
        const resultData = resultResponse.data;

        if (resultData.status === 'success' && resultData.code === '0' && resultData.data && resultData.data.post) {
          const post = resultData.data.post;
          ticketStatus = post.ticket_status || '';
          uploadStatus = post.upload_status || '';

          if (post.upload_speed) {
            uploadSpeed = post.upload_speed;
          }

          console.log(`Upload test check ${attempt}: ticketStatus=${ticketStatus}, uploadStatus=${uploadStatus}, speed=${uploadSpeed} Mbps`);

          if (uploadStatus === 'Completed' || uploadStatus === 'Success' && uploadSpeed > 0) {
            console.log(`Upload test completed at check ${attempt}, speed=${uploadSpeed} Mbps`);
            success = true;
            break;
          }

          // Terminal failure states
          if (ticketStatus === 'Failed' || ticketStatus === 'Error' || uploadStatus === 'Failed') {
            console.log(`Upload test failed at check ${attempt}: ticketStatus=${ticketStatus}`);
            break;
          }
        } else {
          console.log(`Upload test check ${attempt}: response not successful - ${JSON.stringify(resultData)}`);
        }
      } catch (error) {
        console.error(`Upload test check ${attempt} error: ${error.message}`);
        if (error.response) {
          console.error(`Response status: ${error.response.status}, data: ${JSON.stringify(error.response.data)}`);
        }
      }

      if (attempt < MAX_POLL_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    if (!success) {
      return {
        success: false,
        error_message: `Upload test did not complete. Final status: ${ticketStatus || 'unknown'}`,
        upload_speed: uploadSpeed,
        raw_response: { ticket_status: ticketStatus, upload_status: uploadStatus, upload_speed: uploadSpeed, ticket_id: ticketId }
      };
    }

    // Get tasks.started_at from queue_jobs relation for executed_at
    let taskStartedAt = null;
    if (queueJobId) {
      client = await pool.connect();
      const taskResult = await client.query(
        'SELECT t.started_at FROM tasks t JOIN queue_jobs qj ON t.id = qj.task_id WHERE qj.id = $1',
        [queueJobId]
      );
      if (taskResult.rows.length > 0) {
        taskStartedAt = taskResult.rows[0].started_at;
      }
    }

    // Return results without INSERT (consolidation will be done by main handler)
    return {
      success: true,
      upload_speed: uploadSpeed,
      task_started_at: taskStartedAt,
      raw_response: { ticket_status: ticketStatus, upload_status: uploadStatus, upload_speed: uploadSpeed, ticket_id: ticketId }
    };

  } catch (error) {
    console.error('Upload test failed:', error.message);
    console.error('Upload error details:', error);
    return {
      success: false,
      error_message: error.message || 'Unknown error',
      raw_response: { error: error.message || 'Unknown error', details: error.toString() }
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function executeOntStatus(device) {
  console.log(`📡 Executing ONT Status check for device ${device.serial_number}`);

  let client;
  try {
    client = await pool.connect();

    // Get Axiros server configuration (cached)
    const axirosServer = await getAxirosServer();

    // Construct URL properly
    const serverUrl = axirosServer.server_url.replace(/\/$/, ''); // Remove trailing slash
    const basePath = axirosServer.base_path.replace(/^\//, ''); // Remove leading slash
    const url = `${serverUrl}/${basePath}/GetONTStatus`;
    const config = {
      method: 'POST',
      url,
      headers: {
        'accept': 'application/json',
        'Authorization': `Basic ${axirosServer.auth_password}`,
        'Content-Type': 'application/json'
      },
      data: {
        cpe_id: device.serial_number,
        service_id: ''
      }
    };

    console.log(`Getting ONT Status for ${device.serial_number}`);
    console.log(`ONT Status request URL: ${url}`);
    console.log(`ONT Status request data: ${JSON.stringify(config.data)}`);
    
    const response = await axios(config);
    console.log(`ONT Status Response:`, JSON.stringify(response.data));
    console.log(`ONT Status Response data:`, JSON.stringify(response.data.data));

    if (response.data.status !== 'success' || response.data.code !== '0') {
      throw new Error(`Failed to get ONT Status - status: ${response.data.status}, code: ${response.data.code}, data: ${JSON.stringify(response.data.data)}`);
    }

    const ontData = response.data.data.post;
    console.log(`ONT Status: ${ontData.ont_status}, Type: ${ontData.ont_type}`);

    // Update devices table with ONT status
    await client.query(
      'UPDATE devices_ont SET status = $1, cpe_type = $2 WHERE serial_number = $3',
      [ontData.ont_status.toLowerCase(), ontData.ont_type, ontData.ont_sn]
    );

    return {
      success: true,
      ont_sn: ontData.ont_sn,
      ont_soft_version: ontData.ont_soft_version,
      ont_status: ontData.ont_status,
      ont_subscription_status: ontData.ont_subscription_status,
      ont_type: ontData.ont_type,
      raw_response: response.data
    };

  } catch (error) {
    console.error('ONT Status check failed:', error.message);
    console.error('ONT Status error details:', error);
    return {
      success: false,
      error_message: error.message || 'Unknown error',
      raw_response: { error: error.message || 'Unknown error', details: error.toString() }
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}
