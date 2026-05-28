import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Geolocation from 'react-native-background-geolocation';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  useCreateLoad,
  useDriverProfile,
  useLoadMatches,
  useMyLoads,
  useNearbyLoads,
  queryClient,
  useRateLimitTimer,
} from '../hooks/useApi';
import { getApiBases } from '../api/client';
import { logout } from '../api/endpoints';
import { offlineQueue } from '../services/offline.service';
import { startGps, stopGps, teardownGps } from '../services/gps.service';
import { startRecording, stopAndParse, VoiceState } from '../services/voice.service';
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

const DEFAULT_LOCATION = { lat: 22.7196, lng: 75.8577 };

export default function HomeScreen({ navigation }: Props) {
  const [isDutyOnline, setIsDutyOnline] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [loadForm, setLoadForm] = useState({
    originName: 'Indore',
    originLat: String(DEFAULT_LOCATION.lat),
    originLng: String(DEFAULT_LOCATION.lng),
    destinationName: 'Bhopal',
    destLat: '23.2599',
    destLng: '77.4126',
    requiredCapacity: '10',
    payoutInr: '18000',
    pickupTime: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
  });
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const micScale = React.useRef(new Animated.Value(1)).current;

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useDriverProfile();
  const isDriver = profile?.role === 'DRIVER';
  const isShipper = profile?.role === 'SHIPPER';

  const loadsQuery = useNearbyLoads(location.lat, location.lng, isDutyOnline && isDriver);
  const myLoadsQuery = useMyLoads(isShipper);
  const loadMatchesQuery = useLoadMatches(selectedLoadId, isShipper);
  const createLoadMutation = useCreateLoad();
  const { cooldownSec, isRateLimited } = useRateLimitTimer();
  const apiBases = getApiBases();

  useEffect(() => {
    Geolocation.getCurrentPosition({ timeout: 15, maximumAge: 30_000 })
      .then((loc) => {
        const nextLocation = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setLocation(nextLocation);
        setLoadForm((current) => ({
          ...current,
          originLat: String(nextLocation.lat),
          originLng: String(nextLocation.lng),
        }));
      })
      .catch(() => {
        // Keep fallback coordinates.
      });

    const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable));
    });

    const interval = setInterval(async () => {
      setPendingCount(await offlineQueue.count());
    }, 5000);

    return () => {
      netInfoUnsubscribe();
      clearInterval(interval);
    };
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchProfile();
      if (isDriver) {
        await loadsQuery.refetch();
      }
      if (isShipper) {
        await myLoadsQuery.refetch();
      }
      setPendingCount(await offlineQueue.count());
    } finally {
      setRefreshing(false);
    }
  }, [isDriver, isShipper, loadsQuery, myLoadsQuery, refetchProfile]);

  const toggleDuty = useCallback(async () => {
    if (!isDriver) {
      return;
    }

    const next = !isDutyOnline;
    setIsDutyOnline(next);

    try {
      if (next) {
        await startGps();
        await loadsQuery.refetch();
      } else {
        await stopGps();
      }
    } catch (error: any) {
      setIsDutyOnline(false);
      Alert.alert('GPS Error', error?.message ?? 'Could not change GPS duty state.');
    }
  }, [isDriver, isDutyOnline, loadsQuery]);

  const handleMicPressIn = async () => {
    if (!isDriver) {
      return;
    }

    Animated.spring(micScale, { toValue: 1.3, useNativeDriver: true }).start();
    await startRecording(setVoiceState);
  };

  const handleMicPressOut = async () => {
    if (!isDriver) {
      return;
    }

    Animated.spring(micScale, { toValue: 1, useNativeDriver: true }).start();
    const result = await stopAndParse(setVoiceState);
    if (result?.entities.loadId) {
      navigation.navigate('LoadDetail', { loadId: result.entities.loadId });
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await teardownGps();
      await logout();
      queryClient.clear();
      navigation.replace('Login');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleCreateLoad = async () => {
    const requiredCapacity = Number(loadForm.requiredCapacity);
    const payoutInr = Number(loadForm.payoutInr);
    const originLat = Number(loadForm.originLat);
    const originLng = Number(loadForm.originLng);
    const destLat = Number(loadForm.destLat);
    const destLng = Number(loadForm.destLng);

    if (
      !loadForm.originName.trim()
      || !loadForm.destinationName.trim()
      || !Number.isFinite(requiredCapacity)
      || !Number.isFinite(payoutInr)
      || !Number.isFinite(originLat)
      || !Number.isFinite(originLng)
      || !Number.isFinite(destLat)
      || !Number.isFinite(destLng)
      || !loadForm.pickupTime.trim()
    ) {
      Alert.alert('Invalid Load', 'Fill all load fields with valid values.');
      return;
    }

    try {
      await createLoadMutation.mutateAsync({
        originName: loadForm.originName.trim(),
        originLat,
        originLng,
        destinationName: loadForm.destinationName.trim(),
        destLat,
        destLng,
        requiredCapacity,
        payoutInr,
        pickupTime: new Date(loadForm.pickupTime).toISOString(),
      });
      Alert.alert('Load Created', 'Your load was submitted successfully.');
      await myLoadsQuery.refetch();
      setSelectedLoadId(null);
    } catch (error: any) {
      Alert.alert('Load Creation Failed', error?.message ?? 'Could not create the load.');
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

  if (profileLoading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>
            {profile?.name ?? profile?.companyName ?? 'LoadSetu User'}
          </Text>
          <Text style={s.truckLabel}>
            {isDriver
              ? profile?.truckNumber ?? 'No truck linked'
              : profile?.companyName ?? 'Shipper account'}
          </Text>
          <Text style={s.endpointLabel}>Backend: {apiBases.spring}</Text>
        </View>

        <TouchableOpacity
          style={[s.logoutBtn, loggingOut && s.btnDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          <Text style={s.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {!isOnline && (
        <View style={s.offlineBanner}>
          <Text style={s.offlineText}>
            Offline{pendingCount > 0 ? ` | ${pendingCount} queued request(s)` : ''}
          </Text>
        </View>
      )}

      {isRateLimited && (
        <View style={s.rateBanner}>
          <Text style={s.rateText}>Too many requests. Wait {cooldownSec}s.</Text>
        </View>
      )}

      {isDriver ? (
        <>
          <TouchableOpacity
            style={[s.toggle, isDutyOnline ? s.toggleOn : s.toggleOff]}
            onPress={toggleDuty}
            activeOpacity={0.85}
          >
            <Text style={s.toggleText}>{isDutyOnline ? 'GO OFFLINE' : 'GO ONLINE'}</Text>
          </TouchableOpacity>

          {!isDutyOnline ? (
            <View style={s.emptyState}>
              <Text style={s.emptyText}>Turn duty on to start GPS and receive nearby loads.</Text>
            </View>
          ) : loadsQuery.isLoading ? (
            <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={loadsQuery.data ?? []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={C.accent} />}
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
                  <Text style={s.emptyText}>No nearby loads are available right now.</Text>
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
        </>
      ) : (
        <ScrollView
          contentContainerStyle={s.shipperScroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={C.accent} />}
        >
          <View style={s.card}>
            <Text style={s.sectionTitle}>Create Load</Text>
            <Field label="Origin Name" value={loadForm.originName} onChangeText={(value) => setLoadForm((current) => ({ ...current, originName: value }))} />
            <Field label="Origin Latitude" value={loadForm.originLat} onChangeText={(value) => setLoadForm((current) => ({ ...current, originLat: value }))} keyboardType="decimal-pad" />
            <Field label="Origin Longitude" value={loadForm.originLng} onChangeText={(value) => setLoadForm((current) => ({ ...current, originLng: value }))} keyboardType="decimal-pad" />
            <Field label="Destination Name" value={loadForm.destinationName} onChangeText={(value) => setLoadForm((current) => ({ ...current, destinationName: value }))} />
            <Field label="Destination Latitude" value={loadForm.destLat} onChangeText={(value) => setLoadForm((current) => ({ ...current, destLat: value }))} keyboardType="decimal-pad" />
            <Field label="Destination Longitude" value={loadForm.destLng} onChangeText={(value) => setLoadForm((current) => ({ ...current, destLng: value }))} keyboardType="decimal-pad" />
            <Field label="Required Capacity (tons)" value={loadForm.requiredCapacity} onChangeText={(value) => setLoadForm((current) => ({ ...current, requiredCapacity: value }))} keyboardType="decimal-pad" />
            <Field label="Payout (INR)" value={loadForm.payoutInr} onChangeText={(value) => setLoadForm((current) => ({ ...current, payoutInr: value }))} keyboardType="number-pad" />
            <Field label="Pickup Time" value={loadForm.pickupTime} onChangeText={(value) => setLoadForm((current) => ({ ...current, pickupTime: value }))} />

            <TouchableOpacity
              style={[s.primaryBtn, createLoadMutation.isPending && s.btnDisabled]}
              onPress={handleCreateLoad}
              disabled={createLoadMutation.isPending}
            >
              {createLoadMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Submit Load</Text>}
            </TouchableOpacity>
          </View>

          <View style={s.card}>
            <Text style={s.sectionTitle}>My Loads</Text>
            {(myLoadsQuery.data ?? []).length === 0 ? (
              <Text style={s.emptyText}>No loads created yet.</Text>
            ) : (
              (myLoadsQuery.data ?? []).map((load) => (
                <View key={load.id} style={s.shipperLoadCard}>
                  <Text style={s.city}>{`${load.origin.city} -> ${load.destination.city}`}</Text>
                  <Text style={s.loadPrice}>Rs {load.offeredPrice.toLocaleString('en-IN')}</Text>
                  <Text style={s.loadShipper}>Status: {load.status ?? 'AVAILABLE'}</Text>
                  <TouchableOpacity
                    style={s.matchBtn}
                    onPress={() => setSelectedLoadId(selectedLoadId === load.id ? null : load.id)}
                  >
                    <Text style={s.matchBtnText}>
                      {selectedLoadId === load.id ? 'Hide Matches' : 'View Matches'}
                    </Text>
                  </TouchableOpacity>

                  {selectedLoadId === load.id && (
                    <View style={s.matchPanel}>
                      {loadMatchesQuery.isLoading ? (
                        <ActivityIndicator color={C.accent} />
                      ) : (loadMatchesQuery.data ?? []).length === 0 ? (
                        <Text style={s.loadShipper}>No matched trucks available yet.</Text>
                      ) : (
                        (loadMatchesQuery.data ?? []).map((match) => (
                          <View key={`${load.id}_${match.truck_id}`} style={s.matchCard}>
                            <Text style={s.matchTruck}>{match.truck_id}</Text>
                            <Text style={s.loadShipper}>Deadhead: {match.deadhead_km.toFixed(1)} km</Text>
                            <Text style={s.loadShipper}>Score: {match.confidence_score.toFixed(2)}</Text>
                            <Text style={s.loadPrice}>Rs {match.payout_inr.toLocaleString('en-IN')}</Text>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
}) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={C.muted}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    gap: 12,
  },
  greeting: { color: C.text, fontSize: 20, fontWeight: '700' },
  truckLabel: { color: C.muted, fontSize: 13, marginTop: 2 },
  endpointLabel: { color: C.green, fontSize: 12, marginTop: 6 },
  logoutBtn: {
    backgroundColor: '#2e0a0a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  logoutText: { color: C.text, fontWeight: '700' },
  offlineBanner: {
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: '#3a1010',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  offlineText: { color: C.accent, fontSize: 12, fontWeight: '700' },
  toggle: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  toggleOn: { backgroundColor: '#0a2e1e' },
  toggleOff: { backgroundColor: '#2e0a0a' },
  toggleText: { color: C.text, fontWeight: '800', fontSize: 20 },
  rateBanner: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#2e2000',
    borderRadius: 8,
    padding: 10,
  },
  rateText: { color: C.yellow, fontSize: 13, textAlign: 'center' },
  listContent: { paddingHorizontal: 20, paddingBottom: 200 },
  loadCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  loadRoute: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
  city: { color: C.text, fontSize: 16, fontWeight: '700' },
  arrow: { color: C.muted, fontSize: 16 },
  loadMeta: { flexDirection: 'row', gap: 16, marginBottom: 6, flexWrap: 'wrap' },
  loadWeight: { color: C.muted, fontSize: 13 },
  loadPrice: { color: C.green, fontSize: 15, fontWeight: '700' },
  loadDist: { color: C.muted, fontSize: 13 },
  loadShipper: { color: C.muted, fontSize: 12, marginTop: 4 },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 24 },
  emptyText: { color: C.muted, fontSize: 15, textAlign: 'center' },
  voiceArea: { position: 'absolute', bottom: 40, alignSelf: 'center', alignItems: 'center', gap: 10 },
  voiceLabel: { color: C.muted, fontSize: 13 },
  micButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micActive: { backgroundColor: '#c0392b' },
  micIcon: { fontSize: 24, color: '#fff', fontWeight: '800' },
  shipperScroll: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 14,
  },
  infoCard: {
    backgroundColor: '#172035',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  fieldLabel: { color: C.muted, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    color: C.text,
    fontSize: 15,
  },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  shipperLoadCard: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 12,
    marginTop: 12,
  },
  matchBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#111827',
  },
  matchBtnText: { color: C.text, fontSize: 12, fontWeight: '700' },
  matchPanel: { marginTop: 12, gap: 10 },
  matchCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#111827',
  },
  matchTruck: { color: C.green, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  infoText: { color: C.text, fontSize: 14, lineHeight: 20, marginTop: 10 },
  btnDisabled: { opacity: 0.5 },
});
