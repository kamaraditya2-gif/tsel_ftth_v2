# Network Topology Architecture — HLD & LLD

---

## 1. High-Level Network Topology

```
                         INTERNET
                            │
                    ┌───────┴───────┐
                    │   Axiros ACS  │  TR-069/CWMP Management Server
                    │  (External)   │  https://acs.telkomsel.co.id
                    └───────┬───────┘
                            │ TR-069 (CWMP) — port 443
                            │
                    ┌───────┴───────┐
                    │   EBR         │  Edge Router — route ke core Telkomsel
                    │  (Edge Router)│  Untuk traceroute internal network
                    └───────┬───────┘
                            │
                    ┌───────┴───────┐
                    │   IGW         │  Internet Gateway — NAT + routing publik
                    │  (Gateway)    │  Near IGW server untuk speed test
                    └───────┬───────┘
                            │
                    ┌───────┴───────┐
                    │   BNG         │  Broadband Network Gateway
                    │  (Aggregation)│  PPPoE/IPoE termination, QoS, subscriber mgmt
                    └───────┬───────┘
                            │ Fiber (GPON/XPON uplink)
                    ┌───────┴───────┐
                    │   OLT         │  Optical Line Terminal — di STO
                    │  (Access)     │  Aggregates ONT upstream
                    └───────┬───────┘
                            │ Fiber feeder
                  ┌─────────┴─────────┐
                  │   ODP / ODC       │  Optical Distribution Point/Cabinet
                  │   (Distribution)  │  Passive splitter 1:8 / 1:16 / 1:32
                  └─────────┬─────────┘
                            │ Fiber drop
                  ┌─────────┴─────────┐
                  │   ONT (CPE)       │  Optical Network Terminal
                  │  (Customer Premise)│  Huawei / Nokia / ZTE / FiberHome
                  │  IP: 10.x.x.x     │  TR-069 managed, ICMP reachable
                  └───────────────────┘

    ─── Test Paths ───
    Ping:
      ONT ──(TR-069)──▶ Axiros ACS ──(RPC IPPingTest)──▶ IGW server
      ONT ──(TR-069)──▶ Axiros ACS ──(RPC IPPingTest)──▶ EBR server

    Traceroute:
      ONT ──(TR-069)──▶ Axiros ACS ──(RPC TraceRouteTest)──▶ EBR

    Speed Test:
      ONT ──(TR-069)──▶ Axiros ACS ──(PostONTDownloadSpeed)──▶ Near IGW
      ONT ──(TR-069)──▶ Axiros ACS ──(PostONTUploadSpeed)──▶ Near IGW

    Direct Ping (ICMP):
      Regional Worker ──(fping ICMP)──▶ ONT IP (10.x.x.x)

    ONT Status:
      Axiros ACS ──(GetONTStatus)──▶ ONT (TR-069 query)
```

### Layer Mapping (OSI)

| OSI Layer | FTTH Component | Protocol |
|-----------|---------------|----------|
| **L1** Physical | Fiber optic (GPON, XPON) | 1490nm/1310nm |
| **L2** Data Link | OLT → ONT via GPON encapsulation | GEM (GPON Encapsulation Method) |
| **L3** Network | BNG → ONT (IP forwarding) | IP (IPv4, CGNAT) |
| **L4** Transport | Axiros ACS ↔ ONT | TCP/HTTP(S) port 443 |
| **L7** Application | ACS ↔ ONT management | TR-069 CWMP (SOAP/XML) |

---

## 2. Low-Level Network Topology

