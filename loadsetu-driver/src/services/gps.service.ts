import BackgroundGeolocation, { Location, State } from 'react-native-background-geolocation';
import { flushTelemetryBatch, sendTelemetry, TelemetryPayload } from '../api/endpoints';
import { db } from './offline.service';

let truckId: string | null = null;
let initialized = false;
let listeners: Array<{ remove: () => void }> = [];
let flushInFlight: Promise<void> | null = null;

function toSpeedKmh(speedMetersPerSecond?: number | null): number {
  if (!speedMetersPerSecond || speedMetersPerSecond < 0) {
    return 0;
  }

  return Math.round(speedMetersPerSecond * 3.6 * 10) / 10;
}

function removeListeners(): void {
  for (const listener of listeners) {
    try {
      listener.remove();
    } catch {
      // Ignore duplicate cleanup.
    }
  }
  listeners = [];
}

async function handleLocation(location: Location): Promise<void> {
  if (!truckId) {
    return;
  }

  const payload: TelemetryPayload = {
    truckId,
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    speedKmh: toSpeedKmh(location.coords.speed),
    headingDegrees: location.coords.heading ?? 0,
    timestamp: new Date(location.timestamp).toISOString(),
  };

  try {
    await sendTelemetry(payload);
  } catch (error) {
    console.warn('[GPS] Telemetry send failed', error);
  }
}

function handleLocationError(errorCode: number): void {
  console.warn('[GPS] Location error', errorCode);
}

export async function initGps(driverTruckId: string): Promise<void> {
  truckId = driverTruckId;

  if (initialized) {
    return;
  }

  await BackgroundGeolocation.ready({
    logLevel: BackgroundGeolocation.LOG_LEVEL_WARNING,
    distanceFilter: 50,
    stationaryRadius: 25,
    locationUpdateInterval: 30_000,
    fastestLocationUpdateInterval: 20_000,
    heartbeatInterval: 180,
    foregroundService: true,
    notification: {
      title: 'LoadSetu Trip Active',
      text: 'LoadSetu is tracking your trip for the shipper.',
      priority: BackgroundGeolocation.NOTIFICATION_PRIORITY_LOW,
    },
    desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
    useSignificantChangesOnly: false,
    maxDaysToPersist: 2,
    maxRecordsToPersist: 500,
    startOnBoot: true,
    stopOnTerminate: false,
    enableHeadless: true,
    preventSuspend: false,
    pausesLocationUpdatesAutomatically: true,
    url: undefined,
  });

  removeListeners();

  listeners = [
    BackgroundGeolocation.onLocation(handleLocation, handleLocationError),
    BackgroundGeolocation.onHeartbeat(async () => {
      try {
        const location = await BackgroundGeolocation.getCurrentPosition({
          timeout: 15,
          maximumAge: 60_000,
          samples: 1,
          persist: false,
        });
        await handleLocation(location);
      } catch (error) {
        console.warn('[GPS] Heartbeat fetch failed', error);
      }
    }),
    BackgroundGeolocation.onConnectivityChange(async ({ connected }) => {
      if (connected) {
        await flushGpsBuffer();
      }
    }),
  ];

  initialized = true;
}

export async function startGps(): Promise<State> {
  if (!initialized) {
    throw new Error('GPS is not initialized for this session.');
  }

  return BackgroundGeolocation.start();
}

export async function stopGps(): Promise<State> {
  return BackgroundGeolocation.stop();
}

export async function flushGpsBuffer(): Promise<void> {
  if (flushInFlight) {
    return flushInFlight;
  }

  flushInFlight = (async () => {
    try {
      const rows = await db.getAllAsync<{ id: number; payload: string }>(
        "SELECT id, payload FROM offline_queue WHERE key LIKE 'telemetry_%' ORDER BY id ASC LIMIT 200",
      );

      if (rows.length === 0) {
        return;
      }

      const payloads: TelemetryPayload[] = rows.map((row) => JSON.parse(row.payload));
      await flushTelemetryBatch(payloads);

      const placeholders = rows.map(() => '?').join(', ');
      await db.runAsync(
        `DELETE FROM offline_queue WHERE id IN (${placeholders})`,
        rows.map((row) => row.id),
      );
    } catch (error) {
      console.warn('[GPS] Flush failed', error);
    }
  })();

  try {
    await flushInFlight;
  } finally {
    flushInFlight = null;
  }
}

export async function teardownGps(): Promise<void> {
  removeListeners();
  initialized = false;
  truckId = null;
  await BackgroundGeolocation.stop();
}
