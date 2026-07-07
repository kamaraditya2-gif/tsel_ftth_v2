# Roadmap — MojoJojoMonitor

> **Status**: Production — Active Development
> **Target Scale**: 26,000+ ONT devices across multiple regional servers

---

## Phase 0: Foundation (Completed)

### Core Infrastructure
- [x] PostgreSQL 15 database with full schema (master, operational, results, alarms)
- [x] Redis 7 with BullMQ queue system (4 queues: fast, download, upload, legacy)
- [x] Docker Compose unified deployment (8 services)
- [x] Modular docker-compose files for split deployment (infra, app, worker, dispatcher)
- [x] Shared bridge network `mojojojo_network`
- [x] Single-server deployment (4-8 vCPU, 16-32 GB RAM, 200-500 GB SSD)
- [x] Multi-stage Dockerfile (dashboard: builder + runner; worker: single-stage Alpine)
- [x] Worker Docker image with `fping` + `iputils` for ICMP ping
- [x] Dashboard Docker image with `docker` + `docker-compose` for admin scaling
- [x] 34 per-province direct ping workers defined in scaling compose
- [x] Docker healthchecks for all services (pg_isready, redis-cli ping, HTTP /api/health)
- [x] Resource limits (CPU + memory) per container
- [x] Redis security: password auth, read-only filesystem, tmpfs, no-new-privileges
- [x] PostgreSQL data persistence to bind mount
- [x] Redis RDB persistence to bind mount
- [x] Dashboard .next volume mount for live rebuilds
- [x] frp tunnel for external dashboard access (gandooz.cloud:8804)
- [x] `.env.example` documenting all tunable configuration
- [x] Regional direct-ping-worker deployment model (per-province servers)

### Dashboard (Next.js 14 App Router)
- [x] Main dashboard with 4 KPI cards (Latency, Speed, Packet Loss, Devices)
- [x] Network topology diagram (ONT → BNG → IGW → File Server)
- [x] Device heatmap (MapLibre GL with color-coded markers)
- [x] Recharts-based time-series charts (latency, speed, packet loss trends)
- [x] ONT Type & Brand comparison bar charts
- [x] Severity summary & root cause analytics (Canvas 2D)
- [x] Top devices (worst performers per metric)
- [x] Device management page (CRUD, filters, pagination, detail modal)
- [x] Alarm management v1 & v2 pages

### Worker System
- [x] Dispatcher with 1-minute cron (scheduled + pending job dispatch)
- [x] 3 dedicated BullMQ workers (fast, download, upload)
- [x] Direct ping worker (ICMP fping, independent loop)
- [x] Axiros ACS API integration (ping, traceroute, speed tests, ont-status)
- [x] Distributed rate limiting via Redis (10s per-device cooldown)
- [x] Circuit breaker for Axiros config (5 failures → 30s timeout)
- [x] Worker heartbeat (Redis, 60s interval)

### Features
- [x] Role-based access control (admin, operator, viewer, field)
- [x] Session-based authentication
- [x] Login rate limiting (Redis-based)
- [x] Multi-level location filtering (Area → Regional/DS → NOP)
- [x] Scheduled & on-demand test task management
- [x] Threshold configuration via threshold_master
- [x] Alarm lifecycle (create, clear, duration tracking)
- [x] Notification integrations (Telegram, WhatsApp, Ticketing)
- [x] Root cause analysis (L1 category → L2 specific cause)
- [x] Comment threads per device alarm
- [x] MTTR tracking & reporting
- [x] CSV report exports
- [x] AI chatbot widget (Google Gemini + OpenAI)

---

## Phase 1: Stabilization & Scale Prep (Q3 2026)

