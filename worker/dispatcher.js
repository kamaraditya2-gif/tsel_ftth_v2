require('dotenv').config();
const cron = require('node-cron');
const { Queue } = require('bullmq');
const pool = require('./db');

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
};

const defaultJobOptions = {
  removeOnComplete: {
    count: 100,
    age: 3600 // Remove completed jobs after 1 hour
  },
  removeOnFail: {
    count: 500,
    age: 7200 // Remove failed jobs after 2 hours
  }
};

// Three dedicated queues for parallel worker distribution
const fastQueue = new Queue('acs-fast', { connection: redisConnection, defaultJobOptions });
const downloadQueue = new Queue('acs-download', { connection: redisConnection, defaultJobOptions });
const uploadQueue = new Queue('acs-upload', { connection: redisConnection, defaultJobOptions });

// Legacy queue for backward compatibility (ont-status and fallback)
const legacyQueue = new Queue('acs-queue', { connection: redisConnection, defaultJobOptions });

const CHUNK_SIZE = 50; // Process devices in chunks to avoid CPU spike

console.log('🚀 Dispatcher started');
console.log(`   Redis: ${redisConnection.host}:${redisConnection.port}`);
console.log(`   Postgres: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

// Map test type to the appropriate queue
function getQueueForTestType(testType) {
  switch (testType) {
    case 'ping':
    case 'traceroute':
    case 'ont-status':
      return fastQueue;
    case 'download':
      return downloadQueue;
    case 'upload':
      return uploadQueue;
    default:
      return legacyQueue;
  }
}

// Get total pending jobs across all queues
async function getTotalPendingJobs() {
  const [fast, download, upload, legacy] = await Promise.all([
    fastQueue.getJobCounts('waiting', 'active', 'delayed'),
    downloadQueue.getJobCounts('waiting', 'active', 'delayed'),
    uploadQueue.getJobCounts('waiting', 'active', 'delayed'),
    legacyQueue.getJobCounts('waiting', 'active', 'delayed'),
  ]);
  
  const active = 
    (fast.waiting || 0) + (fast.active || 0) + (fast.delayed || 0) +
    (download.waiting || 0) + (download.active || 0) + (download.delayed || 0) +
    (upload.waiting || 0) + (upload.active || 0) + (upload.delayed || 0);
  const legacyTotal = (legacy.waiting || 0) + (legacy.active || 0) + (legacy.delayed || 0);
  
  // Auto-clean legacy queue if it has accumulated stale jobs
  if (legacyTotal > 10000) {
    try {
      await legacyQueue.drain();
      console.log(`   🧹 Auto-drained legacy queue (had ${legacyTotal} stale jobs)`);
    } catch (e) {
      console.error('   Failed to drain legacy queue:', e.message);
    }
  }
    
  return { total: active, fast, download, upload, legacy };
}

// Jalankan pengecekan setiap menit
cron.schedule('* * * * *', async () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ⏰ Checking for scheduled tasks...`);
  
  let client;
  try {
    client = await pool.connect();

    // Cari task yang aktif dengan scheduled type
    const tasksRes = await client.query(`
      SELECT * FROM tasks
      WHERE is_active = true
        AND next_run IS NOT NULL
        AND next_run < NOW() AT TIME ZONE 'Asia/Jakarta'
        AND deleted_at IS NULL
    `);

    const tasks = tasksRes.rows;

    if (tasks.length === 0) {
      console.log(`[${timestamp}]   No active scheduled tasks found`);
    } else {
      console.log(`[${timestamp}]   Found ${tasks.length} active scheduled tasks`);
      tasks.forEach(task => {
        console.log(`   - Task ${task.id}: ${task.title} (is_active: ${task.is_active}, deleted_at: ${task.deleted_at}, next_run: ${task.next_run})`);
      });

      for (const task of tasks) {
        await processScheduledTask(client, task);
      }
    }

    // Cari queue jobs dengan status pending yang belum dikirim ke queue
    const pendingJobsRes = await client.query(`
      SELECT qj.*, d.serial_number, t.title as task_name
      FROM queue_jobs qj
      LEFT JOIN devices_ont d ON qj.device_id = d.id
      LEFT JOIN tasks t ON qj.task_id = t.id
      WHERE qj.status = 'pending'
      ORDER BY qj.created_at ASC
      LIMIT 100
    `);

    const pendingJobs = pendingJobsRes.rows;

    if (pendingJobs.length > 0) {
      console.log(`[${timestamp}]   Found ${pendingJobs.length} pending queue jobs to dispatch`);

      for (const job of pendingJobs) {
        try {
          const queue = getQueueForTestType(job.test_type);
          await queue.add('process-acs', {
            queueJobId: job.id,
            deviceId: job.device_id,
            testType: job.test_type
          }, {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000
            }
          });

          // Mark as processing immediately so we don't re-dispatch
          await client.query(
            `UPDATE queue_jobs SET status = 'processing', started_at = NOW() WHERE id = $1 AND status = 'pending'`,
            [job.id]
          );

          console.log(`[${timestamp}]   Dispatched pending job ${job.id} (${job.test_type}) to ${queue.name} (Task: ${job.task_name || 'N/A'})`);
        } catch (error) {
          console.error(`   Error dispatching pending job ${job.id}:`, error.message);
        }
      }
    }

  } catch (error) {
    console.error('❌ Dispatcher error:', error.message);
  } finally {
    if (client) client.release();
  }
});

