import { useState, useEffect } from "react";
import { motion } from "framer-motion";

/**
 * IntrusionBlockScreen
 * ─────────────────────
 * Shown when backend returns ids_blocked: true
 *
 * Props:
 *   blockType       : "temporary" | "permanent"
 *   timeRemaining   : number (seconds) — for temporary block
 *   alertType       : string — "device_blocked" | "account_locked" | etc
 *   message         : string
 *   onRetry         : fn — called when countdown expires (temporary only)
 */
export default function IntrusionBlockScreen({
  blockType = "temporary",
  timeRemaining = 0,
  alertType,
  message,
  onRetry,
}) {
  const [seconds, setSeconds] = useState(timeRemaining);

  useEffect(() => {
    setSeconds(timeRemaining);
  }, [timeRemaining]);

  useEffect(() => {
    if (blockType !== "temporary" || seconds <= 0) return;
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(t);
          onRetry?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [blockType, seconds, onRetry]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const isPermanent = blockType === "permanent";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        background: "rgba(6,17,31,0.97)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Background pulse */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isPermanent
            ? "radial-gradient(circle at 50% 40%, rgba(239,68,68,0.08) 0%, transparent 65%)"
            : "radial-gradient(circle at 50% 40%, rgba(245,158,11,0.08) 0%, transparent 65%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="relative w-full max-w-md rounded-3xl border p-8 text-center"
        style={{
          background: "rgba(11,16,32,0.95)",
          borderColor: isPermanent
            ? "rgba(239,68,68,0.3)"
            : "rgba(245,158,11,0.3)",
          boxShadow: isPermanent
            ? "0 0 60px rgba(239,68,68,0.12)"
            : "0 0 60px rgba(245,158,11,0.12)",
        }}
      >
        {/* Icon */}
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ repeat: Infinity, duration: 2.5 }}
          className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center text-4xl"
          style={{
            background: isPermanent
              ? "rgba(239,68,68,0.1)"
              : "rgba(245,158,11,0.1)",
            border: isPermanent
              ? "1px solid rgba(239,68,68,0.3)"
              : "1px solid rgba(245,158,11,0.3)",
          }}
        >
          {isPermanent ? "🔒" : "🚫"}
        </motion.div>

        {/* Title */}
        <h2
          className="text-2xl font-extrabold mb-2"
          style={{
            color: isPermanent ? "#EF4444" : "#F59E0B",
          }}
        >
          {isPermanent ? "Account Locked" : "Device Temporarily Blocked"}
        </h2>

        {/* Message */}
        <p className="text-sm mb-6" style={{ color: "#94A3B8" }}>
          {message ||
            (isPermanent
              ? "Suspicious activity detected. Your account has been locked for security."
              : "Too many failed attempts. Your device has been temporarily blocked.")}
        </p>

        {/* Countdown (temporary only) */}
        {!isPermanent && (
          <div className="mb-6">
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#64748B" }}>
              Try again in
            </p>
            <div
              className="text-5xl font-mono font-extrabold"
              style={{ color: seconds > 0 ? "#F59E0B" : "#22C55E" }}
            >
              {seconds > 0
                ? `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
                : "00:00"}
            </div>
            {seconds === 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm mt-2"
                style={{ color: "#22C55E" }}
              >
                Block expired — you may try again
              </motion.p>
            )}
          </div>
        )}

        {/* Progress bar (temporary) */}
        {!isPermanent && timeRemaining > 0 && (
          <div
            className="w-full h-1.5 rounded-full mb-6"
            style={{ background: "rgba(255,255,255,0.07)" }}
          >
            <motion.div
              className="h-1.5 rounded-full"
              style={{ background: "linear-gradient(90deg, #F59E0B, #EF4444)" }}
              initial={{ width: "100%" }}
              animate={{ width: `${(seconds / timeRemaining) * 100}%` }}
              transition={{ duration: 1, ease: "linear" }}
            />
          </div>
        )}

        {/* Info tiles */}
        <div className="grid grid-cols-2 gap-3 mb-6 text-left">
          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-xs" style={{ color: "#64748B" }}>Alert Type</p>
            <p className="text-sm font-semibold text-white mt-0.5">
              {alertType?.replace(/_/g, " ") || "Security Alert"}
            </p>
          </div>
          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-xs" style={{ color: "#64748B" }}>Status</p>
            <p
              className="text-sm font-semibold mt-0.5"
              style={{ color: isPermanent ? "#EF4444" : "#F59E0B" }}
            >
              {isPermanent ? "Locked" : "Blocked"}
            </p>
          </div>
        </div>

        {/* Actions */}
        {isPermanent ? (
          <div className="space-y-3">
            <p className="text-xs" style={{ color: "#64748B" }}>
              Contact your system administrator to restore access.
            </p>
            <button
              onClick={() => (window.location.href = "/")}
              className="w-full rounded-xl py-3 text-sm font-semibold transition-all"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#EF4444",
              }}
            >
              Back to Home
            </button>
          </div>
        ) : (
          seconds === 0 && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={onRetry}
              className="w-full rounded-xl py-3 text-sm font-bold transition-all"
              style={{
                background: "linear-gradient(135deg, #00E5FF, #22C55E)",
                color: "#06111F",
              }}
            >
              Try Login Again
            </motion.button>
          )
        )}
      </motion.div>
    </div>
  );
}