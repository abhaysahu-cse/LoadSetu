# VahanSync AI Microservice  v2
### LoadSetu × VahanSync — Production AI & Freight Matching Engine

> Solves India's ₹14 trillion logistics "empty run" crisis.
> Launched for public use. Built for millions of users from Day 1.

---

## Architecture overview

```
WhatsApp Driver / Shipper (Text or Voice Note)
              ↓
   Twilio Webhook  POST /webhook/whatsapp/twilio
              ↓
 ┌────────────────────────────────────────────────┐
 │            Security Gauntlet (in order)        │
 │  1. Twilio HMAC Signature Validation           │
 │  2. MessageSid Idempotency (Redis SETNX)       │
 │  3. Per-phone Rate Limiting  (10 req/60s)      │
 │  4. Voice Note 2MB Guardrail                   │
 │  5. Message Length Guard  (250 char)           │
 │  6. Shipper State Machine  (pre-Gemini)        │
 └────────────────────────────────────────────────┘
              ↓
   Gemini 1.5 Flash  (Intent Parser v2)
   • Dual-intent detection  (driver | shipper)
   • 10+ language support   (Tamil, Marathi, etc.)
   • Voice note transcription + extraction
   • Prompt injection guard
   • Tenacity retry + asyncio hard timeout
              ↓
 ┌────────────────────────────────────────────────┐
 │         Dual-Intent Router                     │
 │  DRIVER  → H3 Matching Engine                  │
 │            → Spring Boot  (load fetch)         │
 │            → Pricing Engine                    │
 │            → WhatsApp teaser reply             │
 │  SHIPPER → Pricing Engine                      │
 │            → Redis state save (5-min TTL)      │
 │            → WhatsApp price quote              │
 │            → YES → Kafka booking-events        │
 └────────────────────────────────────────────────┘
              ↓
   Apache Kafka   (event streaming)
   • truck-telemetry-events  (consumed)
   • booking-events          (produced)
   • load-status-events      (produced)
```

---

## Project structure

```
vahansync/
├── main.py                    # FastAPI app — all routes, middleware, security
├── config/
│   └── settings.py            # All env vars (pydantic-settings)
├── models/
│   └── schemas.py             # All Pydantic models with guardrails
├── services/
│   ├── gemini_parser.py       # LLM chain v2 — text + voice + bulk
│   ├── matching_engine.py     # H3 matching — calls Spring Boot
│   ├── pricing_engine.py      # V1 rule engine + driver fee tiers
│   └── kafka_client.py        # Kafka producer + telemetry consumer
├── tests/
│   └── test_integration.py    # Full test suite
├── docker-compose.yml         # Postgres+PostGIS, Redis, Kafka, Kafka-UI
├── requirements.txt
└── .env.example
```

---

## Quick start (VS Code)

```bash
# 1. Start infrastructure (Postgres, Redis, Kafka)
docker-compose up -d

# 2. Set up Python environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Configure
cp .env.example .env
# Edit .env — add GEMINI_API_KEY at minimum
# Generate INTERNAL_API_SECRET:
# python -c "import secrets; print(secrets.token_hex(32))"

# 4. Run
uvicorn main:app --reload --port 8000

# 5. Open docs
open http://localhost:8000/docs
```

---

## Core API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhook/whatsapp/twilio` | Primary driver/shipper entry point |
| POST | `/webhook/whatsapp/meta` | Meta Business API webhook |
| GET  | `/webhook/whatsapp/meta` | Meta verification handshake |
| POST | `/webhook/payment/success` | Razorpay/Cashfree capture → unlock shipper details |
| POST | `/api/v1/loads/match` | Direct load matching (dashboard / Spring Boot) |
| POST | `/api/v1/bookings/confirm` | Confirm a match → publish Kafka events |
| POST | `/api/v1/pricing/calculate` | Standalone pricing calculator |
| POST | `/api/v1/parse/intent` | Debug: test Gemini parser |
| POST | `/api/v1/parse/shipper-bulk` | Magic Dropzone: Excel paste → clean loads |
| GET  | `/health` | Kubernetes liveness probe |
| GET  | `/ready` | Kubernetes readiness probe |

---

## Security layers (Twilio webhook)

Each incoming WhatsApp message passes through 9 sequential layers before reaching Gemini:

1. **Twilio HMAC Signature** — `twilio.RequestValidator` validates `X-Twilio-Signature`. Drops spoofed requests with 403.
2. **MessageSid Idempotency** — `SETNX processed_msg:{sid}` with 5-min TTL. Returns silent 200 on Twilio retries.
3. **Rate Limiting** — `INCR rate_limit:whatsapp:{phone}` — max 10 requests/60s. Returns localised wait message.
4. **Voice Note 2MB Guard** — Audio downloaded with Twilio Basic Auth. Rejected if > 2MB.
5. **Message Length Guard** — Max 250 characters before hitting Gemini API (prompt injection / Denial-of-Wallet).
6. **Shipper State Machine** — Redis key `shipper_state:{phone}` checked PRE-Gemini. YES confirms load, anything else cancels.
7. **Post-LLM Pydantic Guardrails** — `capacity_tons ≤ 50`, `payout_inr < 500,000`. Hallucinations trigger clarification flow.
8. **Prompt Injection Guard** — System prompt explicitly instructs Gemini to return `user_role: unknown` on injection attempts.
9. **DPDP Log Masking** — `mask_phone()` ensures raw numbers never appear in logs. `+919876543210 → +91XXXXXX3210`.

