# Mojo-Central — API & Data Flow Reference

---

## 1. Axiros ACS API (TR-069 RPC)

Base URL yang dikonfigurasi di DB `axiros_server`:

```
server_url: https://acs.network.telkomsel.co.id
base_path:  /live/AXAPI/Indihome
Auth:       Basic base64(username:password)
```

### 1.1 Ping Test — `IPPingTest`

**Endpoint**: `POST {server_url}/{base_path.replace('/Indihome','/Portal')}/DeviceManagement/TR069/RPC/IPPingTest`

**Request**:
```json
{
  "identifiers": "HWT0123456789",
  "host": "10.11.12.13"
}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "post": {
      "details": {
        "AverageResponseTime": 25.4,
        "FailureCount": 0,
        "MaximumResponseTime": 30.1,
        "MinimumResponseTime": 20.2,
        "SuccessCount": 4
      }
    }
  }
}
```

Worker memanggil 2×: ke **IGW** (ping_igw) dan ke **EBR** (ping_ebr), dengan retry 2× per target.

---

### 1.2 Traceroute Test — `TraceRouteTest`

**Endpoint**: `POST {server_url}/{base_path.replace('/Indihome','/Portal')}/DeviceManagement/TR069/RPC/TraceRouteTest`

**Request**:
```json
{
  "identifiers": "HWT0123456789",
  "host": "10.22.33.44"
}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "post": {
      "code": 200,
      "details": {
        "DiagnosticsState": "Requested",
        "RouteHopsNumberOfEntries": 8,
        "1.HopHost": "gw-1.router.local",
        "1.HopHostAddress": "192.168.1.1",
        "1.HopErrorCode": 0,
        "1.HopRTTimes": "2.5ms",
        "2.HopHost": "10.1.1.1",
        "2.HopHostAddress": "10.1.1.1",
        "2.HopErrorCode": 0,
        "2.HopRTTimes": "5.1ms",
        "3.HopHost": "10.2.2.1",
        "3.HopHostAddress": "10.2.2.1",
        "3.HopErrorCode": 0,
        "3.HopRTTimes": "12.3ms",
        "4.HopHost": "172.16.1.1",
        "4.HopHostAddress": "172.16.1.1",
        "4.HopErrorCode": 0,
        "4.HopRTTimes": "18.7ms",
        "5.HopHostAddress": "10.11.12.13",
        "5.HopErrorCode": 0,
        "5.HopRTTimes": "25.4ms"
      },
      "message": "OK"
    }
  }
}
```

Worker parse hops dari `1.HopHostAddress` sampai `N.HopRTTimes`.

---

### 1.3 Download Speed Test

#### Start: `POST {base_path}/PostONTDownloadSpeed`

**Request**:
```json
{
  "cpe_id": "HWT0123456789",
  "service_id": ""
}
```

**Response**:
```json
{
  "status": "success",
  "code": "0",
  "data": {
    "post": {
      "ticket_id": "TKT-20260709-ABCD1234",
      "message": "Download test started"
    }
  }
}
```

#### Poll Result: `GET {base_path}/GetONTDownloadSpeedResult?id={ticket_id}`

**Response** (while running):
```json
{
  "status": "success",
  "code": "0",
  "data": {
    "post": {
      "ticket_status": "In Progress",
      "download_status": "Running",
      "download_speed": 0
    }
  }
}
```

**Response** (completed):
```json
{
  "status": "success",
  "code": "0",
  "data": {
    "post": {
      "ticket_status": "Completed",
      "download_status": "Completed",
      "download_speed": 95.5
    }
  }
}
```

Worker: retry start 5× @30s (handle "Device Not Ready"), lalu poll 15× @30s (~7.5 menit).

---

### 1.4 Upload Speed Test

#### Start: `POST {base_path}/PostONTUploadSpeed`

**Request**:
```json
{
  "cpe_id": "HWT0123456789",
  "service_id": ""
}
```

