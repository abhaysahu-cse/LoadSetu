import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as Keychain from 'react-native-keychain';
import { offlineQueue } from '../services/offline.service';
import { clearSession } from '../services/session.service';
import { getFastApiBaseUrl, getResolvedBaseUrls, getSpringBootBaseUrl } from '../services/network.service';

type ClientKind = 'spring' | 'fastapi';

let rateLimitCooldownUntil: number | null = null;
let unauthorizedHandler: (() => void) | null = null;

export const getRateLimitCooldown = () => rateLimitCooldownUntil;
export const setUnauthorizedHandler = (handler: () => void) => {
  unauthorizedHandler = handler;
};
export const getApiBases = getResolvedBaseUrls;

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

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function isRetriableError(error: any): boolean {
  if (!error) {
    return false;
  }

  if (error.type === 'NETWORK_ERROR' || error.type === 'TIMEOUT_ERROR') {
    return true;
  }

  return error.type === 'API_ERROR' && error.retryable === true;
}

function createClient(kind: ClientKind): AxiosInstance {
  const instance = axios.create({
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });

  instance.interceptors.request.use(async (config) => {
    const jwt = await getJwt();
    config.baseURL = kind === 'spring' ? getSpringBootBaseUrl() : getFastApiBaseUrl();
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

      if (error.code === 'ECONNABORTED') {
        throw {
          type: 'TIMEOUT_ERROR',
          message: 'Request timed out. Please try again.',
        };
      }

      if (!error.response) {
        throw {
          type: 'NETWORK_ERROR',
          message: 'Network unavailable. Request queued if supported.',
          originalError: error,
        };
      }

      const requestId = error.config?.headers?.['X-Request-ID'] ?? 'unknown';
      const status = error.response.status;

      throw {
        type: 'API_ERROR',
        status,
        message: (error.response.data as any)?.message
          ?? (error.response.data as any)?.error
          ?? 'Unknown error',
        requestId,
        retryable: isRetryableStatus(status),
      };
    },
  );

  return instance;
}

export const springClient = createClient('spring');
export const fastapiClient = createClient('fastapi');

export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, baseDelay = 500 }: { retries?: number; baseDelay?: number } = {},
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      if (err?.type === 'RATE_LIMIT' || err?.type === 'AUTH_ERROR' || !isRetriableError(err)) {
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
    if (err?.type === 'NETWORK_ERROR' || err?.type === 'TIMEOUT_ERROR') {
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
    if (err?.type === 'NETWORK_ERROR' || err?.type === 'TIMEOUT_ERROR') {
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
