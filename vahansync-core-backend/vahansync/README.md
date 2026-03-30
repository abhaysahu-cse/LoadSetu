# VahanSync Core Engine — V4 Final
### LoadSetu × VahanSync — AI-Powered National Freight Exchange

> *"Bridging empty trucks with waiting loads across India"*

---

## ⚡ Quick Start (5 minutes to running)

### Prerequisites
- Java 21 ([SDKMAN](https://sdkman.io): `sdk install java 21-tem`)
- Maven 3.9+ (`mvn -version`)
- Docker + Docker Compose (`docker -v`)

### Step 1 — Clone and configure
```bash
cp .env.example .env
# Edit .env — for local dev, defaults work as-is
# Only change JWT_SECRET and INTERNAL_API_SECRET now
```

### Step 2 — Start infrastructure
```bash
docker compose up -d
# Wait ~30 seconds for Kafka and Postgres to be healthy
docker compose ps   # All services should show "healthy"
```

### Step 3 — Run the application
```bash
# Option A: Maven (recommended for development)
./mvnw spring-boot:run

# Option B: Build JAR first
./mvnw clean package -DskipTests
java -jar target/vahansync-core-1.0.0-SNAPSHOT.jar

# Option C: IntelliJ IDEA / Eclipse
# Open project → Run VahanSyncApplication.java main()
```

### Step 4 — Verify it works
```bash
curl http://localhost:8080/api/v1/health
# Expected: {"service":"vahansync-core","status":"UP","version":"4.0.0"}
```

### Step 5 — Register a shipper and test
```bash
# Register a shipper account
curl -X POST http://localhost:8080/api/v1/auth/register-shipper \
  -H "Content-Type: application/json" \
  -d '{"phone":"+919876543210","password":"password123","companyName":"Tata Freight Pvt Ltd"}'

# Save the token from the response, then create a load:
curl -X POST http://localhost:8080/api/v1/loads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "originName": "Surat Port",
    "originLat": 21.1702, "originLng": 72.8311,
    "destinationName": "Bhopal",
    "destLat": 23.2599, "destLng": 77.4126,
    "requiredCapacity": 10.0,
    "payoutInr": 18000,
    "pickupTime": "2026-04-01T10:00:00Z"
  }'
```

---

## 📁 Project Structure

```
vahansync-core/
├── docker-compose.yml              ← Local dev: Postgres/PostGIS + Redis + Kafka
├── .env.example                    ← Copy to .env and fill secrets
├── pom.xml                         ← Maven: Java 21, Spring Boot 3.2.4
└── src/main/
    ├── java/com/loadsetu/vahansync/
    │   ├── VahanSyncApplication.java        ← Entry point + UTC + @EnableJpaAuditing
    │   ├── config/
    │   │   ├── GlobalExceptionHandler.java  ← requestId in every error, no stack traces
    │   │   ├── KafkaConfig.java             ← Producer + consumer beans
    │   │   └── RateLimitConfig.java         ← Bucket4j + Upstash Redis (fail-open)
    │   ├── controller/
    │   │   ├── AuthController.java          ← /auth/login, /register, /register-shipper
    │   │   ├── LoadController.java          ← /loads (CRUD) + /loads/match + /loads/bulk
    │   │   ├── PaymentController.java       ← /payments/create-order/{id} (Razorpay init)
    │   │   ├── PaymentWebhookController.java← /payments/webhook (gateway callback)
    │   │   └── TelemetryController.java     ← /telemetry (GPS) + /telemetry/twilio
    │   ├── dto/
    │   │   └── Dtos.java                    ← All request/response models
    │   ├── entity/
    │   │   ├── User.java                    ← DRIVER/SHIPPER/FLEET_OWNER + companyName
    │   │   ├── Truck.java                   ← truckNumber regex + ownerId + noShowCount
    │   │   ├── Load.java                    ← PostGIS geometry + IDOR shipperId
    │   │   ├── Booking.java                 ← driverId + FRAUD_ATTEMPT + ML fields
    │   │   ├── PaymentAuditLog.java         ← Immutable fintech audit trail
    │   │   ├── PricingImpressionLog.java    ← XGBoost ML training data
    │   │   └── OutboxEvent.java             ← Transactional outbox (Kafka reliability)
    │   ├── filter/
    │   │   └── CorrelationIdFilter.java     ← X-Request-ID → MDC (distributed tracing)
    │   ├── kafka/
    │   │   └── KafkaProducerService.java    ← Async publish + telemetry consumer
    │   ├── repository/
    │   │   ├── LoadRepository.java          ← ST_DWithin + IDOR findByIdAndShipperId
    │   │   ├── BookingRepository.java       ← findByIdAndDriverId (payment IDOR)
    │   │   ├── TruckRepository.java         ← existsByIdAndOwnerId
    │   │   └── UserRepository.java
    │   ├── scheduler/
    │   │   └── OutboxRelayScheduler.java    ← 5s poll + exponential backoff + DLQ
    │   ├── security/
    │   │   ├── JwtUtils.java                ← Token generation + validation
    │   │   └── SecurityConfig.java          ← 3-tier chain: Public/InternalAI/JWT
    │   └── service/
    │       ├── AuthService.java             ← login + register + registerShipper
    │       ├── LoadService.java             ← match + createSingleLoad + confirmBooking
    │       ├── PaymentGatewayService.java   ← Razorpay mock (upgrade path documented)
    │       ├── PaymentWebhookService.java   ← REQUIRES_NEW audit + fraud detection
    │       ├── ReservationService.java      ← Redis lock (fail-open)
    │       └── UlipVerificationService.java ← @CircuitBreaker + @Retry
    └── resources/
        ├── application.yml                  ← All config (Neon/Upstash/Kafka/JWT)
        ├── logback-spring.xml               ← [requestId] in every log line
        └── db/migration/
            ├── V1__init_vahansync_schema.sql
            ├── V2__v2_fintech_safety_ml_pipeline.sql
            └── V3__user_system_hardening.sql  ← Includes V4 columns
```

---

## 🗺️ Complete API Reference

### Auth (Public — no JWT)

| Method | Path | Body | Returns |
|--------|------|------|---------|
| `POST` | `/api/v1/auth/login` | `{phone, password}` | JWT token |
| `POST` | `/api/v1/auth/register` | `{fullName, phone, password, role}` | JWT token |
| `POST` | `/api/v1/auth/register-shipper` | `{phone, password, companyName}` | JWT + companyName |

### Loads (JWT required)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/loads` | JWT (SHIPPER) | Create single load (Next.js dashboard) |
| `GET`  | `/api/v1/loads/{id}` | JWT | Fetch own load (IDOR-safe) |
| `POST` | `/api/v1/loads/match` | X-INTERNAL-SECRET | AI spatial matching (Python only) |
| `POST` | `/api/v1/loads/bulk` | X-INTERNAL-SECRET | Bulk enterprise ingest (Python only) |

### Bookings (JWT required)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/bookings` | JWT (DRIVER) | Confirm a matched load |
| `POST` | `/api/v1/bookings/{id}/no-show` | JWT | Report driver no-show |

### Payments (JWT required)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/payments/create-order/{bookingId}` | JWT (DRIVER) | Init Razorpay order |
| `POST` | `/api/v1/payments/webhook` | Public (rate-limited) | Gateway callback |

### Other

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/telemetry` | JWT | Driver GPS push → Kafka |
| `POST` | `/api/v1/telemetry/twilio` | Public | WhatsApp webhook from Meta |
| `GET`  | `/api/v1/trucks/verify/{rc}` | JWT | ULIP RC verification |
| `GET`  | `/api/v1/health` | Public | Health check |

---

## 🔐 Security Architecture

### 3-Tier Filter Chain

```
Request
  │
  ▼
CorrelationIdFilter (@Order 1)       ← Assigns X-Request-ID to MDC. Always runs first.
  │
  ▼
InternalApiSecurityFilter            ← Checks X-INTERNAL-SECRET header
  │   Valid secret → ROLE_INTERNAL_AI (Python AI calls /loads/match, /loads/bulk)
  │   Wrong secret → 401 IMMEDIATELY (no fallthrough)
  │   No header    → continues to JWT filter
  ▼
JwtAuthFilter                        ← Validates Bearer token from React/Mobile
  │   Valid JWT   → sets SecurityContext with userId + role
  │   No/bad JWT  → SecurityContext empty → Spring returns 401 on protected routes
  ▼
SecurityFilterChain rules:
  /auth/**                → permitAll
  /telemetry/twilio       → permitAll
  /health, /actuator/**   → permitAll
  /loads/match, /loads/bulk → hasAuthority(ROLE_INTERNAL_AI)
  everything else         → authenticated()
```

### IDOR Protection Pattern

Every resource read/update includes the authenticated user's ID:
```java
// ❌ WRONG — allows any authenticated user to read any load
loadRepository.findById(id)

// ✅ CORRECT — only returns if the authenticated shipper owns this load
loadRepository.findByIdAndShipperId(id, UUID.fromString(principalId))

// Returns 404 for both "not found" and "not owner" — never reveals existence
```

---

## 💳 Payment Flow (Full Loop)

```
1. Driver confirms booking via WhatsApp
   POST /api/v1/bookings
   → Booking created (status: AWAITING_PAYMENT)
   → driverId stored on booking

2. React Native app calls:
   POST /api/v1/payments/create-order/{bookingId}
   → IDOR check: booking.driverId == authenticated driver ✅
   → PaymentGatewayService.createOrder() → "order_mock_ABC123"
   → Returns { gateway_order_id, amount, currency }

3. React Native opens Razorpay SDK with gateway_order_id
   → Driver pays on phone

4. Razorpay calls our server:
   POST /api/v1/payments/webhook
   → PaymentAuditLog written (REQUIRES_NEW transaction — always committed)
   → webhook.amount == booking.driverMatchFee ? CONFIRMED : FRAUD_ATTEMPT
   → booking-events published to Kafka via Outbox pattern
```

---

## 🔄 Outbox Pattern (Kafka Reliability)

Local Docker Kafka can restart. The Outbox pattern prevents event loss:

```
confirmBooking() @Transactional {
    bookingRepository.save(booking)     ─┐ Same DB transaction
    outboxRepository.save(outboxEvent)  ─┘ Commits together or both roll back

    // NO direct Kafka.send() here — avoids dual-write problem
}

OutboxRelayScheduler (@Scheduled every 5s) {
    events = outboxRepository.findDueForRelay()
    for event in events:
        kafka.send(event.topic, event.payload).get()  // Blocking ack
        event.status = PUBLISHED

    // On failure: exponential backoff
    // retryCount 1 → wait 30s
    // retryCount 2 → wait 60s
    // retryCount 3 → wait 120s
    // retryCount 4 → wait 240s
    // retryCount 5 → wait 480s
    // retryCount > 5 → status = DLQ (manual review)
}
```

---

## 🧠 ML Data Pipeline

Every load offer sent to a driver is logged in `pricing_impression_logs`:

```
offered_payout_inr | deadhead_km | local_truck_supply | response_time_ms | driver_response
      18000        |    12.5     |         3          |       245        |    ACCEPTED
      15000        |    22.0     |         8          |       312        |    REJECTED
      20000        |     8.0     |         1          |       198        |    ACCEPTED
```

This table feeds the XGBoost pricing model — "given supply, deadhead, and payout, what's the acceptance probability?"

---

## 🌐 Cloud Infrastructure Map

| Component | Local Dev | Production |
|-----------|-----------|------------|
| PostgreSQL | Docker (postgis/postgis:15) | Neon Cloud (SSL) |
| Redis | Docker (redis:7) | Upstash (SSL, rediss://) |
| Kafka | Docker (confluentinc/cp-kafka:7.6) | AWS MSK |
| App | `./mvnw spring-boot:run` | AWS EKS (Kubernetes) |
| ULIP | Mock (200ms simulated) | ULIP DPIIT live API |
| Payment | Mock order IDs | Razorpay live keys |

### Switching local → Neon Cloud
```bash
# .env
DB_HOST=ep-your-neon-endpoint.ap-southeast-1.aws.neon.tech
DB_PORT=5432
DB_NAME=vahansync_db
DB_USER=vahansync
DB_PASS=your-neon-password
# sslmode=require is already in application.yml JDBC URL
```

### Switching local Redis → Upstash
```bash
# .env
REDIS_HOST=your-instance.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-upstash-token
REDIS_SSL=true    # Enables rediss://
```

---

## ✅ Pre-Launch Checklist

- [ ] Set `JWT_SECRET` to a real 512-bit base64 value: `openssl rand -base64 64`
- [ ] Set `INTERNAL_API_SECRET` shared secret with Python FastAPI team: `openssl rand -hex 32`
- [ ] Set `ULIP_MOCK=false` and configure `ULIP_API_KEY` when ULIP sandbox creds arrive
- [ ] Set `PAYMENT_MOCK=false` and add `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`
- [ ] Add Razorpay HMAC signature verification in `PaymentWebhookController`
- [ ] Set `REDIS_SSL=true` and configure Upstash credentials
- [ ] Run `EXPLAIN ANALYZE` on `/loads/match` query — verify GIST index is being hit
- [ ] Replace `generateLoadHash()` SHA with `SHA-256` (current uses `hashCode()`)
- [ ] Set up PagerDuty/Slack webhook for `DLQ` outbox events
- [ ] Set up alert for `FRAUD_ATTEMPT` bookings in `payment_audit_logs`
- [ ] Configure Flyway baseline if migrating existing data

---

## 🔧 Troubleshooting

**App fails to start with "relation does not exist"**
→ Flyway migration failed. Check DB connection. Ensure PostGIS extension is enabled:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

**Kafka publish fails at startup**
→ Topics don't exist yet. `docker compose up -d` runs `kafka-init` which creates them.
Or run manually: `docker exec vahansync-kafka kafka-topics.sh --create ...`

**Rate limiter not working**
→ Redis is down. Rate limiter is fail-open — requests pass through. Check Redis connection.

**`/loads/match` returns 401**
→ Python AI service is not sending `X-INTERNAL-SECRET` header. Check FastAPI client config.

**`/loads/match` returns 403 for a truck**
→ Truck `noShowCount >= 5`. Driver is shadow-banned. Check `trucks` table.

---

*LoadSetu × VahanSync — Built for 10,000 trucks, designed for 10,000,000.*