**Response**:
```json
{
  "status": "success",
  "code": "0",
  "data": {
    "post": {
      "ticket_id": "TKT-20260709-EFGH5678"
    }
  }
}
```

#### Poll Result: `GET {base_path}/GetONTUploadSpeedResult?id={ticket_id}`

**Response** (completed):
```json
{
  "status": "success",
  "code": "0",
  "data": {
    "post": {
      "ticket_status": "Completed",
      "upload_status": "Completed",
      "upload_speed": 22.3
    }
  }
}
```

---

### 1.5 ONT Status — `GetONTStatus`

**Endpoint**: `POST {base_path}/GetONTStatus`

**Request**:
```json
{
  "cpe_id": "HWT0123456789",
  "service_id": ""
}
```

**Response**:
```json
{
  "status": "success",
  "code": "0",
  "data": {
    "post": {
      "ont_sn": "HWT0123456789",
      "ont_soft_version": "V300R021C10SPC100",
      "ont_status": "Online",
      "ont_subscription_status": "Active",
      "ont_type": "Huawei EG8145V5"
    }
  }
}
```

Worker update `devices_ont` dengan `status + cpe_type`.

---

## 2. Internal API Endpoints (Next.js → PostgreSQL)

### 2.1 Devices

#### GET `/api/devices?area_id=&regional_id=&nop_id=&manufacturer=&cpe_type=`

**Response**:
```json
[
  {
    "id": 1,
    "device_name": "ONT-JKT-001",
    "serial_number": "HWT0123456789",
    "mac_address": "A1:B2:C3:D4:E5:F6",
    "ip_address": "192.168.1.100",
    "status": "online",
    "group_id": 1,
    "speed_id": 2,
    "indihome_id": "IH123456",
    "cpe_type": "Huawei EG8145V5",
    "manufacturer": "Huawei",
    "model": "EG8145V5",
    "lat": -6.2088,
    "lng": 106.8456,
    "downstream_server_id": 11,
    "cluster_nop_id": 5,
    "alias_device": null,
    "group_name": "Jakarta Pusat",
    "speed_name": "100 Mbps",
    "region_name": "Jakarta",
    "region_province": "DKI Jakarta",
    "nop_name": "JKP",
    "area_name": "Jabodetabek",
    "avg_ping": 15.3
  }
]
```

#### POST `/api/devices`

**Request**:
```json
{
  "device_name": "ONT-JKT-002",
  "serial_number": "HWT0987654321",
  "mac_address": "F6:E5:D4:C3:B2:A1",
  "ip_address": "192.168.1.101",
  "group_id": 1,
  "speed_id": 2,
  "indihome_id": "IH654321",
  "cpe_type": "Nokia G-010G-Q",
  "manufacturer_id": 1,
  "ont_model_id": 3,
  "status": "offline",
  "lat": -6.2,
  "lng": 106.8,
  "downstream_server_id": 11,
  "cluster_nop_id": 5
}
```

**Response**: `201 Created` — full device row.

---

### 2.2 Performance Data

#### GET `/api/performance?device_id=1&period=24h&test_type=ping`

**Response**:
```json
{
  "device": {
    "id": 1,
    "device_name": "ONT-JKT-001",
    "serial_number": "HWT0123456789"
  },
  "data": [
    {
      "executed_at": "2026-07-09T10:00:00Z",
      "ping_igw": 15.2,
      "ping_ebr": 25.4,
      "packet_loss_igw": 0,
      "packet_loss_ebr": 0
    }
  ]
}
```

#### GET `/api/performance?device_id=1&test_type=download`

**Response**:
```json
{
  "data": [
    {
      "executed_at": "2026-07-09T10:00:00Z",
      "download_speed": 95.5,
      "success": true
    }
  ]
}
```

---

### 2.3 Dashboard Summary

#### GET `/api/dashboard/summary`

