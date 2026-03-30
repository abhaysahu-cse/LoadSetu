"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import {
  MessageCircle, Zap, TruckIcon, ArrowRight, Shield,
  MapPin, CheckCircle2, ChevronRight, Star, IndianRupee,
  Wifi, Activity, Navigation
} from "lucide-react";

// ─── Scroll-reveal wrapper ──────────────────────────────────────────────────
function Reveal({
  children,
  delay = 0,
  className = "",
  direction = "up",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "left" | "right" | "none";
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const variants = {
    hidden: {
      opacity: 0,
      y: direction === "up" ? 40 : 0,
      x: direction === "left" ? -40 : direction === "right" ? 40 : 0,
    },
    visible: { opacity: 1, y: 0, x: 0 },
  };
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={variants}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Animated count-up number ───────────────────────────────────────────────
function CountUp({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 60, damping: 18 });
  const [display, setDisplay] = useState(0);
  useEffect(() => { motionVal.set(value); }, [value]);
  useEffect(() => spring.on("change", (v) => setDisplay(Math.round(v))), [spring]);
  return (
    <span>
      {prefix}{display.toLocaleString("en-IN")}{suffix}
    </span>
  );
}

// ─── Animated Map Mockup (from VahanSync) ──────────────────────────────────
function HeroMapMockup() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setStep((s) => (s + 1) % 4), step === 0 ? 800 : 1400);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="relative w-full max-w-sm mx-auto select-none">
      <div className="absolute -inset-4 rounded-3xl bg-emerald-500/10 blur-2xl pointer-events-none" />
      <div className="relative bg-slate-900 border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl shadow-black/60">
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-300">VahanSync Live Map</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">50km radius</span>
        </div>

        {/* pseudo map canvas */}
        <div className="relative bg-[#0d1520] h-64 overflow-hidden">
          {/* grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-10">
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#64748b" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* road lines */}
          <svg className="absolute inset-0 w-full h-full opacity-30">
            <line x1="0" y1="128" x2="400" y2="128" stroke="#334155" strokeWidth="2" />
            <line x1="200" y1="0" x2="200" y2="256" stroke="#334155" strokeWidth="2" />
            <line x1="0" y1="70" x2="400" y2="185" stroke="#334155" strokeWidth="1.5" />
          </svg>

          {/* 50km radius circle */}
          {step >= 1 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute pointer-events-none"
              style={{ left: 168, top: 90, transform: "translate(-50%,-50%)" }}
            >
              <div className="w-36 h-36 rounded-full border border-emerald-500/40 bg-emerald-500/5" />
              <div
                className="absolute inset-0 w-36 h-36 rounded-full border border-emerald-500/20 animate-ping"
                style={{ animationDuration: "2.5s" }}
              />
            </motion.div>
          )}

          {/* moving truck marker */}
          <motion.div
            className="absolute"
            animate={{ left: step >= 2 ? 168 : 80, top: step >= 2 ? 90 : 128 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            style={{ left: 80, top: 128, transform: "translate(-50%,-50%)" }}
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center text-base shadow-lg">
                🚛
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-slate-900 animate-pulse" />
            </div>
          </motion.div>

          {/* matched load pins */}
          {step >= 2 &&
            [
              { x: 218, y: 100, delay: 0 },
              { x: 240, y: 122, delay: 0.12 },
              { x: 192, y: 74, delay: 0.22 },
            ].map((pin, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: pin.delay, type: "spring", stiffness: 300 }}
                className="absolute"
                style={{ left: pin.x, top: pin.y, transform: "translate(-50%,-50%)" }}
              >
                <div className="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white shadow-lg" />
              </motion.div>
            ))}

          {/* dashed deadhead lines */}
          {step >= 2 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {[{ x2: 218, y2: 100 }, { x2: 240, y2: 122 }, { x2: 192, y2: 74 }].map((l, i) => (
                <motion.line
                  key={i}
                  x1={168}
                  y1={90}
                  x2={l.x2}
                  y2={l.y2}
                  stroke="#f43f5e"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.75 }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                />
              ))}
            </svg>
          )}

          {/* AI Match Found popup */}
          <AnimatePresence>
            {step >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
                className="absolute bottom-3 left-3 right-3 bg-slate-800/97 border border-emerald-500/40 rounded-2xl px-4 py-3 shadow-xl backdrop-blur-sm"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <Zap size={11} />AI Match Found
                  </span>
                  <span className="text-xs text-slate-500">8.2 km deadhead</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">Surat → Bhopal</span>
                  <span className="text-sm font-black text-emerald-400">₹15,000</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-emerald-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: "87%" }}
                      transition={{ delay: 0.2, duration: 0.7 }}
                    />
                  </div>
                  <span className="text-xs text-emerald-400 font-semibold flex-shrink-0">87% match</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── WhatsApp Chat Mockup ───────────────────────────────────────────────────
