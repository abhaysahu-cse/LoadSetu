# LoadSetu Driver

React Native / Expo mobile app for drivers and shippers.

Use the repo root [README](</c:/Projects/LoadSetu/README.md>) as the main runbook. This file is only the mobile-specific quick reference.

## Run

```bash
cd loadsetu-driver
npm install
npm run android
```

Available scripts:

- `npm start` - Expo dev server
- `npm run android` - Android native run via Expo
- `npm run ios` - iOS native run via Expo

## Network

The app supports local emulator and real-device testing without code edits in the common case.

- Android emulator defaults to `http://10.0.2.2:8080` and `http://10.0.2.2:8000`
- iOS simulator defaults to `http://localhost:8080` and `http://localhost:8000`
- Real device host/IP can be configured from the login screen and is persisted locally

Main network code:

- `src/services/network.service.ts`
- `src/api/client.ts`

## Main Flows

- Driver login/register
- Shipper login/register
- Driver GPS telemetry with offline queue
- Nearby loads for drivers
- Load creation for shippers
- Match visibility for shipper loads

Main files:

- `App.tsx`
- `src/screens/LoginScreen.tsx`
- `src/screens/HomeScreen.tsx`
- `src/screens/LoadDetailScreen.tsx`
- `src/services/gps.service.ts`
- `src/services/offline.service.ts`

## Before GitHub / Fresh Clone

- Add a real `google-services.json` only if you are enabling Firebase locally
- Confirm Android SDK and one AVD are installed
- Bring backend + ML up before starting the app

## Current Verification Status

- TypeScript check passes: `npx tsc --noEmit`
- Full runtime still depends on a healthy Android emulator or physical device

## Notes

- Background GPS on emulator is less trustworthy than a physical Android device
- For end-to-end testing, start backend + ML first, then create/load test users from the app
