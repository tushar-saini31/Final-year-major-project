import { motion, AnimatePresence } from "framer-motion";

/**
 * AttemptsWarningPopup
 * ──────────────────────
 * Shown when backend returns show_warning: true
 * (3 or 4 failed attempts — block is imminent)
 *
 * Props:
 *   remaining : number (attempts left before block)
 *   onDismiss : fn
 */
export default function AttemptsWarningPopup({ remaining, onDismiss }) {
  const isFinal = remaining <= 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.88, y: 24 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-3xl border p-7 text-center"
          style={{
            background: "rgba(11,16,32,0.98)",
            borderColor: isFinal
              ? "rgba(239,68,68,0.4)"
              : "rgba(245,158,11,0.4)",
            boxShadow: isFinal
              ? "0 0 50px rgba(239,68,68,0.15)"
              : "0 0 50px rgba(245,158,11,0.15)",
          }}
        >
          {/* Icon */}
          <motion.div
            animate={isFinal ? { scale: [1, 1.1, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.2 }}
            className="text-5xl mb-4"
          >
            {isFinal ? "🚨" : "⚠️"}
          </motion.div>

          <h3
            className="text-xl font-extrabold mb-2"
            style={{ color: isFinal ? "#EF4444" : "#F59E0B" }}
          >
            {isFinal ? "Final Warning!" : "Security Warning"}
          </h3>

          <p className="text-sm mb-5" style={{ color: "#94A3B8" }}>
            {isFinal
              ? "One more failed attempt will temporarily block your device for 30 minutes."
              : `You have ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining before your device is blocked.`}
          </p>

          {/* Attempt dots */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((n) => {
              const used = 5 - remaining >= n;
              const isNext = 5 - remaining + 1 === n;
              return (
                <div
                  key={n}
                  className="w-3 h-3 rounded-full transition-all"
                  style={{
                    background: used
                      ? "#EF4444"
                      : isNext
                      ? "#F59E0B"
                      : "rgba(255,255,255,0.12)",
                    boxShadow: isNext ? "0 0 8px rgba(245,158,11,0.6)" : "none",
                  }}
                />
              );
            })}
          </div>

          <p className="text-xs mb-5" style={{ color: "#475569" }}>
            If this isn't you, do not continue — contact your administrator.
          </p>

          <button
            onClick={onDismiss}
            className="w-full rounded-xl py-3 text-sm font-bold transition-all"
            style={{
              background: isFinal
                ? "rgba(239,68,68,0.15)"
                : "rgba(245,158,11,0.15)",
              border: isFinal
                ? "1px solid rgba(239,68,68,0.4)"
                : "1px solid rgba(245,158,11,0.4)",
              color: isFinal ? "#EF4444" : "#F59E0B",
            }}
          >
            I Understand — Continue
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}