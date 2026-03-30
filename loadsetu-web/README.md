# LoadSetu × VahanSync — Frontend Command Center

Production-grade Next.js 15 frontend for the AI-Powered National Freight Exchange.

---

## Day 1 Bootstrap

```bash
npx create-next-app@latest loadsetu-frontend --typescript --tailwind --eslint
cd loadsetu-frontend

npm install \
  zustand \
  @tanstack/react-query \
  framer-motion \
  mapbox-gl @types/mapbox-gl \
  axios \
  xlsx \
  uuid \
  clsx \
  tailwind-merge

cp .env.example .env.local
# → Fill in NEXT_PUBLIC_MAPBOX_TOKEN and backend URLs

npm run dev
```

---

## Architecture

```
src/
├── app/
│   ├── layout.tsx              Root layout (font, metadata)
│   ├── page.tsx                Redirect → /map
│   ├── globals.css             Tailwind base + custom scrollbar + Mapbox overrides
│   ├── providers.tsx           QueryClient + WebSocket init + Rate limit + Toasts
│   ├── login/page.tsx          JWT login page
│   └── (dashboard)/
│       ├── layout.tsx          Auth guard + Sidebar shell
│       ├── map/page.tsx        God View (Mapbox)
│       ├── exchange/page.tsx   Load Exchange board
│       ├── ingest/page.tsx     Bulk CSV/Excel ingest
│       ├── analytics/page.tsx  ROI analytics dashboard
│       └── fleet/page.tsx      Fleet management panel
│
├── components/
│   ├── ui/
│   │   ├── Sidebar.tsx         Collapsible nav + platform status + correlation ID
│   │   └── RateLimitBanner.tsx 429 countdown banner + toast system
│   └── features/
│       ├── LiveMap/
│       │   └── GodView.tsx     Mapbox + H3 heatmap + radius + deadhead lines
│       ├── LoadIngest/
│       │   ├── BulkIngest.tsx  Drag-drop → parse → validate → confirm flow
│       │   └── LoadExchange.tsx Split-screen exchange board with booking
│       ├── Analytics/
│       │   └── Dashboard.tsx   KPI cards + bar chart + route rankings
│       └── Fleet/
│           └── FleetPanel.tsx  Truck list + detail panel + map flyTo
│
├── lib/
│   ├── api/
│   │   ├── client.ts           Axios instance: JWT + X-Request-ID + 429 + refresh
│   │   └── hooks.ts            TanStack Query hooks for all endpoints
│   ├── websocket/
│   │   └── socket.ts           WS manager: reconnect + REST fallback
│   └── localization/
│       └── dictionary.ts       Hinglish dictionary + t() helper
│
├── store/
│   └── index.ts                Zustand: authStore, fleetStore, mapStore, uiStore
│
├── middleware.ts                Next.js auth guard for all dashboard routes
├── next.config.js              Mapbox webpack fix + CSP headers + API rewrites
├── tailwind.config.ts          Custom palette + safelist
└── tsconfig.json               Strict mode + @/* aliases
```

---

## State Rules

| State type | Tool | Examples |
|---|---|---|
| Server/API data | TanStack Query | Trucks, matches, analytics |
| UI-only state | Zustand | Sidebar open, selected truck, toasts |
| Never | Redux | — |

---

## Security Checklist

- [x] JWT interceptor — every request gets `Authorization: Bearer <token>`
- [x] X-Request-ID — every request gets a UUID; tracked in UI debug panel
- [x] httpOnly cookie support — `withCredentials: true` on all Axios calls
- [x] 429 rate limit UI — countdown banner, button disabled while cooling
- [x] Error toasts with requestId — surfaced from `X-Request-ID` response header
- [x] Silent token refresh — 401 triggers refresh before retry
- [x] No raw secrets in client bundle — all env vars via `NEXT_PUBLIC_*`
- [x] Middleware auth guard — redirects unauthenticated users to `/login`
- [x] CSP headers — Mapbox and backend origins explicitly whitelisted
- [x] Tokens in sessionStorage only — never localStorage

---

## WebSocket Flow

```
Spring Boot (Kafka consumer)
  → WS push to /ws/telemetry
    → TelemetrySocketManager.dispatch()
      → TRUCK_LOCATION_UPDATE → useFleetStore.upsertTruck()
      → BOOKING_CONFIRMED    → useUIStore.addToast()
      → PLATFORM_STATUS      → useUIStore.setPlatformStatus()
```

If WS fails after 5 reconnect attempts → falls back to REST polling every 8s.

---

## CORS Setup (Spring Boot side)

The `CorsFilter` in your Spring Boot service **must** whitelist this origin:

```yaml
# application.yml
loadsetu:
  cors:
    allowed-origins: http://localhost:3000
```

The frontend sets `withCredentials: true` — Spring Boot must respond with:
```
Access-Control-Allow-Credentials: true
Access-Control-Allow-Origin: http://localhost:3000  # exact origin, not *
```

---

## Hinglish Localization

When the backend returns `detected_language: "hi"` on login:
- UI labels stay English
- Help, status, and notification text switches to Hinglish

```ts
import { createLocale } from "@/lib/localization/dictionary";
const { t } = createLocale("hi");
t("truck_empty"); // → "Truck khali hai — load chahiye"
t("booking_confirmed"); // → "Booking pakki! Aap chalna shuru kar sakte ho."
```

Add new strings to `src/lib/localization/dictionary.ts`.

---

## API Endpoints Consumed

| Method | URL | Service | Used by |
|---|---|---|---|
| POST | `/auth/login` | Spring Boot | Login page |
| GET | `/api/v1/fleet/trucks` | Spring Boot | GodView, Fleet, Exchange |
| POST | `/api/v1/loads/match` | FastAPI | GodView, Exchange |
| POST | `/api/v1/bookings` | Spring Boot | Exchange |
| GET | `/api/v1/analytics/dashboard` | Spring Boot | Analytics |
| GET | `/api/v1/heatmap/h3` | FastAPI | GodView H3 layer |
| POST | `/api/v1/loads/bulk?dry_run=true` | Spring Boot | BulkIngest |
| POST | `/api/v1/loads/bulk` | Spring Boot | BulkIngest |
| WS | `/ws/telemetry` | Spring Boot | Global telemetry |
