const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Direct Ping Worker');
console.log('');

const worker = spawn('node', ['direct-ping-worker.js'], {
  cwd: __dirname,
  stdio: 'inherit'
});

worker.on('error', (err) => {
  console.error('❌ Direct Ping Worker failed to start:', err);
});

worker.on('exit', (code, signal) => {
  console.log(`🛑 Direct Ping Worker exited with code ${code}, signal ${signal}`);
});

console.log(`✅ Direct Ping Worker started (PID: ${worker.pid})`);
console.log(`💡 Press Ctrl+C to stop the worker\n`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Direct Ping Worker...');
  worker.kill('SIGTERM');
  
  setTimeout(() => {
    console.log('✅ Direct Ping Worker stopped');
    process.exit(0);
  }, 5000);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Direct Ping Worker...');
  worker.kill('SIGTERM');
  
  setTimeout(() => {
    console.log('✅ Direct Ping Worker stopped');
    process.exit(0);
  }, 5000);
});
