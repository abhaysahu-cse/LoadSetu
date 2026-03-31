# 🎛️ LoadSetu Admin Dashboard — Control Center

> Next.js · Tailwind · Terminal Aesthetic · Real-time polling
> Internal tool — only for you. Not for drivers or shippers.

---

## ⚡ QUICK START

```bash
# 1. Go into the folder
cd admin-dashboard

# 2. Install dependencies
npm install

# 3. Set your Spring Boot server IP
cp .env.local.example .env.local
# Then open .env.local and set:
# SPRING_BOOT_URL=http://<YOUR_SERVER_IP>:8080

# 4. Run the dashboard
npm run dev

# 5. Open in browser
# http://localhost:3001
```

---

## 📋 Pages

| Page | URL | What it shows |
|------|-----|---------------|
| Overview | `/` | KPIs + all tables + Force Match button |
| Trucks | `/trucks` | Live truck list from Redis, filter by status |
| Loads | `/loads` | All loads, filter by status, cancel button |
| Matches | `/matches` | AI + manual matches, Force Match button |
| Health | `/health` | Kafka / Redis / Backend status |

---

## 🔌 Spring Boot APIs Required

Your Spring Boot server must expose these endpoints under `/admin/*`:

| Method | Path | Returns |
|--------|------|---------|
| GET | `/admin/trucks` | `[{truckId, lat, lng, speed, heading, status, lastSeen}]` |
| GET | `/admin/loads` | `[{loadId, origin, destination, weight, truckType, status, createdAt}]` |
| GET | `/admin/matches` | `[{matchId, loadId, truckId, matchCount, score, method, matchedAt}]` |
| GET | `/admin/health` | `{kafka, redis, backend, uptime, dbPool, activeDrivers}` |
| POST | `/admin/force-match` | body: `{loadId, truckId}` → returns `{matchId}` |
| POST | `/admin/loads/{id}/cancel` | Cancels a load |
| PATCH | `/admin/driver/status` | body: `{driverId, status}` |

### Sample Spring Boot Controller (Java)

```java
@RestController
@RequestMapping("/admin")
@PreAuthorize("hasRole('ADMIN')") // Secure it!
public class AdminController {

    @Autowired private RedisTemplate<String, String> redis;
    @Autowired private LoadRepository loadRepo;
    @Autowired private MatchRepository matchRepo;

    @GetMapping("/trucks")
    public List<TruckLocationDto> getTrucks() {
        // Reads from Redis: KEYS truck:location:*
        Set<String> keys = redis.keys("truck:location:*");
        return keys.stream().map(key -> {
            Map<Object,Object> data = redis.opsForHash().entries(key);
            return TruckLocationDto.from(data);
        }).collect(Collectors.toList());
    }

    @GetMapping("/loads")
    public List<Load> getLoads() {
        return loadRepo.findTop100ByOrderByCreatedAtDesc();
    }

    @GetMapping("/matches")
    public List<Match> getMatches() {
        return matchRepo.findTop100ByOrderByMatchedAtDesc();
    }

    @GetMapping("/health")
    public Map<String, Object> getHealth() {
        Map<String, Object> status = new HashMap<>();
        status.put("backend", true);
        try { redis.ping(); status.put("redis", true); }
        catch (Exception e) { status.put("redis", false); }
        // Add Kafka check similarly
        status.put("kafka", kafkaHealthIndicator.isHealthy());
        return status;
    }

    @PostMapping("/force-match")
    public Map<String, String> forceMatch(@RequestBody ForceMatchRequest req) {
        // Use Redis distributed lock, assign truck to load
        String matchId = matchingService.forceMatch(req.getLoadId(), req.getTruckId());
        return Map.of("matchId", matchId);
    }
}
```

---

## 🔄 Auto-refresh Intervals

| Section | Interval |
|---------|----------|
| Trucks | 6 seconds |
| Loads | 8 seconds |
| Matches | 12 seconds |
| Health | 5 seconds |

---

## 🏗️ Project Structure

```
admin-dashboard/
├── pages/
│   ├── _app.js           ← Root
│   ├── index.js          ← Overview (main dashboard)
│   ├── trucks.js         ← Truck monitor
│   ├── loads.js          ← Load monitor
│   ├── matches.js        ← Match results
│   └── health.js         ← System health
├── components/
│   ├── Layout.jsx        ← Sidebar + topbar wrapper
│   ├── Sidebar.jsx       ← Navigation
│   ├── TruckTable.jsx    ← Truck data table
│   ├── LoadTable.jsx     ← Load data table
│   ├── MatchTable.jsx    ← Match data table
│   ├── HealthCard.jsx    ← Service status cards
│   ├── ForceMatchModal.jsx ← Force match dialog
│   ├── StatCard.jsx      ← KPI number cards
│   └── SectionHeader.jsx ← Table headers with refresh
├── services/
│   └── api.js            ← All API calls
├── utils/
│   └── usePolling.js     ← Auto-refresh hook
├── styles/
│   └── globals.css       ← Terminal theme
├── next.config.js        ← Proxy to Spring Boot
├── tailwind.config.js
└── .env.local.example    ← Copy to .env.local
```

---

## ⚠️ Security Note

This dashboard has NO authentication by default (it's an internal tool).
Before deploying to a server, add either:
- Basic auth via nginx reverse proxy
- Next.js middleware with a hardcoded admin password
- IP whitelist in nginx (only allow your IP)
