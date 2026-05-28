import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  login,
  registerDriver,
  registerShipper,
} from '../api/endpoints';
import { initGps } from '../services/gps.service';
import { syncDeviceToken } from '../services/fcm.service';
import { RootStackParamList } from '../navigation/deepLink';
import {
  getApiBases,
} from '../api/client';
import {
  getConfiguredApiHost,
  getDefaultApiHost,
  setApiHost,
} from '../services/network.service';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;
type AuthRole = 'DRIVER' | 'SHIPPER';
type AuthMode = 'LOGIN' | 'REGISTER';

const C = {
  bg: '#0d0d1a',
  surface: '#1a1a2e',
  accent: '#e94560',
  text: '#e8e8f0',
  muted: '#6b6b8a',
  border: '#2a2a45',
  green: '#00c9a7',
};

export default function LoginScreen({ navigation }: Props) {
  const [role, setRole] = useState<AuthRole>('DRIVER');
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [truckNumber, setTruckNumber] = useState('');
  const [capacity, setCapacity] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [customHost, setCustomHostInput] = useState(getConfiguredApiHost() ?? '');
  const [loading, setLoading] = useState(false);
  const [savingHost, setSavingHost] = useState(false);
  const [hostVersion, setHostVersion] = useState(0);

  const apiBases = useMemo(() => getApiBases(), [hostVersion]);

  const isRegister = mode === 'REGISTER';

  const refreshHost = () => setHostVersion((current) => current + 1);

  const validate = (): string | null => {
    if (!phone.trim() || !password.trim()) {
      return 'Enter your phone number and password.';
    }

    if (password.trim().length < 8) {
      return 'Password must be at least 8 characters.';
    }

    if (!isRegister) {
      return null;
    }

    if (role === 'DRIVER') {
      if (!fullName.trim() || !truckNumber.trim() || !capacity.trim()) {
        return 'Fill name, truck number, and capacity.';
      }

      const parsedCapacity = Number(capacity);
      if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0 || parsedCapacity > 50) {
        return 'Truck capacity must be between 0.1 and 50 tons.';
      }
    } else if (!companyName.trim()) {
      return 'Enter company name for shipper registration.';
    }

    return null;
  };

  const handleAuth = async () => {
    const validationMessage = validate();
    if (validationMessage) {
      Alert.alert('Check Details', validationMessage);
      return;
    }

    setLoading(true);

    try {
      const profile = isRegister
        ? role === 'DRIVER'
          ? await registerDriver({
              fullName,
              phone,
              password,
              truckNumber,
              capacity: Number(capacity),
            })
          : await registerShipper({
              companyName,
              phone,
              password,
            })
        : await login({ phone, password });

      if (profile.role === 'DRIVER' && profile.truckId) {
        await initGps(profile.truckId);
      }

      try {
        await syncDeviceToken();
      } catch {
        console.warn('[AUTH] Device token sync failed');
      }

      navigation.replace('Home');
    } catch (error: any) {
      Alert.alert(
        isRegister ? 'Registration Failed' : 'Login Failed',
        error?.message ?? 'Please check your details and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHost = async () => {
    setSavingHost(true);
    try {
      await setApiHost(customHost);
      refreshHost();
      Alert.alert('Network Updated', 'API host saved successfully.');
    } catch {
      Alert.alert('Network Error', 'Could not save the API host.');
    } finally {
      setSavingHost(false);
    }
  };

  const handleUseDefaultHost = async () => {
    setSavingHost(true);
    try {
      await setApiHost(null);
      setCustomHostInput('');
      refreshHost();
      Alert.alert('Network Reset', `Using default host ${getDefaultApiHost()}.`);
    } catch {
      Alert.alert('Network Error', 'Could not reset the API host.');
    } finally {
      setSavingHost(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.logo}>LoadSetu</Text>
        <Text style={s.subtitle}>Driver and shipper mobile control panel</Text>

        <View style={s.segmentRow}>
          <SegmentButton label="Driver" active={role === 'DRIVER'} onPress={() => setRole('DRIVER')} />
          <SegmentButton label="Shipper" active={role === 'SHIPPER'} onPress={() => setRole('SHIPPER')} />
        </View>

        <View style={s.segmentRow}>
          <SegmentButton label="Login" active={mode === 'LOGIN'} onPress={() => setMode('LOGIN')} />
          <SegmentButton label="Register" active={mode === 'REGISTER'} onPress={() => setMode('REGISTER')} />
        </View>

        <View style={s.form}>
          {isRegister && role === 'DRIVER' && (
            <>
              <Text style={s.label}>Full Name</Text>
              <TextInput
                style={s.input}
                placeholder="Ravi Kumar"
                placeholderTextColor={C.muted}
                value={fullName}
                onChangeText={setFullName}
              />

              <Text style={s.label}>Truck Number</Text>
              <TextInput
                style={s.input}
                placeholder="MP09AB1234"
                placeholderTextColor={C.muted}
                value={truckNumber}
                onChangeText={setTruckNumber}
                autoCapitalize="characters"
              />

              <Text style={s.label}>Capacity (tons)</Text>
              <TextInput
                style={s.input}
                placeholder="12"
                placeholderTextColor={C.muted}
                keyboardType="decimal-pad"
                value={capacity}
                onChangeText={setCapacity}
              />
            </>
          )}

          {isRegister && role === 'SHIPPER' && (
            <>
              <Text style={s.label}>Company Name</Text>
              <TextInput
                style={s.input}
                placeholder="Acme Logistics"
                placeholderTextColor={C.muted}
                value={companyName}
                onChangeText={setCompanyName}
              />
            </>
          )}

          <Text style={s.label}>Phone Number</Text>
          <TextInput
            style={s.input}
            placeholder="9876543210"
            placeholderTextColor={C.muted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={13}
          />

          <Text style={s.label}>Password</Text>
          <TextInput
            style={s.input}
            placeholder="Minimum 8 characters"
            placeholderTextColor={C.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleAuth}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.btnText}>
                {isRegister ? `Register ${role === 'DRIVER' ? 'Driver' : 'Shipper'}` : `Login as ${role === 'DRIVER' ? 'Driver' : 'Shipper'}`}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={s.networkCard}>
          <Text style={s.networkTitle}>Network Configuration</Text>
          <Text style={s.networkHelper}>
            Default Android emulator host is `10.0.2.2`. For a real phone, enter your local Wi-Fi IP.
          </Text>

          <Text style={s.label}>Custom API Host</Text>
          <TextInput
            style={s.input}
            placeholder="192.168.1.10"
            placeholderTextColor={C.muted}
            value={customHost}
            onChangeText={setCustomHostInput}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={s.endpointText}>Backend: {apiBases.spring}</Text>
          <Text style={s.endpointText}>ML: {apiBases.fastapi}</Text>

          <View style={s.networkActions}>
            <TouchableOpacity
              style={[s.secondaryBtn, savingHost && s.btnDisabled]}
              onPress={handleSaveHost}
              disabled={savingHost}
            >
              <Text style={s.secondaryBtnText}>Save Host</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.secondaryBtn, savingHost && s.btnDisabled]}
              onPress={handleUseDefaultHost}
              disabled={savingHost}
            >
              <Text style={s.secondaryBtnText}>Use Default</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[s.segment, active && s.segmentActive]} onPress={onPress} activeOpacity={0.85}>
      <Text style={[s.segmentText, active && s.segmentTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 40 },
  logo: { color: C.text, fontSize: 38, textAlign: 'center', fontWeight: '800', marginBottom: 6 },
  subtitle: { color: C.muted, fontSize: 15, textAlign: 'center', marginBottom: 28 },
  segmentRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  segment: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  segmentActive: {
    borderColor: C.accent,
    backgroundColor: '#2b1520',
  },
  segmentText: { color: C.muted, fontWeight: '700' },
  segmentTextActive: { color: C.text },
  form: { gap: 12, marginTop: 10 },
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
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  networkCard: {
    marginTop: 28,
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    gap: 12,
  },
  networkTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  networkHelper: { color: C.muted, fontSize: 13, lineHeight: 18 },
  endpointText: { color: C.green, fontSize: 13 },
  networkActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#172035',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { color: C.text, fontWeight: '700' },
});
