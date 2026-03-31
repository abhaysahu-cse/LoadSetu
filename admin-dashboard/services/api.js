/**
 * LoadSetu Admin — API Service Layer
 * Admin endpoints proxy to Python FastAPI :8000 via next.config.js rewrites
 * Spring Boot endpoints proxy via /api/spring/*
 */

const ADMIN_BASE = '/api/admin';
const SPRING_BASE = '/api/spring';

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Trucks ──────────────────────────────────────────────────────────────────
// Python FastAPI reads from Redis: truck:location:*
// Returns: { count: number, trucks: [{ truckId, lat, lng, speed, heading, status, lastSeen }] }
export const getTrucks = async () => {
  const data = await apiFetch(`${ADMIN_BASE}/trucks/live`);
  return data.trucks || [];
};

// ── Loads ────────────────────────────────────────────────────────────────────
// Returns recent load-events from Kafka buffer
// { count: number, events: [{ loadId, origin, destination, ... }] }
export const getLoads = async () => {
  const data = await apiFetch(`${ADMIN_BASE}/load-events/recent`);
  return data.events || [];
};

// ── Matches ──────────────────────────────────────────────────────────────────
// Returns recent match results from Kafka
// { count: number, events: [...] }
export const getMatches = async () => {
  const data = await apiFetch(`${ADMIN_BASE}/load-matches/recent`);
  return data.events || [];
};

// ── Health ───────────────────────────────────────────────────────────────────
// Returns: { kafka: bool, redis: bool, backend: bool, ... }
export const getHealth = () => apiFetch(`${ADMIN_BASE}/health`);

// ── Force Match ───────────────────────────────────────────────────────────────
// POST /api/v1/admin/force-match  { origin, destination, weight_tons, ... }
export const forceMatch = (params) =>
  apiFetch(`${ADMIN_BASE}/force-match`, {
    method: 'POST',
    body: JSON.stringify(params),
  });

// ── Cancel load (via Spring Boot) ─────────────────────────────────────────────
export const cancelLoad = (loadId) =>
  apiFetch(`${SPRING_BASE}/loads/${loadId}`, { method: 'DELETE' });
