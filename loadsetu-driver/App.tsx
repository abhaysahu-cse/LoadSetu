import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, LogBox, StatusBar, View } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClientProvider } from '@tanstack/react-query';
import messaging from '@react-native-firebase/messaging';

import { queryClient } from './src/hooks/useApi';
import { initDatabase, startOfflineSyncWatcher } from './src/services/offline.service';
import { initGps } from './src/services/gps.service';
import { initDeepLinking, RootStackParamList, setNavigator } from './src/navigation/deepLink';
import { getStoredSession } from './src/api/endpoints';
import { getJwt, setUnauthorizedHandler } from './src/api/client';
import { requestNotificationPermission, syncDeviceToken, watchFcmTokenRefresh } from './src/services/fcm.service';

import HomeScreen from './src/screens/HomeScreen';
import LoadDetailScreen from './src/screens/LoadDetailScreen';
import ActiveBookingScreen from './src/screens/ActiveBookingScreen';
import LoginScreen from './src/screens/LoginScreen';
import PaymentCheckoutScreen from './src/screens/PaymentCheckout';

LogBox.ignoreLogs(['Non-serializable values']);

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const [booting, setBooting] = useState(true);
  const [initialRoute, setInitialRoute] = useState<'Login' | 'Home'>('Login');

  useEffect(() => {
    let cleanupDeepLink: (() => void) | undefined;
    let cleanupSync: (() => void) | undefined;
    let cleanupFcmRefresh: (() => void) | undefined;

    (async () => {
      await initDatabase();
      cleanupSync = startOfflineSyncWatcher();

      const jwt = await getJwt();
      const session = await getStoredSession();
      if (jwt && session) {
        setInitialRoute('Home');
        if (session.truckId) {
          await initGps(session.truckId);
        }
      }

      setUnauthorizedHandler(() => {
        navRef.current?.reset({ index: 0, routes: [{ name: 'Login' }] });
      });

      await requestNotificationPermission();
      cleanupFcmRefresh = watchFcmTokenRefresh();

      if (jwt) {
        try {
          await syncDeviceToken();
        } catch (error) {
          console.warn('[FCM] Initial sync failed', error);
        }
      }

      messaging().onMessage(async (remoteMessage) => {
        const rawLoadId = remoteMessage.data?.loadId;
        const loadId = typeof rawLoadId === 'string' ? rawLoadId : undefined;
        if (loadId) {
          Alert.alert('New Load Alert', 'A new load is available near you.', [
            { text: 'Later' },
            { text: 'Open', onPress: () => navRef.current?.navigate('LoadDetail', { loadId }) },
          ]);
        }
      });

      if (navRef.current) {
        setNavigator(navRef.current);
      }
      cleanupDeepLink = await initDeepLinking();
      setBooting(false);
    })();

    return () => {
      cleanupDeepLink?.();
      cleanupSync?.();
      cleanupFcmRefresh?.();
    };
  }, []);

  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0d0d1a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#e94560" size="large" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d1a" />
      <NavigationContainer
        ref={navRef}
        onReady={() => {
          if (navRef.current) {
            setNavigator(navRef.current);
          }
        }}
      >
        <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="LoadDetail" component={LoadDetailScreen} />
          <Stack.Screen name="PaymentCheckout" component={PaymentCheckoutScreen} />
          <Stack.Screen name="ActiveBooking" component={ActiveBookingScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}