### 2.1 IP Addressing & Subnetting

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  INTERNET / WAN                                                            │
│  ├── Axiros ACS Server:     203.xx.xx.xx (public)                         │
│  ├── frp Server:            gandooz.cloud:8804 (public)                   │
│  └── External APIs:         Telegram/WhatsApp/Ticketing (public)          │
│                                                                             │
│  CORE NETWORK                                                              │
│  ├── IGW:                   10.11.x.x/16                                  │
│  ├── EBR:                   10.22.x.x/16                                  │
│  ├── BNG:                   10.33.x.x/16                                  │
│  ├── Near IGW test server:  10.11.12.x/24  (speed test target)           │
│  └── Near EBR test server:  10.22.33.x/24  (traceroute target)           │
│                                                                             │
│  ACCESS NETWORK                                                            │
│  ├── OLT management:        10.44.x.x/16                                  │
│  ├── ODP/ODC:               Passive (unmanaged)                           │
│  └── ONT:                   10.50-99.x.x/16 (CGNAT pool)                 │
│                                                                             │
│  MONITORING SYSTEM (Private)                                               │
│  ├── Docker bridge:         172.17.x.x/16 (mojojojo_network)              │
│  │   ├── mojo_dashboard:    172.17.0.2:3000                               │
│  │   ├── postgres:          172.17.0.3:5432                               │
│  │   ├── redis:             172.17.0.4:6379                               │
│  │   ├── dispatcher:        172.17.0.5                                    │
│  │   └── workers(acs-*):    172.17.0.6-16                                 │
│  ├── frp client tunnel:     localhost:3002 → gandooz.cloud:8804           │
│  └── Regional workers:      Terhubung via VPN ke central DB               │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 VLAN & Network Segmentation

| VLAN | Network | Fungsi | Device |
|------|---------|--------|--------|
| VLAN 10 | 10.50.0.0/16 | CGNAT pool ONT | ONT devices |
| VLAN 20 | 10.51.0.0/16 | Management OLT | OLT |
| VLAN 30 | 10.33.0.0/16 | BNG loopback/interkoneksi | BNG |
| VLAN 40 | 10.11.0.0/16 | IGW interkoneksi | IGW/EBR |
| VLAN 100 | 10.100.0.0/24 | Monitoring infra (Docker) | Central server |
| VLAN 200 | 172.16.x.x/16 | Regional worker VPN | Regional servers |

### 2.3 Protocol Details

#### TR-069 CWMP (ACS ↔ ONT)

```
ONT (CPE)                  ACS Server
  │                           │
  │  ─── HTTPS POST ──────▶   │  Inform (boot, periodic, alarm)
  │  ◀── InformResponse ───   │
  │                           │
  │  ◀── HTTP GET ────────    │  Download (config/firmware URL)
  │  ─── DownloadResponse ▶   │
  │                           │
  │  ◀── RPC (SOAP/XML) ──   │  IPPingTest / TraceRouteTest
  │                           │
  │  ◀── RPC ──────────────   │  PostONTDownloadSpeed (via REST)
  │  ─── Autonomous TR-069 ─▶ │  Result delivery sebagai Inform
```

#### ICMP Ping (Direct Ping Worker)

```
Regional Worker                  ONT
  │                               │
  │  ─── ICMP Echo Request ───▶   │  fping -c 4 -t 5000 10.50.1.100
  │  ◀── ICMP Echo Reply ─────    │  RTT: 12.3ms
  │                               │
  │  ─── ICMP Echo Request ───▶   │  Jika ada packet loss
  │  (no reply)                   │  → packet_loss = 25%
```

### 2.4 Test Flow Detail Per Type

#### Ping Test — Full Packet Flow

