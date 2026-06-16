const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
      ignore: 'pid,hostname'
    }
  } : undefined,
  base: {
    service: 'mojo-worker',
    version: process.env.npm_package_version || '1.0.0'
  }
});

module.exports = { logger };
