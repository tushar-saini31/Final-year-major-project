import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { verifyOtp } from "../api/auth";

export default function OtpVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = location.state?.mode === "register" ? "register" : "login";
  const profile = location.state?.profile;

  const [otp, setOtp] = useState("");
  const [message] = useState(location.state?.otpHint || "OTP has been sent to your phone.");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile?.username) {
      navigate("/otp-details", { state: { mode }, replace: true });
    }
  }, [profile, navigate, mode]);

  const handleVerify = async (event) => {
    event.preventDefault();
    setError("");

    if (!otp.trim() || otp.trim().length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await verifyOtp({
        username: profile.username,
        otp_code: otp.trim(),
      });

      if (!result?.success) throw new Error("OTP verify failed");

      navigate("/face-auth", {
        state: {
          mode,
          profile,
          otpVerified: true,
        },
      });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail === "OTP expired") {
        setError("Your OTP has expired. Please go back and request a new one.");
      } else if (detail === "invalid OTP") {
        setError("Incorrect OTP. Please check and try again.");
      } else if (detail === "no OTP pending for this user") {
        setError("No OTP found. Please go back and request a new one.");
      } else {
        setError("Verification failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Resend requires re-entering password (backend now requires it),
  // so we send the user back to the details page instead.
  const handleResend = () => {
    navigate("/otp-details", {
      state: { mode },
      replace: false,
    });
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
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1 text-xs uppercase tracking-[0.25em] text-cyan-200">
            Step 2 of 4
          </span>
        </nav>

        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur md:p-10"
          >
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">OTP verification</p>
            <h1 className="mt-3 text-3xl font-bold">Verify your one-time code</h1>
            <p className="mt-3 text-sm text-slate-300">
              Enter the 6-digit OTP sent to your registered contact.
              {mode === "login" && " Your password was verified successfully."}
            </p>

            {message && (
              <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {message}
              </div>
            )}

            <form onSubmit={handleVerify} className="mt-6 space-y-5">
              <label className="flex flex-col gap-2 text-sm text-slate-200">
                <span>Enter OTP</span>
                <input
                  value={otp}
                  onChange={(e) => {
                    // Only allow digits, max 6
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setOtp(val);
                    if (error) setError("");
                  }}
                  placeholder="123456"
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className={`rounded-2xl border bg-slate-950/70 px-4 py-3 text-lg tracking-[0.35em] text-white outline-none transition focus:border-cyan-400
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
                  disabled={submitting || otp.length !== 6}
                  className="rounded-2xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Verifying..." : "Continue to face auth"}
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  className="rounded-2xl border border-white/15 px-6 py-3 font-semibold text-slate-200 transition hover:border-cyan-400 hover:text-white"
                >
                  ← Re-enter details
                </button>
              </div>

              <p className="text-xs text-slate-500">
                OTP expired or not received? Click "Re-enter details" to go back and request a new one.
              </p>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
