"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import {
  useBulkIngestDryRun,
  useBulkIngestConfirm,
  useMe,
  type BulkLoadRow,
  type BulkLoadRequestItem,
} from "@/lib/api/hooks";
import { useUIStore } from "@/store";

// ─── Column Map ───────────────────────────────────────────────────────────────

const REQUIRED_COLUMNS = [
  "origin_name",
  "destination_name",
  "required_capacity",
  "payout_inr",
  "pickup_time",
] as const;

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  mumbai: { lat: 19.076, lng: 72.8777 },
  delhi: { lat: 28.6139, lng: 77.209 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  pune: { lat: 18.5204, lng: 73.8567 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  surat: { lat: 21.1702, lng: 72.8311 },
  bhopal: { lat: 23.2599, lng: 77.4126 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  nagpur: { lat: 21.1458, lng: 79.0882 },
  indore: { lat: 22.7196, lng: 75.8577 },
  coimbatore: { lat: 11.0168, lng: 76.9558 },
  kochi: { lat: 9.9312, lng: 76.2673 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  jabalpur: { lat: 23.1815, lng: 79.9864 },
  vadodara: { lat: 22.3072, lng: 73.1812 },
  ludhiana: { lat: 30.901, lng: 75.8573 },
};

// ─── Parse helper ─────────────────────────────────────────────────────────────

function parseRows(rawRows: Record<string, unknown>[]): BulkLoadRow[] {
  return rawRows.map((raw, i) => {
    const errors: string[] = [];
    const origin = String(raw["origin_name"] ?? "").trim();
    const destination = String(raw["destination_name"] ?? "").trim();
    const capacity = parseFloat(String(raw["required_capacity"] ?? "NaN"));
    const payout = parseFloat(String(raw["payout_inr"] ?? "NaN"));
    const pickupTime = String(raw["pickup_time"] ?? "").trim();

    if (!origin) errors.push("Origin city missing");
    if (!destination) errors.push("Destination city missing");
    if (isNaN(capacity) || capacity <= 0 || capacity > 50)
      errors.push("Capacity must be 0.1–50 tons");
    if (isNaN(payout) || payout <= 0) errors.push("Invalid payout (₹)");
    if (!pickupTime) errors.push("Pickup time missing");

    return {
      rowNum: i + 2, // spreadsheet row = data row + 2 (1-indexed + header)
      originName: origin,
      destinationName: destination,
      requiredCapacity: capacity,
      payoutInr: payout,
      pickupTime,
      valid: errors.length === 0,
      errors,
    };
  });
}

function getCoords(city: string): { lat: number; lng: number } | null {
  return CITY_COORDS[city.trim().toLowerCase()] ?? null;
}

function toBulkLoadRequestItems(rows: BulkLoadRow[], shipperId: string): BulkLoadRequestItem[] {
  return rows.map((row) => {
    const origin = getCoords(row.originName);
    const destination = getCoords(row.destinationName);
    if (!origin || !destination) {
      throw new Error(`Unknown city in bulk upload: ${row.originName} -> ${row.destinationName}`);
    }

    const pickupDate = new Date(row.pickupTime);
    if (Number.isNaN(pickupDate.getTime())) {
      throw new Error(`Invalid pickup time on row ${row.rowNum}`);
    }

    return {
      originCity: row.originName,
      originLat: origin.lat,
      originLng: origin.lng,
      destinationCity: row.destinationName,
      destinationLat: destination.lat,
      destinationLng: destination.lng,
      requiredCapacity: row.requiredCapacity,
      payoutInr: row.payoutInr,
      pickupTime: pickupDate.toISOString(),
      pickupDate: pickupDate.toISOString().slice(0, 10),
      shipperId,
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

type Stage = "idle" | "preview" | "dryrun" | "confirm" | "done";

export default function BulkIngest() {
  const [stage, setStage] = useState<Stage>("idle");
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<BulkLoadRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dryRun = useBulkIngestDryRun();
  const confirm = useBulkIngestConfirm();
  const { data: me } = useMe();
  const { addToast } = useUIStore();

  const validRows = rows.filter((r) => r.valid);
  const invalidRows = rows.filter((r) => !r.valid);

  // ── File processing ──────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        const parsed = parseRows(rawRows);
        setRows(parsed);
        setStage("preview");
      } catch {
        addToast("Could not parse file — check it's Excel or CSV format", "error");
      }
    };
    reader.readAsArrayBuffer(file);
  }, [addToast]);

  // ── Drag handlers ────────────────────────────────────────────

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  // ── Dry run → confirm flow ────────────────────────────────────

  async function handleDryRun() {
    setStage("dryrun");
    try {
      const result = await dryRun.mutateAsync(rows);
      setRows(result.rows);
      setStage("confirm");
    } catch {
      setStage("preview");
    }
  }

  async function handleConfirm() {
    if (!me?.userId) {
      addToast("User profile not ready. Please reload and try again.", "error");
      return;
    }

    try {
      const result = await confirm.mutateAsync({
        loads: toBulkLoadRequestItems(validRows, me.userId),
      });
      addToast(
        `✅ ${result.accepted} loads uploaded, ${result.rejected} rejected`,
        "success"
      );
      setStage("done");
    } catch {
      // error handled by interceptor
    }
  }

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Bulk Load Ingest</h2>
        <p className="text-sm text-slate-500">
          Upload an Excel or CSV to stage multiple loads at once. Validation runs
          before any data is saved.
        </p>
      </div>

      {/* ── Upload zone ── */}
      <AnimatePresence mode="wait">
        {stage === "idle" && (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer transition-all ${
              isDragOver
                ? "border-emerald-500 bg-emerald-500/5"
                : "border-slate-700 hover:border-slate-500 bg-slate-900/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); }}
            />
            <div className="text-5xl mb-4">📂</div>
            <p className="text-white font-semibold mb-1">
              Drop Excel / CSV here
            </p>
            <p className="text-slate-500 text-sm">
              or click to browse · .xlsx, .xls, .csv supported
            </p>
            <div className="mt-6 inline-flex items-center gap-2 bg-slate-800 rounded-xl px-4 py-2 text-xs text-slate-400">
              Required columns:{" "}
              <code className="text-emerald-400">
                {REQUIRED_COLUMNS.join(", ")}
              </code>
            </div>
          </motion.div>
        )}

        {/* ── Preview & validation table ── */}
        {(stage === "preview" || stage === "confirm") && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-4 flex-1 min-h-0"
          >
            {/* Summary bar */}
            <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 bg-slate-500 rounded-full" />
                <span className="text-slate-400">{fileName}</span>
              </div>
              <div className="ml-auto flex gap-3 text-sm">
                <span className="text-emerald-400 font-semibold">
                  {validRows.length} valid
                </span>
                {invalidRows.length > 0 && (
                  <span className="text-rose-400 font-semibold">
                    {invalidRows.length} errors
                  </span>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto rounded-2xl border border-slate-800 bg-slate-900/60">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Row</th>
                    <th className="px-4 py-3 text-left">Origin</th>
                    <th className="px-4 py-3 text-left">Destination</th>
                    <th className="px-4 py-3 text-right">Capacity (T)</th>
                    <th className="px-4 py-3 text-right">Payout (₹)</th>
                    <th className="px-4 py-3 text-left">Pickup Time</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.rowNum}
                      className={`border-t border-slate-800/60 ${
                        !row.valid ? "bg-rose-950/20" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        #{row.rowNum}
                      </td>
                      <td className="px-4 py-3 text-slate-200">
                        {row.originName || <span className="text-rose-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-200">
                        {row.destinationName || (
                          <span className="text-rose-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        {isNaN(row.requiredCapacity) ? (
                          <span className="text-rose-400">?</span>
                        ) : (
                          row.requiredCapacity
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-semibold">
                        {isNaN(row.payoutInr) ? (
                          <span className="text-rose-400">?</span>
                        ) : (
                          `₹${row.payoutInr.toLocaleString("en-IN")}`
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {row.pickupTime || <span className="text-rose-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {row.valid ? (
                          <span className="text-emerald-400 text-xs font-semibold">
                            ✓ Valid
                          </span>
                        ) : (
                          <div>
                            <span className="text-rose-400 text-xs font-semibold block">
                              ✕ Error
                            </span>
                            {row.errors.map((e, i) => (
                              <span key={i} className="text-rose-500/80 text-xs block">
                                {e}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Action row */}
            <div className="flex gap-3">
              <button
                onClick={() => { setStage("idle"); setRows([]); setFileName(""); }}
                className="px-5 py-3 rounded-xl text-sm text-slate-400 border border-slate-700 hover:border-slate-500 transition-all"
              >
                ← Re-upload
              </button>
              {stage === "preview" && (
                <button
                  onClick={handleDryRun}
                  disabled={validRows.length === 0 || dryRun.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                >
                  {dryRun.isPending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Validating with backend…
                    </>
                  ) : (
                    `Validate ${validRows.length} rows with backend →`
                  )}
                </button>
              )}
              {stage === "confirm" && (
                <button
                  onClick={handleConfirm}
                  disabled={validRows.length === 0 || confirm.isPending}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                >
                  {confirm.isPending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving loads…
                    </>
                  ) : (
                    `✓ Confirm & Save ${validRows.length} loads`
                  )}
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Done state ── */}
        {stage === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center flex-1 gap-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center text-4xl"
            >
              ✅
            </motion.div>
            <h3 className="text-xl font-bold text-white">Upload Complete</h3>
            <p className="text-slate-400 text-sm">
              {validRows.length} loads are now live in the exchange.
            </p>
            <button
              onClick={() => { setStage("idle"); setRows([]); setFileName(""); }}
              className="mt-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-white font-semibold transition-all"
            >
              Upload another batch
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
