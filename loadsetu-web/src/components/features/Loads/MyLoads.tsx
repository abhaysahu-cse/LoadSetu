"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useMyLoads } from "@/lib/api/hooks";
import type { LoadRecord } from "@/lib/api/hooks";

// ─── Status config ─────────────────────────────────────────────────────────

const STATUS_CFG: Record<
  LoadRecord["status"],
  { label: string; badge: string; dot: string }
> = {
  AVAILABLE:  { label: "Available",  badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
  MATCHED:    { label: "Matched",    badge: "bg-blue-500/15 text-blue-400 border-blue-500/20",          dot: "bg-blue-400 animate-pulse" },
  BOOKED:     { label: "Booked",     badge: "bg-violet-500/15 text-violet-400 border-violet-500/20",    dot: "bg-violet-400" },
  COMPLETED:  { label: "Completed",  badge: "bg-slate-700/50 text-slate-400 border-slate-600/20",       dot: "bg-slate-500" },
  CANCELLED:  { label: "Cancelled",  badge: "bg-rose-500/15 text-rose-400 border-rose-500/20",          dot: "bg-rose-400" },
};

// ─── Shimmer skeleton rows ─────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-800/50 animate-pulse">
      <td className="px-5 py-4"><div className="w-32 h-3 bg-slate-800 rounded-full" /></td>
      <td className="px-5 py-4"><div className="w-28 h-3 bg-slate-800 rounded-full" /></td>
      <td className="px-5 py-4"><div className="w-10 h-3 bg-slate-800 rounded-full" /></td>
      <td className="px-5 py-4"><div className="w-20 h-3 bg-slate-800 rounded-full" /></td>
      <td className="px-5 py-4"><div className="w-24 h-3 bg-slate-800 rounded-full" /></td>
      <td className="px-5 py-4"><div className="w-16 h-5 bg-slate-800 rounded-lg" /></td>
    </tr>
  );
}

// ─── Filter pill ──────────────────────────────────────────────────────────

type FilterStatus = "ALL" | LoadRecord["status"];

function FilterPill({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
        active
          ? "bg-slate-700 border-slate-600 text-white"
          : "bg-transparent border-slate-800 text-slate-500 hover:text-white"
      }`}
    >
      {label}
      <span className="ml-1.5 opacity-60">{count}</span>
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

export default function MyLoadsPage() {
  const { data, isLoading, isError, refetch } = useMyLoads();
  const [filter, setFilter]   = useState<FilterStatus>("ALL");
  const [search, setSearch]   = useState("");

  const loads = data ?? [];

  const filtered = loads.filter((l) => {
    const matchStatus = filter === "ALL" || l.status === filter;
    const matchSearch =
      !search ||
      l.originName.toLowerCase().includes(search.toLowerCase()) ||
      l.destinationName.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const counts: Record<FilterStatus, number> = {
    ALL:       loads.length,
    AVAILABLE: loads.filter((l) => l.status === "AVAILABLE").length,
    MATCHED:   loads.filter((l) => l.status === "MATCHED").length,
    BOOKED:    loads.filter((l) => l.status === "BOOKED").length,
    COMPLETED: loads.filter((l) => l.status === "COMPLETED").length,
    CANCELLED: loads.filter((l) => l.status === "CANCELLED").length,
  };

  // Earnings from completed loads only
  const totalEarned = loads
    .filter((l) => l.status === "COMPLETED")
    .reduce((s, l) => s + l.payoutInr, 0);

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="px-6 py-5 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">My Loads</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Filtered by your shipper ID · live from Spring Boot
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* KPI pill */}
            {!isLoading && (
              <div className="hidden md:flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2">
                <div>
                  <p className="text-xs text-slate-600">Total Loads</p>
                  <p className="text-sm font-black text-white">{loads.length}</p>
                </div>
                <div className="w-px h-8 bg-slate-800" />
                <div>
                  <p className="text-xs text-slate-600">Earnings (Completed)</p>
                  <p className="text-sm font-black text-emerald-400">
                    ₹{totalEarned.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            )}
            <Link
              href="/loads/create"
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all"
            >
              + Post Load
            </Link>
          </div>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search by city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
          />
          <div className="flex gap-2 flex-wrap">
            {(["ALL", "AVAILABLE", "MATCHED", "BOOKED", "COMPLETED", "CANCELLED"] as FilterStatus[]).map(
              (s) => (
                <FilterPill
                  key={s}
                  label={s === "ALL" ? "All" : STATUS_CFG[s as LoadRecord["status"]].label}
                  active={filter === s}
                  count={counts[s]}
                  onClick={() => setFilter(s)}
                />
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        {isError ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-600">
            <span className="text-4xl">⚠️</span>
            <p className="text-sm">Failed to load — check your connection</p>
            <button
              onClick={() => refetch()}
              className="text-xs border border-slate-700 px-4 py-2 rounded-xl text-slate-400 hover:text-white transition-all"
            >
              Retry
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-950 border-b border-slate-800">
              <tr>
                {["Route", "Pickup Time", "Capacity", "Payout (₹)", "Posted", "Status"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {/* Shimmer skeleton — per "Shimmer Rule" */}
              {isLoading &&
                Array(8)
                  .fill(0)
                  .map((_, i) => <SkeletonRow key={i} />)}

              {/* Loaded rows */}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-20 text-slate-600">
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-4xl opacity-40">📋</span>
                      <p className="text-sm">No loads match your filter</p>
                      <Link
                        href="/loads/create"
                        className="text-xs text-emerald-400 hover:text-emerald-300 underline"
                      >
                        Post your first load →
                      </Link>
                    </div>
                  </td>
                </tr>
              )}

              <AnimatePresence>
                {!isLoading &&
                  filtered.map((load, i) => {
                    const cfg = STATUS_CFG[load.status];
                    return (
                      <motion.tr
                        key={load.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.025 }}
                        className="border-b border-slate-800/40 hover:bg-slate-900/40 transition-colors"
                      >
                        {/* Route */}
                        <td className="px-5 py-4">
                          <p className="font-semibold text-white">
                            {load.originName}
                            <span className="text-slate-600 mx-1.5 font-normal">→</span>
                            {load.destinationName}
                          </p>
                          <p className="text-xs text-slate-600 font-mono mt-0.5">
                            {load.id.slice(0, 8)}…
                          </p>
                        </td>
                        {/* Pickup */}
                        <td className="px-5 py-4 text-slate-300 text-xs">
                          {new Date(load.pickupTime).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </td>
                        {/* Capacity */}
                        <td className="px-5 py-4 text-slate-300">
                          {load.requiredCapacity}T
                        </td>
                        {/* Payout */}
                        <td className="px-5 py-4">
                          <span className="text-emerald-400 font-bold">
                            ₹{load.payoutInr.toLocaleString("en-IN")}
                          </span>
                        </td>
                        {/* Posted at */}
                        <td className="px-5 py-4 text-slate-500 text-xs">
                          {new Date(load.createdAt).toLocaleDateString("en-IN")}
                        </td>
                        {/* Status */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.badge}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer count ── */}
      {!isLoading && filtered.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex-shrink-0">
          <p className="text-xs text-slate-600">
            Showing{" "}
            <span className="text-slate-400 font-semibold">{filtered.length}</span>
            {" "}of{" "}
            <span className="text-slate-400 font-semibold">{loads.length}</span>
            {" "}loads
          </p>
        </div>
      )}
    </div>
  );
}
