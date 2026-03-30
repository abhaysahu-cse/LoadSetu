"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useFleetStore, useMapStore, useAuthStore } from "@/store";
import { useFleetTrucks, useLoadMatches, useH3Heatmap } from "@/lib/api/hooks";
import type { Truck, LoadMatch } from "@/store";
import { createLocale } from "@/lib/localization/dictionary";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// ─── Colour helpers ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<Truck["status"], string> = {
  EMPTY: "#f59e0b",
  IN_TRANSIT: "#3b82f6",
  IDLE: "#64748b",
  OFFLINE: "#1e293b",
};

// Create a pulsing HTML marker element
function createTruckMarker(truck: Truck): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "truck-marker";
  el.style.cssText = `
    width: 32px; height: 32px; position: relative; cursor: pointer;
  `;
  const color = STATUS_COLORS[truck.status];
  const isPulsing = truck.status === "EMPTY";

  el.innerHTML = `
    ${isPulsing ? `<span style="
      position:absolute;inset:0;border-radius:50%;background:${color};
      opacity:0.35;animation:markerPulse 1.8s ease-out infinite;
    "></span>` : ""}
    <div style="
      width:32px;height:32px;border-radius:50%;background:${color};
      border:2px solid rgba(255,255,255,0.9);
      display:flex;align-items:center;justify-content:center;
      position:relative;z-index:1;font-size:14px;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
    ">🚛</div>
  `;
  return el;
}

// ─── Pulse animation global style ────────────────────────────────────────────

const MARKER_STYLE = `
  @keyframes markerPulse {
    0%   { transform: scale(1); opacity: 0.35; }
    70%  { transform: scale(2.4); opacity: 0; }
    100% { transform: scale(2.4); opacity: 0; }
  }
