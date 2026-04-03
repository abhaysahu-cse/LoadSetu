"use client";

import axios from "axios";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useLogin } from "@/lib/api/hooks";
import { useAuthStore } from "@/store";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const login = useLogin();
  const { setAuth, setLanguage } = useAuthStore();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const res = await login.mutateAsync({ phone, password });
      setAuth({
        token: res.token,
        fleetName: res.company_name ?? res.full_name ?? "LoadSetu",
        userRole: res.role,
      });
      setLanguage("en");
      router.replace("/map");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const requestId = err.response?.headers?.["x-request-id"] as string | undefined;
        const message =
          err.response?.data?.message ??
          err.response?.data?.error ??
          "Login failed";
        setError(requestId ? `${message} [reqId: ${requestId}]` : message);
        return;
      }
      setError("Login failed");
    }
  }

  return (
    <main className="flex min-h-screen bg-slate-950">
      <div className="relative hidden overflow-hidden border-r border-slate-800 bg-slate-900 p-12 lg:flex lg:w-[55%] lg:flex-col lg:justify-between">
        <div className="absolute left-0 top-0 h-full w-full">
          <div className="absolute left-1/4 top-1/3 h-80 w-80 rounded-full bg-emerald-500/6 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-blue-600/6 blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="mb-16 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-lg font-bold text-slate-950">
              LS
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-white">LoadSetu</p>
              <p className="font-mono text-xs text-slate-600">x VahanSync</p>
            </div>
          </div>

          <h1 className="mb-4 text-4xl font-black leading-tight tracking-tight text-white">
            National Freight Exchange
            <br />
            <span className="text-emerald-400">Command Center</span>
          </h1>
          <p className="max-w-md leading-relaxed text-slate-400">
            Real-time logistics orchestration for shippers and fleet owners.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-4">
          {[
            { value: "<2s", label: "Match latency" },
            { value: "50km", label: "Search radius" },
            { value: "24x7", label: "Ops ready" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <p className="text-xl font-black text-emerald-400">{stat.value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="mb-10 flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-sm font-bold text-slate-950">
              LS
            </div>
            <span className="font-black text-white">LoadSetu</span>
          </div>

          <h2 className="mb-1 text-2xl font-black tracking-tight text-white">Welcome back</h2>
          <p className="mb-8 text-sm text-slate-500">Log in to the dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="........"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 pr-12 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-600 transition-colors hover:text-slate-400"
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
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {login.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Authenticating...
                </>
              ) : (
                "Enter Dashboard"
              )}
            </motion.button>

            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          </form>

          <p className="mt-6 text-center text-xs text-slate-600">
            Need a shipper account?{" "}
            <a href="/register" className="text-emerald-400 hover:text-emerald-300">
              Create one
            </a>
          </p>
        </motion.div>
      </div>
    </main>
  );
}
