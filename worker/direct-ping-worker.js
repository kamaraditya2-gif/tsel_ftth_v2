require('dotenv').config();
const { exec } = require('child_process');
const { promisify } = require('util');
const pool = require('./db');
const redis = require('./lib/redis');
const { logger } = require('./lib/logger');

const execAsync = promisify(exec);

// Configuration
const PING_INTERVAL_MINUTES = parseInt(process.env.DIRECT_PING_INTERVAL_MINUTES) || 10;
const PING_COUNT = 4; // Number of ping packets to send
const PING_TIMEOUT_MS = 5000; // Timeout for each ping in milliseconds
const DOWNSTREAM_SERVER_ID = parseInt(process.env.DOWNSTREAM_SERVER_ID) || 1; // Which downstream server this worker belongs to
const WORKER_ID = `mojo-direct-ping-${DOWNSTREAM_SERVER_ID}-${Date.now()}`;
const QUEUE_NAME = 'direct-ping';
const WORKER_START_TIME = Date.now().toString();

logger.info('Direct Ping Worker Configuration:', {
  interval: `${PING_INTERVAL_MINUTES} minutes`,
  pingCount: PING_COUNT,
  timeout: `${PING_TIMEOUT_MS}ms`,
  downstreamServerId: DOWNSTREAM_SERVER_ID === 0 ? 'all' : DOWNSTREAM_SERVER_ID
});

// Function to validate IP address (IPv4 and IPv6)
function isValidIPAddress(ip) {
  if (!ip || typeof ip !== 'string') return false;
  
  // IPv4 regex pattern
  const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // IPv6 regex pattern (simplified)
  const ipv6Pattern = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){0,6}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$/;
  
  return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
}

// Function to parse ping output and extract latency and packet loss
function parsePingOutput(output, ipAddress) {
  try {
    const lines = output.split('\n');
    
    // Parse average latency (works for both Windows and Linux)
    let avgLatency = null;
    let packetLoss = 0;
    
    // Windows ping output format: "Minimum = 2ms, Maximum = 3ms, Average = 2ms"
    const windowsMatch = output.match(/Average = (\d+)ms/i);
    if (windowsMatch) {
      avgLatency = parseFloat(windowsMatch[1]);
    }
    
    // Linux ping output format: "rtt min/avg/max/mdev = 2.123/2.456/3.000/0.123 ms"
    const linuxMatch = output.match(/rtt min\/avg\/max\/mdev = [\d.]+\/([\d.]+)\/[\d.]+\/[\d.]+ ms/i);
    if (linuxMatch && !avgLatency) {
      avgLatency = parseFloat(linuxMatch[1]);
    }
    
    // Alpine/BusyBox ping output format: "round-trip min/avg/max = 2.123/2.456/3.000 ms"
    const alpineMatch = output.match(/round-trip min\/avg\/max = [\d.]+\/([\d.]+)\/[\d.]+ ms/i);
    if (alpineMatch && !avgLatency) {
      avgLatency = parseFloat(alpineMatch[1]);
    }
    
    // Parse packet loss
    // Windows: "Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)"
    const windowsLossMatch = output.match(/\((\d+)% loss\)/i);
    if (windowsLossMatch) {
      packetLoss = parseFloat(windowsLossMatch[1]);
    }
    
    // Linux: "4 packets transmitted, 4 received, 0% packet loss"
    const linuxLossMatch = output.match(/(\d+)% packet loss/i);
    if (linuxLossMatch && packetLoss === 0) {
      packetLoss = parseFloat(linuxLossMatch[1]);
    }
    
    return {
      avgLatency,
      packetLoss
    };
  } catch (error) {
    logger.error(`Error parsing ping output for ${ipAddress}:`, error.message);
    return { avgLatency: null, packetLoss: null };
  }
}

// Function to check if fping is available
async function checkFpingAvailable() {
  try {
    await execAsync('fping -v');
    return true;
  } catch (error) {
    return false;
  }
}

// Function to parse fping output
function parseFpingOutput(output) {
  try {
    const lines = output.split('\n');
    const results = {};
    
    for (const line of lines) {
      // fping reachable:   "192.168.1.1 : xmt/rcv/%loss = 4/4/0%, min/avg/max = 2.1/2.3/2.5"
      // fping unreachable: "192.168.1.1 : xmt/rcv/%loss = 4/0/100%"
      // Note: some fping versions omit "ms" suffix
      const match = line.match(/^(\S+)\s*:\s*xmt\/rcv\/%loss\s*=\s*(\d+)\/(\d+)\/(\d+)%(?:,\s*min\/avg\/max\s*=\s*([\d.]+)\/([\d.]+)\/([\d.]+))?(?:\s*ms)?/i);
      if (match) {
        const ip = match[1].trim();
        const packetLoss = parseFloat(match[4]);
        // avgLatency exists only when host is reachable (min/avg/max present)
        const avgLatency = match[6] ? parseFloat(match[6]) : null;
        results[ip] = { avgLatency, packetLoss };
      }
    }
    
    return results;
  } catch (error) {
    logger.error('Error parsing fping output:', error.message);
    return {};
  }
}

