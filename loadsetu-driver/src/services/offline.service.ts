import NetInfo from '@react-native-community/netinfo';
import * as SQLite from 'expo-sqlite';
import { fastapiClient, isRetriableError, springClient } from '../api/client';

export type QueueClient = 'spring' | 'fastapi';

export interface QueueItem {
  key: string;
  url: string;
  data: unknown;
  client: QueueClient;
  method?: 'POST' | 'PATCH' | 'PUT';
}

export const db = SQLite.openDatabaseSync('loadsetu.db');

let flushPromise: Promise<void> | null = null;

export async function initDatabase(): Promise<void> {
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS offline_queue (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      key        TEXT    NOT NULL UNIQUE,
      url        TEXT    NOT NULL,
      payload    TEXT    NOT NULL,
      client     TEXT    NOT NULL DEFAULT 'spring',
      method     TEXT    NOT NULL DEFAULT 'POST',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      attempts   INTEGER NOT NULL DEFAULT 0
    );
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS load_cache (
      id        TEXT    PRIMARY KEY,
      data      TEXT    NOT NULL,
      cached_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS booking_history (
      id        TEXT    PRIMARY KEY,
      data      TEXT    NOT NULL,
      synced    INTEGER NOT NULL DEFAULT 0,
      cached_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);
}

export const offlineQueue = {
  async enqueue(item: QueueItem): Promise<void> {
    await db.runAsync(
      `INSERT OR REPLACE INTO offline_queue (key, url, payload, client, method)
       VALUES (?, ?, ?, ?, ?)`,
      [item.key, item.url, JSON.stringify(item.data), item.client, item.method ?? 'POST'],
    );
  },

  async flush(): Promise<void> {
    if (flushPromise) {
      return flushPromise;
    }

    flushPromise = (async () => {
      const rows = await db.getAllAsync<{
        id: number;
        key: string;
        url: string;
        payload: string;
        client: QueueClient;
        method: string;
        attempts: number;
      }>(
        "SELECT * FROM offline_queue WHERE key NOT LIKE 'telemetry_%' ORDER BY id ASC",
      );

      for (const row of rows) {
        const httpClient = row.client === 'fastapi' ? fastapiClient : springClient;
        const data = JSON.parse(row.payload);

        try {
          if (row.method === 'PATCH') {
            await httpClient.patch(row.url, data);
          } else if (row.method === 'PUT') {
            await httpClient.put(row.url, data);
          } else {
            await httpClient.post(row.url, data);
          }

          await db.runAsync('DELETE FROM offline_queue WHERE id = ?', [row.id]);
        } catch (error: any) {
          if (!isRetriableError(error)) {
            await db.runAsync('DELETE FROM offline_queue WHERE id = ?', [row.id]);
            continue;
          }

          await db.runAsync(
            'UPDATE offline_queue SET attempts = attempts + 1 WHERE id = ?',
            [row.id],
          );

          if (row.attempts + 1 >= 10) {
            await db.runAsync('DELETE FROM offline_queue WHERE id = ?', [row.id]);
          }
        }
      }
    })();

    try {
      await flushPromise;
    } finally {
      flushPromise = null;
    }
  },

  async count(): Promise<number> {
    const result = await db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) as c FROM offline_queue WHERE key NOT LIKE 'telemetry_%'",
    );
    return result?.c ?? 0;
  },
};

export const loadCache = {
  async save(loadId: string, data: unknown): Promise<void> {
    await db.runAsync(
      'INSERT OR REPLACE INTO load_cache (id, data) VALUES (?, ?)',
      [loadId, JSON.stringify(data)],
    );
  },

  async get(loadId: string): Promise<unknown | null> {
    const row = await db.getFirstAsync<{ data: string }>(
      'SELECT data FROM load_cache WHERE id = ?',
      [loadId],
    );
    return row ? JSON.parse(row.data) : null;
  },

  async saveAll(loads: { id: string; [k: string]: unknown }[]): Promise<void> {
    for (const load of loads) {
      await this.save(load.id, load);
    }
  },

  async getAll(): Promise<unknown[]> {
    const rows = await db.getAllAsync<{ data: string }>('SELECT data FROM load_cache');
    return rows.map((row) => JSON.parse(row.data));
  },
};

export function startOfflineSyncWatcher(): () => void {
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected && state.isInternetReachable) {
      await offlineQueue.flush();
    }
  });

  return unsubscribe;
}