// Calculate next run time based on cron expression
function calculateNextRun(cronTime) {
  // Get current time in Asia/Jakarta timezone
  const now = new Date();
  const jakartaOffset = 7 * 60; // Jakarta is UTC+7 (420 minutes)
  const localOffset = now.getTimezoneOffset();
  const jakartaTime = new Date(now.getTime() + (jakartaOffset + localOffset) * 60000);
  
  const parts = cronTime.split(' ');
  const minute = parseInt(parts[0]);
  const hour = parseInt(parts[1]);
  const dayOfMonth = parts[2];
  const month = parts[3];
  const dayOfWeek = parts[4];
  
  const nextRun = new Date(jakartaTime);
  
  if (dayOfMonth === '*' && dayOfWeek === '*') {
    // Minute-based interval (e.g., */15 * * * *)
    if (parts[0].startsWith('*/') && parts[1] === '*') {
      const interval = parseInt(parts[0].substring(2));
      nextRun.setMinutes(Math.ceil(nextRun.getMinutes() / interval) * interval);
      nextRun.setSeconds(0);
      nextRun.setMilliseconds(0);
      if (nextRun <= jakartaTime) {
        nextRun.setMinutes(nextRun.getMinutes() + interval);
      }
    // Hourly or daily intervals
    } else if (parts[1].startsWith('*/')) {
      // Every N hours - preserve current minute
      const interval = parseInt(parts[1].substring(2));
      nextRun.setHours(nextRun.getHours() + interval);
      nextRun.setSeconds(0);
      nextRun.setMilliseconds(0);
    } else if (parts[1] === '*') {
      // Every hour - preserve current minute
      nextRun.setHours(nextRun.getHours() + 1);
      nextRun.setSeconds(0);
      nextRun.setMilliseconds(0);
    } else {
      // Specific hour - use cron minute
      nextRun.setHours(hour);
      nextRun.setMinutes(minute);
      nextRun.setSeconds(0);
      nextRun.setMilliseconds(0);
      if (nextRun <= jakartaTime) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
    }
  } else if (dayOfWeek !== '*') {
    // Weekly (specific day of week)
    nextRun.setHours(hour);
    nextRun.setMinutes(minute);
    nextRun.setSeconds(0);
    nextRun.setMilliseconds(0);
    const currentDay = nextRun.getDay();
    const targetDay = parseInt(dayOfWeek);
    const daysToAdd = (targetDay - currentDay + 7) % 7 || 7;
    nextRun.setDate(nextRun.getDate() + daysToAdd);
    if (nextRun <= jakartaTime) {
      nextRun.setDate(nextRun.getDate() + 7);
    }
  }
  
  return nextRun;
}

