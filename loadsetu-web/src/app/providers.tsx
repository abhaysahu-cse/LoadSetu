"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { RateLimitBanner, ToastContainer } from "@/components/ui/RateLimitBanner";
import { useTelemetrySocket } from "@/lib/websocket/socket";
import { useAuthStore } from "@/store";

// Keep QueryClient stable across renders
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error: unknown) => {
        // Don't retry on 4xx errors
        if (
          error instanceof Error &&
          "status" in error &&
          typeof (error as { status?: number }).status === "number"
        ) {
          const status = (error as { status: number }).status;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
    },
  },
});

function WebSocketInit() {
  const { token } = useAuthStore();
  useTelemetrySocket(token);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketInit />
      <RateLimitBanner />
      {children}
      <ToastContainer />
    </QueryClientProvider>
  );
}
