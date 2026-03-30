import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { confirmPayment, createPaymentOrder } from '../api/endpoints';
import { RootStackParamList } from '../navigation/deepLink';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentCheckout'>;

const C = {
  bg: '#0d0d1a',
  surface: '#1a1a2e',
  accent: '#e94560',
  green: '#00c9a7',
  text: '#e8e8f0',
  muted: '#6b6b8a',
  border: '#2a2a45',
};

export default function PaymentCheckoutScreen({ route, navigation }: Props) {
  const { bookingId, load } = route.params;
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<{ gateway_order_id: string; amount: number; currency: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const paymentOrder = await createPaymentOrder(bookingId);
        setOrder(paymentOrder);
      } catch (error: any) {
        Alert.alert('Payment Error', error?.message ?? 'Could not start payment.');
        navigation.goBack();
      } finally {
        setLoadingOrder(false);
      }
    })();
  }, [bookingId, navigation]);

  const handleMockGatewaySuccess = async () => {
    if (!order) {
      return;
    }
    setSubmitting(true);
    try {
      const paymentId = `pay_mock_${Date.now()}`;
      await confirmPayment(bookingId, paymentId, Number(order.amount), 'mock-success');
      navigation.replace('ActiveBooking', { bookingId, load });
    } catch (error: any) {
      Alert.alert('Verification Failed', error?.message ?? 'Payment was not verified by backend.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={s.container}>
      <View style={s.card}>
        <Text style={s.heading}>Payment Checkout</Text>
        <Text style={s.route}>{`${load.origin.city} -> ${load.destination.city}`}</Text>

        {loadingOrder ? (
          <ActivityIndicator color={C.accent} size="large" style={{ marginTop: 24 }} />
        ) : (
          <>
            <Text style={s.amount}>Rs {Number(order?.amount ?? 0).toLocaleString('en-IN')}</Text>
            <Text style={s.helper}>Trip unlock waits for `/api/v1/payments/confirm` to return 200.</Text>
            <Text style={s.helper}>Current build is running the mock payment gateway path.</Text>
          </>
        )}
      </View>

      <TouchableOpacity
        style={[s.payBtn, (loadingOrder || submitting) && s.payBtnDisabled]}
        onPress={handleMockGatewaySuccess}
        disabled={loadingOrder || submitting}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.payText}>Simulate Successful Payment</Text>}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center' },
  card: { backgroundColor: C.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: C.border },
  heading: { color: C.text, fontSize: 26, fontWeight: '800', marginBottom: 8 },
  route: { color: C.muted, fontSize: 15 },
  amount: { color: C.green, fontSize: 38, fontWeight: '900', marginTop: 28 },
  helper: { color: C.muted, fontSize: 13, marginTop: 10, lineHeight: 18 },
  payBtn: { marginTop: 20, backgroundColor: C.accent, borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  payBtnDisabled: { opacity: 0.5 },
  payText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

