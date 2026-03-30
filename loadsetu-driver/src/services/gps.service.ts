/**
 * LoadSetu — Background GPS Service
 * Uses react-native-background-geolocation (gold standard for RN GPS).
 *
 * Rules:
 *  - Moving   → ping every 20–30 sec
 *  - Idle     → ping every 2–5 min
 *  - Offline  → buffer in SQLite → flush when back online
 *  - Must survive: screen lock, app kill, battery saver
 */

import BackgroundGeolocation, {
  Location,
  State,
} from 'react-native-background-geolocation';
import { sendTelemetry, flushTelemetryBatch, TelemetryPayload } from '../api/endpoints';
import { db } from './offline.service';

let truckId: string | null = null;

// ─── Initialise once (call from App.tsx or after login) ─────────────────────
export async function initGps(driverTruckId: string): Promise<void> {
  truckId = driverTruckId;

  await BackgroundGeolocation.ready({
    // ── Identity ──────────────────────────────────────────────────────────
    logLevel: BackgroundGeolocation.LOG_LEVEL_WARNING,

    // ── Motion detection ─────────────────────────────────────────────────
    // Moving: ping every 30 sec
    distanceFilter: 50,          // metres moved before a ping (while moving)
    stationaryRadius: 25,        // metres — if inside this → stationary mode

    // ── Intervals ────────────────────────────────────────────────────────
    locationUpdateInterval: 30_000,        // 30s while moving
    fastestLocationUpdateInterval: 20_000, // never faster than 20s
    heartbeatInterval: 180,                // ping every 3 min while stationary

    // ── Android Foreground Service (THE PHONE-KILL FIX) ──────────────────
    foregroundService: true,
    notification: {
      title: 'LoadSetu — Trip Active',
      text:  'LoadSetu is tracking your trip for the shipper.',
      smallIcon: 'ic_notification',        // must exist in drawable/
      priority: BackgroundGeolocation.NOTIFICATION_PRIORITY_LOW,
    },

    // ── Accuracy ──────────────────────────────────────────────────────────
    desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
    useSignificantChangesOnly: false,

    // ── Persistence ───────────────────────────────────────────────────────
    // SDK's own buffer — but we also maintain our own SQLite buffer
    maxDaysToPersist: 2,
    maxRecordsToPersist: 500,

    // ── Restart on boot ───────────────────────────────────────────────────
    startOnBoot: false,           // only start when driver goes ONLINE
    stopOnTerminate: false,       // survive app kill ← THE CRITICAL FLAG
    enableHeadless: true,         // Android headless task support

    // ── Power ─────────────────────────────────────────────────────────────
    preventSuspend: false,        // don't prevent iOS suspension (save battery)
    pausesLocationUpdatesAutomatically: true,

    // ── HTTP (SDK's own sync — complementary to ours) ─────────────────────
    // We handle sync manually via offlineQueue, so disable SDK's built-in HTTP
    url: undefined,
  });

  // ── Location event ──────────────────────────────────────────────────────
  BackgroundGeolocation.onLocation(handleLocation, handleLocationError);

  // ── Heartbeat (stationary ping) ─────────────────────────────────────────
  BackgroundGeolocation.onHeartbeat(async (event) => {
    const loc = await BackgroundGeolocation.getCurrentPosition({ timeout: 15, maximumAge: 60_000 });
    await handleLocation(loc);
  });

  // ── Connectivity restored → flush buffer ────────────────────────────────
  BackgroundGeolocation.onConnectivityChange(async ({ connected }) => {
    if (connected) await flushGpsBuffer();
  });
}

// ─── Start tracking (call when driver goes ONLINE) ──────────────────────────
export async function startGps(): Promise<State> {
  return BackgroundGeolocation.start();
}

// ─── Stop tracking (call when driver goes OFFLINE or trip ends) ─────────────
export async function stopGps(): Promise<State> {
  return BackgroundGeolocation.stop();
}

// ─── Handle a GPS fix ───────────────────────────────────────────────────────
async function handleLocation(location: Location): Promise<void> {
  if (!truckId) return;

  const payload: TelemetryPayload = {
    truckId,
    lat:       location.coords.latitude,
    lng:       location.coords.longitude,
    speed:     location.coords.speed     ?? 0,
    heading:   location.coords.heading   ?? 0,
    timestamp: new Date(location.timestamp).toISOString(),
  };

  // Try to send live; if it fails sendTelemetry() enqueues in SQLite
  await sendTelemetry(payload);
}

function handleLocationError(errorCode: number): void {
  console.warn('[GPS] Error', errorCode);
  // code 0 = location services disabled — we surface this in the UI via DriverStatusBar
}

// ─── Flush SQLite GPS buffer (called on reconnect) ──────────────────────────
export async function flushGpsBuffer(): Promise<void> {
  try {
    const rows = await db.getAllAsync<{ id: number; payload: string }>(
      "SELECT id, payload FROM offline_queue WHERE key LIKE 'telemetry_%' ORDER BY id ASC LIMIT 200",
    );
    if (rows.length === 0) return;

    const payloads: TelemetryPayload[] = rows.map((r) => JSON.parse(r.payload));
    await flushTelemetryBatch(payloads);

    const ids = rows.map((r) => r.id).join(',');
    await db.runAsync(`DELETE FROM offline_queue WHERE id IN (${ids})`);
  } catch (err) {
    console.warn('[GPS] Flush failed, will retry next reconnect', err);
  }
}
