"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useCreateLoad } from "@/lib/api/hooks";
import { useUIStore } from "@/store";

// ─── City coordinate lookup (common freight corridors) ───────────────────────

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "Mumbai":    { lat: 19.0760, lng: 72.8777 },
  "Delhi":     { lat: 28.6139, lng: 77.2090 },
  "Bangalore": { lat: 12.9716, lng: 77.5946 },
  "Chennai":   { lat: 13.0827, lng: 80.2707 },
  "Kolkata":   { lat: 22.5726, lng: 88.3639 },
  "Hyderabad": { lat: 17.3850, lng: 78.4867 },
  "Pune":      { lat: 18.5204, lng: 73.8567 },
  "Ahmedabad": { lat: 23.0225, lng: 72.5714 },
  "Surat":     { lat: 21.1702, lng: 72.8311 },
  "Bhopal":    { lat: 23.2599, lng: 77.4126 },
  "Jaipur":    { lat: 26.9124, lng: 75.7873 },
  "Lucknow":   { lat: 26.8467, lng: 80.9462 },
  "Nagpur":    { lat: 21.1458, lng: 79.0882 },
  "Indore":    { lat: 22.7196, lng: 75.8577 },
  "Coimbatore":{ lat: 11.0168, lng: 76.9558 },
  "Kochi":     { lat: 9.9312,  lng: 76.2673 },
  "Chandigarh":{ lat: 30.7333, lng: 76.7794 },
  "Jabalpur":  { lat: 23.1815, lng: 79.9864 },
  "Vadodara":  { lat: 22.3072, lng: 73.1812 },
  "Ludhiana":  { lat: 30.9010, lng: 75.8573 },
};

const CITY_LIST = Object.keys(CITY_COORDS).sort();

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        {label}
        {required && <span className="text-rose-400 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-600 mt-1.5">{hint}</p>}
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-slate-900 border border-slate-700 focus:border-emerald-500/70 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm outline-none transition-colors";

