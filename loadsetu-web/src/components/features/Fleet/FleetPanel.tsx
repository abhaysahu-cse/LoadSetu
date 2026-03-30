"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFleetTrucks } from "@/lib/api/hooks";
import { useFleetStore, useMapStore } from "@/store";
import type { Truck } from "@/store";
import { createLocale } from "@/lib/localization/dictionary";
import { useAuthStore } from "@/store";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  EMPTY: {
    label: "Empty",
    dot: "bg-amber-400",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  },
  IN_TRANSIT: {
    label: "In Transit",
    dot: "bg-blue-400",
    badge: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  },
  IDLE: {
    label: "Idle",
    dot: "bg-slate-500",
    badge: "bg-slate-700/50 text-slate-400 border-slate-600/30",
  },
  OFFLINE: {
    label: "Offline",
    dot: "bg-slate-700",
    badge: "bg-slate-900 text-slate-600 border-slate-800",
  },
};

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-slate-800/60 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-slate-800" />
      <div className="flex-1 space-y-2">
        <div className="w-32 h-3 bg-slate-800 rounded-full" />
        <div className="w-20 h-2.5 bg-slate-800 rounded-full" />
      </div>
      <div className="w-16 h-6 bg-slate-800 rounded-lg" />
      <div className="w-20 h-6 bg-slate-800 rounded-lg" />
    </div>
  );
}

// ─── Truck Detail Panel ───────────────────────────────────────────────────────

function TruckDetailPanel({ truck, onClose }: { truck: Truck; onClose: () => void }) {
  const { detectedLanguage } = useAuthStore();
  const { t } = createLocale(detectedLanguage);
  const { flyTo } = useMapStore();
  const cfg = STATUS_CONFIG[truck.status];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="w-80 flex-shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col"
    >
      <div className="flex items-center justify-between p-5 border-b border-slate-800">
        <h3 className="font-bold text-white">{truck.driverName}</h3>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-white text-lg transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="p-5 space-y-4 flex-1 overflow-auto">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">Status</span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.badge}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot} mr-1.5 align-middle`} />
            {cfg.label}
          </span>
        </div>

        {/* Details */}
        {[
          ["Plate Number", truck.plateNumber],
          ["Capacity", `${truck.capacityTons} Tons`],
          ["Phone", truck.phone],
          ["Last Updated", new Date(truck.lastUpdated).toLocaleTimeString("en-IN")],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-sm text-slate-500">{label}</span>
            <span className="text-sm text-slate-200 font-medium">{value}</span>
          </div>
        ))}

        {/* Location */}
        <div className="bg-slate-800/60 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1">Last Known Location</p>
          <p className="text-xs font-mono text-slate-300">
            {truck.currentLocationLat.toFixed(4)}, {truck.currentLocationLng.toFixed(4)}
          </p>
          {truck.h3Index && (
            <p className="text-xs font-mono text-blue-400 mt-0.5">
              H3: {truck.h3Index}
            </p>
          )}
        </div>

        {/* Status hint */}
        <p className="text-xs text-slate-500 italic">
          {truck.status === "EMPTY" ? t("truck_empty") : t("truck_moving")}
        </p>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        <button
          onClick={() => flyTo(truck.currentLocationLat, truck.currentLocationLng, 13)}
          className="w-full bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 text-blue-400 font-semibold py-2.5 rounded-xl text-sm transition-all"
        >
          🗺️ {t("view_on_map")}
        </button>
        {truck.status === "EMPTY" && (
          <button className="w-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 font-semibold py-2.5 rounded-xl text-sm transition-all">
            ⚡ {t("find_matches")}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type FilterStatus = "ALL" | Truck["status"];

export default function FleetPanel() {
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [search, setSearch] = useState("");
  const [detailTruck, setDetailTruck] = useState<Truck | null>(null);

  const { data, isLoading } = useFleetTrucks();
  const { setSelectedTruck } = useFleetStore();

  const allTrucks = data ?? [];
  const filtered = allTrucks.filter((t) => {
    const matchStatus = filter === "ALL" || t.status === filter;
    const matchSearch =
      !search ||
      t.driverName.toLowerCase().includes(search.toLowerCase()) ||
      t.plateNumber.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const counts: Record<FilterStatus, number> = {
    ALL: allTrucks.length,
    EMPTY: allTrucks.filter((t) => t.status === "EMPTY").length,
    IN_TRANSIT: allTrucks.filter((t) => t.status === "IN_TRANSIT").length,
    IDLE: allTrucks.filter((t) => t.status === "IDLE").length,
    OFFLINE: allTrucks.filter((t) => t.status === "OFFLINE").length,
  };

  return (
    <div className="h-full flex">
      {/* ── Main list ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Controls */}
        <div className="p-5 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Fleet Management</h2>
            <span className="text-sm text-slate-500">
              {allTrucks.length} trucks registered
            </span>
          </div>
          {/* Search */}
          <input
            type="text"
            placeholder="Search driver or plate…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
          />
          {/* Filter pills */}
          <div className="flex gap-2 flex-wrap">
            {(["ALL", "EMPTY", "IN_TRANSIT", "IDLE", "OFFLINE"] as FilterStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                  filter === s
                    ? "bg-slate-700 border-slate-600 text-white"
                    : "bg-transparent border-slate-800 text-slate-500 hover:text-white"
                }`}
              >
                {s === "ALL" ? "All" : STATUS_CONFIG[s as Truck["status"]].label}
                <span className="ml-1.5 opacity-60">{counts[s]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => <SkeletonRow key={i} />)
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
              <span className="text-4xl">🚛</span>
              <p className="text-sm">No trucks match your filter</p>
            </div>
          ) : (
            filtered.map((truck, i) => {
              const cfg = STATUS_CONFIG[truck.status];
              const isSelected = detailTruck?.id === truck.id;
              return (
                <motion.div
                  key={truck.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => {
                    setDetailTruck(isSelected ? null : truck);
                    setSelectedTruck(truck);
                  }}
                  className={`flex items-center gap-4 px-5 py-4 border-b border-slate-800/60 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-slate-800/60"
                      : "hover:bg-slate-900/60"
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-lg flex-shrink-0">
                    🚛
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${cfg.dot}`}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {truck.driverName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {truck.plateNumber} · {truck.capacityTons}T
                    </p>
                  </div>

                  {/* Status */}
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.badge} flex-shrink-0`}>
                    {cfg.label}
                  </span>

                  {/* Last updated */}
                  <span className="text-xs text-slate-600 flex-shrink-0 hidden md:block">
                    {new Date(truck.lastUpdated).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Detail panel ── */}
      <AnimatePresence>
        {detailTruck && (
          <TruckDetailPanel
            truck={detailTruck}
            onClose={() => setDetailTruck(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
