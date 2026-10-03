---
marp: true
theme: uncover
class:
  - lead
  - invert
paginate: true
---

# Mojo-Central
## Roadmap

6 Phase — Foundation to Innovation

---

# Phase 1: Foundation ✅ (Complete)

| Item | Status |
|------|--------|
| Dashboard v2 (alarms, maps, analytics) | ✅ |
| Real-time alarm monitoring | ✅ |
| Root cause analytics (L1/L2) | ✅ |
| Multi-select location filter | ✅ |
| On-demand device test | ✅ |
| User roles & auth | ✅ |
| Latency/speed charts | ✅ |
| Alarm comment + delete | ✅ |
| Duration + MTTR | ✅ |
| **Documentation (HLD, LLD, Roadmap)** | ✅ |

---

# Phase 2: Scale Prep (Q3 2026)

**Target: 15K devices**

| Item | Priority |
|------|----------|
| PgBouncer connection pooling | High |
| PostgreSQL connection leak detection | High |
| Worker graceful SIGTERM | High |
| Prometheus /metrics endpoint | Medium |
| Docker image hardening (distroless) | Medium |
| Ordered shutdown `docker stop` | Medium |
| IaC environment separation | Low |
| OOM kill alerting | Medium |

---

# Phase 2 Risks

| Risk | Mitigation |
|------|------------|
| DB max_connections exhaustion | PgBouncer + monitoring |
| Worker disconnect storms | Exponential backoff |
| Queue memory leak | Worker memory limit 512M |

---

# Phase 3: 26K Scale (Q4 2026)

**Target: 26,000 devices**

| Item | Priority |
|------|----------|
| PostgreSQL partitioning by month | High |
| Data archiving (pg_partman) | High |
| Redis `maxmemory-policy allkeys-lru` | High |
| Direct ping worker per province (34×) | High |
| Worker priority queue | Medium |
| Dispatcher lock (Redis `SET NX`) | Medium |
| Batch test API for provinces | Medium |
| 4-week performance test | Medium |

---

# Phase 3 Targets

| Metric | Target |
|--------|--------|
| Ping test SLA | 26K in 90 min |
| Speed test SLA | 26K in 90 min |
| Direct ping RTT | < 200ms |
| Dashboard P95 | < 500ms |
| Alarm detection | < 5 min |
| Uptime | 99.5% |

---

# Phase 3 Architecture

```
PostgreSQL w/ partitioning
     │
Dispatcher (Redis lock) → BullMQ (priority)
     │
Workers: 34 regional (direct ping)
         3 ACS workers (fast/dl/ul)
     │
PgBouncer → Connection pool
```

---

# Phase 4: Analytics (Q1 2027)

| Item | Priority |
|------|----------|
| Long-term trend dashboard (30/90 day) | High |
| SLA report generator (CSV/PDF) | High |
| Predictive analytics (failure prediction) | Medium |
| Monthly performance digest email | Medium |
| Customizable dashboard widgets | Low |
| Grafana data source integration | Low |

---

# Phase 5: Maturity (Q2–Q3 2027)

| Item | Priority |
|------|----------|
| DR plan (cross-datacenter) | High |
| RTO < 1 hour | High |
| RPO < 5 minutes | High |
| Network automation integration | Medium |
| Incident management integration (Jira/ServiceNow) | Medium |
| Read-only API + rate limiting + docs | Medium |
| K8s migration evaluation | Low |

---

# Phase 5: K8s Architecture

```
Ingress NGINX → Dashboard Pod (2×)
                     │
              Internal Service
                     │
    ┌────────────────┴────────────────┐
Postgres Operator    BullMQ Operator
(RWO + Replica)      (Redis Sentinel)
    │                       │
    └───────────────────────┘
    Worker DaemonSet (per province)
    Worker Deployment (ACS: fast/dl/ul)
```

---

# Phase 6: Innovation (Q4 2027+)

| Item | Timeline |
|------|----------|
| AI/ML anomaly detection | Q4 2027 |
| Automatic root cause suggestion | Q1 2028 |
| Customer-facing portal | Q2 2028 |
| Third-party integration API | Q3 2028 |
| Real-time dashboard (WebSocket) | Q4 2028 |

---

# Tech Debt Register

| Item | Impact | Plan |
|------|--------|------|
| Queue results legacy table | Migration overhead | Phase 2 |
| Monolithic dispatcher | Single point of failure | Phase 3 |
| No connection pooling | DB connection exhaustion | Phase 2 |
| No autoscaling | Manual scaling | Phase 5 |
| No DR | Single data center | Phase 5 |

---

# Capacity Plan

| Timeline | Devices | CPU | RAM | Storage |
|----------|---------|-----|-----|---------|
| Current | 10K | 4-8 vCPU | 16-32 GB | 200-500 GB |
| Q4 2026 | 26K | ~50 vCPU | ~60 GB | ~1.5 TB |
| Q2 2027 | 50K | ~100 vCPU | ~120 GB | ~3 TB |

---

# Key Principles

- **No hardcoded thresholds** — always use `threshold_master`
- **Zero-downtime deployments** — rolling restart
- **Observability first** — metrics before features
- **Document everything** — HLD, LLD, Runbooks
- **Security by design** — least privilege, encryption