**Response**:
```json
{
  "total_devices": 26000,
  "online_devices": 24500,
  "offline_devices": 1500,
  "active_alarms": 45,
  "recent_tests_24h": 52000,
  "avg_ping": 18.5,
  "avg_download": 85.3,
  "avg_upload": 20.1,
  "alarms_by_type": {
    "latency": 20,
    "download": 15,
    "upload": 10
  },
  "mttr_avg_hours": 4.5
}
```

---

### 2.4 Map Data

#### GET `/api/devices/map?area_id=1&regional_id=11`

**Response**:
```json
[
  {
    "id": 1,
    "device_name": "ONT-JKT-001",
    "serial_number": "HWT0123456789",
    "lat": -6.2088,
    "lng": 106.8456,
    "status": "online",
    "avg_ping": 15.3,
    "avg_download": 95.5,
    "avg_upload": 22.1,
    "has_alarm": false
  }
]
```

#### POST/GET `/api/devices/map/ondemand` (On-Demand Test)

**POST** — Trigger test:
```json
// Request
{ "deviceId": 1 }
// Response: 201
{ "taskId": 1234, "deviceId": 1, "status": "requested" }
```

**GET** — Poll hasil:
```
GET /api/devices/map/ondemand?deviceId=1
```
```json
{
  "jobs": [
    { "id": "uuid-1", "status": "completed", "testType": "ping" },
    { "id": "uuid-2", "status": "completed", "testType": "download" },
    { "id": "uuid-3", "status": "completed", "testType": "upload" }
  ],
  "hasResult": true,
  "overallStatus": "completed",
  "results": {
    "ping_igw": 15.2,
    "ping_ebr": 25.4,
    "packet_loss_igw": 0,
    "packet_loss_ebr": 0,
    "download_speed": 95.5,
    "download_threshold": null,
    "upload_speed": 22.3,
    "upload_threshold": null,
    "executed_at": "2026-07-09T10:00:00.000Z"
  }
}
```

---

### 2.5 Alarms

#### GET `/api/alarms/active?area_id=1&regional_id=11`

**Response**:
```json
[
  {
    "id": 1,
    "device_id": 1,
    "device_name": "ONT-JKT-001",
    "serial_number": "HWT0123456789",
    "alarm_type": "latency",
    "metric_value": 150.5,
    "threshold_value": 100,
    "severity": "warning",
    "message": "LATENCY alarm: 150.5 ms (threshold: 100)",
    "triggered_at": "2026-07-09T08:00:00Z",
    "last_checked_at": "2026-07-09T10:00:00Z",
    "run_id": "123-1720500000000",
    "region_name": "Jakarta",
    "region_province": "DKI Jakarta",
    "nop_name": "JKP",
    "root_cause_name": "High Temperature",
    "root_cause_category": "L1",
    "root_cause_note": "Cooling fan failure",
    "assigned_by": "admin",
    "assigned_at": "2026-07-09T09:00:00Z",
    "action": "Dispatch crew",
    "pic": "Budi",
    "action_assigned_at": "2026-07-09T09:00:00Z",
    "comments": [
      {
        "id": 1,
        "comment": "Crew dispatched to location",
        "created_by": "admin",
        "created_at": "2026-07-09T09:05:00Z",
        "replies": []
      }
    ]
  }
]
```

#### GET `/api/alarms/history?device_id=1&limit=20`

**Response**:
```json
[
  {
    "id": 1,
    "device_id": 1,
    "alarm_type": "latency",
    "metric_value": 150.5,
    "threshold_value": 100,
    "triggered_at": "2026-07-08T08:00:00Z",
    "cleared_at": "2026-07-08T10:30:00Z",
    "duration_seconds": 9000,
    "device_name": "ONT-JKT-001",
    "serial_number": "HWT0123456789"
  }
]
```

#### GET `/api/alarms/mttr?period=7d`