const selectCls =
  "w-full bg-slate-900 border border-slate-700 focus:border-emerald-500/70 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors appearance-none cursor-pointer";

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreateLoadPage() {
  const router = useRouter();
  const createLoad = useCreateLoad();
  const { addToast, lastRequestId } = useUIStore();

  const [form, setForm] = useState({
    originName: "",
    destinationName: "",
    requiredCapacity: "",
    payoutInr: "",
    pickupTime: "",
    notes: "",
  });

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  function getCoords(city: string) {
    return CITY_COORDS[city] ?? { lat: 0, lng: 0 };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const originCoords = getCoords(form.originName);
    const destCoords   = getCoords(form.destinationName);

    if (!originCoords.lat || !destCoords.lat) {
      addToast("Select cities from the dropdown list", "error");
      return;
    }
    if (form.originName === form.destinationName) {
      addToast("Origin and destination must be different", "error");
      return;
    }

    try {
      const response = await createLoad.mutateAsync({
        originName:        form.originName,
        originLat:         originCoords.lat,
        originLng:         originCoords.lng,
        destinationName:   form.destinationName,
        destLat:           destCoords.lat,
        destLng:           destCoords.lng,
        requiredCapacity:  parseFloat(form.requiredCapacity),
        payoutInr:         parseFloat(form.payoutInr),
        pickupTime:        new Date(form.pickupTime).toISOString(),
        notes:             form.notes || undefined,
      });
      addToast(`Load posted successfully. Load ID: ${response.loadId.slice(0, 8)}`, "success");
      router.push("/loads");
    } catch {
      // interceptor shows toast with X-Request-ID automatically
    }
  }

  const isPending = createLoad.isPending;

  return (
    <div className="h-full overflow-auto p-6 md:p-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs font-bold tracking-[0.2em] text-emerald-400 uppercase mb-2">
            Load Management
          </p>
          <h1 className="text-2xl font-black text-white tracking-tight mb-1">
            Post a New Load
          </h1>
          <p className="text-sm text-slate-500 mb-8">
            The AI matching engine will begin pairing your load with verified drivers
            the moment you submit.
          </p>
        </motion.div>

        {/* Form card */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6"
        >
          {/* ── Route ── */}
          <div>
            <p className="text-xs font-bold tracking-[0.15em] text-slate-500 uppercase mb-4">
              Route
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Origin City" required>
                <select
                  value={form.originName}
                  onChange={set("originName")}
                  required
                  className={selectCls}
                >
                  <option value="">Select origin…</option>
                  {CITY_LIST.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Destination City" required>
                <select
                  value={form.destinationName}
                  onChange={set("destinationName")}
                  required
                  className={selectCls}
                >
                  <option value="">Select destination…</option>
                  {CITY_LIST.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Route preview pill */}
            {form.originName && form.destinationName && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-3 flex items-center gap-2 bg-slate-800/60 rounded-xl px-4 py-2.5"
              >
                <span className="text-sm text-white font-semibold">{form.originName}</span>
                <span className="text-slate-600">→</span>
                <span className="text-sm text-white font-semibold">{form.destinationName}</span>
                {form.originName !== form.destinationName && (
                  <span className="ml-auto text-xs text-emerald-400 font-semibold">
                    Route valid ✓
                  </span>
                )}
                {form.originName === form.destinationName && (
                  <span className="ml-auto text-xs text-rose-400 font-semibold">
                    Same city ✗
                  </span>
                )}
              </motion.div>
            )}
          </div>

          <div className="h-px bg-slate-800" />

          {/* ── Load details ── */}
          <div>
            <p className="text-xs font-bold tracking-[0.15em] text-slate-500 uppercase mb-4">
              Load Details
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Capacity Required (Tons)"
                required
                hint="0.1 – 40 tons"
              >
                <input
                  type="number"
                  min="0.1"
                  max="40"
                  step="0.5"
                  placeholder="10"
                  value={form.requiredCapacity}
                  onChange={set("requiredCapacity")}
                  required
                  className={inputCls}
                />
              </Field>
              <Field
                label="Payout (₹)"
                required
                hint="Amount you'll pay the driver"
              >
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="500"
                    step="100"
                    placeholder="15000"
                    value={form.payoutInr}
                    onChange={set("payoutInr")}
                    required
                    className={`${inputCls} pl-8`}
                  />
                </div>
              </Field>
            </div>
          </div>

          <div className="h-px bg-slate-800" />

          {/* ── Timing ── */}
          <div>
            <p className="text-xs font-bold tracking-[0.15em] text-slate-500 uppercase mb-4">
              Timing
            </p>
            <Field label="Pickup Date & Time" required hint="When the truck must be at origin">
              <input
                type="datetime-local"
                value={form.pickupTime}
                onChange={set("pickupTime")}
                required
                min={new Date().toISOString().slice(0, 16)}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="h-px bg-slate-800" />

          {/* ── Notes ── */}
          <Field label="Additional Notes" hint="Loading instructions, special cargo info, etc.">
            <textarea
              rows={3}
              placeholder="e.g. Refrigerated cargo, loading dock on south side…"
              value={form.notes}
              onChange={set("notes")}
              className={`${inputCls} resize-none`}
            />
          </Field>

          {/* ── Submit ── */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-white transition-all"
            >
              Cancel
            </button>
            <motion.button
              type="submit"
              disabled={isPending}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Posting load…
                </>
              ) : (
                "Post Load & Start Matching →"
              )}
            </motion.button>
          </div>

          {/* Correlation ID hint — per "Correlation Rule" */}
          {createLoad.isError && lastRequestId && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-slate-600 text-center"
            >
              Upload failed · Error ID:{" "}
              <code className="font-mono text-rose-400">{lastRequestId}</code>
            </motion.p>
          )}
        </motion.form>
      </div>
    </div>
  );
}