```
┌──────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ NOC  │     │ Dashboard│     │ Worker   │     │ Axiros   │     │ ONT      │
│      │     │ (Next.js)│     │ (Node.js)│     │ ACS API  │     │ (CPE)    │
└──┬───┘     └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
   │              │                 │                │                │
   │  Trigger     │                 │                │                │
   │──────────────▶                 │                │                │
   │              │  GET /api/      │                │                │
   │              │  axiros-server  │                │                │
   │              │◀────────────────│                │                │
   │              │  {server_url}   │                │                │
   │              │────────────────▶│                │                │
   │              │                 │ POST IPPingTest│                │
   │              │                 │───────────────▶│  TR-069 RPC    │
   │              │                 │                │───────────────▶│
   │              │                 │                │  Ping IGW      │
   │              │                 │                │  10.11.12.13   │
   │              │                 │                │◀───────────────│
   │              │                 │◀───────────────│ {avg: 15.2ms}  │
   │              │                 │                │                │
   │              │                 │ POST IPPingTest│                │
   │              │                 │───────────────▶│  TR-069 RPC    │
   │              │                 │                │───────────────▶│
   │              │                 │                │  Ping EBR      │
   │              │                 │                │  10.22.33.44   │
   │              │                 │                │◀───────────────│
   │              │                 │◀───────────────│ {avg: 25.4ms}  │
   │              │                 │                │                │
   │              │                 │ INSERT INTO    │                │
   │              │                 │ test_results_  │                │
   │              │                 │ ping           │                │
   │              │                 │◀── DB ───▶     │                │
   │              │                 │                │                │
   │              │                 │ checkAndUpdate │                │
   │              │                 │ Alarm()        │                │
   │  Refresh     │                 │                │                │
   │◀─────────────│                 │                │                │
```

#### Speed Test (Download) — Full Packet Flow

```
Worker (acs-download)
  │
  │  Step 1: START
  │
  │  POST /live/AXAPI/Indihome/PostONTDownloadSpeed
  │  { cpe_id: "HWT0123456789", service_id: "" }
  │
  │  Retry 5× @30s jika "Device Not Ready"
  │
  │  Response: { ticket_id: "TKT-20260709-ABCD1234" }
  │
  │  Step 2: POLL (15× @30s = ~7.5 menit)
  │
  │  GET /live/AXAPI/Indihome/GetONTDownloadSpeedResult?id=TKT-XXX
  │
  │  Status transitions:
  │  ┌──────────────┬──────────────┬───────────────┐
  │  │ Attempt 1-3  │ Attempt 4-8  │ Attempt 9-15  │
  │  │ "Running"    │ "In Progress"│ "Completed"    │
  │  │ speed: 0     │ speed: 45.2  │ speed: 95.5   │
  │  └──────────────┴──────────────┴───────────────┘
  │
  │  Terminal states: "Failed", "Error", "Expired"
  │
  │  Step 3: SAVE
  │  INSERT INTO test_results_speed_download (download_speed: 95.5, success: true)
  │  checkAndUpdateAlarm() → threshold: 50 Mbps → 95.5 > 50 → alarm clear
```

#### Direct Ping (ICMP fping) — Full Packet Flow

```
Regional Worker (mojo_direct_ping_worker)
  │
  │  Step 1: QUERY DEVICES
  │  SELECT ip_address FROM devices_ont
  │  WHERE downstream_server_id = 11 AND ip_address IS NOT NULL
  │
  │  → ["10.50.1.100", "10.50.1.101", "10.50.1.102", ...]
  │
  │  Step 2: EXECUTE FPING
  │  fping -c 4 -t 5000 10.50.1.100 10.50.1.101 10.50.1.102 ...
  │
  │  Step 3: PARSE OUTPUT
  │
  │  10.50.1.100 : xmt/rcv/%loss = 4/4/0%, min/avg/max = 2.1/12.3/25.5
  │  10.50.1.101 : xmt/rcv/%loss = 4/0/100%
  │  10.50.1.102 : xmt/rcv/%loss = 4/4/0%, min/avg/max = 1.5/8.2/15.3
  │
  │  Step 4: INSERT RESULTS
  │  INSERT INTO test_results_direct_ping
  │  (device_id, ip_address, avg_latency_ms, packet_loss_percent, downstream_server_id)
  │
  │  Values:
  │  (1001, "10.50.1.100", 12.3, 0.0, 11)
  │  (1002, "10.50.1.101", NULL, 100.0, 11)
  │  (1003, "10.50.1.102", 8.2, 0.0, 11)
  │
  │  Step 5: REPEAT setiap DIRECT_PING_INTERVAL_MINUTES (default: 10)
```

---

