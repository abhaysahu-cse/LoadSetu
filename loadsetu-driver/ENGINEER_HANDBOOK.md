# LoadSetu Driver App — Engineer Handbook
> Production-ready. India highway conditions. Offline-first. Voice-first.

---

## 📡 Exact Endpoint Map

| # | Action | Method | Base | Path | Notes |
|---|--------|--------|------|------|-------|
| 1 | Login | POST | `:8080` | `/api/v1/auth/login` | Store JWT in Keychain |
| 2 | Refresh Token | POST | `:8080` | `/api/v1/auth/refresh` | On 401 |
| 3 | Logout | POST | `:8080` | `/api/v1/auth/logout` | |
| 4 | **GPS Telemetry** | POST | `:8000` | `/api/v1/telemetry` | FastAPI ONLY — never :8080 |
| 5 | Batch Telemetry Flush | POST | `:8000` | `/api/v1/telemetry/batch` | Offline reconnect |
| 6 | Voice Parse | POST | `:8000` | `/api/v1/voice/parse` | multipart/form-data, key=audio |
| 7 | Nearby Loads | GET | `:8080` | `/api/v1/loads/nearby?lat=&lng=&radius=50` | TanStack Query cached |
| 8 | Load by ID | GET | `:8080` | `/api/v1/loads/{loadId}` | Deep link entry |
| 9 | Accept Load | POST | `:8080` | `/api/v1/bookings/{loadId}/accept` | Redis lock on backend |
| 10 | Confirm Pickup | POST | `:8080` | `/api/v1/bookings/{bookingId}/pickup-confirmed` | Optional photo proof |
| 11 | Confirm Delivery | POST | `:8080` | `/api/v1/bookings/{bookingId}/delivered` | Optional photo proof |
| 12 | Active Booking | GET | `:8080` | `/api/v1/bookings/active` | |
| 13 | Booking History | GET | `:8080` | `/api/v1/bookings/history?page=0&size=20` | |
| 14 | Update Status | PATCH | `:8080` | `/api/v1/driver/status` | `{status: OFFLINE\|ONLINE\|IN_TRIP}` |
| 15 | Driver Profile | GET | `:8080` | `/api/v1/driver/profile` | |

---

## 🔐 Request Headers (Every single request)

```
Authorization: Bearer <JWT from react-native-keychain>
X-Request-ID:  <UUID v4 — generated per request>
Content-Type:  application/json  (or multipart/form-data for voice)
```

---

## 🏗️ Data Flow

```
Driver GPS (every 30s moving / 3min idle)
    ↓
react-native-background-geolocation
    ↓ (if network)
POST :8000/api/v1/telemetry    ← FastAPI AI Proxy
    ↓
Kafka topic: truck.telemetry
    ↓
Spring Boot (persist + broadcast)
    ↓
Redis (live position cache for shippers)

    ↓ (if NO network)
SQLite offline_queue
    ↓ (on reconnect)
POST :8000/api/v1/telemetry/batch
```

```
Driver speaks
    ↓
Audio file (.aac, ≤2MB)
    ↓
POST :8000/api/v1/voice/parse
    ↓
Gemini (intent extraction)
    ↓
{ intent, entities }
    ↓
Navigate to relevant screen
```

```
WhatsApp message: "loadsetu://load/abc123"
    ↓ (if app installed)
App opens → LoadDetailScreen
    ↓ (if app NOT installed)
https://app.loadsetu.in/load/abc123
    ↓
Browser → Play Store redirect
```

---

## 📦 File Structure

```
loadsetu-driver/
├── App.tsx                         # Root — wires all services
├── index.js                        # FCM background handler
├── package.json
└── src/
    ├── api/
    │   ├── client.ts               # Axios + JWT + retry + rate-limit
    │   └── endpoints.ts            # All 15 endpoints, typed
    ├── services/
    │   ├── gps.service.ts          # Background GPS + offline buffer
    │   ├── offline.service.ts      # SQLite queue + load cache
    │   └── voice.service.ts        # Recording + 2MB cap + AI parse
    ├── hooks/
    │   └── useApi.ts               # TanStack Query hooks + persisted cache
    ├── navigation/
    │   └── deepLink.ts             # loadsetu:// + App Links
    └── screens/
        ├── HomeScreen.tsx          # Dashboard + status + voice + loads
        ├── LoadDetailScreen.tsx    # Accept + rate limit + deep link
        ├── ActiveBookingScreen.tsx # Trip tracking (implement similarly)
        └── LoginScreen.tsx         # Auth (implement similarly)
```

---

## ✅ Non-Negotiable Checklist (DO NOT SHIP WITHOUT)

- [ ] `react-native-background-geolocation` foreground service active
- [ ] `stopOnTerminate: false` + `enableHeadless: true` in GPS config
- [ ] JWT stored in `react-native-keychain` (NEVER AsyncStorage)
- [ ] `react-native-ssl-pinning` configured with prod certificate hash
- [ ] Deep linking scheme `loadsetu://` registered in app.json + AndroidManifest
- [ ] Offline queue flushes on NetInfo reconnect event
- [ ] Rate-limit (429) shows cooldown timer, disables action button
- [ ] FCM background handler registered in index.js (before AppRegistry)
- [ ] TanStack Query `persistQueryClient` wired to AsyncStorage
- [ ] SQLite `offline_queue` table created on first launch
- [ ] GPS telemetry NEVER goes to `:8080` — always `:8000` (FastAPI)
- [ ] Voice file hard-rejected if >2MB (no upload attempt)
- [ ] `X-Request-ID` header on every request

---

## 🔑 SSL Pinning Setup

```typescript
// react-native-ssl-pinning usage
import { fetch } from 'react-native-ssl-pinning';

await fetch('https://api.loadsetu.in/api/v1/auth/login', {
  method: 'POST',
  pkPinning: true,
  sslPinning: {
    certs: ['cert_sha256_base64_here'], // Get from: openssl s_client -connect api.loadsetu.in:443
  },
  body: JSON.stringify(payload),
});
```

---

## 🌐 Deep Link Registration (app.json)

```json
{
  "expo": {
    "scheme": "loadsetu",
    "android": {
      "intentFilters": [{
        "action": "VIEW",
        "autoVerify": true,
        "data": [
          { "scheme": "loadsetu" },
          { "scheme": "https", "host": "app.loadsetu.in" }
        ],
        "category": ["BROWSABLE", "DEFAULT"]
      }]
    }
  }
}
```

---

## ⚡ The Three Highway Rules

1. **Rajasthan Rule** — Any failed API call → saved to SQLite → retried silently on reconnect. User NEVER sees a blocking error for offline saves.

2. **Phone Kill Rule** — Android foreground service with persistent notification. `stopOnTerminate: false`. GPS survives battery saver, app kill, screen lock.

3. **WhatsApp Bridge Rule** — `loadsetu://` scheme registered. Invalid links → friendly alert, no crash. App not installed → Play Store URL.
