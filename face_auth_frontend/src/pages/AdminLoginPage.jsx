import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { adminLogin } from "../api/auth";
import { useAuth } from "../context/AuthContext";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { loginAndComplete } = useAuth();

  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!password.trim()) {
      setError("Admin password is required.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await adminLogin({ password: password.trim() });
      if (!result?.success) throw new Error("Admin login failed");

      loginAndComplete(result.username, result.access_token, { username: result.username }, "admin");
      navigate("/admin", { replace: true });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || "Invalid admin password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-8">
        <nav className="flex items-center justify-between border-b border-white/10 pb-5">
          <button
            onClick={() => navigate("/")}
            className="text-lg font-semibold text-cyan-300 transition hover:text-cyan-200"
          >
            Secure Hub
          </button>
          <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-1 text-xs uppercase tracking-[0.25em] text-violet-200">
            Admin Access
          </span>
        </nav>

        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur md:p-10"
          >
            <p className="text-sm uppercase tracking-[0.3em] text-violet-300">Secure Hub admin</p>
            <h1 className="mt-3 text-3xl font-bold">Admin login</h1>
            <p className="mt-3 text-sm text-slate-300">
              Only the configured admin password can enter the admin control panels.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <label className="flex flex-col gap-2 text-sm text-slate-200">
                <span>Admin Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="Enter admin password"
                  autoComplete="current-password"
                  className={`rounded-2xl border bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-violet-400
                    ${error ? "border-red-500/70" : "border-white/10"}`}
                />
              </label>

              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-violet-500 px-6 py-3 font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Verifying..." : "Enter Admin Dashboard"}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="rounded-2xl border border-white/15 px-6 py-3 font-semibold text-slate-200 transition hover:border-cyan-400 hover:text-white"
                >
                  Back to home
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
