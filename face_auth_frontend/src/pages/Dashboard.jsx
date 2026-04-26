import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// ── Animated Shield Icon ──────────────────────────────────────────────────────
function ShieldIcon({ size = 56 }) {
  return (
    <motion.svg
      width={size} height={size} viewBox="0 0 56 56" fill="none"
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.2 }}
    >
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00E5FF" />
          <stop offset="100%" stopColor="#22C55E" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <motion.path
        d="M28 4L8 13v14c0 11.6 8.5 22.4 20 25 11.5-2.6 20-13.4 20-25V13L28 4z"
        fill="url(#sg)" fillOpacity="0.15" stroke="url(#sg)" strokeWidth="1.5"
        filter="url(#glow)"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, delay: 0.3 }}
      />
      <motion.path
        d="M22 28l4 4 8-8"
        stroke="#00E5FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        filter="url(#glow)"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, delay: 1.2 }}
      />
    </motion.svg>
  );
}

// ── Glowing pulse dot ─────────────────────────────────────────────────────────
function PulseDot({ color = "#22C55E" }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: color }} />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: color }} />
    </span>
  );
}

// ── Security score bar ────────────────────────────────────────────────────────
function ScoreBar({ label, value, color, delay = 0 }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span style={{ color: "#94A3B8" }}>{label}</span>
        <span style={{ color }} className="font-mono font-semibold">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.07)" }}>
        <motion.div
          className="h-1.5 rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, delay, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ── Timeline step ─────────────────────────────────────────────────────────────