### Redis fail-open protocol
All Redis calls are wrapped in `try/except`. If Redis is down, the core text-matching request proceeds unblocked. Rate limiting and idempotency are skipped — logged at WARNING level.

---

## Dual-intent routing

| Message | Detected Role | Action |
|---------|--------------|--------|
| "Surat se kal 10 ton khali hai Bhopal jana hai" | `driver` | H3 match → load options |
| "Mumbai se Delhi 500kg electronics bhejne hain" | `shipper` | Price quote → Redis state → confirm |
| "YES" (after quote) | shipper confirmation | Kafka `booking-events` → Spring Boot |
| Any other reply | shipper cancel | Redis state deleted |

---

## Voice note flow

```
Driver sends audio → Twilio webhook
  → NumMedia > 0 detected
  → httpx download with Twilio Basic Auth (5s timeout)
  → 2MB size check
  → genai.BlobDict(mime_type, audio_bytes) → Gemini 1.5 Flash
  → Gemini transcribes + extracts intent in ONE call
  → Same ParsedFreightIntent pipeline
  → Same WhatsApp reply format
```

Supported formats: OGG/OPUS (WhatsApp default), MP4, MP3, WAV, WebM, AMR.

---

## Gemini parser features

- **Dual-intent detection** — `user_role: driver | shipper | unknown`
- **10+ language support** — followup messages written in driver's own language
- **Prompt injection guard** — injection attempts return `user_role: unknown` + confidence 0.0
- **Tenacity retry** — 2 retries with 1s backoff on transient Gemini failures
- **Hard asyncio timeout** — 10 seconds per call, never blocks Twilio's 15s window
- **Post-LLM Pydantic guardrails** — capacity > 50 tons or payout > ₹5L triggers clarification
- **Bulk shipper parse** — Magic Dropzone for enterprise shippers

---

## Pricing model

```
base_freight     = weight_tons × distance_km × ₹1.85/ton/km × truck_multiplier
fuel_surcharge   = base_freight × 12%
toll_estimate    = (distance_km / 100) × ₹120
urgency_premium  = base_freight × 8%  (same-day loads only)
gross_payout     = base + fuel + toll + urgency
platform_fee     = gross × 4%
deadhead_cost    = deadhead_km × ₹8.50  (progressive 3-tier penalty)
net_payout       = gross - platform_fee - deadhead_cost

driver_match_fee = ₹99   if net_payout < ₹10,000
                 = ₹199  if net_payout ≤ ₹25,000
                 = ₹299  if net_payout > ₹25,000
```

---

## Kafka topics

| Topic | Direction | Consumer |
|-------|-----------|----------|
| `truck-telemetry-events` | Consumed | Updates Redis location cache + H3 index |
| `booking-events` | Produced | Spring Boot → PostgreSQL booking persistence |
| `load-status-events` | Produced | Spring Boot → load state machine |

---

## Spring Boot integration

This service is the intelligence layer. Spring Boot is the data layer.

**Python → Spring Boot:**
- `POST /api/v1/loads/match` — fetch ranked matches from the Spring matching contract
- All requests include `X-INTERNAL-SECRET` header

**Spring Boot filter (Java):**
```java
@Component
public class InternalSecretFilter extends OncePerRequestFilter {
    @Value("${internal.api.secret}")
    private String expectedSecret;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if (!expectedSecret.equals(req.getHeader("X-INTERNAL-SECRET"))) {
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }
        chain.doFilter(req, res);
    }
}
```

---

## Environment variables (key ones)

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ | Google AI Studio key |
| `INTERNAL_API_SECRET` | ✅ | Service-to-service auth (generate: `secrets.token_hex(32)`) |
| `TWILIO_ACCOUNT_SID` | ✅ (prod) | For voice note download auth |
| `TWILIO_AUTH_TOKEN` | ✅ (prod) | For webhook signature validation |
| `REDIS_URL` | ✅ | Redis connection string |
| `KAFKA_BOOTSTRAP_SERVERS` | ✅ | Kafka broker(s) |
| `SPRING_BOOT_BASE_URL` | ✅ | Java backend URL |
| `RAZORPAY_KEY_SECRET` | ✅ (prod) | Payment webhook HMAC verification |

See `.env.example` for all variables with documentation.

---

## Testing

```bash
# All tests
pytest tests/ -v --asyncio-mode=auto

# Specific test
pytest tests/test_integration.py::test_match_loads_basic -v

# With coverage
pytest tests/ --cov=services --cov=models --cov-report=term-missing
```

---

## Production deployment (AWS EKS)

```bash
docker build -t vahansync-ai:v2 .
docker tag vahansync-ai:v2 $ECR_URL/vahansync-ai:v2
docker push $ECR_URL/vahansync-ai:v2
kubectl apply -f k8s/
```

Set all env vars via AWS Secrets Manager → Kubernetes Secrets.
Never put secrets in the Docker image or k8s YAML.

---

## V2 roadmap

- [ ] XGBoost surge pricing model (replaces rule engine)
- [ ] ULIP/VAHAN truck verification integration
- [ ] OLA Maps reverse geocode (replaces hardcoded city coords)
- [ ] Full Meta Graph API reply integration
- [ ] Twilio proactive message send (booking reminders, payment links)
- [ ] Driver fraud detection layer
- [ ] Multi-language shipper price quote templates
