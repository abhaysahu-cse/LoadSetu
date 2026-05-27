"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { usePricingLogs, useAnalytics } from "@/lib/api/hooks";
import type { PricingLogEntry } from "@/lib/api/hooks";

function SkeletonCard() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 animate-pulse">
      <div className="w-24 h-3 bg-slate-800 rounded-full mb-3" />
      <div className="w-32 h-8 bg-slate-800 rounded-xl mb-2" />
      <div className="w-20 h-3 bg-slate-800 rounded-full" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-800/50 animate-pulse">
      {Array(6).fill(0).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="w-16 h-3 bg-slate-800 rounded-full" />
        </td>
      ))}
    </tr>
  );
}

function MetricCard({ label, value, sub, color, bg }: {
  label: string; value: string; sub: string;
  color: string; bg: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-slate-800 p-5 ${bg}`}>
      <p className="text-xs text-slate-500 font-medium mb-2">{label}</p>
      <p className={`text-2xl font-black tracking-tight ${color}`}>{value}</p>
      <p className="text-xs text-slate-600 mt-1">{sub}</p>
    </motion.div>
  );
}

function PricingRow({ entry }: { entry: PricingLogEntry }) {
  const delta = entry.acceptedPriceInr - entry.suggestedPriceInr;
  return (
    <tr className="border-b border-slate-800/40 hover:bg-slate-900/30 transition-colors">
      <td className="px-4 py-3 text-xs font-mono text-slate-500">{entry.loadId.slice(0, 8)}…</td>
      <td className="px-4 py-3 text-xs text-slate-300 font-semibold">₹{entry.suggestedPriceInr.toLocaleString("en-IN")}</td>
      <td className="px-4 py-3 text-xs font-semibold text-white">₹{entry.acceptedPriceInr.toLocaleString("en-IN")}</td>
      <td className="px-4 py-3 text-xs">
        <span className={delta >= 0 ? "text-emerald-400" : "text-rose-400"}>
          {delta >= 0 ? "+" : ""}₹{delta.toLocaleString("en-IN")}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">{entry.deadheadKm.toFixed(1)} km</td>
      <td className="px-4 py-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
          entry.accepted
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
        }`}>
          {entry.accepted ? "Accepted" : "Rejected"}
        </span>
      </td>
    </tr>
  );
}

type Range = "7d" | "30d" | "90d";

export default function AnalyticsDashboard() {
  const [range, setRange] = useState<Range>("30d");
  const { data: logs, isLoading: logsLoading } = usePricingLogs();
  const { data: kpis, isLoading: kpisLoading } = useAnalytics(range);
  const isLoading = logsLoading || kpisLoading;

  const acceptedLogs       = (logs ?? []).filter((l) => l.accepted);
  const acceptanceRate     = logs?.length ? acceptedLogs.length / logs.length : 0;
  const avgConfidence      = logs?.length ? logs.reduce((s, l) => s + l.confidenceScore, 0) / logs.length : 0;
  const totalDeadheadSaved = acceptedLogs.reduce((s, l) => s + l.deadheadKm, 0);
  const maxSuggested       = Math.max(...(logs ?? []).map((l) => l.suggestedPriceInr), 1);
  const earningsSeries     = kpis?.earningsTimeSeries.map((p) => p.earnings) ?? [];

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Analytics</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Source: <code className="text-xs text-blue-400 font-mono">PricingImpressionLog</code>
            {" · "}
            <code className="text-xs text-blue-400 font-mono">GET /api/v1/analytics/pricing</code>
          </p>
        </div>
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
          {(["7d", "30d", "90d"] as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                range === r ? "bg-slate-700 text-white" : "text-slate-500 hover:text-white"
              }`}>{r}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />) : (
          <>
            <MetricCard label="Total Earnings" value={`₹${((kpis?.totalEarnings ?? 0) / 100_000).toFixed(1)}L`} sub="across all bookings" color="text-emerald-400" bg="bg-emerald-500/8" />
            <MetricCard label="Acceptance Rate" value={`${Math.round(acceptanceRate * 100)}%`} sub={`${acceptedLogs.length} / ${logs?.length ?? 0} impressions`} color="text-blue-400" bg="bg-blue-500/8" />
            <MetricCard label="Avg AI Confidence" value={`${Math.round(avgConfidence * 100)}%`} sub="VahanSync match score" color="text-amber-400" bg="bg-amber-500/8" />
            <MetricCard label="Deadhead Recovered" value={`${Math.round(totalDeadheadSaved)} km`} sub="from accepted matches" color="text-violet-400" bg="bg-violet-500/8" />
          </>
        )}
      </div>

      {!isLoading && earningsSeries.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-sm font-semibold text-slate-300 mb-4">Earnings over time</p>
          <div className="flex items-end gap-1 h-36">
            {kpis!.earningsTimeSeries.map((pt, i) => {
              const maxVal = Math.max(...earningsSeries);
              const pct = maxVal > 0 ? (pt.earnings / maxVal) * 100 : 0;
              return (
                <motion.div key={i} title={`${pt.date}: ₹${pt.earnings.toLocaleString("en-IN")}`}
                  className="flex-1 bg-emerald-500/80 hover:bg-emerald-400 rounded-sm transition-colors cursor-default"
                  style={{ height: `${pct}%`, minHeight: 2 }}
                  initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                  transition={{ delay: i * 0.018, duration: 0.4 }} />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-slate-600 mt-2">
            <span>{kpis!.earningsTimeSeries[0]?.date}</span>
            <span>{kpis!.earningsTimeSeries.at(-1)?.date}</span>
          </div>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-300">Pricing Impression Log</p>
          <p className="text-xs text-slate-600 font-mono">GET /api/v1/analytics/pricing</p>
        </div>
        <div className="overflow-auto max-h-80">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-950">
              <tr>
                {["Load ID", "AI Suggested", "Accepted", "Delta", "Deadhead", "Outcome"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logsLoading ? Array(6).fill(0).map((_, i) => <SkeletonRow key={i} />) :
                (logs ?? []).slice(0, 50).map((entry) => (
                  <PricingRow key={entry.id} entry={entry} />
                ))
              }
            </tbody>
          </table>
        </div>
        {!logsLoading && (logs?.length ?? 0) === 0 && (
          <div className="text-center py-12 text-slate-600 text-sm">No pricing impressions yet</div>
        )}
      </div>

      {!isLoading && (kpis?.topRoutes?.length ?? 0) > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-sm font-semibold text-slate-300 mb-4">Top Routes by Volume</p>
          <div className="space-y-3">
            {kpis!.topRoutes.slice(0, 6).map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-44 text-sm text-slate-300 truncate">{r.origin} → {r.destination}</div>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }}
                    animate={{ width: `${(r.count / kpis!.topRoutes[0].count) * 100}%` }}
                    transition={{ duration: 0.7, delay: i * 0.05, ease: "easeOut" }}
                    className="h-full bg-emerald-500 rounded-full" />
                </div>
                <div className="w-16 text-right text-xs text-slate-400">{r.count} trips</div>
                <div className="w-24 text-right text-xs text-emerald-400 font-semibold">₹{Math.round(r.avgPayout / 1000)}k avg</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
