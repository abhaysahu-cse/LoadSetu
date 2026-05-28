import { Platform } from 'react-native';
import { clearJwt, fastapiClient, offlineSafePatch, offlineSafePost, saveJwt, springClient, withRetry } from './client';
import { clearSession, getSession, saveSession } from '../services/session.service';

export interface LoginPayload {
  phone: string;
  password: string;
}

export interface DriverRegistrationPayload {
  fullName: string;
  phone: string;
  password: string;
  truckNumber: string;
  capacity: number;
}

export interface ShipperRegistrationPayload {
  companyName: string;
  phone: string;
  password: string;
}

interface BackendAuthResponse {
  token: string;
  expires_in: number;
  user_id: string;
  role: string;
  full_name?: string | null;
  truck_id?: string | null;
  company_name?: string | null;
}

export interface DriverProfile {
  userId: string;
  phone: string;
  name: string;
  role: string;
  companyName?: string | null;
  truckId?: string | null;
  truckNumber?: string | null;
  truckType?: string | null;
  currentStatus?: string | null;
}

export interface LoadDraft {
  originName: string;
  originLat: number;
  originLng: number;
  destinationName: string;
  destLat: number;
  destLng: number;
  requiredCapacity: number;
  payoutInr: number;
  pickupTime: string;
}

interface BackendUserProfile {
  user_id: string;
  phone: string;
  name: string;
  role: string;
  company_name?: string | null;
  truck_id?: string | null;
  truck_number?: string | null;
  truck_type?: string | null;
  current_status?: string | null;
}

interface BackendNearbyLoad {
  id: string;
  originName: string;
  originLat?: number;
  originLng?: number;
  destinationName: string;
  destinationLat?: number;
  destinationLng?: number;
  requiredCapacity: number;
  payoutInr: number;
  shipperName?: string;
  status: string;
  pickupTime: string;
  distanceKm?: number;
}

interface BackendLoadDetail {
  id: string;
  originName: string;
  destinationName: string;
  requiredCapacity: number;
  payoutInr: number;
  pickupTime: string;
  status: string;
  createdAt?: string;
}

interface BackendCreateLoadResponse {
  loadId: string;
  originName: string;
  destinationName: string;
  status: string;
  createdAt: string;
}

export interface AppLoad {
  id: string;
  origin: { city: string; lat?: number; lng?: number };
  destination: { city: string; lat?: number; lng?: number };
  weight: number;
  truckType: string;
  offeredPrice: number;
  shipper: { name: string; rating: number };
  expiresAt: string;
  distanceKm: number;
  pickupTime: string;
  status?: string;
}

interface BackendBookingResponse {
  bookingId: string;
  status: string;
  createdAt: string;
  message: string;
}

export interface BookingResponse {
  bookingId: string;
  status: string;
  confirmedAt: string;
  message: string;
}

export interface CreatedLoad {
  loadId: string;
  originName: string;
  destinationName: string;
  status: string;
  createdAt: string;
}

export interface LoadTruckMatch {
  truck_id: string;
  load_id?: string;
  origin?: string;
  destination?: string;
  payout_inr: number;
  deadhead_km: number;
  confidence_score: number;
}

interface BackendLoadMatchesResponse {
  loadId: string;
  matches: LoadTruckMatch[];
}

interface PaymentOrderResponse {
  gateway_order_id: string;
  amount: number;
  currency: string;
  booking_id: string;
}

interface PaymentConfirmResponse {
  bookingId: string;
  paymentId: string;
  status: string;
  message: string;
}

interface BookingStatusResponse {
  status: string;
}

export interface TelemetryPayload {
  truckId: string;
  lat: number;
  lng: number;
  speedKmh: number;
  headingDegrees: number;
  timestamp: string;
}

export interface VoiceIntentResponse {
  intent: 'FIND_LOAD' | 'ACCEPT_LOAD' | 'STATUS_UPDATE' | 'UNKNOWN';
  confidence: number;
  entities: {
    loadId?: string;
  };
  rawTranscript: string;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  return phone.startsWith('+') ? phone : `+${digits}`;
}