## 3. Monitoring System Topology

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CLOUD / PUBLIC                                  │
│                                                                              │
│  Browser (NOC)        Axiros ACS Server     frp Server         Telegram API │
│  │                        │                    │                      │      │
│  │ HTTPS                  │ HTTPS:443          │ frp:8804            │ HTTPS │
└──┼────────────────────────┼────────────────────┼──────────────────────┼──────┘
   │                        │                    │                      │
   ▼                        ▼                    ▼                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           CENTRAL DATACENTER                                 │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  HOST SERVER 1 (Monolith / All-in-One)                               │   │
│  │                                                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │   │
│  │  │  PostgreSQL   │  │    Redis     │  │  frp Client  │                │   │
│  │  │  10.100.0.10  │  │  10.100.0.11 │  │ → gandooz    │                │   │
│  │  │  :5432        │  │  :6379       │  │    :8804     │                │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────────┘                │   │
│  │         │                 │                                            │   │
│  │  ┌──────┴─────────────────┴──────────────────────────────────────┐   │   │
│  │  │  Docker Bridge Network: 172.17.0.0/16                          │   │   │
│  │  │                                                                 │   │   │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │   │
│  │  │  │  Dispatcher  │  │  acs-fast    │  │  acs-download        │  │   │   │
│  │  │  │  (cron 1m)   │  │  (conc: 5)   │  │  (conc: 2)           │  │   │   │
│  │  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │   │   │
│  │  │                                                                 │   │   │
│  │  │  ┌──────────────────────┐  ┌──────────────┐                     │   │   │
│  │  │  │  acs-upload          │  │  Dashboard   │                     │   │   │
│  │  │  │  (conc: 2)           │  │  Next.js:3000│                     │   │   │
│  │  │  └──────────────────────┘  └──────────────┘                     │   │   │
│  │  └─────────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  FIREWALL:                                                                   │
│  ┌──────────────┬───────────────────┬──────────┬──────────┐                 │
│  │ Direction    │ Port/Proto        │ Source   │ Dest     │                 │
│  ├──────────────┼───────────────────┼──────────┼──────────┤                 │
│  │ Inbound      │ TCP/8804 (frp)    │ Internet │ Server   │                 │
│  │ Outbound     │ TCP/443 (ACS)     │ Workers  │ ACS      │                 │
│  │ Outbound     │ TCP/443 (Telegram)│ Workers  │ Telegram │                 │
│  │ Outbound     │ ICMP (fping)      │ Workers  │ ONT      │                 │
│  │ Inter-VM     │ TCP/5432 (PG)     │ Regional │ Central  │                 │
│  │ Inter-VM     │ TCP/6379 (Redis)  │ Workers  │ Central  │                 │
│  └──────────────┴───────────────────┴──────────┴──────────┘                 │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
           │
           │ VPN / WAN (IPSec atau WireGuard)
           │
