import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const BASE = "http://127.0.0.1:8000";
const card = "rounded-2xl border border-slate-400/20 bg-slate-800/55 backdrop-blur";

function badgeColor(type) {
  if (!type) return "text-cyan-300 border-cyan-300/30 bg-cyan-400/10";
  if (type.includes("locked") || type.includes("critical")) return "text-violet-300 border-violet-300/30 bg-violet-400/10";
  if (type.includes("blocked") || type.includes("brute")) return "text-red-300 border-red-300/30 bg-red-400/10";
  if (type.includes("device") || type.includes("new")) return "text-amber-300 border-amber-300/30 bg-amber-400/10";
  return "text-cyan-300 border-cyan-300/30 bg-cyan-400/10";
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { token, logout } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [restricted, setRestricted] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [confirmState, setConfirmState] = useState(null);

  const load = async () => {
    try {
      const cfg = { headers: { Authorization: `Bearer ${token}` } };
      const [a, r, s] = await Promise.all([
        axios.get(`${BASE}/intrusion/alerts`, cfg),
        axios.get(`${BASE}/intrusion/admin/restricted-accounts`, cfg),
        axios.get(`${BASE}/intrusion/admin/stats`, cfg),
      ]);
      setAlerts(a.data);
      setRestricted(r.data);
      setStats(s.data);
    } catch {
      setMsg("Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
  }, [token]);

  const flash = (m) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 2500);
  };

  const unlock = async (username) => {
    try {
      await axios.post(`${BASE}/intrusion/admin/unlock/${username}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      flash(`${username} unlocked`);
      load();
    } catch {
      flash("Unlock failed");
    }
  };

  const unblock = async (username) => {
    try {
      await axios.post(`${BASE}/intrusion/admin/unblock/${username}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      flash(`${username} block cleared`);
      load();
    } catch {
      flash("Unblock failed");
    }
  };

  const lockPermanently = async (username) => {
    try {
      await axios.post(`${BASE}/intrusion/admin/lock/${username}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      flash(`${username} permanently locked`);
      load();
    } catch {
      flash("Permanent lock failed");
    }
  };

  const statCards = stats
    ? [
        {
          label: "Alerts Today",
          value: stats.total_alerts_today,
          tone: "from-rose-400/16 via-rose-300/8 to-transparent",
          ring: "hover:border-rose-300/35",
          valueColor: "text-rose-100",
          glow: "bg-rose-300/18",
        },
        {
          label: "Blocked Devices",
          value: stats.blocked_devices,
          tone: "from-amber-400/14 via-amber-300/8 to-transparent",
          ring: "hover:border-amber-300/35",
          valueColor: "text-amber-100",
          glow: "bg-amber-300/16",
        },
        {
          label: "Locked Accounts",
          value: stats.locked_accounts,
          tone: "from-violet-400/16 via-violet-300/8 to-transparent",
          ring: "hover:border-violet-300/35",
          valueColor: "text-violet-100",
          glow: "bg-violet-300/16",
        },
        {
          label: "High Risk",
          value: stats.high_risk_attempts,
          tone: "from-fuchsia-400/14 via-fuchsia-300/8 to-transparent",
          ring: "hover:border-fuchsia-300/35",
          valueColor: "text-fuchsia-100",
          glow: "bg-fuchsia-300/16",
        },
        {
          label: "Attempts",
          value: stats.total_attempts_today,
          tone: "from-sky-400/14 via-sky-300/8 to-transparent",
          ring: "hover:border-sky-300/35",
          valueColor: "text-sky-100",
          glow: "bg-sky-300/16",
        },
        {
          label: "Successful",
          value: stats.successful_logins_today,
          tone: "from-emerald-400/14 via-emerald-300/8 to-transparent",
          ring: "hover:border-emerald-300/35",
          valueColor: "text-emerald-100",
          glow: "bg-emerald-300/16",
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0b1220] to-slate-900 text-white">
      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setConfirmState(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/15 bg-slate-900/95 p-6 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/80">Confirm Action</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-100">{confirmState.title}</h3>
            <p className="mt-2 text-sm text-slate-300">{confirmState.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmState(null)}
                className="rounded-md border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await confirmState.onConfirm();
                  setConfirmState(null);
                }}
                className="rounded-md border border-cyan-300/35 bg-cyan-400/15 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-400/25"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 right-10 h-72 w-72 rounded-full bg-violet-500/12 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-cyan-500/12 blur-3xl" />
      </div>

      <nav className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-300 to-cyan-300 text-xs font-bold text-slate-900">S</div>
            <div>
              <p className="text-base font-semibold tracking-tight text-slate-100">Secure Hub</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-violet-300/80">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/dashboard")} className="rounded-lg border border-white/15 px-3 py-1 text-xs text-slate-300 hover:bg-white/5">Dashboard</button>
            <button onClick={() => navigate("/monitor")} className="rounded-lg border border-cyan-300/30 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-400/10">Security Monitor</button>
            <button
              onClick={() =>
                setConfirmState({
                  title: "Logout now?",
                  message: "Are you sure you want to logout from the admin dashboard?",
                  onConfirm: async () => {
                    logout();
                    navigate("/admin-login");
                  },
                })
              }
              className="rounded-lg border border-rose-300/30 px-3 py-1 text-xs text-rose-200 hover:bg-rose-400/10"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-7xl space-y-5 px-4 py-8 md:px-8">
        <section className={`${card} bg-gradient-to-br from-slate-800/70 to-slate-800/45 p-6`}>
          <p className="text-xs uppercase tracking-[0.18em] text-violet-300/80">Control Center</p>
          <h1 className="mt-2 text-2xl font-semibold md:text-3xl">Security Administration</h1>
          <p className="mt-2 text-sm text-slate-300">Review active threats, unlock users, and manage system response.</p>
          {msg && (
            <p className="mt-4 inline-flex rounded-md border border-cyan-300/25 bg-cyan-400/10 px-3 py-1.5 text-sm text-cyan-200">
              {msg}
            </p>
          )}
        </section>

        {stats && (
          <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {statCards.map((item, i) => (
              <motion.article
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`${card} relative overflow-hidden bg-gradient-to-b from-slate-700/42 to-slate-800/48 p-4 transition ${item.ring}`}
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${item.tone}`} />
                <div className={`pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full blur-2xl ${item.glow}`} />
                <div className="relative">
                  <p className="text-xs uppercase tracking-wider text-slate-300">{item.label}</p>
                  <p className={`mt-2 text-3xl font-semibold leading-none ${item.valueColor}`}>{item.value}</p>
                </div>
              </motion.article>
            ))}
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-2">
          <article className={`${card} bg-gradient-to-br from-violet-900/15 to-slate-800/55 p-6`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Restricted Accounts</h2>
              <span className="rounded-md border border-violet-300/30 bg-violet-400/10 px-2 py-1 text-xs text-violet-300">{restricted.length}</span>
            </div>
            {restricted.length === 0 ? (
              <p className="text-sm text-slate-300">No locked or temporarily blocked accounts right now.</p>
            ) : (
              <div className="space-y-2">
                {restricted.map((u) => (
                  <div key={u.username} className="flex items-center justify-between rounded-lg border border-slate-300/20 bg-slate-700/35 p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-100">{u.username}</p>
                        {u.is_locked && <span className="rounded-md border border-red-300/30 bg-red-400/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-300">Locked</span>}
                        {!u.is_locked && u.is_temporarily_blocked && <span className="rounded-md border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">Temp Block</span>}
                      </div>
                      <p className="text-xs text-slate-300">{u.email}</p>
                      {u.blocked_until && (
                        <p className="text-xs text-slate-400">Blocked until {new Date(u.blocked_until).toLocaleString()}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!u.is_locked && (
                        <button
                          onClick={() =>
                            setConfirmState({
                              title: `Permanently block ${u.username}?`,
                              message: "This will lock the account until an admin unlocks it.",
                              onConfirm: () => lockPermanently(u.username),
                            })
                          }
                          className="rounded-md border border-rose-300/35 bg-rose-400/10 px-3 py-1 text-xs text-rose-300"
                        >
                          Block Permanently
                        </button>
                      )}
                      {u.is_locked && (
                        <button
                          onClick={() =>
                            setConfirmState({
                              title: `Unlock ${u.username}?`,
                              message: "This will restore account access and clear active restrictions.",
                              onConfirm: () => unlock(u.username),
                            })
                          }
                          className="rounded-md border border-emerald-300/35 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300"
                        >
                          Unlock
                        </button>
                      )}
                      {u.is_temporarily_blocked && (
                        <button
                          onClick={() =>
                            setConfirmState({
                              title: `Clear temporary block for ${u.username}?`,
                              message: "This will allow login attempts again.",
                              onConfirm: () => unblock(u.username),
                            })
                          }
                          className="rounded-md border border-cyan-300/35 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300"
                        >
                          Clear Block
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className={`${card} bg-gradient-to-br from-cyan-900/15 to-slate-800/55 p-6`}>
            <h2 className="mb-4 text-xl font-semibold">Operations</h2>
            <div className="space-y-2">
              {["Review recent alerts", "Confirm user identity before unlock", "Escalate recurring incidents", "Track lock and unblock trends"].map((line) => (
                <div key={line} className="rounded-lg border border-slate-300/20 bg-slate-700/30 px-3 py-2 text-sm text-slate-200 transition hover:border-violet-300/30 hover:bg-violet-400/10">{line}</div>
              ))}
            </div>
          </article>
        </section>

        <section className={`${card} bg-gradient-to-br from-slate-800/65 to-slate-800/45 p-6`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Intrusion Alerts</h2>
            <span className="rounded-md border border-white/15 bg-white/[0.06] px-2 py-1 text-xs text-slate-200">{alerts.length} items</span>
          </div>
          {loading ? (
            <p className="text-sm text-slate-300">Loading alerts...</p>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-slate-300">No alerts found.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className="rounded-lg border border-slate-300/20 bg-slate-700/30 p-3 transition hover:border-cyan-300/25">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-100">{a.username}</span>
                    <span className={`rounded-md border px-2 py-0.5 text-xs ${badgeColor(a.alert_type)}`}>{a.alert_type?.replace(/_/g, " ")}</span>
                    {a.resolved && <span className="rounded-md border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-300">resolved</span>}
                  </div>
                  <p className="text-sm text-slate-200">{a.description}</p>
                  <p className="mt-1 text-xs text-slate-300">{a.ip_address || "-"} • score {a.risk_score} • {new Date(a.timestamp).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
