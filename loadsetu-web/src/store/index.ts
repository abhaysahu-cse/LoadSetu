import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TruckStatus = "EMPTY" | "IN_TRANSIT" | "IDLE" | "OFFLINE";

export interface Truck {
  id: string;
  driverName: string;
  phone: string;
  capacityTons: number;
  currentLocationLat: number;
  currentLocationLng: number;
  status: TruckStatus;
  plateNumber: string;
  lastUpdated: string;
  h3Index?: string;
}

export interface LoadMatch {
  loadId: string;
  origin: string;
  destination: string;
  payoutInr: number;
  deadheadKm: number;
  confidenceScore: number;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  requiredCapacity: number;
  pickupTime: string;
}

export interface RateLimitState {
  active: boolean;
  retryAfterSeconds: number;
  endpoint: string | null;
}

// ─── Auth Store ─────────────────────────────────────────────────────────────

interface AuthStore {
  token: string | null;
  refreshToken: string | null;
  fleetId: string | null;
  fleetName: string | null;
  userRole: "FLEET_OWNER" | "SHIPPER" | "ADMIN" | null;
  isAuthenticated: boolean;
  detectedLanguage: "en" | "hi";
  setAuth: (payload: {
    token: string;
    refreshToken?: string | null;
    fleetId?: string | null;
    fleetName?: string | null;
    userRole: "FLEET_OWNER" | "SHIPPER" | "ADMIN";
  }) => void;
  setLanguage: (lang: "en" | "hi") => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      fleetId: null,
      fleetName: null,
      userRole: null,
      isAuthenticated: false,
      detectedLanguage: "en",
      setAuth: (payload) =>
        set({
          token: payload.token,
          refreshToken: payload.refreshToken ?? null,
          fleetId: payload.fleetId ?? null,
          fleetName: payload.fleetName ?? null,
          userRole: payload.userRole,
          isAuthenticated: true,
        }),
      setLanguage: (lang) => set({ detectedLanguage: lang }),
      clearAuth: () =>
        set({
          token: null,
          refreshToken: null,
          fleetId: null,
          fleetName: null,
          userRole: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: "loadsetu-auth",
      // Store only non-sensitive metadata; token goes into sessionStorage
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        fleetId: state.fleetId,
        fleetName: state.fleetName,
        userRole: state.userRole,
        isAuthenticated: state.isAuthenticated,
        detectedLanguage: state.detectedLanguage,
        // Tokens stored in httpOnly cookies by backend; keep reference only
        token: state.token,
        refreshToken: state.refreshToken,
      }),
    }
  )
);

// ─── Fleet Store ─────────────────────────────────────────────────────────────

interface FleetStore {
  trucks: Truck[];
  selectedTruck: Truck | null;
  matches: LoadMatch[];
  matchesLoading: boolean;
  setTrucks: (trucks: Truck[]) => void;
  upsertTruck: (truck: Truck) => void;
  setSelectedTruck: (truck: Truck | null) => void;
  setMatches: (matches: LoadMatch[]) => void;
  setMatchesLoading: (loading: boolean) => void;
  clearMatches: () => void;
}

export const useFleetStore = create<FleetStore>()((set) => ({
  trucks: [],
  selectedTruck: null,
  matches: [],
  matchesLoading: false,
  setTrucks: (trucks) => set({ trucks }),
  upsertTruck: (truck) =>
    set((state) => {
      const idx = state.trucks.findIndex((t) => t.id === truck.id);
      if (idx === -1) return { trucks: [...state.trucks, truck] };
      const next = [...state.trucks];
      next[idx] = truck;
      return { trucks: next };
    }),
  setSelectedTruck: (truck) => set({ selectedTruck: truck, matches: [] }),
  setMatches: (matches) => set({ matches }),
  setMatchesLoading: (loading) => set({ matchesLoading: loading }),
  clearMatches: () => set({ matches: [], selectedTruck: null }),
}));

// ─── Map Store ───────────────────────────────────────────────────────────────

interface MapStore {
  viewState: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  showH3Heatmap: boolean;
  showRadiusCircle: boolean;
  clusteringEnabled: boolean;
  setViewState: (vs: Partial<MapStore["viewState"]>) => void;
  toggleH3Heatmap: () => void;
  toggleRadiusCircle: () => void;
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  flyToCallback: ((lat: number, lng: number, zoom: number) => void) | null;
  registerFlyTo: (fn: (lat: number, lng: number, zoom: number) => void) => void;
}

export const useMapStore = create<MapStore>()((set, get) => ({
  viewState: { longitude: 78.9629, latitude: 20.5937, zoom: 5 },
  showH3Heatmap: true,
  showRadiusCircle: false,
  clusteringEnabled: true,
  flyToCallback: null,
  setViewState: (vs) =>
    set((s) => ({ viewState: { ...s.viewState, ...vs } })),
  toggleH3Heatmap: () =>
    set((s) => ({ showH3Heatmap: !s.showH3Heatmap })),
  toggleRadiusCircle: () =>
    set((s) => ({ showRadiusCircle: !s.showRadiusCircle })),
  flyTo: (lat, lng, zoom = 12) => {
    const cb = get().flyToCallback;
    if (cb) cb(lat, lng, zoom);
  },
  registerFlyTo: (fn) => set({ flyToCallback: fn }),
}));

// ─── UI Store ─────────────────────────────────────────────────────────────────

interface UIStore {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  rateLimit: RateLimitState;
  lastRequestId: string | null;
  toasts: { id: string; message: string; type: "success" | "error" | "info" }[];
  platformStatus: "CONNECTED" | "DEGRADED" | "OFFLINE";
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setRateLimit: (state: RateLimitState) => void;
  clearRateLimit: () => void;
  setLastRequestId: (id: string) => void;
  addToast: (message: string, type?: "success" | "error" | "info") => void;
  removeToast: (id: string) => void;
  setPlatformStatus: (status: UIStore["platformStatus"]) => void;
}

export const useUIStore = create<UIStore>()((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  rateLimit: { active: false, retryAfterSeconds: 0, endpoint: null },
  lastRequestId: null,
  toasts: [],
  platformStatus: "CONNECTED",
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setRateLimit: (state) => set({ rateLimit: state }),
  clearRateLimit: () =>
    set({ rateLimit: { active: false, retryAfterSeconds: 0, endpoint: null } }),
  setLastRequestId: (id) => set({ lastRequestId: id }),
  addToast: (message, type = "info") =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        { id: crypto.randomUUID(), message, type },
      ],
    })),
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setPlatformStatus: (status) => set({ platformStatus: status }),
}));
