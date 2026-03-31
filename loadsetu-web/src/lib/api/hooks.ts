import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
} from "@tanstack/react-query";
import { springClient, aiClient, get, post } from "./client";
import type { Truck, LoadMatch } from "@/store";

export const qk = {
  trucks: ["trucks"] as const,
  truck: (id: string) => ["trucks", id] as const,
  matches: (truckId: string) => ["matches", truckId] as const,
  analytics: (range: string) => ["analytics", range] as const,
  pricingLogs: ["pricing-logs"] as const,
  demand: ["demand-heatmap"] as const,
  bookings: ["bookings"] as const,
  h3Heatmap: ["h3-heatmap"] as const,
  myLoads: ["my-loads"] as const,
  me: ["me"] as const,
};

export interface MatchRequest {
  truck_id: string;
  current_location_lat: number;
  current_location_lng: number;
  empty_at_timestamp: string;
  capacity_tons: number;
}

export interface BookingRequest {
  truck_id: string;
  load_id: string;
  agreed_payout: number;
}

export interface BookingResponse {
  bookingId: string;
  status: string;
  message?: string;
  createdAt?: string;
}

export interface AnalyticsData {
  totalEarnings: number;
  emptyKmSaved: number;
  successRate: number;
  acceptanceRate: number;
  bookingsThisPeriod: number;
  avgPayoutInr: number;
  earningsTimeSeries: { date: string; earnings: number }[];
  topRoutes: { origin: string; destination: string; count: number; avgPayout: number }[];
}

export interface H3HeatmapCell {
  h3Index: string;
  lat: number;
  lng: number;
  demandScore: number;
  availableTrucks: number;
  pendingLoads: number;
}

export interface BulkLoadRow {
  rowNum: number;
  originName: string;
  destinationName: string;
  requiredCapacity: number;
  payoutInr: number;
  pickupTime: string;
  valid: boolean;
  errors: string[];
}

export interface BulkLoadRequestItem {
  originCity: string;
  originLat: number;
  originLng: number;
  destinationCity: string;
  destinationLat: number;
  destinationLng: number;
  requiredCapacity: number;
  payoutInr: number;
  pickupTime: string;
  pickupDate: string;
  shipperId: string;
}

export interface BulkIngestResponse {
  totalReceived: number;
  accepted: number;
  duplicatesSkipped: number;
  rejected: number;
}

export interface UserProfile {
  userId: string;
  phone: string;
  name: string;
  role: "SHIPPER" | "FLEET_OWNER" | "ADMIN";
  fleetId?: string;
  fleetName?: string;
  createdAt: string;
}

export interface CreateLoadRequest {
  originName: string;
  originLat: number;
  originLng: number;
  destinationName: string;
  destLat: number;
  destLng: number;
  requiredCapacity: number;
  payoutInr: number;
  pickupTime: string;
  notes?: string;
}

export interface CreateLoadResponse {
  loadId: string;
  originName: string;
  destinationName: string;
  status: "AVAILABLE" | "MATCHED" | "BOOKED" | "COMPLETED" | "CANCELLED";
  createdAt: string;
}

export interface LoadRecord {
  id: string;
  originName: string;
  destinationName: string;
  requiredCapacity: number;
  payoutInr: number;
  pickupTime: string;
  status: "AVAILABLE" | "MATCHED" | "BOOKED" | "COMPLETED" | "CANCELLED";
  shipperId?: string;
  createdAt: string;
}

export interface DemandHeatmapCell {
  h3Index: string;
  lat: number;
  lng: number;
  demandScore: number;
  activeLoads: number;
  availableTrucks: number;
}

export interface PricingLogEntry {
  id: string;
  loadId: string;
  truckId: string;
  suggestedPriceInr: number;
  acceptedPriceInr: number;
  deadheadKm: number;
  confidenceScore: number;
  timestamp: string;
  accepted: boolean;
}