**Response**:
```json
{
  "overall_mttr_hours": 4.5,
  "mttr_by_type": {
    "latency": 3.2,
    "download": 5.1,
    "upload": 5.8
  },
  "total_cleared": 85,
  "total_alarms": 130,
  "period": "7d"
}
```

#### POST `/api/alarms/check` — Root cause assignment

**Request**:
```json
{
  "deviceId": 1,
  "rootCauseId": 1,
  "note": "Cooling fan failure",
  "action": "Dispatch crew",
  "pic": "Budi"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Root cause assigned",
  "assigned_at": "2026-07-09T09:00:00Z"
}
```

#### POST `/api/alarms/comments` — Add comment

**Request**:
```json
{
  "deviceId": 1,
  "comment": "Crew dispatched to location",
  "createdBy": "admin",
  "parentId": null
}
```

**Response**: `{ "id": 1, "device_id": 1, ... }`

#### DELETE `/api/alarms/comments?id=1`

**Response**: `{ "success": true }`

---

### 2.6 Tasks & Queue

#### GET `/api/tasks`

**Response**:
```json
[
  {
    "id": 1,
    "title": "R01 Sumut Ping",
    "task_type": "scheduled",
    "test_type": "ping,traceroute",
    "group_id": 2,
    "device_id": null,
    "cron_time": "37 2 * * *",
    "next_run": "2026-07-10T02:37:00.000Z",
    "is_active": true,
    "region_name": "Sumatera Utara"
  }
]
```

#### POST `/api/tasks`

**Request**:
```json
{
  "title": "R07 Bali Ping",
  "task_type": "scheduled",
  "test_type": "ping",
  "group_id": 17,
  "cron_time": "38 2 * * *"
}
```

#### POST `/api/tasks/:id/run` — On-demand trigger

**Response**:
```json
{
  "success": true,
  "message": "Task triggered",
  "jobCount": 500
}
```

---

### 2.7 Queue Jobs

#### GET `/api/queue-jobs?taskId=1&status=pending`

**Response**:
```json
[
  {
    "id": "uuid-xxx",
    "task_id": 1,
    "device_id": 100,
    "status": "pending",
    "test_type": "ping",
    "execution_type": "scheduled",
    "run_id": "1-1720500000000",
    "last_error": null,
    "created_at": "2026-07-09T02:37:00Z",
    "device_name": "ONT-MDN-001",
    "serial_number": "HWT0123456789"
  }
]
```

---

### 2.8 Configuration APIs

#### GET/POST `/api/axiros-server`

**GET Response**:
```json
{
  "id": 1,
  "server_url": "https://acs.network.telkomsel.co.id",
  "base_path": "/live/AXAPI/Indihome",
  "auth_username": "axiros_user",
  "auth_password": "base64pass",
  "is_active": true,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-06-15T00:00:00Z"
}
```

#### GET/POST/PUT/DELETE `/api/test-server`

**GET Response**:
```json
[
  {
    "id": 1,
    "name": "IGW-JKT-01",
    "ip_address": "10.11.12.13",
    "test_type": "igw",
    "is_active": true
  },
  {
    "id": 2,
    "name": "EBR-JKT-01",
    "ip_address": "10.22.33.44",
    "test_type": "ebr",
    "is_active": true
  }
]
```

---

### 2.9 Location & Master Data

#### GET `/api/location/areas`

**Response**:
```json
[
  { "id": 1, "name": "Jabodetabek", "code": "JBT" }
]
```

#### GET `/api/location/regionals?area_id=1`

**Response**:
```json
[
  { "id": 11, "name": "Jakarta", "province": "DKI Jakarta", "area_id": 1 }
]
```

#### GET `/api/location/nops?regional_id=11`

**Response**:
```json
[
  { "id": 5, "name": "JKP", "area_id": 1, "regional_id": 11 }
]
```

---

### 2.10 Thresholds (from `threshold_master`)