function toAppLoad(load: BackendNearbyLoad | BackendLoadDetail): AppLoad {
  return {
    id: load.id,
    origin: { city: load.originName, lat: (load as BackendNearbyLoad).originLat, lng: (load as BackendNearbyLoad).originLng },
    destination: { city: load.destinationName, lat: (load as BackendNearbyLoad).destinationLat, lng: (load as BackendNearbyLoad).destinationLng },
    weight: load.requiredCapacity,
    truckType: 'Open Truck',
    offeredPrice: load.payoutInr,
    shipper: { name: (load as BackendNearbyLoad).shipperName ?? 'LoadSetu Shipper', rating: 4.8 },
    expiresAt: load.pickupTime,
    distanceKm: (load as BackendNearbyLoad).distanceKm ?? 0,
    pickupTime: load.pickupTime,
    status: (load as BackendLoadDetail).status ?? (load as BackendNearbyLoad).status,
  };
}

function computeDriverMatchFee(offeredPrice: number): number {
  if (offeredPrice < 10000) return 99;
  if (offeredPrice <= 25000) return 199;
  return 299;
}

async function persistAuth(res: BackendAuthResponse): Promise<void> {
  await saveJwt(res.token);
  await saveSession({
    userId: res.user_id,
    role: res.role,
    fullName: res.full_name,
    truckId: res.truck_id,
    companyName: res.company_name,
  });
}

export async function login(payload: LoginPayload): Promise<DriverProfile> {
  const res = await withRetry(() => springClient.post<BackendAuthResponse>('/api/v1/auth/login', {
    phone: normalizePhone(payload.phone),
    password: payload.password,
  }));

  await persistAuth(res.data);
  return fetchDriverProfile();
}

export async function registerDriver(payload: DriverRegistrationPayload): Promise<DriverProfile> {
  const res = await withRetry(() => springClient.post<BackendAuthResponse>('/api/v1/auth/register-driver', {
    phone: normalizePhone(payload.phone),
    password: payload.password,
    fullName: payload.fullName.trim(),
    truckNumber: payload.truckNumber.trim().toUpperCase(),
    capacity: payload.capacity,
  }));

  await persistAuth(res.data);
  return fetchDriverProfile();
}

export async function registerShipper(payload: ShipperRegistrationPayload): Promise<DriverProfile> {
  const res = await withRetry(() => springClient.post<BackendAuthResponse>('/api/v1/auth/register-shipper', {
    phone: normalizePhone(payload.phone),
    password: payload.password,
    companyName: payload.companyName.trim(),
  }));

  await persistAuth(res.data);
  return fetchDriverProfile();
}

export async function logout(): Promise<void> {
  await clearJwt();
  await clearSession();
}

export async function getStoredSession() {
  return getSession();
}

export async function fetchDriverProfile(): Promise<DriverProfile> {
  const res = await withRetry(() => springClient.get<BackendUserProfile>('/api/v1/users/me'));
  await saveSession({
    userId: res.data.user_id,
    role: res.data.role,
    fullName: res.data.name,
    truckId: res.data.truck_id,
    companyName: res.data.company_name,
  });

  return {
    userId: res.data.user_id,
    phone: res.data.phone,
    name: res.data.name,
    role: res.data.role,
    companyName: res.data.company_name,
    truckId: res.data.truck_id,
    truckNumber: res.data.truck_number,
    truckType: res.data.truck_type,
    currentStatus: res.data.current_status,
  };
}

export async function registerDeviceToken(fcmToken: string): Promise<void> {
  await withRetry(() => springClient.post('/api/v1/users/device-token', {
    fcmToken,
    deviceType: Platform.OS,
  }));
}

export async function fetchNearbyLoads(lat: number, lng: number, radiusKm = 50): Promise<AppLoad[]> {
  const response = await withRetry(() => springClient.get<BackendNearbyLoad[]>('/api/v1/loads/nearby', {
    params: { lat, lng, radius: radiusKm },
  }));

  return response.data.map(toAppLoad);
}