### Infrastructure & Container Optimization
- [ ] **PgBouncer** — Add connection pooling for PostgreSQL (currently: 10 conns/worker × N workers = high connection count)
- [ ] **Reduce Docker image size** — Audit dashboard runner image (~800 MB); remove unnecessary binaries
- [ ] **Container layer caching** — Optimize Dockerfile layer ordering for faster rebuilds in CI
- [ ] **Health check hardening** — Add health endpoint to workers (currently: dashboard only)
- [ ] **Container logging driver** — Switch Docker from `json-file` to `journald` or `local` for log management
- [ ] **Docker network security** — Implement network segmentation (infra vs app vs worker networks)
- [ ] **Database backup automation** — Script `pg_dump` daily to S3-compatible storage (30-day retention) + WAL archiving for PITR

### Performance & Scalability
- [ ] **Batch inserts** — Replace individual queue_job inserts with multi-value INSERT (currently: 50-per-chunk but row-by-row)
- [ ] **Direct ping batch insert** — Convert direct-ping-worker to batch inserts instead of row-per-device
- [ ] **Increase MAX_PENDING_JOBS** — Raise from 50,000 to 200,000+ for full 26K device coverage
- [ ] **Increase CHUNK_SIZE** — Raise from 50 to 500-1,000 for faster dispatch
- [ ] **Worker concurrency env var** — Make `WORKER_CONCURRENCY` configurable per queue type
- [ ] **Queue metrics** — Expose BullMQ queue depth, processing rate, failure rate as Prometheus metrics

### Reliability
- [ ] **Graceful degradation** — If Axiros API is down, workers should still handle non-ACS tasks
- [ ] **Dead letter queue** — Jobs that fail after max retries should go to DLQ for manual review
- [ ] **Worker health check endpoint** — HTTP endpoint per worker for Docker healthcheck
- [ ] **Automatic worker recovery** — If worker crashes or becomes unresponsive, Docker auto-restart + Redis-based rebalancing
- [ ] **Database migration system** — Formal migration tool (e.g., node-pg-migrate) instead of ad-hoc DO $$ blocks

### Monitoring & Observability
- [ ] **Structured logging** — Migrate from console.log to structured JSON logging (pino already in worker deps)
- [ ] **Centralized log aggregation** — Docker logging driver → centralized system (Loki/Elasticsearch)
- [ ] **Key metrics dashboard** — Grafana dashboard for: queue depth, worker count, job latency, error rates, DB connection pool usage
- [ ] **Container resource monitoring** — cAdvisor + Prometheus for CPU/memory/disk per container
- [ ] **Alerting** — Alert when queues back up (pending > 10K), workers go offline, DB connections exhausted, disk > 80%
- [ ] **Request tracing** — Add correlation IDs (run_id) spanning from task creation → dispatch → worker execution → result storage

### Bug Fixes & Hardening
- [ ] **Stalled job handling** — Review BullMQ stalledInterval values; ensure stalled jobs are retried not lost
- [ ] **Device IP validation** — Add proper IPv4/IPv6 validation in direct-ping-worker
- [ ] **Session timeout** — Add session expiry and refresh mechanism
- [ ] **Rate limit edge cases** — Ensure rate limit keys are properly cleaned up after device deletion
- [ ] **Alarm dedup** — Prevent duplicate active_alarms for same device + same alarm_type

---

## Phase 2: 26K Device Scaling (Q4 2026)

### Horizontal Scaling
- [ ] **ACS Fast Workers** — Scale to 13 containers (concurrency=10 each) = 78,000 jobs/hour capacity
- [ ] **ACS Download Workers** — Scale to 6 containers (concurrency=10 each) = covers all 26K devices in 6 hours
- [ ] **ACS Upload Workers** — Scale to 6 containers (concurrency=10 each) = same as download
- [ ] **Direct Ping Workers** — Shard by `downstream_server_id` (5-10 workers, each covering 2-5 regions)
- [ ] **Worker sharding** — Implement `id % SHARD_COUNT` for intra-region device distribution
- [ ] **Docker Swarm / K8s** — Evaluate orchestration platform for auto-scaling workers (replicas, rolling updates, self-healing)