async function processScheduledTask(client, task) {
  try {
    // Cek apakah task ini sudah dijalankan dalam menit ini (prevent duplicate)
    const lastRunCheck = await client.query(`
      SELECT COUNT(*) as count 
      FROM queue_jobs 
      WHERE task_id = $1 
        AND created_at > NOW() - INTERVAL '1 minute'
    `, [task.id]);
    
    if (parseInt(lastRunCheck.rows[0].count) > 0) {
      console.log(`   Task ${task.id} already executed this minute, skipping`);
      return;
    }
    
    console.log(`   Processing task: ${task.title} (${task.test_type})`);
    
    // Ambil device IDs berdasarkan group_id atau device_id
    let deviceIds = [];
    
    if (task.group_id) {
      let query, params;
      if (task.nop_city) {
        query = `SELECT d.id FROM devices_ont d WHERE d.downstream_server_id = $1 AND d.cluster_nop_id = $2`;
        params = [task.group_id, parseInt(task.nop_city)];
      } else {
        query = `SELECT d.id FROM devices_ont d WHERE d.downstream_server_id = $1`;
        params = [task.group_id];
      }
      const devicesRes = await client.query(query, params);
      deviceIds = devicesRes.rows.map(d => d.id);
      console.log(`   Found ${deviceIds.length} devices with downstream_server_id = ${task.group_id}${task.nop_city ? `, nop_id = ${task.nop_city}` : ''}`);
    } else if (task.device_id) {
      deviceIds = [task.device_id];
      console.log(`   Single device task`);
    }
    
    if (deviceIds.length === 0) {
      console.log(`   No devices found for task ${task.id}`);
      return;
    }
    
    // Ambil payload data untuk snapshot
    let payloadData = null;
    if (task.payload_id) {
      const payloadRes = await client.query('SELECT * FROM payloads WHERE id = $1', [task.payload_id]);
      if (payloadRes.rows.length > 0) {
        payloadData = payloadRes.rows[0];
      }
    }
    
    // Urai menjadi individual jobs dengan chunking
    await dispatchJobsInChunks(client, deviceIds, task, payloadData);
    
    // Update next_run untuk scheduled tasks
    console.log(`   Task ${task.id} - task_type: ${task.task_type}, cron_time: ${task.cron_time}`);
    if (task.task_type === 'scheduled' && task.cron_time) {
      try {
        const nextRun = calculateNextRun(task.cron_time);
        console.log(`   Calculated next_run: ${nextRun.toISOString()}`);
        await client.query(
          'UPDATE tasks SET next_run = $1, updated_at = NOW() WHERE id = $2',
          [nextRun, task.id]
        );
        console.log(`   ✅ Updated next_run for task ${task.id}: ${nextRun.toISOString()}`);
      } catch (error) {
        console.error(`   ❌ Error updating next_run for task ${task.id}:`, error.message);
      }
    } else if (task.task_type === 'ondemand') {
      // Set is_active to false after creating queue_jobs for on-demand tasks
      await client.query(
        'UPDATE tasks SET is_active = false, updated_at = NOW() WHERE id = $1',
        [task.id]
      );
      console.log(`   Set is_active to false for on-demand task ${task.id}`);
    } else {
      console.log(`   Skipping next_run update - task_type: ${task.task_type}, has cron_time: ${!!task.cron_time}`);
    }
    
  } catch (error) {
    console.error(`   Error processing task ${task.id}:`, error.message);
  }
}

