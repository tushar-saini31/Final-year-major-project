import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const BASE = "http://127.0.0.1:8000";

const card = "rounded-2xl border border-white/10 bg-[#111827]/75 backdrop-blur";

function MetricBar({ label, value, tone }) {
  const toneClass = {
    cyan: "bg-cyan-400",
    gold: "bg-amber-400",
    green: "bg-emerald-400",
    violet: "bg-violet-400",
  }[tone] || "bg-cyan-400";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-slate-100">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className={`h-full ${toneClass}`}
        />
      </div>
    </div>
  );
}

function LogoutModal({ onCancel, onConfirm }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900/95 p-6 shadow-2xl"
        >
          <h3 className="text-xl font-semibold text-white">Log out now?</h3>
          <p className="mt-2 text-sm text-slate-400">You’ll need to sign in again.</p>
          <div className="mt-5 flex gap-3">
            <button onClick={onCancel} className="flex-1 rounded-lg border border-white/20 py-2 text-sm text-slate-300 transition hover:border-white/35 hover:bg-white/5">Stay</button>
            <button onClick={onConfirm} className="flex-1 rounded-lg border border-red-400/40 bg-red-500/15 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/25">Log out</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const [showLogout, setShowLogout] = useState(false);

  const stats = useMemo(() => ([
    { label: "Auth Pipeline", value: "OTP -> Face -> Voice", sub: "All stages complete" },
    { label: "Vault Scope", value: "User isolated", sub: "Per-account data boundary" },
    { label: "Session", value: "Active", sub: "No anomalies detected" },
    { label: "Current Risk", value: "Low", sub: "IDS status normal" },
  ]), []);

  const actions = useMemo(() => {
    const all = [
      { label: "Open Vault", run: () => navigate("/vault/library"), adminOnly: false },
      { label: "Add Data", run: () => navigate("/vault/editor"), adminOnly: false },
      { label: "Security Monitor", run: () => navigate("/monitor"), adminOnly: true },
      { label: "Admin Dashboard", run: () => navigate("/admin"), adminOnly: true },
      { label: "Demo Panel", run: () => navigate("/demo"), adminOnly: true },
      { label: "Sign Out", run: () => setShowLogout(true), adminOnly: false },
    ];
    return all.filter((a) => !a.adminOnly || isAdmin);
  }, [isAdmin, navigate]);

  const completeLogout = () => {
    setShowLogout(false);
    logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0b1220] to-slate-900 text-white">
      {showLogout && <LogoutModal onCancel={() => setShowLogout(false)} onConfirm={completeLogout} />}

      <nav className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-300 to-emerald-300 text-xs font-bold text-slate-900">S</div>
            <div>
              <p className="text-base font-semibold tracking-tight text-slate-100">Secure Hub</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-3 py-1.5 text-right">
              <p className="text-base font-mono leading-none text-cyan-300">{user}</p>
            </div>
            <button
              onClick={() => navigate("/vault/library")}
              className="rounded-lg border border-cyan-300/35 bg-cyan-400/10 px-3 py-1.5 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20 hover:text-cyan-100"
            >
              Open Vault
            </button>
            <button
              onClick={() => setShowLogout(true)}
              className="rounded-lg border border-red-300/35 bg-red-400/10 px-3 py-1.5 text-sm font-medium text-red-200 transition hover:bg-red-400/20 hover:text-red-100"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-8 md:px-8">
        <section className={`${card} p-6 md:p-8`}>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Welcome</p>
          <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Hello, {user}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
            Your identity has been verified through the full multi-factor journey. Use the actions below to access private vault data or security operations.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={() => navigate("/vault/library")} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Open Vault</button>
            <button onClick={() => navigate("/vault/editor")} className="rounded-lg border border-cyan-300/30 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10">Add Data</button>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <article key={s.label} className={`${card} p-4`}>
              <p className="text-xs uppercase tracking-wider text-slate-400">{s.label}</p>
              <p className="mt-2 text-lg font-semibold text-white">{s.value}</p>
              <p className="mt-1 text-xs text-slate-400">{s.sub}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className={`${card} p-6`}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Security Score</h2>
              <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-mono text-emerald-300">92 / 100</span>
            </div>
            <div className="space-y-5">
              <MetricBar label="Identity Verification" value={98} tone="cyan" />
              <MetricBar label="Biometric Strength" value={91} tone="gold" />
              <MetricBar label="Session Integrity" value={95} tone="violet" />
              <MetricBar label="Vault Access Policy" value={88} tone="green" />
            </div>
          </article>

          <article className={`${card} p-6`}>
            <h2 className="mb-5 text-xl font-semibold">MFA Timeline</h2>
            <div className="space-y-3">
              {[
                ["OTP verification", "Code confirmed"],
                ["Face recognition", "Liveness passed"],
                ["Voice authentication", "Phrase matched"],
                ["Vault unlocked", "Session granted"],
              ].map(([title, sub]) => (
                <div key={title} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-100">{title}</p>
                    <p className="text-xs text-slate-400">{sub}</p>
                  </div>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-300">done</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className={`${card} p-6`}>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Quick Actions</h2>
              <p className="mt-1 text-sm text-slate-400">Jump to your most used workspace actions.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={a.run}
                className="rounded-lg border border-white/15 bg-white/[0.02] px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:-translate-y-[1px] hover:border-cyan-300/45 hover:bg-cyan-400/10"
              >
                {a.label}
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