### Infrastructure Upgrades
- [ ] **Multi-host deployment** — Split services across dedicated hosts (DB, Dashboard, Worker pools)
- [ ] **PostgreSQL read replicas** — Dashboard reads from replicas, workers write to primary
- [ ] **PgBouncer deployment** — Connection pooling for N workers × 10 connections = reduced DB load
- [ ] **Redis cluster** — Sharded Redis for queue data + rate limiting across multiple instances
- [ ] **Redis memory upgrade** — Increase from 1GB to 2-4GB for full queue capacity
- [ ] **Load balancer** — Add Nginx/HAProxy in front of dashboard for HA (HTTPS termination + SSL)
- [ ] **Total estimated hardware**: ~50 vCPU, 60GB RAM across multiple VMs
- [ ] **Storage scaling** — PostgreSQL data volume: 500 GB → 1 TB; add monitoring-based auto-scaling

### Network Topology Enhancements
- [ ] **Site-to-site VPN** — Connect regional servers to central via WireGuard/IPsec for secure DB access
- [ ] **Traffic shaping** — QoS for worker → Axiros API traffic (prevent rate limiting)
- [ ] **DNS-based regional routing** — Regional workers discover nearest database replica via DNS
- [ ] **Network latency monitoring** — Track DB query latency from regional workers to central DB
- [ ] **CDN for dashboard** — Cache static assets (Next.js chunks) on CDN for faster NOC access

### Regional Deployment
- [ ] **Regional worker packaging** — Standalone `install.sh` for regional direct-ping-worker
- [ ] **Offline/air-gapped deployment** — Bundle all images + deps for remote regions without internet
- [ ] **Regional health monitoring** — Dashboard shows per-region worker status, last successful test, data latency
- [ ] **Regional DB read replicas** — Each region has local replica for low-latency queries

---

## Phase 3: Feature Expansion (Q1 2027)

### Advanced Analytics
- [ ] **Predictive analytics** — ML model to predict device failure based on historical metrics (latency trend, packet loss pattern)
- [ ] **Anomaly detection** — Automatic detection of unusual metric patterns (sudden latency spikes, gradual speed degradation)
- [ ] **Capacity planning** — Report showing per-region bandwidth utilization trends; recommends speed group upgrades
- [ ] **SLA reporting** — Per-customer/per-region SLA compliance (uptime %, speed conformity %, latency within threshold %)
- [ ] **Custom dashboard builder** — Drag-and-drop widget layout per user role

### Alarm System Enhancements
- [ ] **Alarm correlation** — Group related alarms (same device, same root cause, same region) into incidents
- [ ] **Escalation policies** — Auto-escalate unacknowledged critical alarms after N minutes (SMS → phone call)
- [ ] **Scheduled maintenance mode** — Suppress alarms during planned maintenance windows
- [ ] **AI root cause suggestion** — Based on historical patterns, suggest likely root cause when assigning
- [ ] **Root cause analytics v2** — Multi-dimensional drill-down (by region, by brand, by speed package, by time)

### Customer-Facing Features
- [ ] **Customer portal** — White-labeled dashboard for ISP customers (view their own device stats only)
- [ ] **Self-service speed test** — End-user can trigger speed test from customer portal
- [ ] **Automated ticket creation** — When alarm cleared, automatically generate ticket with Full RCA

### Integrations
- [ ] **API Gateway** — REST API for external systems to query device status, trigger tests, get alarm data
- [ ] **Webhook notifications** — Configurable webhook per alarm type
- [ ] **Email reports** — Scheduled PDF/CSV email delivery
- [ ] **Slack / Microsoft Teams** — Additional notification channels
- [ ] **Grafana datasource plugin** — Allow Grafana to query MojoJojoMonitor data directly

---

## Phase 4: Maturity (Q2-Q3 2027)

