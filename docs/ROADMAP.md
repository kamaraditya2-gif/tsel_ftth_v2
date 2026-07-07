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

### Performance & Scalability
- [ ] **PgBouncer** — Add connection pooling for PostgreSQL (currently: 10 conns/worker × N workers = high connection count)
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
- [ ] **Alerting** — Alert when queues back up (pending > 10K), workers go offline, DB connections exhausted
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
- [ ] **Docker Swarm / K8s** — Evaluate orchestration platform for auto-scaling workers

### Infrastructure Upgrades
- [ ] **PostgreSQL read replicas** — Dashboard reads from replicas, workers write to primary
- [ ] **Redis cluster** — Sharded Redis for queue data + rate limiting across multiple instances
- [ ] **Redis memory upgrade** — Increase from 1GB to 2-4GB for full queue capacity
- [ ] **Load balancer** — Add Nginx/HAProxy in front of dashboard for HA
- [ ] **Total estimated hardware**: ~50 vCPU, 60GB RAM across multiple VMs

### Regional Deployment
- [ ] **Regional worker packaging** — Standalone `install.sh` for regional direct-ping-worker
- [ ] **Offline/air-gapped deployment** — Bundle all images + deps for remote regions without internet
- [ ] **Regional health monitoring** — Dashboard shows per-region worker status, last successful test, data latency

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

### DevOps & Reliability
- [ ] **CI/CD pipeline** — GitHub Actions for automated build, test, and deployment
- [ ] **Blue-green deployment** — Zero-downtime dashboard updates
- [ ] **Chaos engineering** — Worker failover testing, DB connection storm testing
- [ ] **Disaster recovery** — Automated backup → offsite restore procedure; RTO < 1 hour, RPO < 15 minutes
- [ ] **SLO monitoring** — Track and report on key service level objectives (dashboard latency < 500ms, alarm processing < 1min)

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

---

## Key Milestones Summary

| Milestone | Target | Key Deliverables |
|-----------|--------|-----------------|
| Foundation | ✅ Done | Dashboard + Workers + Queue + Alarms + Auth |
| Scale Ready | Q3 2026 | PgBouncer, batch ops, metrics, migration system |
| 26K Scale | Q4 2026 | 25+ scaled workers, sharding, regional deployment |
| Analytics | Q1 2027 | ML predictions, anomaly detection, SLA reporting, customer portal |
| Maturity | Q2-Q3 2027 | CI/CD, full test coverage, DR, SLO monitoring |
| Innovation | Q4 2027+ | AI remediation, multi-vendor, AR, real-time dashboard |

---

## Current Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Axiros API rate limiting | Jobs fail/timeout | Medium | Distributed Redis rate limiter + circuit breaker |
| DB connection exhaustion | Workers hang | Medium | PgBouncer (Phase 1) |
| Redis memory overflow | Queue data loss | Low | `removeOnComplete`/`removeOnFail` TTLs; monitor in Phase 1 |
| Single dashboard instance | Full UI outage | Low | Docker restart-policy; multi-instance planned |
| Stalled BullMQ jobs | Tests never complete | Low | stalledInterval + maxStalledCount configuration |
| Regional network outage | Direct ping fails | Medium | Independent worker; data stays in region until sync |

---

## Tech Debt Register

| Item | Priority | Effort | Notes |
|------|----------|--------|-------|
| Console.log → structured logging | High | 2 days | Pino already in deps |
| TypeScript types coverage | Medium | 2 weeks | Start with shared types |
| Database migration tool | High | 3 days | Replace ad-hoc SQL |
| Unit tests | Medium | 3 weeks | Jest setup |
| API error standardization | Low | 3 days | Consistent error response format |
| Remove legacy queue_results | Low | 1 day | After confirming no consumers |
| ESLint configuration | Low | 1 day | Clean up lint rules |