#### GET `/api/threshold`

**Response**:
```json
[
  {
    "id": 1,
    "speed_group_id": 1,
    "upload_threshold": 10,
    "download_threshold": 50,
    "latency_threshold": 100,
    "packet_loss_threshold": 5,
    "speed_group_name": "50 Mbps"
  }
]
```

---

### 2.11 Workers & Health

#### GET `/api/workers`

**Response**:
```json
[
  {
    "id": "mojo-worker-1720500000000",
    "status": "running",
    "lastHeartbeat": "2026-07-09T10:00:00.000Z",
    "concurrency": 5,
    "queue": "acs-fast"
  }
]
```

#### GET `/api/health`

**Response**:
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "queues": {
    "acs-fast": { "waiting": 150, "active": 5 },
    "acs-download": { "waiting": 10, "active": 2 },
    "acs-upload": { "waiting": 8, "active": 2 }
  },
  "uptime": "5d 12h 30m"
}
```

---

### 2.12 Auth

#### POST `/api/auth/login`

**Request**:
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response**:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "full_name": "Administrator"
  }
}
```

#### GET `/api/user-role`

**Response**:
```json
{
  "username": "admin",
  "full_name": "Administrator",
  "role": "admin"
}
```

---

## 3. Data Flow: Ping (ONT → ACS)

```
  Dispatcher (cron 1m)
       │
       │  UPDATE queue_jobs SET status = 'processing'
       │  ADD ke BullMQ queue 'acs-fast'
       ▼
  Worker 'acs-fast'
       │
       │  1. GET /api/axiros-server → { server_url, base_path, auth }
       │  2. GET /api/test-server → [{ ip, test_type: 'igw' }, { ip, test_type: 'ebr' }]
       │
       ├──▶ POST {server}/Portal/DeviceManagement/TR069/RPC/IPPingTest
       │     Body: { identifiers: "SERIAL", host: "10.11.12.13" }  ← IGW
       │     Response: { data.post.details.AverageResponseTime: 15.2 }
       │
       ├──▶ POST {server}/Portal/DeviceManagement/TR069/RPC/IPPingTest
       │     Body: { identifiers: "SERIAL", host: "10.22.33.44" }  ← EBR
       │     Response: { data.post.details.AverageResponseTime: 25.4 }
       │
       ▼
  INSERT INTO test_results_ping (device_id, ping_igw, ping_ebr, ...)
       │
       ▼
  checkAndUpdateAlarm()
       │  IF ping_igw > 100ms → INSERT/UPDATE active_alarms
       │  IF ping_igw < 100ms AND ada alarm aktif → move to alarm_history
       ▼
  UPDATE devices_ont SET last_seen = NOW()
```

---

## 4. Data Flow: Traceroute (ONT → ACS)

```
  Dispatcher → Worker 'acs-fast'
       │
       │  POST {server}/Portal/DeviceManagement/TR069/RPC/TraceRouteTest
       │  Body: { identifiers: "SERIAL", host: "10.22.33.44" }  ← target EBR
       │
       ▼
  Response: { data.post.details["1.HopHostAddress"]: "192.168.1.1", ... }
       │
       ▼
  Parse hops → [{ hop_no: 1, address, hostname, rt_times }, ...]
       │
       ▼
  INSERT INTO test_results_traceroute (traceroute_raw: JSON, total_hops, total_rtt_ms)
```

---

## 5. Data Flow: Download Speed (ONT → ACS)