`;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GodView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const [selectedMatchLoad, setSelectedMatchLoad] = useState<LoadMatch | null>(null);

  const { trucks, selectedTruck, setSelectedTruck, matches, setMatches, setMatchesLoading } =
    useFleetStore();
  const { showH3Heatmap, toggleH3Heatmap, registerFlyTo } = useMapStore();
  const { detectedLanguage } = useAuthStore();
  const { t } = createLocale(detectedLanguage);

  const { data: trucksData } = useFleetTrucks();
  const { data: h3Data } = useH3Heatmap();

  const matchRequest = selectedTruck
    ? {
        truck_id: selectedTruck.id,
        current_location_lat: selectedTruck.currentLocationLat,
        current_location_lng: selectedTruck.currentLocationLng,
        empty_at_timestamp: new Date().toISOString(),
        capacity_tons: selectedTruck.capacityTons,
      }
    : null;

  const { data: matchData, isLoading: matchLoading } = useLoadMatches(matchRequest);

  useEffect(() => {
    if (matchData?.matches) setMatches(matchData.matches);
    setMatchesLoading(matchLoading);
  }, [matchData, matchLoading]);

  // ── Init Map ──────────────────────────────────────────────────

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const style = document.createElement("style");
    style.textContent = MARKER_STYLE;
    document.head.appendChild(style);

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [78.9629, 20.5937],
      zoom: 5,
      projection: { name: "mercator" },
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      mapRef.current = map;
      setMapReady(true);
      _initSources(map);
      _initH3Layer(map);
      _initRadiusLayer(map);
      _initDeadheadLayer(map);
      _initMatchMarkerLayer(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Register flyTo ─────────────────────────────────────────────

  useEffect(() => {
    registerFlyTo((lat, lng, zoom) => {
      mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1800 });
    });
  }, [registerFlyTo]);

  // ── Update truck markers ──────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const currentIds = new Set(trucks.map((t) => t.id));

    // Remove stale markers
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add / update markers
    trucks.forEach((truck) => {
      if (markersRef.current.has(truck.id)) {
        markersRef.current
          .get(truck.id)!
          .setLngLat([truck.currentLocationLng, truck.currentLocationLat]);
      } else {
        const el = createTruckMarker(truck);
        el.addEventListener("click", () => onTruckClick(truck));
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([truck.currentLocationLng, truck.currentLocationLat])
          .addTo(map);
        markersRef.current.set(truck.id, marker);
      }
    });
  }, [trucks, mapReady]);

  // ── Draw 50km radius circle when truck selected ───────────────

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    if (!selectedTruck) {
      (map.getSource("radius-source") as mapboxgl.GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: [],
      });
      (map.getSource("deadhead-source") as mapboxgl.GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: [],
      });
      return;
    }

    // Radius circle (approximate 50km as a circle polygon)
    const radiusKm = 50;
    const steps = 64;
    const coords: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * 360;
      const rad = (angle * Math.PI) / 180;
      const lat =
        selectedTruck.currentLocationLat + (radiusKm / 111) * Math.cos(rad);
      const lng =
        selectedTruck.currentLocationLng +
        (radiusKm / (111 * Math.cos((selectedTruck.currentLocationLat * Math.PI) / 180))) *
          Math.sin(rad);
      coords.push([lng, lat]);
    }

    (map.getSource("radius-source") as mapboxgl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [coords] },
        },
      ],
    });

    map.flyTo({
      center: [selectedTruck.currentLocationLng, selectedTruck.currentLocationLat],
      zoom: 9,
      duration: 1400,
    });
  }, [selectedTruck, mapReady]);

  // ── Draw deadhead lines when matches arrive ───────────────────

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedTruck) return;

    const lines = matches.map((m) => ({
      type: "Feature" as const,
      properties: { loadId: m.loadId, payout: m.payoutInr },
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [selectedTruck.currentLocationLng, selectedTruck.currentLocationLat],
          [m.originLng, m.originLat],
        ],
      },
    }));

    (mapRef.current.getSource("deadhead-source") as mapboxgl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: lines,
    });

    // Plot match origin pins
    const matchPoints = matches.map((m) => ({
      type: "Feature" as const,
      properties: {
        loadId: m.loadId,
        origin: m.origin,
        destination: m.destination,
        payout: m.payoutInr,
        deadhead: m.deadheadKm,
      },
      geometry: { type: "Point" as const, coordinates: [m.originLng, m.originLat] },
    }));

    (mapRef.current.getSource("match-pins-source") as mapboxgl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: matchPoints,
    });
  }, [matches, selectedTruck, mapReady]);

  // ── H3 heatmap layer ──────────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapRef.current || !h3Data) return;
    const features = h3Data.map((cell) => ({
      type: "Feature" as const,
      properties: {
        demandScore: cell.demandScore,
        trucks: cell.availableTrucks,
        loads: cell.pendingLoads,
      },
      geometry: { type: "Point" as const, coordinates: [cell.lng, cell.lat] },
    }));
    (mapRef.current.getSource("h3-source") as mapboxgl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features,
    });
    const visibility = showH3Heatmap ? "visible" : "none";
    mapRef.current.setLayoutProperty("h3-heatmap-layer", "visibility", visibility);
  }, [h3Data, showH3Heatmap, mapReady]);

  // ── Source & layer init helpers ───────────────────────────────

  function _initSources(map: mapboxgl.Map) {
    map.addSource("radius-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addSource("deadhead-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addSource("match-pins-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addSource("h3-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  }

  function _initH3Layer(map: mapboxgl.Map) {
    map.addLayer({
      id: "h3-heatmap-layer",
      type: "heatmap",
      source: "h3-source",
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "demandScore"], 0, 0, 1, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 5, 1, 12, 3],
        "heatmap-color": [
          "interpolate", ["linear"], ["heatmap-density"],
          0, "rgba(16,185,129,0)",
          0.3, "rgba(16,185,129,0.4)",
          0.6, "rgba(245,158,11,0.7)",
          1, "rgba(244,63,94,1)",
        ],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 5, 18, 12, 50],
        "heatmap-opacity": 0.65,
      },
    });
  }

  function _initRadiusLayer(map: mapboxgl.Map) {
    map.addLayer({
      id: "radius-fill",
      type: "fill",
      source: "radius-source",
      paint: { "fill-color": "#10b981", "fill-opacity": 0.06 },
    });
    map.addLayer({
      id: "radius-border",
      type: "line",
      source: "radius-source",
      paint: { "line-color": "#10b981", "line-width": 1.5, "line-dasharray": [4, 3] },
    });
  }

  function _initDeadheadLayer(map: mapboxgl.Map) {
    map.addLayer({
      id: "deadhead-lines",
      type: "line",
      source: "deadhead-source",
      paint: {
        "line-color": "#f43f5e",
        "line-width": 1.5,
        "line-dasharray": [3, 2],
        "line-opacity": 0.75,
      },
    });
  }

  function _initMatchMarkerLayer(map: mapboxgl.Map) {
    map.addLayer({
      id: "match-pins-layer",
      type: "circle",
      source: "match-pins-source",
      paint: {
        "circle-radius": 9,
        "circle-color": "#10b981",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
        "circle-opacity": 0.92,
      },
    });
    map.on("click", "match-pins-layer", (e) => {
      const props = e.features?.[0]?.properties;
      if (props) {
        setSelectedMatchLoad({
          loadId: props.loadId,
          origin: props.origin,
          destination: props.destination,
          payoutInr: props.payout,
          deadheadKm: props.deadhead,
          confidenceScore: 1,
          originLat: 0,
          originLng: 0,
          destinationLat: 0,
          destinationLng: 0,
          requiredCapacity: 0,
          pickupTime: "",
        });
      }
    });
    map.on("mouseenter", "match-pins-layer", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "match-pins-layer", () => {
      map.getCanvas().style.cursor = "";
    });
  }

  const onTruckClick = useCallback((truck: Truck) => {
    setSelectedTruck(truck);
    setSelectedMatchLoad(null);
  }, [setSelectedTruck]);

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="relative w-full h-full bg-slate-950">
      {/* Map canvas */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Loading overlay */}
      {!mapReady && (
        <div className="absolute inset-0 bg-slate-950 flex items-center justify-center z-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Initialising VahanSync map…</p>
          </div>
        </div>
      )}

      {/* Map controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <button
          onClick={toggleH3Heatmap}
          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
            showH3Heatmap
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
              : "bg-slate-900/80 border-slate-700 text-slate-400"
          }`}
        >
          {showH3Heatmap ? "● H3 Demand ON" : "○ H3 Demand OFF"}
        </button>
        {selectedTruck && (
          <button
            onClick={() => { setSelectedTruck(null); setSelectedMatchLoad(null); }}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900/80 border border-slate-700 text-slate-400 hover:text-white transition-all"
          >
            ✕ Clear Selection
          </button>
        )}
      </div>

      {/* Match loading indicator */}
      <AnimatePresence>
        {matchLoading && selectedTruck && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-slate-900/90 border border-slate-700 rounded-2xl px-5 py-2.5 flex items-center gap-3"
          >
            <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-300">{t("finding_loads")}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected truck panel */}
      <AnimatePresence>
        {selectedTruck && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-4 right-16 z-10 w-72 bg-slate-900/95 border border-slate-700/70 rounded-2xl p-4 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-white">{selectedTruck.driverName}</p>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  selectedTruck.status === "EMPTY"
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-blue-500/15 text-blue-400"
                }`}
              >
                {selectedTruck.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-1">{selectedTruck.plateNumber}</p>
            <p className="text-xs text-slate-500 mb-3">{selectedTruck.capacityTons}T capacity</p>

            {matches.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-emerald-400 mb-2">
                  {matches.length} loads found
                </p>
                {matches.slice(0, 3).map((m) => (
                  <div
                    key={m.loadId}
                    onClick={() => setSelectedMatchLoad(m)}
                    className="bg-slate-800 rounded-xl p-3 cursor-pointer hover:bg-slate-700/80 transition-colors"
                  >
                    <p className="text-xs font-medium text-white">
                      {m.origin} → {m.destination}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-emerald-400 text-sm font-bold">
                        ₹{m.payoutInr.toLocaleString("en-IN")}
                      </span>
                      <span className="text-rose-400 text-xs">
                        {m.deadheadKm.toFixed(1)} km dead
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!matchLoading && matches.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-2">
                {t("no_loads_found")}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Load popup on pin click */}
      <AnimatePresence>
        {selectedMatchLoad && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-80 bg-slate-900/97 border border-emerald-500/30 rounded-2xl p-5 backdrop-blur-sm shadow-xl"
          >
            <button
              onClick={() => setSelectedMatchLoad(null)}
              className="absolute top-3 right-3 text-slate-500 hover:text-white text-sm"
            >
              ✕
            </button>
            <p className="text-xs text-emerald-400 font-semibold mb-1">Matched Load</p>
            <p className="text-base font-bold text-white mb-3">
              {selectedMatchLoad.origin} → {selectedMatchLoad.destination}
            </p>
            <div className="flex gap-4">
              <div>
                <p className="text-xs text-slate-500">Payout</p>
                <p className="text-2xl font-black text-emerald-400">
                  ₹{selectedMatchLoad.payoutInr.toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Deadhead</p>
                <p className="text-2xl font-black text-rose-400">
                  {selectedMatchLoad.deadheadKm.toFixed(1)} km
                </p>
              </div>
            </div>
            <button className="mt-4 w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 rounded-xl text-sm transition-colors">
              {t("book_load")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
