const { spawn } = require('child_process');
const path = require('path');

// Get number of workers from command line or environment
const numWorkers = parseInt(process.argv[2]) || parseInt(process.env.NUM_WORKERS) || 2;

console.log('🚀 Starting Worker Manager');
console.log(`   Number of Workers: ${numWorkers}`);
console.log('');

const workers = [];

for (let i = 0; i < numWorkers; i++) {
  const worker = spawn('node', ['worker.js'], {
    cwd: __dirname,
    stdio: 'inherit'
  });

  worker.on('error', (err) => {
    console.error(`❌ Worker ${i + 1} failed to start:`, err);
  });

  worker.on('exit', (code, signal) => {
    console.log(`🛑 Worker ${i + 1} exited with code ${code}, signal ${signal}`);
  });

  workers.push(worker);
  console.log(`✅ Worker ${i + 1} started (PID: ${worker.pid})`);
}

console.log(`\n✨ All ${numWorkers} workers started successfully`);
console.log(`💡 Press Ctrl+C to stop all workers\n`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down workers...');
  
  for (const worker of workers) {
    worker.kill('SIGTERM');
  }
  
  setTimeout(() => {
    console.log('✅ All workers stopped');
    process.exit(0);
  }, 5000);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down workers...');
  
  for (const worker of workers) {
    worker.kill('SIGTERM');
  }
  
  setTimeout(() => {
    console.log('✅ All workers stopped');
    process.exit(0);
  }, 5000);
});
