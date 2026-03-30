import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import {
  acceptLoad,
  AppLoad,
  fetchDriverProfile,
  fetchLoadById,
  fetchNearbyLoads,
} from '../api/endpoints';
import { loadCache } from '../services/offline.service';
import { getRateLimitCooldown } from '../api/client';
import { useEffect, useState } from 'react';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 10000),
      staleTime: 2 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage });
persistQueryClient({ queryClient, persister });

const QK = {
  nearbyLoads: (lat: number, lng: number) => ['loads', 'nearby', lat, lng] as const,
  load: (id: string) => ['loads', id] as const,
  driverProfile: () => ['driver', 'profile'] as const,
};

export function useNearbyLoads(lat: number, lng: number, enabled = true) {
  return useQuery({
    queryKey: QK.nearbyLoads(lat, lng),
    queryFn: async () => {
      const loads = await fetchNearbyLoads(lat, lng);
      await loadCache.saveAll(loads as any);
      return loads;
    },
    enabled,
    refetchInterval: enabled ? 60000 : false,
    placeholderData: (prev) => prev,
  });
}

export function useLoad(loadId: string) {
  return useQuery({
    queryKey: QK.load(loadId),
    queryFn: async (): Promise<AppLoad> => {
      try {
        return await fetchLoadById(loadId);
      } catch (err: any) {
        if (err?.type === 'NETWORK_ERROR') {
          const cached = await loadCache.get(loadId);
          if (cached) {
            return cached as AppLoad;
          }
        }
        throw err;
      }
    },
  });
}

export function useAcceptLoad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (load: AppLoad) => acceptLoad(load),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loads'] });
    },
  });
}

export function useDriverProfile() {
  return useQuery({
    queryKey: QK.driverProfile(),
    queryFn: fetchDriverProfile,
    staleTime: 10 * 60 * 1000,
  });
}

export function useRateLimitTimer(): { cooldownSec: number; isRateLimited: boolean } {
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const until = getRateLimitCooldown();
      if (until) {
        setCooldownSec(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
      } else {
        setCooldownSec(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return { cooldownSec, isRateLimited: cooldownSec > 0 };
}
