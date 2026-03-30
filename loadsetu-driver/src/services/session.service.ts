import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StoredSession {
  userId: string;
  role: string;
  fullName?: string | null;
  truckId?: string | null;
  companyName?: string | null;
}

const SESSION_KEY = 'loadsetu_session';

export async function saveSession(session: StoredSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function getSession(): Promise<StoredSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) as StoredSession : null;
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
