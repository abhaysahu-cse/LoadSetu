"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/store";

// ─── Rate Limit Banner ────────────────────────────────────────────────────────

export function RateLimitBanner() {
  const { rateLimit } = useUIStore();

  return (
    <AnimatePresence>
      {rateLimit.active && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-6 py-3 flex items-center justify-between text-sm font-semibold"
        >
          <div className="flex items-center gap-3">
            <span className="text-base">⚠️</span>
            <span>
              Too many requests to{" "}
              <code className="font-mono bg-amber-600/30 px-1.5 py-0.5 rounded text-xs">
                {rateLimit.endpoint ?? "API"}
              </code>
              . Button disabled temporarily.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-950/70 text-xs font-normal">Retry in</span>
            <span className="text-xl font-black tabular-nums">
              {rateLimit.retryAfterSeconds}s
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

const TOAST_CONFIG = {
  success: {
    icon: "✓",
    bg: "bg-emerald-900/90 border-emerald-700/50",
    text: "text-emerald-100",
    icon_cls: "text-emerald-400",
  },
  error: {
    icon: "✕",
    bg: "bg-rose-950/95 border-rose-800/50",
    text: "text-rose-100",
    icon_cls: "text-rose-400",
  },
  info: {
    icon: "ℹ",
    bg: "bg-slate-800/95 border-slate-700/50",
    text: "text-slate-100",
    icon_cls: "text-blue-400",
  },
};

function Toast({
  id,
  message,
  type,
}: {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}) {
  const { removeToast } = useUIStore();
  const cfg = TOAST_CONFIG[type];

  useEffect(() => {
    const t = setTimeout(() => removeToast(id), 5000);
    return () => clearTimeout(t);
  }, [id, removeToast]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl border backdrop-blur-sm shadow-xl max-w-sm ${cfg.bg}`}
    >
      <span className={`text-sm font-bold flex-shrink-0 mt-0.5 ${cfg.icon_cls}`}>
        {cfg.icon}
      </span>
      <p className={`text-sm leading-snug flex-1 ${cfg.text}`}>{message}</p>
      <button
        onClick={() => removeToast(id)}
        className="text-slate-600 hover:text-white text-xs flex-shrink-0 mt-0.5 transition-colors"
      >
        ✕
      </button>
    </motion.div>
  );
}

export function ToastContainer() {
  const { toasts } = useUIStore();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end">
      <AnimatePresence mode="sync">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
