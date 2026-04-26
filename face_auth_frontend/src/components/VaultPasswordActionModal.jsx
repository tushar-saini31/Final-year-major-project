import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function VaultPasswordActionModal({
  open,
  actionLabel,
  title,
  description,
  onVerify,
  onConfirm,
  onCancel,
}) {
  const [password, setPassword] = useState("");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setVerified(false);
      setError("");
      setWorking(false);
    }
  }, [open]);

  if (!open) return null;

  const verifyPassword = async () => {
    setError("");
    if (!password) {
      setError("Password is required.");
      return;
    }

    try {
      setWorking(true);
      if (onVerify) {
        await onVerify(password);
      }
      setVerified(true);
    } catch (err) {
      setError(err?.response?.data?.detail || "Incorrect password. Action blocked.");
    } finally {
      setWorking(false);
    }
  };

  const confirmAction = async () => {
    if (!onConfirm) return;
    try {
      setWorking(true);
      await onConfirm(password);
    } finally {
      setWorking(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
        >
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="mt-2 text-sm text-slate-300">{description}</p>

          {!verified ? (
            <>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Enter password"
                disabled={working}
                className="mt-4 w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-emerald-400 disabled:opacity-60"
              />
              {error && (
                <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {error}
                </p>
              )}
              <div className="mt-5 flex gap-3">
                <button
                  onClick={verifyPassword}
                  disabled={working}
                  className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {working ? "Verifying..." : "Verify Password"}
                </button>
                <button
                  onClick={onCancel}
                  disabled={working}
                  className="flex-1 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-4 text-sm text-emerald-300">Password verified. Continue?</p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={confirmAction}
                  disabled={working}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {working ? "Working..." : actionLabel}
                </button>
                <button
                  onClick={onCancel}
                  disabled={working}
                  className="flex-1 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Do Not {actionLabel}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
