import messaging from '@react-native-firebase/messaging';
import { registerDeviceToken } from '../api/endpoints';

export async function requestNotificationPermission(): Promise<void> {
  await messaging().requestPermission();
}

export async function syncDeviceToken(): Promise<void> {
  const fcmToken = await messaging().getToken();
  if (fcmToken) {
    await registerDeviceToken(fcmToken);
  }
}

export function watchFcmTokenRefresh(): () => void {
  return messaging().onTokenRefresh(async (token) => {
    try {
      await registerDeviceToken(token);
    } catch (error) {
      console.warn('[FCM] Token refresh sync failed', error);
    }
  });
}
