import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Geolocation from 'react-native-background-geolocation';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useDriverProfile, useNearbyLoads, useRateLimitTimer } from '../hooks/useApi';
import { startGps, stopGps } from '../services/gps.service';
import { startRecording, stopAndParse, VoiceState } from '../services/voice.service';
import { offlineQueue } from '../services/offline.service';
import { RootStackParamList } from '../navigation/deepLink';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const C = {
  bg: '#0d0d1a',
  surface: '#1a1a2e',
  accent: '#e94560',
  green: '#00c9a7',
  yellow: '#f4c430',
  text: '#e8e8f0',
  muted: '#6b6b8a',
  border: '#2a2a45',
};

export default function HomeScreen({ navigation }: Props) {
  const [isDutyOnline, setIsDutyOnline] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [location, setLocation] = useState({ lat: 22.7196, lng: 75.8577 }); // Indore fallback
  const micScale = React.useRef(new Animated.Value(1)).current;

  const { data: profile } = useDriverProfile();
  const { data: loads, isLoading, refetch } = useNearbyLoads(location.lat, location.lng, isDutyOnline);
  const { cooldownSec, isRateLimited } = useRateLimitTimer();

  useEffect(() => {
    // Get current position on mount
    Geolocation.getCurrentPosition({ timeout: 15, maximumAge: 30_000 })
      .then((loc) => {
        setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      })
      .catch(() => {
        // Keep fallback location if GPS not available yet
      });

    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected && !!state.isInternetReachable);
    });
    const interval = setInterval(async () => {
      setPendingCount(await offlineQueue.count());
    }, 5000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const toggleDuty = useCallback(async () => {
    const next = !isDutyOnline;
    setIsDutyOnline(next);
    if (next) {
      await startGps();
      refetch();
    } else {
      await stopGps();
    }
  }, [isDutyOnline, refetch]);

  const handleMicPressIn = async () => {
    Animated.spring(micScale, { toValue: 1.3, useNativeDriver: true }).start();
    await startRecording(setVoiceState);
  };

  const handleMicPressOut = async () => {
    Animated.spring(micScale, { toValue: 1, useNativeDriver: true }).start();
    const result = await stopAndParse(setVoiceState);
    if (result?.entities.loadId) {
      navigation.navigate('LoadDetail', { loadId: result.entities.loadId });
    }
  };

  const voiceLabel: Record<VoiceState, string> = {
    IDLE: 'Hold mic to speak',
    RECORDING: 'Listening...',
    PROCESSING: 'Processing AI...',
    SUCCESS: 'Done',
    ERROR_TOO_LARGE: 'Audio too large',
    ERROR_NETWORK: 'No network',
    ERROR_PERMISSION: 'Mic permission needed',
  };

  return (
    <View style={s.container}>
      <View style={s.topBar}>
        <View>
          <Text style={s.greeting}>Welcome, {profile?.name ?? 'Driver'}</Text>
          <Text style={s.truckLabel}>{profile?.truckNumber ?? 'No truck linked'}</Text>
        </View>
        {!isOnline && (
          <View style={s.offlineBadge}>
            <Text style={s.offlineText}>Offline{pendingCount > 0 ? ` � ${pendingCount} queued` : ''}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[s.toggle, isDutyOnline ? s.toggleOn : s.toggleOff]}
        onPress={toggleDuty}
        activeOpacity={0.85}
      >
        <Text style={s.toggleText}>{isDutyOnline ? 'GO OFFLINE' : 'GO ONLINE'}</Text>
      </TouchableOpacity>

      {isRateLimited && (
        <View style={s.rateBanner}>
          <Text style={s.rateText}>Too many requests. Wait {cooldownSec}s.</Text>
        </View>
      )}

      {!isDutyOnline ? (
        <View style={s.emptyState}>
          <Text style={s.emptyText}>Turn duty on to start GPS and receive live loads.</Text>
        </View>
      ) : isLoading ? (
        <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={loads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          refreshing={isLoading}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.loadCard}
              onPress={() => navigation.navigate('LoadDetail', { loadId: item.id })}
              activeOpacity={0.85}
            >
              <View style={s.loadRoute}>
                <Text style={s.city}>{item.origin.city}</Text>
                <Text style={s.arrow}>{' -> '}</Text>
                <Text style={s.city}>{item.destination.city}</Text>
              </View>
              <View style={s.loadMeta}>
                <Text style={s.loadWeight}>{item.weight}T</Text>
                <Text style={s.loadPrice}>Rs {item.offeredPrice.toLocaleString('en-IN')}</Text>
                <Text style={s.loadDist}>{item.distanceKm.toFixed(1)} km</Text>
              </View>
              <Text style={s.loadShipper}>{item.shipper.name}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Text style={s.emptyText}>No loads nearby right now.</Text>
            </View>
          }
        />
      )}

      <View style={s.voiceArea}>
        <Text style={s.voiceLabel}>{voiceLabel[voiceState]}</Text>
        <Animated.View style={{ transform: [{ scale: micScale }] }}>
          <Pressable
            style={[s.micButton, voiceState === 'RECORDING' && s.micActive]}
            onPressIn={handleMicPressIn}
            onPressOut={handleMicPressOut}
          >
            <Text style={s.micIcon}>Mic</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16 },
  greeting: { color: C.text, fontSize: 18, fontWeight: '700' },
  truckLabel: { color: C.muted, fontSize: 13, marginTop: 2 },
  offlineBadge: { backgroundColor: '#3a1010', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  offlineText: { color: C.accent, fontSize: 12, fontWeight: '600' },
  toggle: { marginHorizontal: 20, marginBottom: 12, borderRadius: 16, paddingVertical: 20, alignItems: 'center' },
  toggleOn: { backgroundColor: '#0a2e1e' },
  toggleOff: { backgroundColor: '#2e0a0a' },
  toggleText: { color: C.text, fontWeight: '800', fontSize: 20 },
  rateBanner: { marginHorizontal: 20, marginBottom: 8, backgroundColor: '#2e2000', borderRadius: 8, padding: 10 },
  rateText: { color: C.yellow, fontSize: 13, textAlign: 'center' },
  listContent: { paddingHorizontal: 20, paddingBottom: 200 },
  loadCard: { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  loadRoute: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  city: { color: C.text, fontSize: 16, fontWeight: '700' },
  arrow: { color: C.muted, fontSize: 16 },
  loadMeta: { flexDirection: 'row', gap: 16, marginBottom: 6 },
  loadWeight: { color: C.muted, fontSize: 13 },
  loadPrice: { color: C.green, fontSize: 15, fontWeight: '700' },
  loadDist: { color: C.muted, fontSize: 13 },
  loadShipper: { color: C.muted, fontSize: 12 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: C.muted, fontSize: 15, textAlign: 'center', paddingHorizontal: 32 },
  voiceArea: { position: 'absolute', bottom: 40, alignSelf: 'center', alignItems: 'center', gap: 10 },
  voiceLabel: { color: C.muted, fontSize: 13 },
  micButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center' },
  micActive: { backgroundColor: '#c0392b' },
  micIcon: { fontSize: 30 },
});
