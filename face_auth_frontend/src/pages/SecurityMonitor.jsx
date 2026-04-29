import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const BASE = "http://127.0.0.1:8000";
const POLL_MS = 3000;
const card = "rounded-2xl border border-white/10 bg-[#111827]/75 backdrop-blur";

const LEVEL = {
  low: "text-emerald-300 border-emerald-300/30 bg-emerald-400/10",
  medium: "text-amber-300 border-amber-300/30 bg-amber-400/10",
  high: "text-red-300 border-red-300/30 bg-red-400/10",
  critical: "text-violet-300 border-violet-300/30 bg-violet-400/10",
};

function ago(iso) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}

export default function SecurityMonitor() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [feed, setFeed] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [filter, setFilter] = useState("all");

  const fetchData = async () => {
    try {
      const cfg = { headers: { Authorization: `Bearer ${token}` } };
      const [f, s] = await Promise.all([
        axios.get(`${BASE}/intrusion/live-feed`, cfg),
        axios.get(`${BASE}/intrusion/admin/stats`, cfg),
      ]);
      setFeed(f.data);
      setStats(s.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  useEffect(() => {
    if (!token || !live) return;
    const t = setInterval(fetchData, POLL_MS);
    return () => clearInterval(t);
  }, [token, live]);

  const filtered = filter === "all" ? feed : feed.filter((r) => r.risk_level === filter);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0b1220] to-slate-900 text-white">
      <nav className="sticky top-0 z-50 border-b border-white/15 bg-slate-950/95 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-300 to-emerald-300 text-xs font-bold text-slate-900">S</div>
            <div>
              <p className="text-base font-semibold tracking-tight text-slate-100">Secure Hub</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/80">Security Monitor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/dashboard")} className="rounded-md border border-white/15 px-3 py-1 text-xs text-slate-300 hover:bg-white/5">Dashboard</button>
            <button onClick={() => setLive((v) => !v)} className="rounded-md border border-white/20 px-3 py-1 text-xs text-slate-200 hover:bg-white/5">
              {live ? "Pause" : "Resume"}
            </button>
            <button onClick={() => navigate("/admin")} className="rounded-md border border-violet-300/30 px-3 py-1 text-xs text-violet-200 hover:bg-violet-400/10">
              Admin Dashboard
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-8 md:px-8">
        <section className={`${card} p-6`}>
          <h1 className="text-2xl font-semibold">Live Security Monitor</h1>
          <p className="mt-2 text-sm text-slate-400">Realtime visibility into login risk and authentication outcomes.</p>
          <p className="mt-2 text-xs text-slate-500">Refresh: every {POLL_MS / 1000}s {live ? "(running)" : "(paused)"}</p>
        </section>

        {stats && (
          <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[
              ["Alerts", stats.total_alerts_today],
              ["Blocked", stats.blocked_devices],
              ["Locked", stats.locked_accounts],
              ["High Risk", stats.high_risk_attempts],
              ["Attempts", stats.total_attempts_today],
              ["Success", stats.successful_logins_today],
            ].map(([k, v]) => (
              <article key={k} className={`${card} p-4`}>
                <p className="text-xs uppercase tracking-wider text-slate-400">{k}</p>
                <p className="mt-2 text-2xl font-semibold">{v}</p>
              </article>
            ))}
          </section>
        )}

        <section className={`${card} p-4`}>
          <div className="mb-3 flex flex-wrap gap-2">
            {["all", "low", "medium", "high", "critical"].map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded-md border px-3 py-1 text-xs uppercase ${filter === f ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-200" : "border-white/15 text-slate-400 hover:text-slate-200"}`}>
                {f}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Device</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Risk</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-3 py-6 text-slate-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-6 text-slate-400">No events for this filter.</td></tr>
                ) : (
                  filtered.map((row, i) => (
                    <motion.tr key={row.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-white/5">
                      <td className="px-3 py-3 font-medium text-slate-100">{row.username}</td>
                      <td className="px-3 py-3 text-slate-300">{row.device_name}</td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-400">{row.ip_address}</td>
                      <td className="px-3 py-3"><span className={`rounded-md border px-2 py-0.5 text-xs ${LEVEL[row.risk_level] || LEVEL.low}`}>{row.risk_level}</span></td>
                      <td className="px-3 py-3 font-mono text-slate-200">{row.risk_score}</td>
                      <td className="px-3 py-3 text-slate-300">{row.success ? "pass" : (row.step_failed || "fail")}</td>
                      <td className="px-3 py-3 text-slate-400">{ago(row.timestamp)}</td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