function TimelineStep({ icon, label, time, done, delay }) {
  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 border"
        style={{
          background: done ? "rgba(0,229,255,0.12)" : "rgba(255,255,255,0.04)",
          borderColor: done ? "rgba(0,229,255,0.35)" : "rgba(255,255,255,0.08)",
          boxShadow: done ? "0 0 12px rgba(0,229,255,0.2)" : "none",
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{label}</p>
        <p className="text-xs" style={{ color: "#64748B" }}>{time}</p>
      </div>
      {done && (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>
          ✓ Done
        </span>
      )}
    </motion.div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, accent, sub, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="rounded-2xl p-5 border relative overflow-hidden group cursor-default"
      style={{
        background: "rgba(11,16,32,0.7)",
        borderColor: "rgba(255,255,255,0.07)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 0%, ${accent}18 0%, transparent 70%)` }}
      />
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-4"
        style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
      >
        {icon}
      </div>
      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#64748B" }}>{label}</p>
      <p className="text-xl font-bold text-white leading-tight">{value}</p>
      {sub && <p className="text-xs mt-1.5" style={{ color: "#475569" }}>{sub}</p>}
    </motion.div>
  );
}

// ── Logout Modal ──────────────────────────────────────────────────────────────
function LogoutModal({ onConfirm, onCancel }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onCancel}
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-3xl p-7 border"
          style={{
            background: "rgba(11,16,32,0.98)",
            borderColor: "rgba(239,68,68,0.25)",
            boxShadow: "0 0 60px rgba(239,68,68,0.15)",
          }}
        >
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl"
            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
            🔓
          </div>
          <h2 className="text-center text-xl font-bold text-white">End Session?</h2>
          <p className="mt-2 text-center text-sm" style={{ color: "#94A3B8" }}>
            You'll need to complete all three authentication steps again to re-access the vault.
          </p>
          <div className="mt-6 flex gap-3">
            <button onClick={onCancel}
              className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#94A3B8" }}
              onMouseEnter={e => { e.target.style.borderColor = "rgba(255,255,255,0.25)"; e.target.style.color = "#fff"; }}
              onMouseLeave={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.color = "#94A3B8"; }}
            >
              Stay In
            </button>
            <button onClick={onConfirm}
              className="flex-1 rounded-xl py-3 text-sm font-bold text-white transition-all"
              style={{ background: "linear-gradient(135deg, #dc2626, #ef4444)" }}
              onMouseEnter={e => e.target.style.opacity = "0.85"}
              onMouseLeave={e => e.target.style.opacity = "1"}
            >
              Logout
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleLogout = () => {
    setShowLogout(false);
    logout();
    navigate("/", { replace: true });
  };

  const loginTime = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const loginDate = time.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  return (
    <div
      className="relative min-h-screen text-white overflow-x-hidden"
      style={{
        background: "linear-gradient(135deg, #06111F 0%, #0B1020 50%, #060D18 100%)",
        fontFamily: "'DM Sans', 'Sora', sans-serif",
      }}
    >
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-[50vw] h-[50vw] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #00E5FF22 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute top-[10%] right-[-5%] w-[40vw] h-[40vw] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #8B5CF622 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute bottom-[-5%] left-[30%] w-[35vw] h-[35vw] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #22C55E22 0%, transparent 70%)", filter: "blur(80px)" }} />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(rgba(0,229,255,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,0.3) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {showLogout && <LogoutModal onConfirm={handleLogout} onCancel={() => setShowLogout(false)} />}

      {/* ── Nav ── */}
      <nav
        className="relative z-20 flex items-center justify-between px-6 md:px-10 py-4 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", background: "rgba(6,17,31,0.8)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
            style={{ background: "linear-gradient(135deg, #00E5FF, #22C55E)", color: "#06111F", fontWeight: 800 }}>
            S
          </div>
          <span className="text-lg font-bold tracking-tight" style={{ color: "#F8FAFC" }}>Secure Hub</span>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm" style={{ color: "#64748B" }}>
          <span>{loginDate}</span>
          <span className="font-mono" style={{ color: "#00E5FF" }}>{loginTime}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm"
            style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <PulseDot color="#22C55E" />
            <span style={{ color: "#22C55E" }} className="font-medium hidden sm:inline">{user}</span>
          </div>
          <button
            onClick={() => setShowLogout(true)}
            className="px-4 py-1.5 rounded-xl text-sm font-semibold transition-all"
            style={{ border: "1px solid rgba(239,68,68,0.3)", color: "#F87171" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-7xl px-4 md:px-8 pb-16 pt-8 space-y-6">

        {/* ── Hero welcome card ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl p-8 md:p-10 border relative overflow-hidden"
          style={{
            background: "rgba(11,16,32,0.6)",
            borderColor: "rgba(0,229,255,0.15)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 0 80px rgba(0,229,255,0.06), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* Decorative corner glow */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(0,229,255,0.08) 0%, transparent 70%)", transform: "translate(30%, -30%)" }} />

          <div className="flex flex-col md:flex-row md:items-center gap-8">
            <div className="flex-shrink-0">
              <div className="w-24 h-24 rounded-3xl flex items-center justify-center relative"
                style={{ background: "rgba(0,229,255,0.07)", border: "1px solid rgba(0,229,255,0.2)", boxShadow: "0 0 40px rgba(0,229,255,0.12)" }}>
                <ShieldIcon size={52} />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "#22C55E", border: "2px solid #06111F" }}>
                  <span className="text-xs">✓</span>
                </div>
              </div>
            </div>

            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.25em] mb-2 font-medium"
                style={{ color: "#00E5FF" }}>
                Authentication Complete — All Checks Passed
              </p>
              <h2 className="text-3xl md:text-4xl font-extrabold leading-tight mb-3">
                Welcome back,{" "}
                <span style={{ background: "linear-gradient(90deg, #00E5FF, #22C55E)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {user}
                </span>
              </h2>
              <p className="text-sm md:text-base leading-relaxed max-w-xl" style={{ color: "#94A3B8" }}>
                Your identity was verified through 3-factor authentication. All biometric checks are clean. Your private vault is now accessible.
              </p>

              <div className="flex flex-wrap gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.98 }}
                  onClick={() => navigate("/vault/library")}
                  className="px-6 py-2.5 rounded-xl font-semibold text-sm"
                  style={{ background: "linear-gradient(135deg, #00E5FF, #0EA5E9)", color: "#06111F", boxShadow: "0 4px 24px rgba(0,229,255,0.3)" }}
                >
                  Open Vault
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.98 }}
                  onClick={() => navigate("/vault/editor")}
                  className="px-6 py-2.5 rounded-xl font-semibold text-sm border transition-all"
                  style={{ borderColor: "rgba(0,229,255,0.3)", color: "#00E5FF", background: "rgba(0,229,255,0.06)" }}
                >
                  Add Private Data
                </motion.button>
              </div>
            </div>

            {/* Live security score ring */}
            <div className="flex-shrink-0 hidden lg:flex flex-col items-center gap-2">
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                  <motion.circle cx="50" cy="50" r="42" fill="none"
                    stroke="url(#scoreGrad)" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray="263.9"
                    initial={{ strokeDashoffset: 263.9 }}
                    animate={{ strokeDashoffset: 263.9 * 0.08 }}
                    transition={{ duration: 1.4, delay: 0.5, ease: "easeOut" }}
                  />
                  <defs>
                    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#00E5FF" />
                      <stop offset="100%" stopColor="#22C55E" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-extrabold text-white">92</span>
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: "#64748B" }}>Score</span>
                </div>
              </div>
              <p className="text-xs font-semibold" style={{ color: "#22C55E" }}>Excellent</p>
            </div>
          </div>
        </motion.section>

        {/* ── Stat cards row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="🔐" label="Auth Pipeline" value="OTP → Face → Voice" accent="#00E5FF"
            sub="3 of 3 checks passed" delay={0.1} />
          <StatCard icon="🗄️" label="Private Vault" value="User-Scoped" accent="#8B5CF6"
            sub="Isolated per account" delay={0.15} />
          <StatCard icon="🛡️" label="Risk Posture" value="Low" accent="#22C55E"
            sub="Liveness check clean" delay={0.2} />
          <StatCard icon="⚡" label="Session Health" value="Active" accent="#F59E0B"
            sub="Valid & ready" delay={0.25} />
        </div>

        {/* ── Middle row: Security score + MFA Timeline ── */}
        <div className="grid lg:grid-cols-2 gap-4">

          {/* Security Score */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="rounded-2xl p-6 border"
            style={{
              background: "rgba(11,16,32,0.7)",
              borderColor: "rgba(255,255,255,0.07)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-white text-base">Security Score</h3>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background: "rgba(34,197,94,0.12)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.2)" }}>
                92 / 100
              </span>
            </div>
            <div className="space-y-4">
              <ScoreBar label="Identity Verification" value={98} color="#00E5FF" delay={0.4} />
              <ScoreBar label="Biometric Strength" value={91} color="#22C55E" delay={0.5} />
              <ScoreBar label="Session Integrity" value={95} color="#8B5CF6" delay={0.6} />
              <ScoreBar label="Vault Access Policy" value={88} color="#F59E0B" delay={0.7} />
            </div>
          </motion.div>

          {/* MFA Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="rounded-2xl p-6 border"
            style={{
              background: "rgba(11,16,32,0.7)",
              borderColor: "rgba(255,255,255,0.07)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-white text-base">MFA Completion</h3>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background: "rgba(0,229,255,0.1)", color: "#00E5FF", border: "1px solid rgba(0,229,255,0.2)" }}>
                All Passed
              </span>
            </div>
            <div className="space-y-4">
              <TimelineStep icon="📩" label="OTP Verification" time="Email code confirmed" done delay={0.4} />
              <div className="ml-4 w-px h-3" style={{ background: "rgba(0,229,255,0.2)" }} />
              <TimelineStep icon="👁️" label="Face Recognition" time="Liveness check passed" done delay={0.5} />
              <div className="ml-4 w-px h-3" style={{ background: "rgba(0,229,255,0.2)" }} />
              <TimelineStep icon="🎤" label="Voice Authentication" time="Phrase matched successfully" done delay={0.6} />
              <div className="ml-4 w-px h-3" style={{ background: "rgba(34,197,94,0.2)" }} />
              <TimelineStep icon="🔓" label="Vault Unlocked" time="Full access granted" done delay={0.7} />
            </div>
          </motion.div>
        </div>

        {/* ── Bottom row: Recent activity + Quick actions ── */}
        <div className="grid lg:grid-cols-3 gap-4">

          {/* Recent Login Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="rounded-2xl p-6 border lg:col-span-2"
            style={{
              background: "rgba(11,16,32,0.7)",
              borderColor: "rgba(255,255,255,0.07)",
              backdropFilter: "blur(12px)",
            }}
          >
            <h3 className="font-bold text-white text-base mb-5">Recent Login Activity</h3>
            <div className="space-y-3">
              {[
                { status: "success", label: "Successful Login", detail: "OTP + Face + Voice", when: "Just now", icon: "✅" },
                { status: "success", label: "Successful Login", detail: "OTP + Face + Voice", when: "2 hours ago", icon: "✅" },
                { status: "warn", label: "Voice retry", detail: "2nd attempt passed", when: "Yesterday", icon: "⚠️" },
                { status: "success", label: "Successful Login", detail: "OTP + Face + Voice", when: "2 days ago", icon: "✅" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + i * 0.07 }}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <span className="text-lg">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-xs" style={{ color: "#64748B" }}>{item.detail}</p>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: "#475569" }}>{item.when}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            className="rounded-2xl p-6 border"
            style={{
              background: "rgba(11,16,32,0.7)",
              borderColor: "rgba(255,255,255,0.07)",
              backdropFilter: "blur(12px)",
            }}
          >
            <h3 className="font-bold text-white text-base mb-5">Quick Actions</h3>
            <div className="space-y-3">
              {[
                { label: "Open Vault", icon: "🗄️", color: "#00E5FF", action: () => navigate("/vault/library") },
                { label: "Add Private Data", icon: "✏️", color: "#8B5CF6", action: () => navigate("/vault/editor") },
                { label: "Security Settings", icon: "⚙️", color: "#F59E0B", action: () => {} },
                { label: "Sign Out", icon: "🔓", color: "#EF4444", action: () => setShowLogout(true) },
              ].map((item, i) => (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.07 }}
                  whileHover={{ x: 3 }}
                  onClick={item.action}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = `${item.color}30`}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"}
                >
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: `${item.color}18`, border: `1px solid ${item.color}30` }}>
                    {item.icon}
                  </span>
                  <span className="text-sm font-medium text-white">{item.label}</span>
                  <span className="ml-auto text-xs" style={{ color: "#475569" }}>→</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Info tiles ── */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              heading: "What This Project Protects",
              body: "Sensitive notes, private credentials, and user-managed records inside a secured workspace.",
              icon: "🔒", color: "#00E5FF",
            },
            {
              heading: "How Data Is Segregated",
              body: "Vault data is isolated per authenticated account to prevent cross-user visibility.",
              icon: "🗂️", color: "#8B5CF6",
            },
            {
              heading: "Access Philosophy",
              body: "Trust is established progressively: identity checks first, private data access second.",
              icon: "🧠", color: "#22C55E",
            },
          ].map((tile, i) => (
            <motion.article
              key={tile.heading}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 + i * 0.08 }}
              whileHover={{ y: -2 }}
              className="rounded-2xl p-5 border group cursor-default relative overflow-hidden"
              style={{
                background: "rgba(11,16,32,0.6)",
                borderColor: "rgba(255,255,255,0.07)",
                backdropFilter: "blur(12px)",
              }}
            >
              <div className="absolute top-0 left-0 w-full h-0.5 rounded-t-2xl"
                style={{ background: `linear-gradient(90deg, ${tile.color}60, transparent)` }} />
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-4"
                style={{ background: `${tile.color}15`, border: `1px solid ${tile.color}25` }}>
                {tile.icon}
              </div>
              <h3 className="text-sm font-bold text-white mb-2">{tile.heading}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#64748B" }}>{tile.body}</p>
            </motion.article>
          ))}
        </div>

      </main>
    </div>
  );
}