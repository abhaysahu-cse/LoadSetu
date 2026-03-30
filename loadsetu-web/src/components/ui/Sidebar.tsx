"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore, useAuthStore } from "@/store";

// ─── Nav definitions per role ─────────────────────────────────────────────────

const FLEET_OWNER_NAV = [
  { href: "/map",      icon: "🗺️", label: "God View",      section: null },
  { href: "/exchange", icon: "💱", label: "Load Exchange",  section: "Fleet Ops" },
  { href: "/fleet",    icon: "🚛", label: "Fleet Manager",  section: null },
  { href: "/ingest",   icon: "📦", label: "Bulk Ingest",    section: null },
  { href: "/analytics",icon: "📈", label: "ROI Analytics",  section: "Insights" },
];

const SHIPPER_NAV = [
  { href: "/map",         icon: "🗺️", label: "Live Map",       section: null },
  { href: "/loads/create",icon: "➕", label: "Post a Load",     section: "Load Management" },
  { href: "/loads",       icon: "📋", label: "My Loads",        section: null },
  { href: "/ingest",      icon: "📦", label: "Bulk Upload",     section: null },
  { href: "/analytics",   icon: "📈", label: "Market Insights", section: "Insights" },
];

const ADMIN_NAV = [
  { href: "/map",         icon: "🗺️", label: "God View",      section: null },
  { href: "/exchange",    icon: "💱", label: "Load Exchange",  section: "Ops" },
  { href: "/fleet",       icon: "🚛", label: "Fleet Manager",  section: null },
  { href: "/loads",       icon: "📋", label: "All Loads",      section: null },
  { href: "/ingest",      icon: "📦", label: "Bulk Ingest",    section: null },
  { href: "/analytics",   icon: "📈", label: "Analytics",      section: "Insights" },
];

const STATUS_CONFIG = {
  CONNECTED: { color: "bg-emerald-400",             label: "Live" },
  DEGRADED:  { color: "bg-amber-400 animate-pulse", label: "Degraded" },
  OFFLINE:   { color: "bg-rose-500",                label: "Offline" },
};

export default function Sidebar() {
  const pathname  = usePathname();
  const { sidebarCollapsed, toggleSidebar, platformStatus, lastRequestId } = useUIStore();
  const { fleetName, userRole, clearAuth } = useAuthStore();
  const statusCfg = STATUS_CONFIG[platformStatus];

  // Pick nav list based on the role returned by /api/v1/users/me
  const navItems =
    userRole === "SHIPPER"
      ? SHIPPER_NAV
      : userRole === "ADMIN"
      ? ADMIN_NAV
      : FLEET_OWNER_NAV;

  // Role badge colours
  const roleBadge =
    userRole === "SHIPPER"
      ? "text-blue-400"
      : userRole === "ADMIN"
      ? "text-violet-400"
      : "text-emerald-400";

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 60 : 220 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="flex-shrink-0 h-full bg-slate-950 border-r border-slate-800 flex flex-col overflow-hidden"
    >
      {/* ── Logo + toggle ── */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-slate-800">
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 min-w-0"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-sm flex-shrink-0">
                🚛
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-white tracking-tight truncate">
                  LoadSetu
                </p>
                <p className={`text-xs truncate font-semibold ${roleBadge}`}>
                  {userRole === "SHIPPER"
                    ? "Shipper"
                    : userRole === "ADMIN"
                    ? "Admin"
                    : fleetName ?? "Fleet Owner"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={toggleSidebar}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 transition-all flex-shrink-0"
        >
          {sidebarCollapsed ? "›" : "‹"}
        </button>
      </div>

      {/* ── Platform status + Correlation ID ── */}
      <div className="px-3 py-2 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusCfg.color}`} />
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-slate-500 truncate"
            >
              {statusCfg.label}
            </motion.span>
          )}
        </div>
        {/* Correlation ID display — per "Correlation Rule" spec */}
        {!sidebarCollapsed && lastRequestId && (
          <p
            className="text-[10px] font-mono text-slate-700 truncate mt-0.5 cursor-pointer hover:text-slate-500 transition-colors"
            title={`Last X-Request-ID: ${lastRequestId}`}
            onClick={() => navigator.clipboard?.writeText(lastRequestId)}
          >
            {lastRequestId.slice(0, 18)}…
          </p>
        )}
      </div>

      {/* ── Nav items ── */}
      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-hidden">
        {navItems.map((item, idx) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href + "/"));

          // Section label between groups
          const prevSection = idx > 0 ? navItems[idx - 1].section : undefined;
          const showSectionLabel =
            !sidebarCollapsed &&
            item.section &&
            item.section !== prevSection;

          return (
            <div key={item.href}>
              {showSectionLabel && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-700 px-2 pt-3 pb-1">
                  {item.section}
                </p>
              )}
              <Link href={item.href}>
                <div
                  className={`flex items-center gap-3 rounded-xl px-2 py-2.5 transition-all cursor-pointer ${
                    active
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:text-white hover:bg-slate-900"
                  }`}
                >
                  <span className="text-base flex-shrink-0">{item.icon}</span>
                  <AnimatePresence>
                    {!sidebarCollapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-sm font-medium truncate"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {active && (
                    <motion.div
                      layoutId="active-indicator"
                      className="ml-auto w-1 h-4 bg-emerald-500 rounded-full flex-shrink-0"
                    />
                  )}
                </div>
              </Link>
            </div>
          );
        })}
      </nav>

      {/* ── Logout ── */}
      <div className="px-2 py-3 border-t border-slate-800">
        <button
          onClick={clearAuth}
          className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-slate-600 hover:text-rose-400 hover:bg-rose-500/5 transition-all"
        >
          <span className="text-base flex-shrink-0">⎋</span>
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-medium"
            >
              Logout
            </motion.span>
          )}
        </button>
      </div>
    </motion.aside>
  );
}

