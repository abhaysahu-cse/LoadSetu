"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useLogin } from "@/lib/api/hooks";
import { useAuthStore } from "@/store";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useLogin();
  const { setAuth, setLanguage } = useAuthStore();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await login.mutateAsync({ phone, password });
      setAuth({
        token: res.token,
        fleetName: res.company_name ?? res.full_name ?? "LoadSetu",
        userRole: res.role,
      });
      setLanguage("en");
      router.replace("/map");
    } catch {
      // handled by interceptor toast
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 flex">
      <div className="hidden lg:flex lg:w-[55%] relative bg-slate-900 border-r border-slate-800 flex-col justify-between p-12 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-emerald-500/6 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-600/6 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-lg">
              ??
            </div>
            <div>
              <p className="font-black text-white text-lg tracking-tight">LoadSetu</p>
              <p className="text-xs text-slate-600 font-mono">× VahanSync</p>
            </div>
          </div>

          <h1 className="text-4xl font-black text-white leading-tight tracking-tight mb-4">
            National Freight Exchange<br />
            <span className="text-emerald-400">Command Center</span>
          </h1>
          <p className="text-slate-400 leading-relaxed max-w-md">
            Real-time logistics orchestration for shippers and fleet owners.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-4">
          {[
            { value: "<2s", label: "Match latency" },
            { value: "50km", label: "Search radius" },
            { value: "24x7", label: "Ops ready" },
          ].map((s) => (
            <div key={s.label} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
              <p className="text-xl font-black text-emerald-400">{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center">??</div>
            <span className="font-black text-white">LoadSetu</span>
          </div>

          <h2 className="text-2xl font-black text-white mb-1 tracking-tight">Welcome back</h2>
          <p className="text-slate-500 text-sm mb-8">Log in to the dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-2 block uppercase tracking-wider">Phone Number</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm outline-none transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 mb-2 block uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-3 pr-12 text-white placeholder-slate-600 text-sm outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 text-xs transition-colors"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={login.isPending || !phone || !password}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm mt-2"
            >
              {login.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Enter Dashboard"
              )}
            </motion.button>
          </form>

          <p className="text-xs text-slate-600 text-center mt-6">
            Need a shipper account? <a href="/register" className="text-emerald-400 hover:text-emerald-300">Create one</a>
          </p>
        </motion.div>
      </div>
    </main>
  );
}
