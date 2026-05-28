"use client";

import { Fragment } from "react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useLoadTruckMatches, useMyLoads } from "@/lib/api/hooks";
import type { LoadRecord } from "@/lib/api/hooks";

const STATUS_CFG: Record<
  LoadRecord["status"],
  { label: string; badge: string; dot: string }
> = {
  AVAILABLE: { label: "Available", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
  MATCHED: { label: "Matched", badge: "bg-blue-500/15 text-blue-400 border-blue-500/20", dot: "bg-blue-400 animate-pulse" },
  BOOKED: { label: "Booked", badge: "bg-violet-500/15 text-violet-400 border-violet-500/20", dot: "bg-violet-400" },
  COMPLETED: { label: "Completed", badge: "bg-slate-700/50 text-slate-400 border-slate-600/20", dot: "bg-slate-500" },
  CANCELLED: { label: "Cancelled", badge: "bg-rose-500/15 text-rose-400 border-rose-500/20", dot: "bg-rose-400" },
};

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-800/50 animate-pulse">
      {Array(7).fill(0).map((_, index) => (
        <td key={index} className="px-5 py-4">
          <div className={`h-3 bg-slate-800 rounded-full ${index === 0 ? "w-32" : index === 6 ? "w-24" : "w-20"}`} />
        </td>
      ))}
    </tr>
  );
}

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

export default function MyLoadsPage() {
  const { data, isLoading, isError, refetch } = useMyLoads();
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [search, setSearch] = useState("");
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const { data: matchData, isLoading: matchesLoading } = useLoadTruckMatches(selectedLoadId);

  const loads = data ?? [];
  const filtered = loads.filter((load) => {
    const matchStatus = filter === "ALL" || load.status === filter;
    const matchSearch =
      !search ||
      load.originName.toLowerCase().includes(search.toLowerCase()) ||
      load.destinationName.toLowerCase().includes(search.toLowerCase()) ||
      load.id.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const counts: Record<FilterStatus, number> = {
    ALL: loads.length,
    AVAILABLE: loads.filter((load) => load.status === "AVAILABLE").length,
    MATCHED: loads.filter((load) => load.status === "MATCHED").length,
    BOOKED: loads.filter((load) => load.status === "BOOKED").length,
    COMPLETED: loads.filter((load) => load.status === "COMPLETED").length,
    CANCELLED: loads.filter((load) => load.status === "CANCELLED").length,
  };

  const totalEarned = loads
    .filter((load) => load.status === "COMPLETED")
    .reduce((sum, load) => sum + load.payoutInr, 0);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">My Loads</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Read-only load visibility from Spring Boot with live match lookup.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isLoading && (
              <div className="hidden md:flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2">
                <div>
                  <p className="text-xs text-slate-600">Total Loads</p>
                  <p className="text-sm font-black text-white">{loads.length}</p>
                </div>
                <div className="w-px h-8 bg-slate-800" />
                <div>
                  <p className="text-xs text-slate-600">Completed Earnings</p>
                  <p className="text-sm font-black text-emerald-400">
                    Rs {totalEarned.toLocaleString("en-IN")}
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

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search by city or load ID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors"
          />
          <div className="flex gap-2 flex-wrap">
            {(["ALL", "AVAILABLE", "MATCHED", "BOOKED", "COMPLETED", "CANCELLED"] as FilterStatus[]).map((status) => (
              <FilterPill
                key={status}
                label={status === "ALL" ? "All" : STATUS_CFG[status as LoadRecord["status"]].label}
                active={filter === status}
                count={counts[status]}
                onClick={() => setFilter(status)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isError ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-600">
            <span className="text-4xl">!</span>
            <p className="text-sm">Failed to load shipper loads.</p>
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
                {["Route", "Pickup Time", "Capacity", "Payout (Rs)", "Posted", "Status", "Matches"].map((header) => (
                  <th
                    key={header}
                    className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array(8).fill(0).map((_, index) => <SkeletonRow key={index} />)}

              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-20 text-slate-600">
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-4xl opacity-40">[]</span>
                      <p className="text-sm">No loads match your filter.</p>
                      <Link
                        href="/loads/create"
                        className="text-xs text-emerald-400 hover:text-emerald-300 underline"
                      >
                        Post your first load
                      </Link>
                    </div>
                  </td>
                </tr>
              )}

              <AnimatePresence>
                {!isLoading && filtered.map((load, index) => {
                  const cfg = STATUS_CFG[load.status];
                  const isExpanded = selectedLoadId === load.id;

                  return (
                    <Fragment key={load.id}>
                      <motion.tr
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.025 }}
                        className="border-b border-slate-800/40 hover:bg-slate-900/40 transition-colors"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-white">
                            {load.originName}
                            <span className="text-slate-600 mx-1.5 font-normal">{"->"}</span>
                            {load.destinationName}
                          </p>
                          <p className="text-xs text-slate-600 font-mono mt-0.5">
                            {load.id.slice(0, 8)}...
                          </p>
                        </td>
                        <td className="px-5 py-4 text-slate-300 text-xs">
                          {new Date(load.pickupTime).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="px-5 py-4 text-slate-300">{load.requiredCapacity}T</td>
                        <td className="px-5 py-4">
                          <span className="text-emerald-400 font-bold">
                            Rs {load.payoutInr.toLocaleString("en-IN")}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-500 text-xs">
                          {new Date(load.createdAt).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.badge}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => setSelectedLoadId(isExpanded ? null : load.id)}
                            className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-900 transition-colors"
                          >
                            {isExpanded ? "Hide Matches" : "View Matches"}
                          </button>
                        </td>
                      </motion.tr>

                      {isExpanded && (
                        <motion.tr
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="border-b border-slate-800/40 bg-slate-950/70"
                        >
                          <td colSpan={7} className="px-5 py-4">
                            {matchesLoading ? (
                              <div className="text-xs text-slate-500 animate-pulse">Loading matches...</div>
                            ) : !matchData?.matches?.length ? (
                              <div className="text-xs text-slate-500">No matched trucks available yet for this load.</div>
                            ) : (
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {matchData.matches.map((match) => (
                                  <div
                                    key={`${load.id}-${match.truck_id}`}
                                    className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"
                                  >
                                    <p className="text-xs text-slate-500 mb-1">Truck ID</p>
                                    <p className="font-mono text-sm font-semibold text-emerald-300">{match.truck_id}</p>
                                    <div className="mt-3 flex items-center justify-between text-xs">
                                      <span className="text-slate-500">Deadhead</span>
                                      <span className="text-slate-200">{match.deadhead_km.toFixed(1)} km</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-xs">
                                      <span className="text-slate-500">Score</span>
                                      <span className="text-amber-300">{match.confidence_score.toFixed(2)}</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-xs">
                                      <span className="text-slate-500">Payout</span>
                                      <span className="text-emerald-400 font-semibold">
                                        Rs {match.payout_inr.toLocaleString("en-IN")}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </motion.tr>
                      )}
                    </Fragment>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {!isLoading && filtered.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex-shrink-0">
          <p className="text-xs text-slate-600">
            Showing <span className="text-slate-400 font-semibold">{filtered.length}</span> of{" "}
            <span className="text-slate-400 font-semibold">{loads.length}</span> loads
          </p>
        </div>
      )}
    </div>
  );
}
