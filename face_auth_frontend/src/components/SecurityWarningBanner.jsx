import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

const BASE = "http://127.0.0.1:8000";

/**
 * SecurityWarningBanner
 * ───────────────────────
 * Shown on the dashboard when risk_level === "medium"
 * (new device or browser change detected)
 *
 * Props:
 *   username    : string
 *   deviceId    : string
 *   deviceName  : string
 *   userAgent   : string
 *   alertType   : string
 *   onDismiss   : fn
 */
export default function SecurityWarningBanner({
  username,
  deviceId,
  deviceName,
  userAgent,
  alertType,
  onDismiss,
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [answer, setAnswer]   = useState(null); // "yes" | "no"

  const handleYes = async () => {
    setLoading(true);
    try {
      await axios.post(`${BASE}/intrusion/trust-device`, {
        username,
        device_id: deviceId,
        device_name: deviceName,
        user_agent: userAgent,
      });
      setAnswer("yes");
      setDone(true);
      setTimeout(() => onDismiss?.(), 2000);
    } catch {
      setAnswer("yes");
      setDone(true);
      setTimeout(() => onDismiss?.(), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleNo = async () => {
    setLoading(true);
    try {
      await axios.post(`${BASE}/intrusion/report-suspicious`, { username });
    } catch {
      // still proceed
    } finally {
      setLoading(false);
      setAnswer("no");
      setDone(true);
      // Force logout after short delay
      setTimeout(() => {
        window.location.href = "/";
      }, 2500);
    }
  };

  return (
    <AnimatePresence>
      {!done ? (
        <motion.div
          key="banner"
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className="fixed top-4 left-1/2 z-50 w-full max-w-lg px-4"
          style={{ transform: "translateX(-50%)" }}
        >
          <div
            className="rounded-2xl border p-5 shadow-2xl"
            style={{
              background: "rgba(11,16,32,0.97)",
              borderColor: "rgba(245,158,11,0.4)",
              boxShadow: "0 8px 40px rgba(245,158,11,0.15)",
              backdropFilter: "blur(16px)",
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(245,158,11,0.3)",
                }}
              >
                🔍
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm mb-1">
                  {alertType === "new_device"
                    ? "New device detected"
                    : "Unusual login activity detected"}
                </p>
                <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>
                  We noticed a login from{" "}
                  <span style={{ color: "#F59E0B" }}>{deviceName}</span>.
                  Was this you?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleYes}
                    disabled={loading}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                    style={{
                      background: "rgba(34,197,94,0.15)",
                      border: "1px solid rgba(34,197,94,0.35)",
                      color: "#22C55E",
                    }}
                  >
                    ✓ Yes, trust this device
                  </button>
                  <button
                    onClick={handleNo}
                    disabled={loading}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                    style={{
                      background: "rgba(239,68,68,0.12)",
                      border: "1px solid rgba(239,68,68,0.3)",
                      color: "#EF4444",
                    }}
                  >
                    ✗ No, this wasn't me
                  </button>
                </div>
              </div>
              <button
                onClick={onDismiss}
                className="text-xs flex-shrink-0"
                style={{ color: "#475569" }}
              >
                ✕
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="done"
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          className="fixed top-4 left-1/2 z-50 w-full max-w-lg px-4"
          style={{ transform: "translateX(-50%)" }}
        >
          <div
            className="rounded-2xl border p-4 text-center text-sm font-semibold"
            style={{
              background: "rgba(11,16,32,0.97)",
              borderColor: answer === "yes"
                ? "rgba(34,197,94,0.4)"
                : "rgba(239,68,68,0.4)",
              color: answer === "yes" ? "#22C55E" : "#EF4444",
              backdropFilter: "blur(16px)",
            }}
          >
            {answer === "yes"
              ? "✓ Device trusted — you won't be asked again on this browser"
              : "🔒 Account locked for safety. Redirecting..."}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}