async function dispatchJobsInChunks(client, deviceIds, task, payloadData) {
  // Split test_type into individual test types
  const testTypes = task.test_type ? task.test_type.split(',').map(t => t.trim()) : [];
  
  if (testTypes.length === 0) {
    console.log(`   No test types specified for task ${task.id}`);
    return;
  }

  // Generate unique run_id for this execution
  const runId = `${task.id}-${Date.now()}`;

  // Check total queue size across all queues
  const queueCounts = await getTotalPendingJobs();
  const totalPending = queueCounts.total;

  console.log(`   Current queue status across all queues: ${totalPending} total pending`);
  console.log(`     acs-fast: ${(queueCounts.fast.waiting || 0) + (queueCounts.fast.active || 0) + (queueCounts.fast.delayed || 0)} pending`);
  console.log(`     acs-download: ${(queueCounts.download.waiting || 0) + (queueCounts.download.active || 0) + (queueCounts.download.delayed || 0)} pending`);
  console.log(`     acs-upload: ${(queueCounts.upload.waiting || 0) + (queueCounts.upload.active || 0) + (queueCounts.upload.delayed || 0)} pending`);
  
  const MAX_PENDING_JOBS = 50000; // Increased max pending jobs for 3 queues
  
  if (totalPending > MAX_PENDING_JOBS) {
    console.log(`   ⚠️  Too many pending jobs (${totalPending}), skipping task ${task.id}`);
    // Update next_run to try again later
    if (task.task_type === 'scheduled' && task.cron_time) {
      const nextRun = calculateNextRun(task.cron_time);
      await client.query(
        'UPDATE tasks SET next_run = $1, updated_at = NOW() WHERE id = $2',
        [nextRun, task.id]
      );
    }
    return;
  }

  // Delete stale queue_jobs for this task — hanya yang pending > 1 jam
  // Jangan hapus yang baru dibuat (< 1 jam) karena worker mungkin masih proses
  await client.query("DELETE FROM queue_jobs WHERE task_id = $1 AND status = 'pending' AND created_at < NOW() - INTERVAL '1 hour'", [task.id]);
  console.log(`   Deleted stale queue_jobs for task ${task.id}`);

  // Dedup: skip pairs that already have a pending/processing queue_job for this task
  const existingRes = await client.query(
    "SELECT device_id, test_type FROM queue_jobs WHERE task_id = $1 AND status IN ('pending','processing')",
    [task.id]
  );
  const existingSet = new Set(existingRes.rows.map(r => `${r.device_id}-${r.test_type}`));

  const totalJobs = deviceIds.length * testTypes.length;
  let jobsDispatched = 0;

  for (let i = 0; i < deviceIds.length; i += CHUNK_SIZE) {
    const deviceChunk = deviceIds.slice(i, i + CHUNK_SIZE);

    // Build the full (device × testType) pair list for this chunk
    const pairs = [];
    for (const devId of deviceChunk) {
      for (const testType of testTypes) {
        const key = `${devId}-${testType}`;
        if (!existingSet.has(key)) {
          pairs.push({ devId, testType });
        }
      }
    }
    if (pairs.length === 0) {
      console.log(`   All device×testType combinations already queued, skipping chunk`);
      continue;
    }

    // Single multi-row INSERT for the whole chunk instead of N×M round-trips.
    // Postgres returns RETURNING rows in the same order as the VALUES list,
    // so we can map the generated ids back to their pairs by index.
    const values = [];
    const params = [];
    pairs.forEach((pair, idx) => {
      const base = idx * 7;
      values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
      params.push(task.id, pair.devId, payloadData, 'scheduled', pair.testType, 'pending', runId);
    });

    const jobRes = await client.query(
      `INSERT INTO queue_jobs (task_id, device_id, payload_data, execution_type, test_type, status, run_id)
       VALUES ${values.join(', ')}
       RETURNING id`,
      params
    );

    // Enqueue all jobs for this chunk in parallel, routing to the correct queue
    await Promise.all(pairs.map((pair, idx) => {
      const queueJobId = jobRes.rows[idx].id;
      // Unique job ID for deduplication
      const jobId = `${pair.devId}-${pair.testType}-${task.id}`;
      const queue = getQueueForTestType(pair.testType);

      jobsDispatched++;
      return queue.add('process-acs', {
        queueJobId,
        deviceId: pair.devId,
        testType: pair.testType
      }, {
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      });
    }));

    console.log(`   Dispatched chunk ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(deviceIds.length/CHUNK_SIZE)} (${deviceChunk.length} devices × ${testTypes.length} test types)`);
    
    // Beri jeda 500ms antar chunk untuk menghindari CPU spike
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`   ✅ Task ${task.id} dispatched: ${jobsDispatched} jobs (${deviceIds.length} devices × ${testTypes.length} test types)`);
}

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n⚠️  Received ${signal}. Closing dispatcher...`);
  await fastQueue.close();
  await downloadQueue.close();
  await uploadQueue.close();
  await legacyQueue.close();
  await pool.end();
  console.log('👋 Dispatcher closed gracefully');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

console.log('✅ Dispatcher is running and checking tasks every minute...');
