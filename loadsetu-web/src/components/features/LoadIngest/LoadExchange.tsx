"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useFleetTrucks,
  useLoadMatches,
  useBookLoad,
  type MatchRequest,
} from "@/lib/api/hooks";
import { useFleetStore, useUIStore, useAuthStore } from "@/store";
import { createLocale } from "@/lib/localization/dictionary";
import type { Truck, LoadMatch } from "@/store";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Truck["status"] }) {
  const map = {
    EMPTY: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    IN_TRANSIT: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    IDLE: "bg-slate-700/50 text-slate-500 border-slate-600/20",
    OFFLINE: "bg-slate-900 text-slate-600 border-slate-800",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${map[status]}`}>
      {status}
    </span>
  );
}

// ─── Skeleton cards ───────────────────────────────────────────────────────────

function SkeletonTruckRow() {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-slate-800/60 animate-pulse">
      <div className="w-9 h-9 rounded-xl bg-slate-800 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="w-28 h-3 bg-slate-800 rounded-full" />
        <div className="w-20 h-2.5 bg-slate-800 rounded-full" />
      </div>
      <div className="w-14 h-5 bg-slate-800 rounded-lg" />
    </div>
  );
}

function SkeletonMatchCard() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 animate-pulse space-y-3">
      <div className="flex justify-between">
        <div className="w-36 h-4 bg-slate-800 rounded-full" />
        <div className="w-16 h-4 bg-slate-800 rounded-full" />
      </div>
      <div className="w-24 h-8 bg-slate-800 rounded-xl" />
      <div className="w-full h-10 bg-slate-800 rounded-xl" />
    </div>
  );
}

// ─── Empty Truck Queue Item ───────────────────────────────────────────────────

function TruckQueueItem({
  truck,
  isSelected,
  onClick,
}: {
  truck: Truck;
  isSelected: boolean;
  onClick: () => void;
}) {
  const emptyMinutes = Math.floor(
    (Date.now() - new Date(truck.lastUpdated).getTime()) / 60000
  );

  return (
    <motion.div
      layout
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all border-b border-slate-800/50 ${
        isSelected
          ? "bg-slate-800/80 border-l-2 border-l-emerald-500"
          : "hover:bg-slate-900/50"
      }`}
    >
      <div className="relative w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-base flex-shrink-0">
        🚛
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-950 animate-pulse" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{truck.driverName}</p>
        <p className="text-xs text-slate-500 truncate">{truck.capacityTons}T · {truck.plateNumber}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-rose-400 font-semibold">
          {emptyMinutes > 60
            ? `${Math.floor(emptyMinutes / 60)}h empty`
            : `${emptyMinutes}m empty`}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Match Card (Order Book Entry) ───────────────────────────────────────────

function MatchCard({
  match,
  truck,
  onBooked,
}: {
  match: LoadMatch;
  truck: Truck;
  onBooked: (loadId: string) => void;
}) {
  const bookLoad = useBookLoad();
  const { addToast } = useUIStore();
  const { detectedLanguage } = useAuthStore();
  const { t } = createLocale(detectedLanguage);
  const [isBooked, setIsBooked] = useState(false);

  const confidencePct = Math.round(match.confidenceScore * 100);
  const isPending = bookLoad.isPending;

  async function handleBook() {
    try {
      await bookLoad.mutateAsync({
        truck_id: truck.id,
        load_id: match.loadId,
        agreed_payout: match.payoutInr,
      });
      setIsBooked(true);
      addToast(t("booking_confirmed"), "success");
      setTimeout(() => onBooked(match.loadId), 600);
    } catch {
      // handled by interceptor
    }
  }

  return (
    <AnimatePresence>
      {!isBooked && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: 80, scale: 0.95 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5 hover:border-slate-600/80 transition-colors group"
        >
          {/* Route header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-white truncate">{match.origin}</span>
              <span className="text-slate-600 text-sm">→</span>
              <span className="text-sm font-bold text-white truncate">{match.destination}</span>
            </div>
            {/* Confidence badge */}
            <div
              className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                confidencePct >= 80
                  ? "bg-emerald-500/15 text-emerald-400"
                  : confidencePct >= 50
                  ? "bg-amber-500/15 text-amber-400"
                  : "bg-slate-700 text-slate-400"
              }`}
            >
              {confidencePct}% match
            </div>
          </div>

          {/* Capacity */}
          <p className="text-xs text-slate-500 mb-4">
            {match.requiredCapacity}T required ·{" "}
            {match.pickupTime
              ? new Date(match.pickupTime).toLocaleString("en-IN", {
                  dateStyle: "short",
                  timeStyle: "short",
                })
              : "Flexible pickup"}
          </p>

          {/* Financials */}
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Payout</p>
              <p className="text-3xl font-black text-emerald-400 leading-none tracking-tight">
                ₹{match.payoutInr.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-0.5">Deadhead</p>
              <p className="text-xl font-black text-rose-400 leading-none">
                {match.deadheadKm.toFixed(1)} km
              </p>
            </div>
          </div>

          {/* Net after deadhead estimate */}
          <div className="flex items-center justify-between text-xs text-slate-500 mb-4 bg-slate-800/40 rounded-xl px-3 py-2">
            <span>Est. fuel cost for deadhead</span>
            <span className="text-rose-400 font-semibold">
              −₹{Math.round(match.deadheadKm * 18).toLocaleString("en-IN")}
            </span>
          </div>

          {/* Book button */}
          <motion.button
            onClick={handleBook}
            disabled={isPending}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.97 }}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Booking…
              </>
            ) : (
              <>⚡ {t("book_load")}</>
            )}
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyOrderBook({ hasTruck }: { hasTruck: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-600 p-12">
      <span className="text-5xl opacity-40">📦</span>
      {hasTruck ? (
        <>
          <p className="text-sm font-semibold text-slate-500">
            Scanning for loads…
          </p>
          <p className="text-xs text-center max-w-48">
            VahanSync is searching the 50km radius. Results appear here.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-slate-500">
            Select an empty truck
          </p>
          <p className="text-xs text-center max-w-48">
            Choose a truck from the queue on the left to see matched loads.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LoadExchange() {
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [bookedIds, setBookedIds] = useState<Set<string>>(new Set());
  const { detectedLanguage } = useAuthStore();
  const { t } = createLocale(detectedLanguage);

  const { data: trucksData, isLoading: trucksLoading } = useFleetTrucks();
  const { setSelectedTruck } = useFleetStore();

  // Only show EMPTY trucks, sorted oldest first (bleeding longest)
  const emptyTrucks = (trucksData ?? [])
    .filter((t) => t.status === "EMPTY")
    .sort(
      (a, b) =>
        new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime()
    );

  const selectedTruck =
    emptyTrucks.find((t) => t.id === selectedTruckId) ?? null;

  const matchReq: MatchRequest | null = selectedTruck
    ? {
        truck_id: selectedTruck.id,
        current_location_lat: selectedTruck.currentLocationLat,
        current_location_lng: selectedTruck.currentLocationLng,
        empty_at_timestamp: selectedTruck.lastUpdated,
        capacity_tons: selectedTruck.capacityTons,
      }
    : null;

  const { data: matchData, isLoading: matchLoading } = useLoadMatches(matchReq);

  const visibleMatches = (matchData?.matches ?? []).filter(
    (m) => !bookedIds.has(m.loadId)
  );

  function onSelectTruck(truck: Truck) {
    setSelectedTruckId(truck.id);
    setSelectedTruck(truck);
  }

  function onBooked(loadId: string) {
    setBookedIds((prev) => new Set([...prev, loadId]));
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── LEFT: Empty Truck Queue ── */}
      <div className="w-72 flex-shrink-0 border-r border-slate-800 flex flex-col bg-slate-950">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-base font-bold text-white">Empty Trucks</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sorted by idle time — longest first
          </p>
        </div>

        <div className="flex-1 overflow-auto">
          {trucksLoading ? (
            Array(5).fill(0).map((_, i) => <SkeletonTruckRow key={i} />)
          ) : emptyTrucks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600 p-8">
              <span className="text-3xl opacity-40">✅</span>
              <p className="text-xs text-center">All trucks are loaded or in transit</p>
            </div>
          ) : (
            emptyTrucks.map((truck) => (
              <TruckQueueItem
                key={truck.id}
                truck={truck}
                isSelected={selectedTruckId === truck.id}
                onClick={() => onSelectTruck(truck)}
              />
            ))
          )}
        </div>

        {/* Queue footer */}
        <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/40">
          <p className="text-xs text-slate-600">
            <span className="text-amber-400 font-semibold">{emptyTrucks.length}</span>
            {" "}truck{emptyTrucks.length !== 1 ? "s" : ""} bleeding money
          </p>
        </div>
      </div>

      {/* ── RIGHT: Order Book ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white">
              {selectedTruck
                ? `Loads for ${selectedTruck.driverName}`
                : "Load Order Book"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedTruck
                ? `${selectedTruck.capacityTons}T · 50km radius · sorted by profit`
                : t("help_how_to_match")}
            </p>
          </div>

          {/* Live indicator */}
          {selectedTruck && (
            <div className="flex items-center gap-2">
              {matchLoading ? (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="w-3 h-3 border border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  {t("finding_loads")}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {visibleMatches.length} loads available
                </div>
              )}
            </div>
          )}
        </div>

        {/* Match cards grid */}
        <div className="flex-1 overflow-auto p-5">
          {matchLoading && selectedTruck ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array(6).fill(0).map((_, i) => <SkeletonMatchCard key={i} />)}
            </div>
          ) : visibleMatches.length > 0 && selectedTruck ? (
            <motion.div
              layout
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              <AnimatePresence>
                {visibleMatches.map((match) => (
                  <MatchCard
                    key={match.loadId}
                    match={match}
                    truck={selectedTruck}
                    onBooked={onBooked}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <EmptyOrderBook hasTruck={!!selectedTruck} />
          )}
        </div>
      </div>
    </div>
  );
}