function WhatsAppMockup() {
  const messages = [
    { from: "user", text: "Mera 10-ton truck Surat mein kal 4 PM ko khali ho raha hai. Bhopal ka load chahiye." },
    { from: "bot", text: "✅ VahanSync scanning 50km radius…", delay: 0.6 },
    { from: "bot", text: "🎯 3 loads matched!\n\n📦 Surat → Bhopal\n💰 ₹15,000 | 421 km haul\n🛣️ Deadhead: only 8 km\n✅ RC + Insurance verified", delay: 1.1 },
    { from: "user", text: "Book kar do!", delay: 1.6 },
    { from: "bot", text: "🚀 Booked! Confirmation sent. Start driving at 4 PM.", delay: 2.1 },
  ];
  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className="absolute -inset-4 rounded-3xl bg-emerald-500/10 blur-2xl" />
      <div className="relative bg-slate-900 border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl shadow-black/60">
        {/* header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700/50">
          <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <TruckIcon size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">LoadSetu AI</p>
            <p className="text-xs text-emerald-400 mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block animate-pulse" />
              Online · ULIP Verified
            </p>
          </div>
        </div>
        {/* chat */}
        <div className="p-4 space-y-3 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2MCcgaGVpZ2h0PSc2MCc+PHJlY3Qgd2lkdGg9JzYwJyBoZWlnaHQ9JzYwJyBmaWxsPSdub25lJy8+PC9zdmc+')] min-h-[260px]">
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: (m.delay ?? i * 0.4) + 0.3, duration: 0.4 }}
              className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                  m.from === "user"
                    ? "bg-emerald-600 text-white rounded-br-sm"
                    : "bg-slate-700 text-slate-100 rounded-bl-sm"
                }`}
              >
                {m.text}
              </div>
            </motion.div>
          ))}
        </div>
        {/* input bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 border-t border-slate-700/50">
          <div className="flex-1 bg-slate-700 rounded-full px-4 py-2 text-xs text-slate-500">
            Type a message…
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
            <MessageCircle size={14} className="text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Trust Marquee ──────────────────────────────────────────────────────────
function TrustBar() {
  const items = [
    { icon: Shield, label: "Integrated with VAHAN" },
    { icon: Activity, label: "Powered by ULIP" },
    { icon: Wifi, label: "ONDC Network" },
    { icon: Navigation, label: "FASTag Enabled" },
    { icon: CheckCircle2, label: "RC Verified Instantly" },
    { icon: Star, label: "99.9% Uptime SLA" },
    { icon: Shield, label: "Integrated with VAHAN" },
    { icon: Activity, label: "Powered by ULIP" },
    { icon: Wifi, label: "ONDC Network" },
    { icon: Navigation, label: "FASTag Enabled" },
    { icon: CheckCircle2, label: "RC Verified Instantly" },
    { icon: Star, label: "99.9% Uptime SLA" },
  ];
  return (
    <div className="w-full overflow-hidden border-y border-slate-800 bg-slate-900/60 py-4">
      <motion.div
        className="flex gap-12 w-max"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      >
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2.5 whitespace-nowrap">
            <item.icon size={15} className="text-blue-400 shrink-0" />
            <span className="text-slate-400 text-sm font-medium tracking-wide">{item.label}</span>
            <span className="text-slate-700 mx-2">·</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── ROI Calculator ─────────────────────────────────────────────────────────
function RoiCalculator() {
  const [trucks, setTrucks] = useState(10);
  const [emptyKm, setEmptyKm] = useState(300);
  const fuelRate = 12; // ₹/km
  const weeksPerMonth = 4.3;
  const savings = Math.round(trucks * emptyKm * fuelRate * weeksPerMonth * 0.7); // 70% reduction

  return (
    <div className="relative rounded-3xl border border-slate-700/60 bg-slate-900/80 p-8 md:p-10 overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10">
        <p className="text-xs font-bold tracking-[0.2em] text-emerald-400 uppercase mb-3">
          Live ROI Calculator
        </p>
        <h3 className="text-2xl md:text-3xl font-bold text-white mb-8">
          See How Much You're Losing
        </h3>

        <div className="space-y-7 mb-10">
          <div>
            <div className="flex justify-between mb-3">
              <span className="text-sm text-slate-400 font-medium">Trucks in your fleet</span>
              <span className="text-sm font-bold text-white bg-slate-800 px-3 py-0.5 rounded-full">{trucks}</span>
            </div>
            <input
              type="range" min={1} max={50} step={1} value={trucks}
              onChange={(e) => setTrucks(+e.target.value)}
              className="w-full accent-emerald-500 h-1.5 rounded-full appearance-none bg-slate-700 cursor-pointer"
            />
            <div className="flex justify-between mt-1 text-xs text-slate-600">
              <span>1</span><span>50</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-3">
              <span className="text-sm text-slate-400 font-medium">Empty km/week per truck</span>
              <span className="text-sm font-bold text-white bg-slate-800 px-3 py-0.5 rounded-full">{emptyKm} km</span>
            </div>
            <input
              type="range" min={50} max={1000} step={10} value={emptyKm}
              onChange={(e) => setEmptyKm(+e.target.value)}
              className="w-full accent-emerald-500 h-1.5 rounded-full appearance-none bg-slate-700 cursor-pointer"
            />
            <div className="flex justify-between mt-1 text-xs text-slate-600">
              <span>50 km</span><span>1,000 km</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-950 border border-slate-700/40 p-6 md:p-8">
          <p className="text-sm text-slate-500 mb-2">Your fleet is bleeding monthly</p>
          <p className="text-rose-400 text-4xl md:text-5xl font-black tracking-tight mb-1">
            ₹<CountUp value={Math.round(trucks * emptyKm * fuelRate * weeksPerMonth)} />
          </p>
          <p className="text-slate-600 text-xs mb-6">in dead fuel cost alone</p>

          <div className="h-px bg-slate-800 mb-6" />

          <p className="text-sm text-slate-500 mb-2">LoadSetu can recover up to</p>
          <p className="text-emerald-400 text-4xl md:text-5xl font-black tracking-tight mb-1">
            ₹<CountUp value={savings} />
          </p>
          <p className="text-slate-600 text-xs">per month · at 70% empty-run reduction</p>
        </div>

        <motion.a
          href="#whatsapp"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="mt-6 w-full flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-4 rounded-2xl transition-colors text-base"
        >
          <MessageCircle size={18} />
          Recover This Money on WhatsApp
          <ArrowRight size={16} />
        </motion.a>
      </div>
    </div>
  );
}

// ─── How It Works Cards ─────────────────────────────────────────────────────
const steps = [
  {
    number: "01",
    icon: MessageCircle,
    title: "Send a Voice Note",
    body: "Just tell our AI where your truck is empty on WhatsApp. No app to download. Works in Hindi, Hinglish, or English.",
    color: "emerald",
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  {
    number: "02",
    icon: Zap,
    title: "Instant AI Match",
    body: "VahanSync Engine scans a 50km radius, ranks loads by profit margin, and shows you the top paying enterprise loads within seconds.",
    color: "blue",
    accent: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    number: "03",
    icon: IndianRupee,
    title: "Drive & Get Paid",
    body: "Accept in chat. We verify RC and insurance via VAHAN instantly. You start driving. Payment guaranteed via FASTag milestones.",
    color: "amber",
    accent: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
];

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans overflow-x-hidden">

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col justify-center px-6 md:px-12 lg:px-24 pt-16 pb-8">
        {/* deep-tech background radial gradients */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-500/8 blur-[120px]" />
          <div className="absolute top-1/3 right-[-5%] w-[500px] h-[500px] rounded-full bg-blue-600/8 blur-[120px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_50%,_#020617_100%)]" />
          {/* subtle grid */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        {/* nav */}
        <nav className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 md:px-12 lg:px-24 py-5 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <TruckIcon size={14} className="text-white" />
            </div>
            <span className="font-black text-white text-lg tracking-tight">LoadSetu</span>
            <span className="ml-1 text-xs text-slate-600 font-mono">× VahanSync</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            <a href="#how" className="hover:text-white transition-colors">How It Works</a>
            <a href="#roi" className="hover:text-white transition-colors">ROI Calculator</a>
            <a href="#whatsapp" className="hover:text-white transition-colors">API</a>
          </div>
          <a
            href="/login"
            className="text-sm border border-slate-700 hover:border-slate-500 px-4 py-2 rounded-xl text-slate-300 hover:text-white transition-all"
          >
            Fleet Login
          </a>
        </nav>

        {/* hero grid */}
        <div className="relative z-10 max-w-7xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center mt-8">
          {/* left */}
          <div>
            <Reveal delay={0.05}>
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-6">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-emerald-400 text-xs font-semibold tracking-wide uppercase">
                  India's First AI Freight Exchange
                </span>
              </div>
            </Reveal>

            <Reveal delay={0.12}>
              <h1 className="text-4xl md:text-5xl lg:text-[3.75rem] font-black leading-[1.08] tracking-tight text-white mb-6">
                Stop Driving{" "}
                <span className="text-rose-400 line-through decoration-rose-500">Empty</span>.{" "}
                <br />
                <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                  Turn Every Return Trip
                </span>{" "}
                Into Profit.
              </h1>
            </Reveal>

            <Reveal delay={0.2}>
              <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-lg">
                LoadSetu connects your empty trucks to verified enterprise loads in seconds via WhatsApp.
                Powered by{" "}
                <span className="text-blue-400 font-medium">ULIP</span> &{" "}
                <span className="text-blue-400 font-medium">ONDC</span>.
                No apps. No brokers. Pure AI.
              </p>
            </Reveal>

            <Reveal delay={0.28}>
              <div className="flex flex-col sm:flex-row gap-3">
                <motion.a
                  href="https://wa.me/919999999999?text=Mera+truck+khali+hai"
                  id="whatsapp"
                  whileHover={{ scale: 1.03, boxShadow: "0 0 30px rgba(16,185,129,0.25)" }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center justify-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-7 py-4 rounded-2xl transition-colors text-base"
                >
                  <MessageCircle size={18} />
                  Start Booking on WhatsApp
                  <ArrowRight size={15} />
                </motion.a>
                <a
                  href="/login"
                  className="flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold px-7 py-4 rounded-2xl transition-all text-base"
                >
                  Fleet Owner Login
                  <ChevronRight size={15} />
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.36}>
              <div className="mt-8 flex items-center gap-6 text-sm text-slate-500">
                {["₹0 setup fee", "Pay per booking", "Govt. ULIP verified"].map((t) => (
                  <div key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    {t}
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* right — animated map mockup */}
          <Reveal delay={0.18} direction="left">
            <HeroMapMockup />
          </Reveal>
        </div>

        {/* stat strip */}
        <Reveal delay={0.45} className="relative z-10 max-w-7xl mx-auto w-full mt-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: "80%", label: "Trucks Unorganized in India" },
              { value: "14%", label: "GDP Lost to Logistics Inefficiency" },
              { value: "₹0", label: "Revenue from an Empty Run" },
              { value: "<2s", label: "VahanSync Match Response" },
            ].map((s, i) => (
              <div key={i} className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4 md:p-5">
                <p className="text-2xl md:text-3xl font-black text-white tracking-tight">{s.value}</p>
                <p className="text-xs text-slate-500 mt-1 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── TRUST BAR ──────────────────────────────────────── */}
      <TrustBar />

      {/* ── HOW IT WORKS ───────────────────────────────────── */}
      <section id="how" className="px-6 md:px-12 lg:px-24 py-24 max-w-7xl mx-auto">
        <Reveal>
          <p className="text-xs font-bold tracking-[0.2em] text-blue-400 uppercase mb-4 text-center">
            How It Works
          </p>
          <h2 className="text-3xl md:text-5xl font-black text-white text-center mb-4 tracking-tight">
            Three Steps. Zero Empty Runs.
          </h2>
          <p className="text-slate-500 text-center max-w-xl mx-auto mb-16">
            Designed for fleet owners who run on WhatsApp, not dashboards.
          </p>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <Reveal key={i} delay={i * 0.12}>
              <motion.div
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className={`relative rounded-3xl border ${step.border} ${step.bg} p-8 h-full overflow-hidden group cursor-default`}
              >
                <div className="absolute top-4 right-4 text-7xl font-black opacity-5 text-white select-none">
                  {step.number}
                </div>
                <div className={`w-12 h-12 rounded-2xl ${step.bg} border ${step.border} flex items-center justify-center mb-6`}>
                  <step.icon size={22} className={step.accent} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.body}</p>
                <div className={`mt-6 flex items-center gap-1.5 text-xs font-semibold ${step.accent}`}>
                  Step {step.number}
                  <ArrowRight size={12} />
                </div>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── ROI CALCULATOR ─────────────────────────────────── */}
      <section id="roi" className="px-6 md:px-12 lg:px-24 py-16 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <Reveal direction="right">
            <p className="text-xs font-bold tracking-[0.2em] text-rose-400 uppercase mb-4">
              The Real Cost of Doing Nothing
            </p>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-5 tracking-tight leading-tight">
              Every Empty Kilometer Is{" "}
              <span className="text-rose-400">Burning Your Margin</span>
            </h2>
            <p className="text-slate-400 leading-relaxed mb-8">
              India loses billions every year to empty truck runs. You don't need to be a statistic.
              Our AI matches your truck before it finishes unloading.
            </p>
            <div className="space-y-3">
              {[
                "Guaranteed return load or fee waived",
                "VAHAN-verified shipper identity on every booking",
                "Real-time GPS handoff via ULIP APIs",
                "WhatsApp-native — zero new app to learn",
              ].map((f) => (
                <div key={f} className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                  <span className="text-slate-300 text-sm">{f}</span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <RoiCalculator />
          </Reveal>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────── */}
      <section className="px-6 md:px-12 lg:px-24 py-24">
        <Reveal>
          <div className="relative max-w-4xl mx-auto rounded-3xl overflow-hidden border border-emerald-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 p-12 md:p-16 text-center">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.08)_0%,_transparent_70%)] pointer-events-none" />
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                <TruckIcon size={28} className="text-emerald-400" />
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">
                Your Next Load is 50km Away.
              </h2>
              <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
                Join thousands of fleet owners already on LoadSetu.
                Start your first match on WhatsApp in under 60 seconds.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <motion.a
                  href="https://wa.me/919999999999"
                  whileHover={{ scale: 1.04, boxShadow: "0 0 40px rgba(16,185,129,0.3)" }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center justify-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-8 py-4.5 rounded-2xl transition-colors text-base"
                >
                  <MessageCircle size={18} />
                  Start Free on WhatsApp
                </motion.a>
                <a href="/login" className="inline-flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold px-8 py-4 rounded-2xl transition-all text-base">
                  Fleet Command Center
                  <ChevronRight size={15} />
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 px-6 md:px-12 lg:px-24 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center">
              <TruckIcon size={12} className="text-white" />
            </div>
            <span className="font-black text-white text-sm tracking-tight">LoadSetu</span>
            <span className="text-slate-700 text-sm">×</span>
            <span className="text-slate-500 text-sm">VahanSync</span>
          </div>
          <p className="text-slate-600 text-xs text-center">
            Powered by ULIP · ONDC Network · VAHAN APIs · Built in India 🇮🇳
          </p>
          <p className="text-slate-700 text-xs">© 2026 LoadSetu Technologies Pvt. Ltd.</p>
        </div>
      </footer>
    </main>
  );
}