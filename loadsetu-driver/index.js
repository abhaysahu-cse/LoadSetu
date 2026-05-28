/**
 * LoadSetu — index.js
 * Must register FCM background handler BEFORE AppRegistry.
 * This is how React Native Firebase requires it.
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// ── FCM Background / Quit handler ────────────────────────────────────────────
// Called when app is in background or killed.
// DO NOT update UI here — use local notifications instead.
messaging().setBackgroundMessageHandler(async (remoteMessage) => {

  // Event types from backend (Spring Boot → FCM)
  const { type, loadId, bookingId } = remoteMessage.data ?? {};

  switch (type) {
    case 'NEW_LOAD_NEARBY':
      // Show local notification with deep link
      // TODO: use notifee to show rich notification
      // await notifee.displayNotification({ title: 'New Load!', body: `loadsetu://load/${loadId}` });
      break;
    case 'BOOKING_CONFIRMED':
      break;
    case 'AI_MATCH':
      break;
    default:
      break;
  }
});

AppRegistry.registerComponent(appName, () => App);