export async function fetchLoadById(loadId: string): Promise<AppLoad> {
  const res = await withRetry(() => springClient.get<BackendLoadDetail>(`/api/v1/loads/${loadId}`));
  return toAppLoad(res.data);
}

export async function fetchMyLoads(): Promise<AppLoad[]> {
  const res = await withRetry(() => springClient.get<BackendLoadDetail[]>('/api/v1/loads/my-loads'));
  return res.data.map(toAppLoad);
}

export async function fetchLoadMatches(loadId: string): Promise<LoadTruckMatch[]> {
  const res = await withRetry(() => springClient.get<BackendLoadMatchesResponse>(`/api/v1/matches/${loadId}`));
  return res.data.matches ?? [];
}

export async function acceptLoad(load: AppLoad): Promise<BookingResponse | null> {
  const session = await getSession();
  if (!session?.truckId) {
    throw new Error('No truck is linked to this driver account.');
  }

  const response = await offlineSafePost<BackendBookingResponse>(
    springClient,
    '/api/v1/bookings',
    {
      truck_id: session.truckId,
      load_id: load.id,
      agreed_payout: load.offeredPrice,
      driver_match_fee: computeDriverMatchFee(load.offeredPrice),
    },
    `booking_${load.id}`,
  );

  if (!response) {
    return null;
  }

  return {
    bookingId: response.bookingId,
    status: response.status,
    confirmedAt: response.createdAt,
    message: response.message,
  };
}

export async function createLoad(payload: LoadDraft): Promise<CreatedLoad> {
  const res = await withRetry(() => springClient.post<BackendCreateLoadResponse>('/api/v1/loads', payload));
  return {
    loadId: res.data.loadId,
    originName: res.data.originName,
    destinationName: res.data.destinationName,
    status: res.data.status,
    createdAt: res.data.createdAt,
  };
}

export async function createPaymentOrder(bookingId: string): Promise<PaymentOrderResponse> {
  const res = await withRetry(() => springClient.post<PaymentOrderResponse>(`/api/v1/payments/create-order/${bookingId}`));
  return res.data;
}

export async function confirmPayment(
  bookingId: string,
  paymentId: string,
  amountPaid: number,
  signature: string,
): Promise<PaymentConfirmResponse> {
  const res = await withRetry(() => springClient.post<PaymentConfirmResponse>('/api/v1/payments/confirm', {
    bookingId,
    paymentId,
    amountPaid,
    signature,
  }));
  return res.data;
}

export async function updateBookingStatus(
  bookingId: string,
  status: 'IN_TRANSIT' | 'COMPLETED',
): Promise<BookingStatusResponse> {
  const url = `/api/v1/bookings/${bookingId}/status?status=${status}`;
  const response = await offlineSafePatch<BookingStatusResponse>(
    springClient,
    url,
    null,
    `booking_status_${bookingId}_${status}`,
  );

  return response ?? { status };
}

export async function sendTelemetry(payload: TelemetryPayload): Promise<void> {
  await offlineSafePost(
    fastapiClient,
    '/api/v1/telemetry',
    {
      truck_id: payload.truckId,
      lat: payload.lat,
      lng: payload.lng,
      speed_kmh: payload.speedKmh,
      heading_degrees: payload.headingDegrees,
      timestamp: payload.timestamp,
    },
    `telemetry_${payload.timestamp}`,
  );
}

export async function flushTelemetryBatch(payloads: TelemetryPayload[]): Promise<void> {
  await withRetry(() => fastapiClient.post('/api/v1/telemetry/batch', {
    pings: payloads.map((payload) => ({
      truck_id: payload.truckId,
      lat: payload.lat,
      lng: payload.lng,
      speed_kmh: payload.speedKmh,
      heading_degrees: payload.headingDegrees,
      timestamp: payload.timestamp,
    })),
  }));
}

export async function parseVoice(_audioUri: string, _mimeType: 'audio/aac' | 'audio/ogg'): Promise<VoiceIntentResponse> {
  return {
    intent: 'UNKNOWN',
    confidence: 0,
    entities: {},
    rawTranscript: '',
  };
}