```
  Dispatcher → Worker 'acs-download'
       │
       │  1. POST {base_path}/PostONTDownloadSpeed
       │     Body: { cpe_id: "SERIAL", service_id: "" }
       │     Response: { data.post.ticket_id: "TKT-XXX" }
       │
       │  ⚠ Retry start 5× @30s jika "Device Not Ready"
       │
       ▼
  Adaptive Poll: 15× @30s (~7.5 menit)
       │
       │  GET {base_path}/GetONTDownloadSpeedResult?id=TKT-XXX
       │
       ├── In Progress → { download_status: "Running", download_speed: 0 }
       ├── Completed   → { download_status: "Completed", download_speed: 95.5 }
       └── Failed      → { ticket_status: "Failed" }
       │
       ▼
  INSERT INTO test_results_speed_download (download_speed, success)
       │
       ▼
  checkAndUpdateAlarm()
       IF download_speed < threshold (50 Mbps) → alarm
       IF download_speed >= threshold → clear alarm
```

---

## 6. Data Flow: Upload Speed (ONT → ACS)

Sama persis dengan download tapi endpoint berbeda:

```
  POST {base_path}/PostONTUploadSpeed    → ticket_id
  GET  {base_path}/GetONTUploadSpeedResult?id=TKT-XXX → upload_speed
  INSERT INTO test_results_speed_upload (upload_speed)
```

Upload threshold default: **10 Mbps**.

---

## 7. Data Flow: ONT Status (ONT → ACS)

```
  Dispatcher → Worker 'acs-fast' (legacy via acs-queue)
       │
       │  POST {base_path}/GetONTStatus
       │  Body: { cpe_id: "SERIAL", service_id: "" }
       │
       ▼
  Response: {
    ont_sn: "HWT0123456789",
    ont_soft_version: "V300R021C10SPC100",
    ont_status: "Online",
    ont_subscription_status: "Active",
    ont_type: "Huawei EG8145V5"
  }
       │
       ▼
  UPDATE devices_ont SET status = 'online', cpe_type = 'Huawei EG8145V5'
```

---

## 8. Data Flow: Regional Direct Ping

### Raw Data Format — `test_results_direct_ping`

```sql
CREATE TABLE test_results_direct_ping (
  id                  SERIAL PRIMARY KEY,
  device_id           INTEGER REFERENCES devices_ont(id),
  ip_address          VARCHAR(45),       -- IPv4 / IPv6
  avg_latency_ms      DECIMAL(10,2),     -- Average ping latency
  packet_loss_percent DECIMAL(5,2),      -- Packet loss %
  downstream_server_id INTEGER,          -- Province ID
  created_at          TIMESTAMP DEFAULT NOW()
);
```

### Example Row

```
 id | device_id | ip_address    | avg_latency_ms | packet_loss_percent | downstream_server_id | created_at
----+-----------+---------------+---------------+--------------------+----------------------+---------------------------
 1  | 1001      | 10.50.1.100   | 12.3           | 0.00               | 2                    | 2026-07-09 10:00:00
 2  | 1002      | 10.50.1.101   | 45.6           | 25.00              | 2                    | 2026-07-09 10:00:01
```

### Flow

```
  Direct Ping Worker (per-province, 34 workers)
       │
       │  SELECT id, ip_address FROM devices_ont
       │  WHERE downstream_server_id = N
       │    AND ip_address IS NOT NULL
       │
       ├──▶ fping -c 4 -t 5000 {ip1} {ip2} ... {ipN}
       │    (atau ping satu-satu jika fping unavailable)
       │
       ▼
  Parse fping output:
    "10.50.1.100 : xmt/rcv/%loss = 4/4/0%, min/avg/max = 2.1/12.3/25.5"
    → { avgLatency: 12.3, packetLoss: 0 }
       │
       ▼
  INSERT INTO test_results_direct_ping
  (device_id, ip_address, avg_latency_ms, packet_loss_percent, downstream_server_id)
       │
       ▼
  Repeat every DIRECT_PING_INTERVAL_MINUTES (default: 10 menit)
```

### Regional 34 Province Workers

```
DS_ID=2  → mojo_direct_ping_worker_sumut      → Sumatera Utara
DS_ID=3  → mojo_direct_ping_worker_sumbar     → Sumatera Barat
DS_ID=17 → mojo_direct_ping_worker_bali        → Bali
...
DS_ID=11 → mojo_direct_ping_worker_jakarta     → DKI Jakarta
```