### Infrastructure Maturity
- [ ] **Container image vulnerability scanning** — Trivy/Snyk in CI pipeline; weekly scan reports
- [ ] **Docker layer cache optimization** — BuildKit cache mounts; shared layer registry for fast multi-host builds
- [ ] **Infrastructure as Code** — Terraform/Pulumi for VM provisioning + Docker Compose deployment
- [ ] **Auto-scaling worker pools** — Based on queue depth: scale up when pending > 10K, scale down when < 1K
- [ ] **Chaos engineering** — Worker failover testing, DB connection storm testing, network partition simulation

### DevOps & Reliability
- [ ] **CI/CD pipeline** — GitHub Actions for automated build, test, and deployment
- [ ] **Blue-green deployment** — Zero-downtime dashboard updates via load balancer
- [ ] **Canary deployments for workers** — Deploy new worker version to 10% capacity, monitor, then full rollout
- [ ] **Disaster recovery** — Automated backup → offsite restore procedure; RTO < 1 hour, RPO < 15 minutes
- [ ] **Database DR** — Streaming replication to standby region; automated failover (Patroni/Repmgr)
- [ ] **Container restart policy audit** — Ensure all containers have appropriate restart: always + on-failure limits
- [ ] **SLO monitoring** — Track and report on key service level objectives (dashboard latency < 500ms, alarm processing < 1min)

### Network & Security
- [ ] **TLS everywhere** — Dashboard behind Nginx with LetsEncrypt/Cloudflare SSL
- [ ] **mTLS for worker ↔ DB** — Mutual TLS authentication between regional workers and central database
- [ ] **Docker Bench Security** — Run security audit; remediate findings (non-root users, seccomp, apparmor)
- [ ] **WAF for dashboard** — Cloudflare/ModSecurity to protect exposed dashboard endpoint
- [ ] **Rate limiting at load balancer** — Nginx rate limiting before requests reach dashboard container
- [ ] **Network policy enforcement** — Kubernetes NetworkPolicy or iptables rules restricting inter-container traffic

### Code Quality
- [ ] **TypeScript migration** — Full type coverage across all code (currently minimal types)
- [ ] **Unit tests** — Jest for dashboard components + worker logic
- [ ] **Integration tests** — Test dispatcher → worker → database flow end-to-end
- [ ] **E2E tests** — Playwright/Cypress for critical user journeys (login → dashboard → alarms → device detail)
- [ ] **API documentation** — OpenAPI/Swagger spec for all API routes
- [ ] **Performance benchmarks** — k6/Gatling tests for API throughput under load

### Internationalization
- [ ] **Multi-language** — English + Bahasa Indonesia UI
- [ ] **Timezone support** — Configurable timezone per user profile
- [ ] **RTL support** — Right-to-left UI layout
- [ ] **Localized number formats** — Thousand separators, decimal points per locale

---

## Phase 5: Innovation (Q4 2027+)

### AI/ML Operations
- [ ] **Automated remediation** — For known root causes (e.g., "FO Cut" → auto-create field ticket with location, "High Temp" → notify field team)
- [ ] **Chatbot v2** — Natural language querying: "Which devices had latency > 100ms in Bali last week?", "Show me alarm trends for R01"
- [ ] **Network topology auto-discovery** — Use traceroute data to automatically build and update network topology graph
- [ ] **Bandwidth forecasting** — Predict per-region bandwidth needs 3/6/12 months ahead

### Multi-Vendor Support
- [ ] **Generic ACS adapter** — Plugin architecture for multiple ACS vendors (not just Axiros)
- [ ] **TR-069 / TR-098 / TR-181** — Support multiple CWMP data models
- [ ] **SNMP monitoring** — Add SNMP polling for non-ACS devices (routers, switches, OLT)
- [ ] **OpenConfig/gRPC** — Streaming telemetry support for modern network devices

### Advanced Visualization
- [ ] **3D network topology** — Three.js/WebGL interactive network graph
- [ ] **Real-time dashboard** — WebSocket-based live updates (no 30s polling)
- [ ] **Mobile app** — React Native / Flutter app for field engineers
- [ ] **AR field tool** — Augmented reality overlay showing device status when point phone at ODP/ONTC