export function useFleetTrucks(options?: Partial<UseQueryOptions<Truck[]>>) {
  return useQuery<Truck[]>({
    queryKey: qk.trucks,
    queryFn: async () => {
      const res = await get<{ count: number; trucks: Truck[] }>(aiClient, "/api/v1/admin/trucks/live");
      return res.trucks;
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
    ...options,
  });
}

export function useTruck(id: string) {
  return useQuery<Truck>({
    queryKey: qk.truck(id),
    queryFn: async () => {
      throw new Error("Truck detail endpoint is disabled until backend support is added.");
    },
    enabled: false && !!id,
    staleTime: Infinity,
  });
}

export function useLoadMatches(req: MatchRequest | null) {
  return useQuery<{ matches: LoadMatch[] }>({
    queryKey: qk.matches(req?.truck_id ?? ""),
    queryFn: () =>
      post<{ matches: LoadMatch[] }>(aiClient, "/api/v1/loads/match", req),
    enabled: !!req,
    staleTime: 60_000,
    retry: 2,
  });
}

export function useBookLoad() {
  const qc = useQueryClient();
  return useMutation<BookingResponse, Error, BookingRequest>({
    mutationFn: (data) =>
      post<BookingResponse>(springClient, "/api/v1/bookings", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.bookings });
    },
  });
}

// TODO: Wire to real analytics endpoint when backend supports it
export function useAnalytics(range: "7d" | "30d" | "90d" = "30d") {
  return useQuery<AnalyticsData>({
    queryKey: qk.analytics(range),
    queryFn: async () => ({
      totalEarnings: 0,
      emptyKmSaved: 0,
      successRate: 0,
      acceptanceRate: 0,
      bookingsThisPeriod: 0,
      avgPayoutInr: 0,
      earningsTimeSeries: [],
      topRoutes: [],
    }),
    staleTime: Infinity,
  });
}

// TODO: Wire to real pricing logs endpoint when backend supports it
export function usePricingLogs() {
  return useQuery<PricingLogEntry[]>({
    queryKey: qk.pricingLogs,
    queryFn: async () => [],
    staleTime: Infinity,
  });
}

// TODO: Wire to real demand heatmap endpoint when backend supports it
export function useDemandHeatmap() {
  return useQuery<DemandHeatmapCell[]>({
    queryKey: qk.demand,
    queryFn: async () => [],
    staleTime: Infinity,
    refetchInterval: false,
  });
}

// TODO: Wire to real H3 heatmap endpoint when backend supports it
export function useH3Heatmap() {
  return useQuery<H3HeatmapCell[]>({
    queryKey: qk.h3Heatmap,
    queryFn: async () => [],
    staleTime: Infinity,
    refetchInterval: false,
  });
}

export function useCreateLoad() {
  const qc = useQueryClient();
  return useMutation<CreateLoadResponse, Error, CreateLoadRequest>({
    mutationFn: (data) =>
      post<CreateLoadResponse>(springClient, "/api/v1/loads", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.myLoads });
    },
  });
}

export function useMyLoads() {
  return useQuery<LoadRecord[]>({
    queryKey: qk.myLoads,
    queryFn: () =>
      get<LoadRecord[]>(springClient, "/api/v1/loads/my-loads"),
    staleTime: 30_000,
  });
}

export function useMe() {
  return useQuery<UserProfile>({
    queryKey: qk.me,
    queryFn: () => get<UserProfile>(springClient, "/api/v1/users/me"),
    staleTime: 10 * 60_000,
  });
}

// Dry-run is client-side validation only; real ingest uses useBulkIngestConfirm
export function useBulkIngestDryRun() {
  return useMutation<{ rows: BulkLoadRow[] }, Error, BulkLoadRow[]>({
    mutationFn: async (rows) => ({ rows }),
  });
}

export function useBulkIngestConfirm() {
  const qc = useQueryClient();
  return useMutation<BulkIngestResponse, Error, { loads: BulkLoadRequestItem[] }>({
    mutationFn: ({ loads }) =>
      post<BulkIngestResponse>(
        springClient,
        "/api/v1/loads/bulk",
        { loads }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.myLoads });
    },
  });
}

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expires_in: number;
  user_id: string;
  role: "FLEET_OWNER" | "SHIPPER" | "ADMIN";
  company_name?: string;
  full_name?: string;
}

export function useLogin() {
  return useMutation<LoginResponse, Error, LoginRequest>({
    mutationFn: (data) =>
      post<LoginResponse>(springClient, "/api/v1/auth/login", data),
  });
}
