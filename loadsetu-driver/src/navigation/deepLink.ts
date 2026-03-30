import { Alert, Linking } from 'react-native';
import { NavigationContainerRef } from '@react-navigation/native';
import { fetchLoadById } from '../api/endpoints';

export type RootStackParamList = {
  Home: undefined;
  LoadDetail: { loadId: string };
  PaymentCheckout: { bookingId: string; load: any };
  ActiveBooking: { bookingId: string; load?: any };
  Login: undefined;
};

let navigatorRef: NavigationContainerRef<RootStackParamList> | null = null;

export function setNavigator(nav: NavigationContainerRef<RootStackParamList>): void {
  navigatorRef = nav;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseDeepLink(url: string): { screen: keyof RootStackParamList; params: any } | null {
  try {
    const { pathname } = new URL(url.replace('loadsetu://', 'https://loadsetu.app/'));
    const parts = pathname.replace(/^\//, '').split('/');

    if ((parts[0] === 'load' || parts[0] === 'match') && parts[1]) {
      return { screen: 'LoadDetail', params: { loadId: parts[1] } };
    }
    if (parts[0] === 'booking' && parts[1]) {
      return { screen: 'ActiveBooking', params: { bookingId: parts[1] } };
    }

    return null;
  } catch {
    return null;
  }
}

async function handleUrl(url: string | null): Promise<void> {
  if (!url || !navigatorRef) {
    return;
  }

  const destination = parseDeepLink(url);
  if (!destination) {
    Alert.alert('Invalid Link', 'This load is no longer available.');
    return;
  }

  if (destination.screen === 'LoadDetail') {
    if (!isUuid(destination.params.loadId)) {
      Alert.alert('Invalid Link', 'This load is no longer available.');
      return;
    }

    try {
      await fetchLoadById(destination.params.loadId);
    } catch {
      Alert.alert('Load Unavailable', 'This load is no longer available.');
      return;
    }
  }

  navigatorRef.navigate(destination.screen, destination.params);
}

export async function initDeepLinking(): Promise<() => void> {
  const initialUrl = await Linking.getInitialURL();
  await handleUrl(initialUrl);

  const subscription = Linking.addEventListener('url', ({ url }) => {
    handleUrl(url);
  });

  return () => subscription.remove();
}
