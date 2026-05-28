import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_HOST_KEY = 'loadsetu_api_host';
const DEFAULT_ANDROID_HOST = '10.0.2.2';
const DEFAULT_IOS_HOST = 'localhost';

let configuredApiHost: string | null = null;

function normalizeHost(host: string | null | undefined): string | null {
  if (!host) {
    return null;
  }

  const trimmed = host.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .trim();
}

export function getDefaultApiHost(): string {
  return Platform.OS === 'android' ? DEFAULT_ANDROID_HOST : DEFAULT_IOS_HOST;
}

export async function initializeNetworkConfig(): Promise<void> {
  configuredApiHost = normalizeHost(await AsyncStorage.getItem(API_HOST_KEY));
}

export function getConfiguredApiHost(): string | null {
  return configuredApiHost;
}

export function getActiveApiHost(): string {
  return configuredApiHost ?? getDefaultApiHost();
}

export async function setApiHost(host: string | null): Promise<void> {
  const normalized = normalizeHost(host);
  configuredApiHost = normalized;

  if (normalized) {
    await AsyncStorage.setItem(API_HOST_KEY, normalized);
    return;
  }

  await AsyncStorage.removeItem(API_HOST_KEY);
}

export function getSpringBootBaseUrl(): string {
  return `http://${getActiveApiHost()}:8080`;
}

export function getFastApiBaseUrl(): string {
  return `http://${getActiveApiHost()}:8000`;
}

export function getResolvedBaseUrls(): { host: string; spring: string; fastapi: string } {
  const host = getActiveApiHost();
  return {
    host,
    spring: `http://${host}:8080`,
    fastapi: `http://${host}:8000`,
  };
}