Setiap worker filter by `downstream_server_id` dan jalan independen.

---

## 9. Complete End-to-End Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DISPATCHER (cron 1m)                        │
│                                                                     │
│  SELECT * FROM tasks                                                │
│  WHERE is_active=true AND next_run < NOW()                          │
│                                                                     │
│  Untuk setiap task:                                                 │
│    ├── Dedup check (existing pending/processing queue_jobs)         │
│    ├── INSERT queue_jobs (device × test_type pairs, chunk 50)      │
│    ├── queue.add('process-acs', { queueJobId, deviceId, testType })│
│    ├── UPDATE queue_jobs SET status='processing'                    │
│    └── UPDATE tasks SET next_run = calculateNextRun(cron_time)      │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BULLMQ QUEUES (Redis)                          │
│                                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────┐     │
│  │acs-fast  │  │acs-download  │  │acs-upload  │  │acs-queue │     │
│  │(conc:5)  │  │(conc:2)      │  │(conc:2)    │  │(legacy)  │     │
│  └─────┬────┘  └──────┬───────┘  └──────┬─────┘  └──────────┘     │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      WORKERS (Node.js + BullMQ)                    │
│                                                                     │
│  Setiap worker consume dari queue masing-masing:                    │
│                                                                     │
│  acs-fast worker:                                                   │
│    ├── PING      → POST IPPingTest (IGW + EBR)                     │
│    ├── TRACEROUTE → POST TraceRouteTest                             │
│    └── ONT-STATUS → POST GetONTStatus                               │
│                                                                     │
│  acs-download worker:                                               │
│    └── DOWNLOAD  → POST PostONTDownloadSpeed + poll result          │
│                                                                     │
│  acs-upload worker:                                                 │
│    └── UPLOAD    → POST PostONTUploadSpeed + poll result            │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  AXIROS ACS API (TR-069)                          │
│                                                                     │
│  https://acs.network.telkomsel.co.id                                │
│  /live/AXAPI/Indihome (atau /Portal untuk ping/traceroute)         │
│                                                                     │
│  ACS Server mengirim perintah TR-069 ke ONT:                       │
│    ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐   │
│    │  ACS    │────▶│  BNG/IGW │────▶│  OLT     │────▶│  ONT   │   │
│    │ Server  │     │ (Core)   │     │ (Access) │     │ (CPE)  │   │
│    └─────────┘     └──────────┘     └──────────┘     └────────┘   │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   DATABASE LAYER (PostgreSQL)                      │
│                                                                     │
│  INSERT test_results_{ping,speed_download,speed_upload,traceroute}  │
│  INSERT/UPDATE/DELETE active_alarms                                 │
│  INSERT alarm_history (saat alarm cleared)                          │
│  UPDATE devices_ont (status, last_seen)                             │
│  UPDATE queue_jobs (status, completed_at, raw_response)             │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Dashboards / API (Next.js)                                  │   │
│  │  SELECT FROM test_results_*, devices_ont, active_alarms      │   │
│  │  Response: JSON → Browser / Mobile                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  NOTIFICATIONS (Worker triggered)                   │
│                                                                     │
│  checkAndUpdateAlarm():                                             │
│    ├── Telegram → POST https://api.telegram.org/bot{token}/sendMsg │
│    ├── WhatsApp → POST {api_url} (Fonnte/Wablas)                    │
│    └── Ticketing → POST {api_url} (Jira/ServiceNow)                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. Regional Direct Ping — Parallel Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│ 34 REGIONAL DIRECT PING WORKERS (berdiri sendiri, bukan BullMQ)     │
│                                                                      │
│         ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│         │ Worker DS=2  │  │ Worker DS=11 │  │ Worker DS=17 │  ...   │
│         │ Sumatera Ut  │  │ Jakarta      │  │ Bali         │        │
│         └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│                │                 │                  │                │
│                ▼                 ▼                  ▼                │
│         ┌──────────────────────────────────────────────────┐         │
│         │  fping -c 4 -t 5000 {ip_list_per_province}      │         │
│         └──────────────────────┬───────────────────────────┘         │
│                                │                                     │
│                                ▼                                     │
│         ┌──────────────────────────────────────────────────┐         │
│         │  Parse output: avgLatency, packetLoss            │         │
│         │  INSERT test_results_direct_ping                 │         │
│         │  (device_id, ip, avg_latency_ms, packet_loss)    │         │
│         └──────────────────────┬───────────────────────────┘         │
│                                │                                     │
│         Setiap worker: loop setiap 10 menit (DIRECT_PING_INTERVAL)  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 11. Database Row Examples (Raw Data)

