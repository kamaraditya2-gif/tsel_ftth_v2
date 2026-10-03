# Redis Security Best Practices

## Overview
This document outlines the Redis security measures implemented in this project following industry standards.

## Implemented Security Measures

### 1. Password Authentication
- **Status**: ✅ Implemented
- **Description**: All Redis connections require password authentication
- **Configuration**: `REDIS_PASSWORD` environment variable
- **Default**: `mojo_redis_password` (change in production)
- **Implementation**: 
  - Redis client (`dashboard/lib/redis.ts`) enforces password
  - Redis config (`config/redis.conf`) sets `requirepass`
  - Docker healthcheck uses password for authentication

### 2. TLS/SSL Encryption
- **Status**: ✅ Implemented (Optional)
- **Description**: Support for encrypted connections to Redis
- **Configuration**: 
  - `REDIS_TLS=true` to enable
  - `REDIS_TLS_REJECT_UNAUTHORIZED=false` for development
- **Implementation**: Redis client supports TLS socket configuration
- **Production**: Enable with valid certificates in `config/redis.conf`

### 3. Network Security
- **Status**: ✅ Implemented
- **Description**: Redis binds to localhost only
- **Configuration**: 
  - Docker port binding: `127.0.0.1:6379:6379`
  - Redis config: `bind 0.0.0.0` (container-level)
  - Protected mode enabled
- **Implementation**: External access blocked at Docker level

### 4. Command Renaming
- **Status**: ✅ Implemented
- **Description**: Dangerous commands are disabled/renamed
- **Renamed Commands**:
  - `FLUSHDB` → disabled
  - `FLUSHALL` → disabled
  - `CONFIG` → disabled
  - `SHUTDOWN` → disabled
  - `DEBUG` → disabled
  - `EVAL` → disabled
- **Purpose**: Prevents attackers from using dangerous commands

### 5. Access Control Lists (ACL)
- **Status**: ✅ Implemented (Configured)
- **Description**: User-based permissions for Redis 6.0+
- **Configuration**: 
  - Default user with full permissions
  - Application user template (commented)
  - Worker user template (commented)
- **Implementation**: Configured in `config/redis.conf`
- **Usage**: Uncomment and configure custom users for production

### 6. Resource Limits
- **Status**: ✅ Implemented
- **Description**: Prevents DoS attacks through memory exhaustion
- **Configuration**:
  - `maxmemory 512mb`
  - `maxmemory-policy allkeys-lru`
  - Docker memory limit: 1GB
  - Docker CPU limit: 0.5 cores
- **Purpose**: Evicts least recently used keys when memory is full

### 7. Container Security
- **Status**: ✅ Implemented
- **Description**: Docker container hardening
- **Measures**:
  - `read_only: true` - Container filesystem is read-only
  - `no-new-privileges:true` - Prevents privilege escalation
  - `tmpfs: /tmp` - Temporary filesystem for write operations
  - Config file mounted as read-only (`:ro`)

### 8. Logging and Monitoring
- **Status**: ✅ Implemented
- **Description**: Security event logging
- **Configuration**:
  - `slowlog-log-slower-than 10000` - Logs slow commands
  - `slowlog-max-len 128` - Keeps last 128 slow operations
  - `loglevel notice` - Standard logging level

## Environment Variables

### Required
```bash
REDIS_PASSWORD=your_secure_password_here
```

### Optional (TLS)
```bash
REDIS_TLS=true
REDIS_TLS_REJECT_UNAUTHORIZED=false  # For development only
REDIS_URL=rediss://localhost:6379    # Use rediss:// for TLS
```

### Optional (Database)
```bash
REDIS_DB=0
```

## Production Deployment Checklist

- [ ] Change `REDIS_PASSWORD` to a strong, unique password
- [ ] Enable TLS/SSL with valid certificates
- [ ] Configure ACL users with minimal required permissions
- [ ] Set `bind` to specific IP addresses instead of `0.0.0.0`
- [ ] Review and adjust `maxmemory` based on server capacity
- [ ] Enable Redis AUTH for all connections
- [ ] Use `rediss://` URL scheme for TLS connections
- [ ] Set `REDIS_TLS_REJECT_UNAUTHORIZED=true` in production
- [ ] Configure firewall rules to limit Redis port access
- [ ] Enable Redis persistence (AOF) for data durability
- [ ] Monitor Redis logs for suspicious activity
- [ ] Regular security audits and updates

## Security Monitoring

### Key Metrics to Monitor
- Connection attempts from unknown IPs
- Failed authentication attempts
- Slow query logs (potential injection attempts)
- Memory usage patterns
- Command execution frequency

### Alerts to Set Up
- Multiple failed authentication attempts
- Memory usage approaching limit
- Unexpected command execution
- Connection spikes from unknown sources

## Common Security Pitfalls

1. **Exposing Redis to Public Internet**
   - Never bind Redis to `0.0.0.0` without firewall
   - Always use `127.0.0.1` for local development

2. **Weak or No Password**
   - Always set a strong password
   - Rotate passwords regularly
   - Never use default passwords in production

3. **Running as Root**
   - Docker container runs as non-root user (Redis default)
   - Never run Redis as root on host system

4. **Disabling Protected Mode**
   - Keep `protected-mode yes` enabled
   - Prevents accidental exposure to public networks

5. **Not Using TLS**
   - Enable TLS for all production deployments
   - Encrypt all data in transit

## Additional Resources

- [Redis Security Documentation](https://redis.io/topics/security)
- [Redis ACL Documentation](https://redis.io/topics/acl)
- [OWASP Redis Security](https://cheatsheetseries.owasp.org/cheatsights/Redis_Security_Cheat_Sheet.html)

## Emergency Procedures

### If Redis is Compromised
1. Immediately change `REDIS_PASSWORD`
2. Rotate all application credentials
3. Review Redis logs for unauthorized access
4. Flush Redis cache if data may be compromised
5. Restart Redis container with new configuration
6. Audit all Redis keys for suspicious data

### If Password is Lost
1. Stop Redis container
2. Edit `config/redis.conf` to set new password
3. Restart Redis container
4. Update environment variables in all applications
5. Restart all applications using Redis

## Contact
For security concerns or questions, contact the DevOps team.
