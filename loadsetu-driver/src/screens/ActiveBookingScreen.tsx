import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { updateBookingStatus } from '../api/endpoints';
import { RootStackParamList } from '../navigation/deepLink';

type Props = NativeStackScreenProps<RootStackParamList, 'ActiveBooking'>;

const C = {
  bg: '#0d0d1a',
  surface: '#1a1a2e',
  green: '#00c9a7',
  text: '#e8e8f0',
  muted: '#6b6b8a',
  border: '#2a2a45',
};

export default function ActiveBookingScreen({ route, navigation }: Props) {
  const { bookingId, load } = route.params;
  const [bookingStatus, setBookingStatus] = useState<'CONFIRMED' | 'IN_TRANSIT' | 'COMPLETED'>('CONFIRMED');
  const [submitting, setSubmitting] = useState(false);

  const handleStatusUpdate = async (nextStatus: 'IN_TRANSIT' | 'COMPLETED') => {
    setSubmitting(true);
    try {
      const response = await updateBookingStatus(bookingId, nextStatus);
      setBookingStatus(response.status as 'IN_TRANSIT' | 'COMPLETED');
      if (nextStatus === 'COMPLETED') {
        Alert.alert('Trip Completed', 'Booking marked as completed.');
      }
    } catch (error: any) {
      Alert.alert('Status Update Failed', error?.message ?? 'Could not update trip status.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.container}>
      <View style={s.card}>
        <Text style={s.heading}>Booking Confirmed</Text>
        <Text style={s.status}>{bookingStatus.replace('_', ' ')}</Text>
        <Text style={s.meta}>Booking ID: {bookingId}</Text>
        {load && (
          <>
            <Text style={s.route}>{`${load.origin.city} -> ${load.destination.city}`}</Text>
            <Text style={s.meta}>Payout: Rs {load.offeredPrice.toLocaleString('en-IN')}</Text>
          </>
        )}
      </View>

      {bookingStatus === 'CONFIRMED' && (
        <TouchableOpacity
          style={[s.primaryBtn, submitting && s.btnDisabled]}
          disabled={submitting}
          onPress={() => handleStatusUpdate('IN_TRANSIT')}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Start Trip</Text>}
        </TouchableOpacity>
      )}

      {bookingStatus === 'IN_TRANSIT' && (
        <TouchableOpacity
          style={[s.finishBtn, submitting && s.btnDisabled]}
          disabled={submitting}
          onPress={() => handleStatusUpdate('COMPLETED')}
        >
          {submitting ? <ActivityIndicator color="#000" /> : <Text style={s.finishBtnText}>Finish Trip</Text>}
        </TouchableOpacity>
      )}

      <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('Home')}>
        <Text style={s.btnText}>Back to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: C.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: C.border },
  heading: { color: C.text, fontSize: 28, fontWeight: '800' },
  status: { color: C.green, fontSize: 16, fontWeight: '700', marginTop: 12 },
  route: { color: C.text, fontSize: 18, marginTop: 20, fontWeight: '700' },
  meta: { color: C.muted, fontSize: 13, marginTop: 10 },
  primaryBtn: { marginTop: 20, backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  finishBtn: { marginTop: 20, backgroundColor: C.green, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  finishBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  btnDisabled: { opacity: 0.5 },
  btn: { marginTop: 20, backgroundColor: C.green, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#000', fontWeight: '800', fontSize: 16 },
});
