"use client";

import { useEffect, useRef, useCallback } from "react";
import { useFleetStore, useUIStore } from "@/store";
import type { Truck } from "@/store";

// ─── Types ────────────────────────────────────────────────────────────────────

type WSEventType =
  | "TRUCK_LOCATION_UPDATE"
  | "TRUCK_STATUS_CHANGE"
  | "NEW_LOAD"
  | "BOOKING_CONFIRMED"
  | "PLATFORM_STATUS";

interface WSMessage<T = unknown> {
  type: WSEventType;
  requestId: string;
  timestamp: string;
  payload: T;
}

interface TruckUpdatePayload {
  truckId: string;
  lat: number;
  lng: number;
  status: Truck["status"];
  h3Index: string;
}

interface BookingPayload {
  bookingId: string;
  truckId: string;
  loadId: string;
  status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws/notifications";
const FALLBACK_POLL_INTERVAL = 8_000; // 8 seconds
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1_500; // exponential backoff base

// ─── Manager (module-level singleton) ────────────────────────────────────────

class TelemetrySocketManager {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private token: string | null = null;
  private usingFallback = false;
  private listeners: Set<(msg: WSMessage) => void> = new Set();

  connect(token: string) {
    this.token = token;
    this.usingFallback = false;
    this._openSocket();
  }

  disconnect() {
    this._clearTimers();
    this.socket?.close(1000, "User logout");
    this.socket = null;
    this.listeners.clear();
  }

  addListener(fn: (msg: WSMessage) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private _openSocket() {
    const url = `${WS_URL}?token=${this.token}`;
    try {
      this.socket = new WebSocket(url);
    } catch {
      this._onFail();
      return;
    }

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.usingFallback = false;
      useUIStore.getState().setPlatformStatus("CONNECTED");
      this._clearPoll();
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        this._dispatch(msg);
      } catch {
        // malformed frame — ignore
      }
    };

    this.socket.onerror = () => this._onFail();
    this.socket.onclose = (ev) => {
      if (ev.code !== 1000) this._onFail();
    };
  }

  private _dispatch(msg: WSMessage) {
    this.listeners.forEach((fn) => fn(msg));

    switch (msg.type) {
      case "TRUCK_LOCATION_UPDATE": {
        const p = msg.payload as TruckUpdatePayload;
        useFleetStore.getState().upsertTruck({
          ...useFleetStore
            .getState()
            .trucks.find((t) => t.id === p.truckId)!,
          id: p.truckId,
          currentLocationLat: p.lat,
          currentLocationLng: p.lng,
          status: p.status,
          h3Index: p.h3Index,
          lastUpdated: msg.timestamp,
        });
        break;
      }
      case "BOOKING_CONFIRMED": {
        const p = msg.payload as BookingPayload;
        useUIStore
          .getState()
          .addToast(`Booking confirmed — load ${p.loadId.slice(0, 8)}`, "success");
        break;
      }
      case "PLATFORM_STATUS": {
        const p = msg.payload as { status: "CONNECTED" | "DEGRADED" | "OFFLINE" };
        useUIStore.getState().setPlatformStatus(p.status);
        break;
      }
    }
  }

  private _onFail() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this._activateFallback();
      return;
    }
    useUIStore.getState().setPlatformStatus("DEGRADED");
    const delay =
      RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => this._openSocket(), delay);
  }

  private _activateFallback() {
    if (this.usingFallback) return;
    this.usingFallback = true;
    useUIStore.getState().setPlatformStatus("DEGRADED");
    // No REST fallback: the old truck polling endpoint has been retired.
    this.pollTimer = setInterval(() => {
      useUIStore.getState().setPlatformStatus("OFFLINE");
    }, FALLBACK_POLL_INTERVAL);
  }

  private _clearTimers() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this._clearPoll();
  }
  private _clearPoll() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }
}

export const telemetrySocket = new TelemetrySocketManager();

// ─── React Hook ───────────────────────────────────────────────────────────────

export function useTelemetrySocket(token: string | null) {
  const initialised = useRef(false);

  useEffect(() => {
    if (!token || initialised.current) return;
    initialised.current = true;
    telemetrySocket.connect(token);
    return () => {
      telemetrySocket.disconnect();
      initialised.current = false;
    };
  }, [token]);
}

export function useSocketListener(
  callback: (msg: WSMessage) => void
) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    const wrapped = (msg: WSMessage) => cbRef.current(msg);

    const unsubscribe = telemetrySocket.addListener(wrapped);
    return () => {
      unsubscribe();
    };
  }, []);
}