### test_results_ping
```
 id | device_id | ping_igw | ping_ebr | packet_loss_igw | packet_loss_ebr | success |     executed_at
----+-----------+----------+----------+-----------------+-----------------+---------+---------------------
 1  | 1001      | 15.20    | 25.40    | 0.00            | 0.00            | t       | 2026-07-09 10:00:00
 2  | 1002      | 120.50   | 150.30   | 25.00           | 50.00           | t       | 2026-07-09 10:01:00
```

### test_results_speed_download
```
 id | device_id | download_speed | success |     executed_at
----+-----------+----------------+---------+---------------------
 1  | 1001      | 95.50          | t       | 2026-07-09 10:00:00
 2  | 1002      | 5.20           | t       | 2026-07-09 10:01:00
```

### test_results_speed_upload
```
 id | device_id | upload_speed | success |     executed_at
----+-----------+--------------+---------+---------------------
 1  | 1001      | 22.30        | t       | 2026-07-09 10:00:00
 2  | 1002      | 2.10         | t       | 2026-07-09 10:01:00
```

### test_results_traceroute
```
 id | device_id | total_hops | total_rtt_ms | traceroute_raw
----+-----------+------------+--------------+------------------------------------------------
 1  | 1001      | 5          | 63.50        | [{"hop_no":1,"address":"192.168.1.1","rt_times":"2.5ms"},...]
```

### test_results_direct_ping
```
 id | device_id | ip_address  | avg_latency_ms | packet_loss_percent | downstream_server_id |     created_at
----+-----------+-------------+----------------+---------------------+----------------------+---------------------
 1  | 1001      | 10.50.1.100 | 12.30          | 0.00                | 2                    | 2026-07-09 10:00:00
 2  | 1003      | 10.50.1.102 | 0.00           | 100.00              | 2                    | 2026-07-09 10:00:01
```

### queue_jobs
```
 id (UUID)                          | device_id | test_type | status    |     created_at
------------------------------------+-----------+-----------+-----------+---------------------
 b7e91c2a-3f1d-4a5e-8c9d-1f2e3d4c5b6a | 1001      | ping      | completed | 2026-07-09 10:00:00
 a1b2c3d4-5e6f-7890-abcd-ef1234567890 | 1001      | download  | processing | 2026-07-09 10:00:00
```

### active_alarms
```
 id | device_id | alarm_type | metric_value | threshold_value | severity |     triggered_at
----+-----------+------------+--------------+-----------------+----------+---------------------
 1  | 1002      | latency    | 120.50       | 100.00          | warning  | 2026-07-09 08:00:00
 2  | 1002      | download   | 5.20         | 50.00           | warning  | 2026-07-09 10:01:00
```

### alarm_history
```
 id | device_id | alarm_type | metric_value |     triggered_at      |      cleared_at       | duration_seconds
----+-----------+------------+--------------+----------------------+-----------------------+------------------
 1  | 1001      | latency    | 150.50       | 2026-07-08 08:00:00  | 2026-07-08 10:30:00  | 9000
```
