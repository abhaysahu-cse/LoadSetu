"use client";

import { Activity, LoaderCircle, RefreshCcw, Siren, Truck, Waves } from "lucide-react";
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";

type TruckSnapshot = {
  truck_id: string;
  lat: number;
  lng: number;
  status: string;
  last_updated?: string | null;
  h3?: string | null;
};

type EventEnvelope = {
  topic: string;
  key?: string | null;
  partition: number;
  offset: number;
  received_at: string;
  payload: Record<string, unknown>;
};

type Overview = {
  fetchedAt: string;
  health: {
    status: string;
    dependencies: Record<string, string>;
    buffers: Record<string, number>;
    last_error?: string | null;
  };
  trucks: { count: number; trucks: TruckSnapshot[] };
  loadEvents: { count: number; events: EventEnvelope[] };
  matchResults: { count: number; events: EventEnvelope[] };
};

function statusClass(status: string) {
  if (status === "up" || status === "ok") {
    return "badge up";
  }
  return "badge degraded";
}

function formatStamp(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleTimeString();
}

export default function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forceLoadId, setForceLoadId] = useState<string | null>(null);

  const trucks = useDeferredValue(data?.trucks.trucks ?? []);

  const loadOverview = async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    }
    try {
      const response = await fetch("/api/overview", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`overview request failed with ${response.status}`);
      }
      const next = (await response.json()) as Overview;
      startTransition(() => {
        setData(next);
        setError(null);
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unknown overview error";
      startTransition(() => setError(message));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadOverview();
    const intervalId = window.setInterval(() => {
      void loadOverview();
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, []);

  const successfulMatches = useMemo(() => {
    return (data?.matchResults.events ?? []).filter((event) => {
      const matches = event.payload.matches;
      return Array.isArray(matches) && matches.length > 0;
    }).length;
  }, [data?.matchResults.events]);

  const forceMatch = async (event: EventEnvelope) => {
    setForceLoadId(event.key ?? null);
    try {
      const payload = event.payload;
      const response = await fetch("/api/force-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          load_id: payload.loadId,
          origin: payload.origin,
          destination: payload.destination,
          pickup_lat: payload.pickupLat,
          pickup_lng: payload.pickupLng,
          weight_tons: payload.weightTons ?? 10,
        }),
      });
      if (!response.ok) {
        throw new Error(`force-match failed with ${response.status}`);
      }
      await loadOverview(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Force match failed";
      setError(message);
    } finally {
      setForceLoadId(null);
    }
  };

  const dependencies = data?.health.dependencies ?? {};

  return (
    <main className="shell">
      <div className="frame">
        {error ? <div className="error-banner">{error}</div> : null}

        <section className="hero">
          <div className="hero-card">
            <div className="eyebrow">
              <span className="dot" />
              Stage 5 Control Layer
            </div>
            <h1>Dispatch Visibility Without Touching The Core Engines.</h1>
            <p>
              This surface watches the live truck cache, recent load intake, and match output while giving operators
              one manual override path when the system needs a nudge.
            </p>
            <div className="hero-meta">
              <div className="meta-chip">
                <span>Pipeline State</span>
                <strong>{data?.health.status ?? "loading"}</strong>
              </div>
              <div className="meta-chip">
                <span>Last Refresh</span>
                <strong>{data ? formatStamp(data.fetchedAt) : "--:--:--"}</strong>
              </div>
              <div className="meta-chip">
                <span>Operator Action</span>
                <strong>Force Match + Health Probe</strong>
              </div>
            </div>
          </div>

          <div className="action-card">
            <h2>Control Actions</h2>
            <div className="section-note">The overview auto-refreshes every 5 seconds. Use manual refresh after a simulator spike.</div>
            <div className="actions">
              <button className="button" onClick={() => void loadOverview(true)} disabled={refreshing}>
                {refreshing ? <LoaderCircle size={16} /> : <RefreshCcw size={16} />}
                {refreshing ? "Refreshing" : "Refresh Now"}
              </button>
              <button className="button secondary" onClick={() => window.location.reload()}>
                <Siren size={16} />
                Hard Reload
              </button>
            </div>
            <div className="health-grid">
              <div className="health-item">
                <span>Load Buffer</span>
                <strong>{data?.health.buffers.recent_load_events ?? 0}</strong>
              </div>
              <div className="health-item">
                <span>Match Buffer</span>
                <strong>{data?.health.buffers.recent_match_results ?? 0}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="grid metrics">
          <div className="metric">
            <h2>Live Trucks</h2>
            <div className="value">{data?.trucks.count ?? 0}</div>
            <div className="meta">Current `truck:location:*` snapshots available to matching.</div>
          </div>
          <div className="metric">
            <h2>Recent Loads</h2>
            <div className="value">{data?.loadEvents.count ?? 0}</div>
            <div className="meta">Events observed on `load-events` by the control-plane monitor.</div>
          </div>
          <div className="metric">
            <h2>Match Outputs</h2>
            <div className="value">{data?.matchResults.count ?? 0}</div>
            <div className="meta">Recent payloads collected from `load-matches`.</div>
          </div>
          <div className="metric">
            <h2>Non-Empty Matches</h2>
            <div className="value">{successfulMatches}</div>
            <div className="meta">Recent match payloads that returned at least one candidate.</div>
          </div>
        </section>

        <section className="content-grid">
          <div className="stack">
            <div className="table-card">
              <h2>Live Truck View</h2>
              <div className="section-note">Truck ID, coordinates, status, and H3 cell pulled from Redis.</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Truck</th>
                      <th>Status</th>
                      <th>Lat</th>
                      <th>Lng</th>
                      <th>Last Update</th>
                      <th>H3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trucks.length > 0 ? (
                      trucks.slice(0, 30).map((truck) => (
                        <tr key={truck.truck_id}>
                          <td>{truck.truck_id}</td>
                          <td>{truck.status}</td>
                          <td>{truck.lat.toFixed(5)}</td>
                          <td>{truck.lng.toFixed(5)}</td>
                          <td>{formatStamp(truck.last_updated)}</td>
                          <td>{truck.h3 ?? "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6}>{loading ? "Loading trucks..." : "No truck snapshots available."}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <h2>Load Monitoring</h2>
              <div className="section-note">Recent load intake captured from Kafka, with one-click replay into the matching topic.</div>
              <div className="event-list">
                {data?.loadEvents.events.length ? (
                  data.loadEvents.events.slice(0, 8).map((event) => (
                    <article className="event-card" key={`${event.topic}-${event.partition}-${event.offset}`}>
                      <div className="event-head">
                        <div>
                          <div className="event-title">{String(event.payload.origin ?? "Unknown")} to {String(event.payload.destination ?? "Unknown")}</div>
                          <div className="section-note">key={event.key ?? "-"} • {formatStamp(event.received_at)}</div>
                        </div>
                        <span className="badge force">load-event</span>
                      </div>
                      <div className="kv">
                        <div>
                          pickup
                          <strong>{String(event.payload.pickupLat ?? "-")}, {String(event.payload.pickupLng ?? "-")}</strong>
                        </div>
                        <div>
                          weight
                          <strong>{String(event.payload.weightTons ?? "-")} tons</strong>
                        </div>
                      </div>
                      <div className="actions">
                        <button
                          className="button"
                          onClick={() => void forceMatch(event)}
                          disabled={forceLoadId === event.key}
                        >
                          {forceLoadId === event.key ? "Queueing" : "Force Match"}
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty">No recent load-events observed yet.</div>
                )}
              </div>
            </div>
          </div>

          <div className="stack">
            <div className="panel">
              <h2>Health Panel</h2>
              <div className="section-note">Fast health read across Python API, Redis, Kafka visibility, and Spring Boot.</div>
              <div className="health-grid">
                {Object.entries(dependencies).map(([name, value]) => (
                  <div className="health-item" key={name}>
                    <span>{name.replaceAll("_", " ")}</span>
                    <strong>{value}</strong>
                    <div className={statusClass(value)}>{value}</div>
                  </div>
                ))}
              </div>
              {data?.health.last_error ? <div className="section-note">last error: {data.health.last_error}</div> : null}
            </div>

            <div className="panel">
              <h2>Match Results</h2>
              <div className="section-note">Recent `load-matches` payloads watched by the control-plane consumer.</div>
              <div className="event-list">
                {data?.matchResults.events.length ? (
                  data.matchResults.events.slice(0, 8).map((event) => {
                    const matches = Array.isArray(event.payload.matches) ? event.payload.matches : [];
                    return (
                      <article className="event-card" key={`${event.topic}-${event.partition}-${event.offset}`}>
                        <div className="event-head">
                          <div>
                            <div className="event-title">Load {String(event.payload.loadId ?? event.key ?? "unknown")}</div>
                            <div className="section-note">{matches.length} candidates • {formatStamp(event.received_at)}</div>
                          </div>
                          <span className="badge match">match-result</span>
                        </div>
                        <div className="kv">
                          <div>
                            best truck
                            <strong>{matches.length ? String((matches[0] as Record<string, unknown>).truck_id ?? (matches[0] as Record<string, unknown>).truckId ?? "-") : "-"}</strong>
                          </div>
                          <div>
                            candidates
                            <strong>{matches.length}</strong>
                          </div>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="empty">No match results observed yet.</div>
                )}
              </div>
            </div>

            <div className="panel">
              <h2>Operator Notes</h2>
              <div className="section-note">Use this surface for visibility and nudges, not as a replacement for the matching engine.</div>
              <div className="event-list">
                <div className="event-card">
                  <div className="event-head">
                    <div className="event-title"><Truck size={18} /> Redis-backed live view</div>
                    <span className="badge up">cache</span>
                  </div>
                  <div className="section-note">Truck rows come from the current Redis location cache, not from the browser or database.</div>
                </div>
                <div className="event-card">
                  <div className="event-head">
                    <div className="event-title"><Waves size={18} /> Kafka event tap</div>
                    <span className="badge up">monitor</span>
                  </div>
                  <div className="section-note">Recent load and match panels are populated by a dedicated consumer group.</div>
                </div>
                <div className="event-card">
                  <div className="event-head">
                    <div className="event-title"><Activity size={18} /> Manual override</div>
                    <span className="badge force">operator</span>
                  </div>
                  <div className="section-note">Force Match re-queues a load event. It does not alter Redis, Java scoring, or database schema.</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}