// Function to ping multiple IPs using fping
async function pingIPsFping(ipAddresses) {
  try {
    const ips = ipAddresses.join(' ');
    const fpingCommand = `fping -c ${PING_COUNT} -t ${PING_TIMEOUT_MS} ${ips}`;
    
    logger.debug(`Pinging ${ipAddresses.length} IPs with fping: ${fpingCommand}`);
    const { stdout, stderr } = await execAsync(fpingCommand, { timeout: PING_TIMEOUT_MS * PING_COUNT + 10000 });
    
    // fping writes per-packet lines to stdout and summary lines to stderr.
    // Combine both so parseFpingOutput can find the summary statistics.
    const combinedOutput = (stdout || '') + '\n' + (stderr || '');
    const results = parseFpingOutput(combinedOutput);
    logger.debug(`Fping results:`, results);
    
    return results;
  } catch (error) {
    // fping returns non-zero exit code (1) when some hosts are unreachable,
    // but stdout still contains valid results for reachable hosts.
    // Extract stdout from the error object to parse partial results.
    // fping returns non-zero when some hosts are unreachable.
    // Summary stats are in stderr, per-packet lines in stdout.
    const combinedErrorOutput = (error.stdout || '') + '\n' + (error.stderr || '');
    if (combinedErrorOutput.trim()) {
      const results = parseFpingOutput(combinedErrorOutput);
      const successCount = Object.values(results).filter((r) => r.avgLatency !== null).length;
      logger.warn(`Fping exited with code ${error.code || 1}, but parsed ${successCount}/${ipAddresses.length} results`);
      logger.debug(`Partial fping results:`, results);
      return results;
    }
    
    logger.error('Fping failed:', error.message);
    return {};
  }
}

// Function to ping an IP address (fallback to regular ping)
async function pingIP(ipAddress) {
  try {
    const platform = process.platform;
    let pingCommand;
    
    if (platform === 'win32') {
      // Windows ping command
      pingCommand = `ping -n ${PING_COUNT} -w ${PING_TIMEOUT_MS} ${ipAddress}`;
    } else {
      // Linux/Mac ping command
      pingCommand = `ping -c ${PING_COUNT} -W ${PING_TIMEOUT_MS / 1000} ${ipAddress}`;
    }
    
    logger.debug(`Pinging ${ipAddress}: ${pingCommand}`);
    const { stdout, stderr } = await execAsync(pingCommand, { timeout: PING_TIMEOUT_MS * PING_COUNT + 5000 });
    
    if (stderr && !stdout) {
      throw new Error(stderr);
    }
    
    const result = parsePingOutput(stdout, ipAddress);
    logger.debug(`Ping result for ${ipAddress}:`, result);
    
    return {
      success: true,
      ...result
    };
  } catch (error) {
    logger.error(`Ping failed for ${ipAddress}:`, error.message);
    return {
      success: false,
      avgLatency: null,
      packetLoss: null
    };
  }
}