┌──────────────────────────────────────────────────────────────────────────────┐
│                     REGIONAL DATACENTERS (×34 Provinces)                     │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  REGIONAL SERVER N (Contoh: R01 Sumut, DS_ID=2)                      │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │   │
│  │  │  Container: mojo_direct_ping_worker                             │  │   │
│  │  │                                                                │  │   │
│  │  │  Environment:                                                  │  │   │
│  │  │    DB_HOST = 10.100.0.10 (Central PostgreSQL)                  │  │   │
│  │  │    DB_PORT = 5432                                              │  │   │
│  │  │    DOWNSTREAM_SERVER_ID = 2                                     │  │   │
│  │  │    DIRECT_PING_INTERVAL_MINUTES = 10                            │  │   │
│  │  │                                                                │  │   │
│  │  │  Network: --network host + --cap-add NET_RAW                   │  │   │
│  │  │                                                                │  │   │
│  │  │  Query: SELECT ip_address FROM devices_ont                     │  │   │
│  │  │         WHERE downstream_server_id = 2                         │  │   │
│  │  │           AND ip_address IS NOT NULL                            │  │   │
│  │  ├────────────────────────────────────────────────────────────────┤  │   │
│  │  │  fping -c 4 -t 5000 → ONT IPs in Sumatera Utara               │  │   │
│  │  │  ├── 10.50.1.100 (ONT Medan 1)                                 │  │   │
│  │  │  ├── 10.50.1.101 (ONT Medan 2)                                 │  │   │
│  │  │  └── ... (~500 IPs)                                            │  │   │
│  │  └─────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                       │   │
│  │  Hardware: 2 vCPU, 4 GB RAM, 50 GB SSD                               │   │
│  │  OS: Ubuntu 22.04 / Docker minimal                                   │   │
│  │  Connectivity: 100 Mbps up/down minimal                               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Firewall per Regional:                                                      │
│  ┌─────────────────┬──────────┬───────────────────┬──────────┐              │
│  │ Direction       │ Port     │ Source            │ Dest     │              │
│  ├─────────────────┼──────────┼───────────────────┼──────────┤              │
│  │ Outbound (VPN)  │ TCP/5432 │ Regional Worker   │ Central  │              │
│  │ Outbound        │ ICMP     │ Regional Worker   │ ONT /24  │              │
│  │ Inbound         │ TCP/22   │ NOC (SSH)         │ Regional │              │
│  └─────────────────┴──────────┴───────────────────┴──────────┘              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. End-to-End Data & Network Flow (Complete)

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Browser  │   │ Dashboard│   │   DB     │   │ Worker   │   │ Axiros   │   │   ONT    │
│  (NOC)    │   │ Next.js  │   │PostgreSQL│   │ (Node.js)│   │ ACS API  │   │  (CPE)   │
└─────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘
      │              │               │               │              │               │
      │  1. HTTP GET │               │               │              │               │
      │  /api/dash/  │               │               │              │               │
      │─────────────▶│               │               │              │               │
      │              │  2. SQL Query │               │              │               │
      │              │──────────────▶│               │              │               │
      │              │◀──────────────│               │              │               │
      │              │  JSON data    │               │              │               │
      │◀─────────────│               │               │              │               │
      │              │               │               │              │               │
      │  3. Scheduler (cron 1m)      │               │              │               │
      │              │               │               │  Dispatcher  │               │
      │              │               │◀──────────────│──────────────│               │
      │              │               │  INSERT       │  BullMQ job  │               │
      │              │               │  queue_jobs   │──────────────│               │
      │              │               │               │              │               │
      │              │               │  4. Worker:   │              │               │
      │              │               │  GET config   │──────────────│               │
      │              │               │               │  RPC (TR-069)│               │
      │              │               │               │──────────────│──────────────▶│
      │              │               │               │              │  Execute test │
      │              │               │               │              │◀──────────────│
      │              │               │               │◀─────────────│  Result       │
      │              │               │               │              │               │
      │              │               │  5. INSERT     │              │               │
      │              │               │  test_results  │              │               │
      │              │               │◀──────────────│              │               │
      │              │               │               │              │               │
      │              │               │  6. checkAlarm │              │               │
      │              │               │───────────────▶              │               │
      │              │               │  active_alarms │             │               │
      │              │               │◀──────────────│              │               │
      │              │               │               │              │               │
      │  7. HTTP GET │               │               │              │               │
      │  (poll/refresh)              │               │              │               │
      │─────────────▶│               │               │              │               │
      │              │  8. SQL Query │               │              │               │
      │              │──────────────▶│               │              │               │
      │              │◀──────────────│               │              │               │
      │◀─────────────│               │               │              │               │
      │  Update UI   │               │               │              │               │
