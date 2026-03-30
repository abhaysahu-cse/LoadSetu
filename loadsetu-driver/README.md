# 🚛 LoadSetu Driver App

> React Native · Expo · Offline-First · Voice-Driven · India Highway Ready

---

## ⚡ QUICK START (Run these commands in order)

### Step 1 — Prerequisites (install once on your machine)

```bash
# Install Node.js 18+ from https://nodejs.org

# Install Expo CLI
npm install -g expo-cli eas-cli

# Install Android Studio from https://developer.android.com/studio
# Then set up Android emulator OR connect a real Android phone via USB
```

### Step 2 — Setup the project

```bash
# Navigate into the project folder
cd loadsetu-driver

# Install all dependencies
npm install
```

### Step 3 — Configure your server IP

Open `src/api/client.ts` and replace:
```typescript
export const SPRING_BOOT_BASE = 'http://<PROD_IP>:8080';
export const FASTAPI_BASE     = 'http://<PROD_IP>:8000';
```
With your actual server IP, e.g.:
```typescript
export const SPRING_BOOT_BASE = 'http://192.168.1.100:8080';
export const FASTAPI_BASE     = 'http://192.168.1.100:8000';
```

### Step 4 — Firebase (FCM Push Notifications)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create project → Add Android app → package name: `in.loadsetu.driver`
3. Download `google-services.json`
4. Replace the `google-services.json` file in this folder with your downloaded one

### Step 5 — Background Geolocation License

`react-native-background-geolocation` requires a license for production.
- Get a free trial at: https://www.transistorsoft.com/shop/products/react-native-background-geolocation
- Open `app.json` and replace `"YOUR_LICENSE_KEY_HERE"` with your key

### Step 6 — Run the app

```bash
# Run on Android (emulator or real device)
npx expo run:android

# Run on iOS (Mac only)
npx expo run:ios

# If you want to use Expo Go (limited — background GPS won't work):
npx expo start
```

---

## 📁 Project Structure

```
loadsetu-driver/
├── App.tsx                          ← Root: wires all services
├── index.js                         ← FCM background handler
├── app.json                         ← Expo config + deep linking
├── package.json                     ← All dependencies
├── tsconfig.json
├── babel.config.js
├── google-services.json             ← REPLACE with your Firebase file
├── ENGINEER_HANDBOOK.md             ← Full endpoint map + architecture
└── src/
    ├── api/
    │   ├── client.ts                ← Axios + JWT + retry + rate limit
    │   └── endpoints.ts             ← All 15 API endpoints, typed
    ├── services/
    │   ├── gps.service.ts           ← Background GPS + offline buffer
    │   ├── offline.service.ts       ← SQLite queue + load cache
    │   └── voice.service.ts         ← Hold-to-record + 2MB cap + Gemini
    ├── hooks/
    │   └── useApi.ts                ← TanStack Query hooks
    ├── navigation/
    │   └── deepLink.ts              ← loadsetu:// deep linking
    └── screens/
        ├── LoginScreen.tsx
        ├── HomeScreen.tsx           ← Dashboard + voice + load list
        ├── LoadDetailScreen.tsx     ← Accept load + rate limit
        └── ActiveBookingScreen.tsx  ← Live trip + pickup/delivery
```

---

## 🔌 API Endpoints (What your backend must expose)

| # | Method | URL | Server |
|---|--------|-----|--------|
| 1 | POST | `/api/v1/auth/login` | Spring Boot :8080 |
| 2 | POST | `/api/v1/auth/refresh` | Spring Boot :8080 |
| 3 | POST | `/api/v1/auth/logout` | Spring Boot :8080 |
| 4 | POST | `/api/v1/telemetry` | **FastAPI :8000** |
| 5 | POST | `/api/v1/telemetry/batch` | **FastAPI :8000** |
| 6 | POST | `/api/v1/voice/parse` | **FastAPI :8000** |
| 7 | GET | `/api/v1/loads/nearby?lat=&lng=&radius=50` | Spring Boot :8080 |
| 8 | GET | `/api/v1/loads/{loadId}` | Spring Boot :8080 |
| 9 | POST | `/api/v1/bookings/{loadId}/accept` | Spring Boot :8080 |
| 10 | POST | `/api/v1/bookings/{bookingId}/pickup-confirmed` | Spring Boot :8080 |
| 11 | POST | `/api/v1/bookings/{bookingId}/delivered` | Spring Boot :8080 |
| 12 | GET | `/api/v1/bookings/active` | Spring Boot :8080 |
| 13 | GET | `/api/v1/bookings/history` | Spring Boot :8080 |
| 14 | PATCH | `/api/v1/driver/status` | Spring Boot :8080 |
| 15 | GET | `/api/v1/driver/profile` | Spring Boot :8080 |

---

## ✅ Pre-ship checklist

- [ ] Replace `<PROD_IP>` in `src/api/client.ts`
- [ ] Replace `google-services.json` with real Firebase file
- [ ] Add background geolocation license key in `app.json`
- [ ] Test GPS on a real Android device (emulator GPS is unreliable)
- [ ] Test offline: turn off WiFi → accept load → turn on WiFi → verify sync
- [ ] Test deep link: `adb shell am start -W -a android.intent.action.VIEW -d "loadsetu://load/test123"`

---

## 🔑 Deep Link Testing

```bash
# Test deep link on connected Android device
adb shell am start -W -a android.intent.action.VIEW \
  -d "loadsetu://load/YOUR_LOAD_ID" in.loadsetu.driver
```

---

## 📞 Architecture Rule (CRITICAL)

```
GPS Telemetry flow:
Mobile App  →  FastAPI :8000  →  Kafka  →  Spring Boot
                    ↑
            NEVER go directly to Spring Boot for GPS
```
