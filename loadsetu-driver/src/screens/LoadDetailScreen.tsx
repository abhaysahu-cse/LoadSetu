import React from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAcceptLoad, useLoad, useRateLimitTimer } from '../hooks/useApi';
import { RootStackParamList } from '../navigation/deepLink';

type Props = NativeStackScreenProps<RootStackParamList, 'LoadDetail'>;

const C = {
  bg: '#0d0d1a',
  surface: '#1a1a2e',
  accent: '#e94560',
  green: '#00c9a7',
  text: '#e8e8f0',
  muted: '#6b6b8a',
  border: '#2a2a45',
  yellow: '#f4c430',
};

export default function LoadDetailScreen({ route, navigation }: Props) {
  const { loadId } = route.params;
  const { data: load, isLoading, isError } = useLoad(loadId);
  const { mutate: accept, isPending } = useAcceptLoad();
  const { cooldownSec, isRateLimited } = useRateLimitTimer();

  const handleAccept = () => {
    if (!load || isRateLimited) {
      return;
    }

    Alert.alert(
      'Confirm Load',
      `${load.origin.city} -> ${load.destination.city}\nRs ${load.offeredPrice.toLocaleString('en-IN')}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            accept(load, {
              onSuccess: (booking) => {
                if (!booking) {
                  Alert.alert('Saved Offline', 'Booking request queued. Payment starts when the request syncs.');
                  return;
                }
                navigation.navigate('PaymentCheckout', { bookingId: booking.bookingId, load });
              },
              onError: (err: any) => {
                Alert.alert('Could not book', err?.message ?? 'Please try again.');
              },
            });
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  if (isError || !load) {
    return (
      <View style={[s.container, s.center]}>
        <Text style={s.errorText}>This load is no longer available.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backBtnText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={s.heading}>Load Details</Text>

        <View style={s.card}>
          <Row label="From" value={load.origin.city} />
          <Row label="To" value={load.destination.city} />
          <Row label="Distance" value={`${load.distanceKm.toFixed(1)} km`} />
          <Row label="Weight" value={`${load.weight} tonnes`} />
          <Row label="Shipper" value={load.shipper.name} />
        </View>

        <View style={[s.card, s.priceCard]}>
          <Text style={s.priceLabel}>Offered Price</Text>
          <Text style={s.price}>Rs {load.offeredPrice.toLocaleString('en-IN')}</Text>
          <Text style={s.helper}>Payment verification happens before trip unlock.</Text>
        </View>

        {isRateLimited && (
          <View style={s.rateBanner}>
            <Text style={s.rateText}>Please wait {cooldownSec}s before trying again.</Text>
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.acceptBtn, (isPending || isRateLimited) && s.acceptBtnDisabled]}
          onPress={handleAccept}
          disabled={isPending || isRateLimited}
        >
          {isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.acceptText}>Continue to Payment</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 120 },
  back: { marginBottom: 8 },
  backText: { color: C.muted, fontSize: 15 },
  heading: { color: C.text, fontSize: 24, fontWeight: '800', marginBottom: 20 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  priceCard: { alignItems: 'center', paddingVertical: 24 },
  priceLabel: { color: C.muted, fontSize: 14, marginBottom: 6 },
  price: { color: C.green, fontSize: 36, fontWeight: '900' },
  helper: { color: C.muted, fontSize: 12, marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLabel: { color: C.muted, fontSize: 14 },
  rowValue: { color: C.text, fontSize: 14, fontWeight: '600' },
  rateBanner: { backgroundColor: '#2e2000', borderRadius: 8, padding: 12 },
  rateText: { color: C.yellow, textAlign: 'center', fontSize: 13 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36, backgroundColor: C.bg },
  acceptBtn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  acceptBtnDisabled: { opacity: 0.5 },
  acceptText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  errorText: { color: C.accent, fontSize: 16, marginBottom: 20 },
  backBtn: { backgroundColor: C.surface, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  backBtnText: { color: C.text, fontSize: 15 },
});