// Main function to process all devices
async function processDirectPing() {
  // Check for stop signal from dashboard
  try {
    const stopSignal = await redis.get('worker:stop-signal');
    if (stopSignal && parseInt(stopSignal) > parseInt(WORKER_START_TIME)) {
      logger.info('Stop signal received from dashboard, shutting down...');
      await pool.end();
      if (redis.status === 'ready') {
        await redis.hdel('acs-workers', WORKER_ID).catch(() => {});
      }
      process.exit(0);
    }
  } catch (e) {
    // ignore redis errors
  }

  logger.info('Starting direct ping cycle...');
  
  let client;
  try {
    client = await pool.connect();
    
    // Get devices with IP addresses for this downstream server/region.
    // DOWNSTREAM_SERVER_ID=0 means "all regions" (useful for a single global worker).
    const devicesRes = DOWNSTREAM_SERVER_ID === 0
      ? await client.query(
          'SELECT id, device_name, serial_number, ip_address FROM devices_ont WHERE ip_address IS NOT NULL'
        )
      : await client.query(
          'SELECT id, device_name, serial_number, ip_address FROM devices_ont WHERE ip_address IS NOT NULL AND downstream_server_id = $1',
          [DOWNSTREAM_SERVER_ID]
        );
    
    // Filter devices with valid IP addresses in JavaScript
    const devices = devicesRes.rows.filter(device => {
      const ip = device.ip_address;
      return ip && 
             ip !== '' && 
             ip !== 'null' && 
             ip.trim().length > 0 &&
             isValidIPAddress(ip.trim());
    });
    
    logger.info(`Found ${devices.length} devices with valid IP addresses to ping`);
    
    if (devices.length === 0) {
      logger.info('No devices to ping');
      return;
    }
    
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;
    
    // Check if fping is available
    const useFping = await checkFpingAvailable();
    if (useFping) {
      logger.info('Using fping for faster pinging');
    } else {
      logger.info('fping not available, using regular ping');
    }
    
    if (useFping && devices.length > 0) {
      // Use fping to ping all IPs at once
      const ipAddresses = devices.map(d => d.ip_address.trim());
      const fpingResults = await pingIPsFping(ipAddresses);
      
      // Process results
      for (const device of devices) {
        const ip = device.ip_address.trim();
        const result = fpingResults[ip];
        
        if (result && result.avgLatency !== null) {
          await client.query(
            `INSERT INTO test_results_direct_ping (device_id, ip_address, avg_latency_ms, packet_loss_percent, downstream_server_id, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [device.id, ip, result.avgLatency, result.packetLoss, DOWNSTREAM_SERVER_ID]
          );
          
          logger.info(`✅ Saved ping result for ${device.device_name || device.serial_number}: ${result.avgLatency}ms, ${result.packetLoss}% loss`);
          successCount++;
        } else {
          logger.warn(`❌ Failed to ping ${device.device_name || device.serial_number} (${ip})`);
          failureCount++;
        }
      }
    } else {
      // Fallback to regular ping (one by one)
      for (const device of devices) {
        const ip = device.ip_address.trim();
        
        logger.info(`Pinging device ${device.device_name || device.serial_number} (${ip})`);
        
        const pingResult = await pingIP(ip);
        
        if (pingResult.success && pingResult.avgLatency !== null) {
          await client.query(
            `INSERT INTO test_results_direct_ping (device_id, ip_address, avg_latency_ms, packet_loss_percent, downstream_server_id, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [device.id, ip, pingResult.avgLatency, pingResult.packetLoss, DOWNSTREAM_SERVER_ID]
          );
          
          logger.info(`✅ Saved ping result for ${device.device_name || device.serial_number}: ${pingResult.avgLatency}ms, ${pingResult.packetLoss}% loss`);
          successCount++;
        } else {
          logger.warn(`❌ Failed to ping ${device.device_name || device.serial_number} (${ip})`);
          failureCount++;
        }
        
        // Small delay between pings to avoid overwhelming the network
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    logger.info(`Direct ping cycle completed: ${successCount} successful, ${failureCount} failed, ${skippedCount} skipped (invalid IP)`);
    
  } catch (error) {
    logger.error('Error in direct ping cycle:', error.message);
    console.error('Error in direct ping cycle:', error.message);
    console.error('Error details:', error);
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Start the worker
async function startWorker() {
  logger.info('Starting Direct Ping Worker...');
  
  // Run immediately on start
  await processDirectPing();
  
  // Schedule recurring runs
  const intervalMs = PING_INTERVAL_MINUTES * 60 * 1000;
  logger.info(`Next ping cycle in ${PING_INTERVAL_MINUTES} minutes`);
  
  setInterval(async () => {
    logger.info(`Starting scheduled ping cycle (interval: ${PING_INTERVAL_MINUTES} minutes)`);
    await processDirectPing();
    logger.info(`Next ping cycle in ${PING_INTERVAL_MINUTES} minutes`);
  }, intervalMs);
}

// Heartbeat mechanism - register this worker in Redis for dashboard visibility.
// Gracefully skip if Redis is not configured (e.g. regional workers without local Redis).
const HEARTBEAT_ENABLED = !!(process.env.REDIS_HOST || process.env.REDIS_URL);

const updateHeartbeat = async () => {
  if (!HEARTBEAT_ENABLED) return;
  try {
    await redis.hset('acs-workers', WORKER_ID, JSON.stringify({
      id: WORKER_ID,
      status: 'running',
      lastHeartbeat: new Date().toISOString(),
      concurrency: 1,
      queue: QUEUE_NAME,
      downstreamServerId: DOWNSTREAM_SERVER_ID
    }));
    await redis.expire('acs-workers', 120);
  } catch (error) {
    logger.error('Failed to update heartbeat:', error.message);
  }
};

if (HEARTBEAT_ENABLED) {
  setInterval(updateHeartbeat, 60000);
  updateHeartbeat();
} else {
  logger.info('Redis not configured — heartbeat disabled (worker will not appear in dashboard worker menu)');
}

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.warn({ signal }, 'Received shutdown signal, stopping worker...');
  if (HEARTBEAT_ENABLED) {
    await redis.hdel('acs-workers', WORKER_ID).catch(() => {});
    await redis.quit();
  }
  await pool.end();
  logger.info('Worker stopped gracefully');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the worker
startWorker().catch(error => {
  logger.fatal('Failed to start worker:', error);
  process.exit(1);
});