### Next-Gen Infrastructure
- [ ] **Multi-region active-active** — Full active-active deployment across 2+ datacenters with global load balancer
- [ ] **Kubernetes migration** — Migrate from Docker Compose to K8s (statefulsets for DB, deployments for workers, HPA for auto-scaling)
- [ ] **Service mesh** — Istio/Linkerd for mTLS, traffic splitting, observability between all microservices
- [ ] **Edge computing** — Deploy lightweight workers at ISP PoPs (closer to ONT devices for lower latency ICMP)
- [ ] **Immutable infrastructure** — Golden AMIs/images with Packer; zero-trust deployment model
- [ ] **Green infrastructure** — Carbon-aware scheduling; scale down non-critical workers during low-carbon intensity hours

---

## Key Milestones Summary

| Milestone | Target | Key Deliverables |
|-----------|--------|-----------------|
| Foundation | ✅ Done | Dashboard + Workers + Queue + Alarms + Auth + Docker deployment + Regional model |
| Scale Ready | Q3 2026 | PgBouncer, batch ops, container optimization, metrics, migration system, backup automation |
| 26K Scale | Q4 2026 | 25+ scaled workers, sharding, multi-host deployment, HA DB + Redis, regional health monitoring |
| Analytics | Q1 2027 | ML predictions, anomaly detection, SLA reporting, customer portal, CDN, network security |
| Maturity | Q2-Q3 2027 | CI/CD, IaC, full test coverage, DR plan, vulnerability scanning, auto-scaling |
| Innovation | Q4 2027+ | AI remediation, multi-vendor, AR, real-time dashboard, multi-region active-active, K8s migration |

---

## Current Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Axiros API rate limiting | Jobs fail/timeout | Medium | Distributed Redis rate limiter + circuit breaker |
| DB connection exhaustion | Workers hang | Medium | PgBouncer (Phase 1); connection pool tuning |
| Redis memory overflow | Queue data loss | Low | `removeOnComplete`/`removeOnFail` TTLs; Redis eviction policy; monitor in Phase 1 |
| Single dashboard instance | Full UI outage | Low | Docker restart-policy; multi-instance behind Nginx planned |
| Stalled BullMQ jobs | Tests never complete | Low | stalledInterval + maxStalledCount configuration |
| Regional network outage | Direct ping fails | Medium | Independent worker; data stays locally until reconnection |
| Disk full (DB logs) | Database crash | Medium | Log rotation; disk monitoring alert at 80%; separate data/log partitions |
| Docker image sprawl | Disk space | Low | `docker system prune` cron job; CI cleanup old images |
| Container memory leak | OOM kills | Medium | Resource limits set; memory monitoring; auto-restart with backoff |
| frp tunnel down | Dashboard unreachable | Medium | frp auto-restart; multi-tunnel fallback; direct IP backup |

---

## Tech Debt Register

| Item | Priority | Effort | Notes |
|------|----------|--------|-------|
| Console.log → structured logging | High | 2 days | Pino already in deps |
| TypeScript types coverage | Medium | 2 weeks | Start with shared types |
| Database migration tool | High | 3 days | Replace ad-hoc SQL |
| Unit tests | Medium | 3 weeks | Jest setup |
| Dashboard Docker image size optimization | Medium | 2 days | ~800 MB; remove unused binaries |
| Container non-root user | High | 1 day | Workers run as root; add USER directive |
| Docker layer caching optimization | Medium | 1 day | Reorder RUN commands for better cache hits |
| API error standardization | Low | 3 days | Consistent error response format |
| Remove legacy queue_results | Low | 1 day | After confirming no consumers |
| ESLint configuration | Low | 1 day | Clean up lint rules |
| Log rotation policy | Medium | 4 hours | Docker json-file max-size/max-file config |
| Backup automation script | High | 1 day | pg_dump cron + S3 upload |
| Redis eviction policy review | Low | 2 hours | Ensure allkeys-lru or volatile-ttl |
| Health endpoint for workers | Medium | 1 day | Simple HTTP server in worker process |
