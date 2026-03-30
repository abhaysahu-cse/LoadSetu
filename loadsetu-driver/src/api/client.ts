import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import * as Keychain from 'react-native-keychain';
import { offlineQueue } from '../services/offline.service';
import { clearSession } from '../services/session.service';

const LOCAL_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const SPRING_BOOT_BASE = `http://${LOCAL_HOST}:8080`;
export const FASTAPI_BASE = `http://${LOCAL_HOST}:8000`;

let rateLimitCooldownUntil: number | null = null;
let unauthorizedHandler: (() => void) | null = null;

export const getRateLimitCooldown = () => rateLimitCooldownUntil;
export const setUnauthorizedHandler = (handler: () => void) => {
  unauthorizedHandler = handler;
};

export async function getJwt(): Promise<string | null> {
  try {
    const creds = await Keychain.getGenericPassword({ service: 'loadsetu_jwt' });
    return creds ? creds.password : null;
  } catch {
    return null;
  }
}

export async function saveJwt(token: string): Promise<void> {
  await Keychain.setGenericPassword('driver', token, { service: 'loadsetu_jwt' });
}

export async function clearJwt(): Promise<void> {
  await Keychain.resetGenericPassword({ service: 'loadsetu_jwt' });
  await clearSession();
}

function createClient(baseURL: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });

  instance.interceptors.request.use(async (config) => {
    const jwt = await getJwt();
    config.headers['X-Request-ID'] = uuidv4();
    if (jwt) {
      config.headers['Authorization'] = `Bearer ${jwt}`;
    }
    return config;
  });

  instance.interceptors.response.use(
    (res: AxiosResponse) => res,
    async (error: AxiosError) => {
      if (error.response?.status === 429) {
        const retryAfter = Number(error.response.headers['retry-after'] ?? 30);
        rateLimitCooldownUntil = Date.now() + retryAfter * 1000;
        throw { type: 'RATE_LIMIT', cooldownMs: retryAfter * 1000 };
      }

      if (error.response?.status === 401) {
        await clearJwt();
        unauthorizedHandler?.();
        throw {
          type: 'AUTH_ERROR',
          status: 401,
          message: 'Session expired. Please log in again.',
        };
      }

      if (!error.response) {
        throw { type: 'NETWORK_ERROR', originalError: error };
      }

      const requestId = error.config?.headers?.['X-Request-ID'] ?? 'unknown';
      throw {
        type: 'API_ERROR',
        status: error.response.status,
        message: (error.response.data as any)?.message
          ?? (error.response.data as any)?.error
          ?? 'Unknown error',
        requestId,
      };
    },
  );

  return instance;
}

export const springClient = createClient(SPRING_BOOT_BASE);
export const fastapiClient = createClient(FASTAPI_BASE);

export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, baseDelay = 500 }: { retries?: number; baseDelay?: number } = {},
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      if (err?.type === 'RATE_LIMIT' || err?.type === 'AUTH_ERROR') {
        throw err;
      }
      attempt += 1;
      if (attempt > retries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, baseDelay * 2 ** (attempt - 1)));
    }
  }
}

export async function offlineSafePost<T>(
  client: AxiosInstance,
  url: string,
  data: unknown,
  queueKey: string,
): Promise<T | null> {
  try {
    const res = await withRetry(() => client.post<T>(url, data));
    return res.data;
  } catch (err: any) {
    if (err?.type === 'NETWORK_ERROR') {
      await offlineQueue.enqueue({
        key: queueKey,
        url,
        data,
        client: client === fastapiClient ? 'fastapi' : 'spring',
      });
      return null;
    }
    throw err;
  }
}

export async function offlineSafePatch<T>(
  client: AxiosInstance,
  url: string,
  data: unknown,
  queueKey: string,
): Promise<T | null> {
  try {
    const res = await withRetry(() => client.patch<T>(url, data));
    return res.data;
  } catch (err: any) {
    if (err?.type === 'NETWORK_ERROR') {
      await offlineQueue.enqueue({
        key: queueKey,
        url,
        data,
        client: client === fastapiClient ? 'fastapi' : 'spring',
        method: 'PATCH',
      });
      return null;
    }
    throw err;
  }
}
