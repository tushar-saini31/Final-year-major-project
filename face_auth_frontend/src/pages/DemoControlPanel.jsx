import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const BASE = "http://127.0.0.1:8000";
const card = "rounded-2xl border border-white/10 bg-[#111827]/75 backdrop-blur";

function ScenarioCard({ title, description, actionLabel, tone, loading, result, onRun }) {
  const toneClass = {
    red: "border-red-300/35 bg-red-400/10 text-red-200",
    amber: "border-amber-300/35 bg-amber-400/10 text-amber-200",
    violet: "border-violet-300/35 bg-violet-400/10 text-violet-200",
    cyan: "border-cyan-300/35 bg-cyan-400/10 text-cyan-200",
  }[tone] || "border-cyan-300/35 bg-cyan-400/10 text-cyan-200";

  return (
    <article className={`${card} p-5`}>
      <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
      <button onClick={onRun} disabled={loading} className={`mt-4 w-full rounded-lg border px-3 py-2 text-sm font-medium ${toneClass} disabled:opacity-50`}>
        {loading ? "Running..." : actionLabel}
      </button>
      {result && <p className={`mt-3 text-xs ${result.ok ? "text-emerald-300" : "text-red-300"}`}>{result.ok ? "Success" : "Error"}: {result.message}</p>}
    </article>
  );
}

export default function DemoControlPanel() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [username, setUsername] = useState("demo_user");
  const [loading, setLoading] = useState({});
  const [results, setResults] = useState({});

  const run = async (key, endpoint) => {
    setLoading((p) => ({ ...p, [key]: true }));
    setResults((p) => ({ ...p, [key]: null }));
    try {
      const cfg = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.post(`${BASE}${endpoint}`, { username }, cfg);
      setResults((p) => ({ ...p, [key]: { ok: true, message: res.data.message } }));
    } catch (e) {
      setResults((p) => ({ ...p, [key]: { ok: false, message: e?.response?.data?.detail || "Request failed" } }));
    } finally {
      setLoading((p) => ({ ...p, [key]: false }));
    }
  };

  const scenarios = [
    {
      key: "brute",
      title: "Brute-force simulation",
      description: "Creates 5 failed attempts and applies a temporary device block.",
      label: "Run brute-force",
      tone: "red",
      endpoint: "/intrusion/demo/simulate-brute-force",
    },
    {
      key: "unknown",
      title: "Unknown device simulation",
      description: "Adds a medium-risk login event from an unrecognized device profile.",
      label: "Run unknown-device",
      tone: "amber",
      endpoint: "/intrusion/demo/simulate-unknown-device",
    },
    {
      key: "critical",
      title: "Critical attack simulation",
      description: "Creates a critical alert and locks the selected account.",
      label: "Run critical-attack",
      tone: "violet",
      endpoint: "/intrusion/demo/simulate-critical",
    },
    {
      key: "reset",
      title: "Reset demo state",
      description: "Clears demo alerts and attempts so you can run a fresh demo.",
      label: "Reset demo",
      tone: "cyan",
      endpoint: "/intrusion/demo/reset",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0b1220] to-slate-900 text-white">
      <nav className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-300 to-cyan-300 text-xs font-bold text-slate-900">S</div>
            <div>
              <p className="text-base font-semibold tracking-tight text-slate-100">Secure Hub</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">Demo Panel</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate("/dashboard")} className="rounded-md border border-white/15 px-3 py-1 text-xs text-slate-300 hover:bg-white/5">Dashboard</button>
            <button onClick={() => navigate("/monitor")} className="rounded-md border border-cyan-300/30 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-400/10">Monitor</button>
            <button onClick={() => navigate("/admin")} className="rounded-md border border-violet-300/30 px-3 py-1 text-xs text-violet-200 hover:bg-violet-400/10">Admin</button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-8 md:px-8">
        <section className={`${card} p-6`}>
          <h1 className="text-2xl font-semibold">Security Demo Control</h1>
          <p className="mt-2 text-sm text-slate-400">Use controlled scenarios to demonstrate IDS behavior and admin response workflows.</p>
          <div className="mt-4 max-w-sm">
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Target username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
              placeholder="username"
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {scenarios.map((s) => (
            <ScenarioCard
              key={s.key}
              title={s.title}
              description={s.description}
              actionLabel={s.label}
              tone={s.tone}
              loading={loading[s.key]}
              result={results[s.key]}
              onRun={() => run(s.key, s.endpoint)}
            />
          ))}
        </section>

        <section className={`${card} p-6`}>
          <h2 className="text-lg font-semibold">Suggested demo flow</h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-300">
            <li>1. Run normal login and show baseline monitor entries.</li>
            <li>2. Simulate unknown device and review medium-risk event.</li>
            <li>3. Simulate brute-force and verify temporary block behavior.</li>
            <li>4. Simulate critical attack and confirm account lock.</li>
            <li>5. Unlock from Admin Dashboard, then reset demo state.</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
