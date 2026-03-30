import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { login } from '../api/endpoints';
import { initGps } from '../services/gps.service';
import { syncDeviceToken } from '../services/fcm.service';
import { RootStackParamList } from '../navigation/deepLink';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const C = {
  bg: '#0d0d1a',
  surface: '#1a1a2e',
  accent: '#e94560',
  text: '#e8e8f0',
  muted: '#6b6b8a',
  border: '#2a2a45',
};

export default function LoginScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert('Missing Details', 'Enter your phone number and password.');
      return;
    }

    setLoading(true);
    try {
      const profile = await login({ phone, password });
      if (profile.truckId) {
        await initGps(profile.truckId);
      }
      await syncDeviceToken();
      navigation.replace('Home');
    } catch (err: any) {
      Alert.alert('Login Failed', err?.message ?? 'Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.inner}>
        <Text style={s.logo}>LoadSetu</Text>
        <Text style={s.subtitle}>Driver login</Text>

        <View style={s.form}>
          <Text style={s.label}>Phone Number</Text>
          <TextInput
            style={s.input}
            placeholder="9876543210"
            placeholderTextColor={C.muted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={10}
          />

          <Text style={s.label}>Password</Text>
          <TextInput
            style={s.input}
            placeholder="Your password"
            placeholderTextColor={C.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Login</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logo: { color: C.text, fontSize: 38, textAlign: 'center', fontWeight: '800', marginBottom: 6 },
  subtitle: { color: C.muted, fontSize: 16, textAlign: 'center', marginBottom: 42 },
  form: { gap: 12 },
  label: { color: C.muted, fontSize: 13 },
  input: {
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: C.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  btn: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