```

---

## 5. Regional Deployment Topology (34 Provinces)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CENTRAL (1 DC)                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Services: DB, Queue, Dashboard, Dispatcher, ACS Workers            │   │
│  │  IP: 10.100.0.10/24                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │ VPN / WAN
                          │
     ┌────────────────────┼────────────────────┬───────────────────┐
     ▼                    ▼                    ▼                   ▼
┌──────────┐      ┌──────────┐      ┌──────────┐         ┌──────────┐
│ REG-01   │      │ REG-02   │      │ REG-03   │  ...    │ REG-34   │
│ Sumut    │      │ Sumbar   │      │ Riau     │         │ Papua    │
├──────────┤      ├──────────┤      ├──────────┤         ├──────────┤
│ DS_ID=2  │      │ DS_ID=3  │      │ DS_ID=4  │         │ DS_ID=35 │
│ ~500 ONT │      │ ~300 ONT │      │ ~400 ONT │         │ ~100 ONT │
│ 2vCPU/4G │      │ 2vCPU/4G │      │ 2vCPU/4G │         │ 2vCPU/4G │
│ Worker   │      │ Worker   │      │ Worker   │         │ Worker   │
│ fping    │      │ fping    │      │ fping    │         │ fping    │
└──────────┘      └──────────┘      └──────────┘         └──────────┘
     │                  │                 │                    │
     ▼                  ▼                 ▼                    ▼
┌──────────┐      ┌──────────┐      ┌──────────┐         ┌──────────┐
│ ONT      │      │ ONT      │      │ ONT      │         │ ONT      │
│ 10.50.x  │      │ 10.51.x  │      │ 10.52.x  │         │ 10.80.x  │
│ CGNAT    │      │ CGNAT    │      │ CGNAT    │         │ CGNAT    │
└──────────┘      └──────────┘      └──────────┘         └──────────┘
```

### Regional Worker Detail (per Province)

```
┌─────────────────────────────────────────────┐
│  mojo_direct_ping_worker                    │
│                                             │
│  Interval: 10 menit                         │
│  Tool: fping -c 4 -t 5000                  │
│                                             │
│  ┌──────┬──────────┬──────────┬──────────┐  │
│  │ ONT  │ IP       │ Latency  │ Packet%  │  │
│  ├──────┼──────────┼──────────┼──────────┤  │
│  │ 1001 │10.50.1.1│ 12.3ms   │ 0%       │  │
│  │ 1002 │10.50.1.2│ 45.6ms   │ 25%      │  │
│  │ 1003 │10.50.1.3│ 0.0ms    │ 100%     │  │
│  │ ...  │ ...     │ ...      │ ...      │  │
│  └──────┴──────────┴──────────┴──────────┘  │
│                                             │
│  INSERT INTO test_results_direct_ping       │
│  → Central PostgreSQL via VPN               │
└─────────────────────────────────────────────┘
```

---

## 6. Network Latency Budget

| Segment | Typical RTT | Notes |
|---------|------------|-------|
| ONT → OLT (fiber) | 0.5-2 ms | GPON, < 20 km |
| OLT → BNG (fiber) | 1-5 ms | Metro ethernet |
| BNG → IGW (fiber) | 1-3 ms | Core network |
| BNG → EBR (fiber) | 1-5 ms | Core network |
| IGW → ACS Server | 5-15 ms | Internet/MPLS VPN |
| **Total ping IGW** | **~10-25 ms** | |
| **Total ping EBR** | **~15-35 ms** | |
| Direct ping (regional) | 5-50 ms | Tergantung jarak |
| Speed test overhead | 30-300s | TR-069 polling time |

---

## 7. Key Design Decisions

| Keputusan | Alasan |
|-----------|--------|
| **Ping via ACS (TR-069)**, bukan ICMP langsung | ONT di CGNAT — tidak punya IP publik reachable |
| **Speed test via ACS**, bukan iperf/ookla | Tidak perlu agent tambahan di ONT |
| **Direct ping (ICMP)** sebagai komplementer | Regional worker di subnet yang sama dengan ONT |
| **Test results terpisah per tipe** | Hindari race condition, concurrent writes aman |
| **2 target ping (IGW + EBR)** | Bedakan latency ke internet vs internal Telkomsel |
| **fping** untuk direct ping | 100× lebih cepat dari ping sequential |
| **Traceroute ke EBR** | Lihat path jaringan internal, bukan routing publik |
