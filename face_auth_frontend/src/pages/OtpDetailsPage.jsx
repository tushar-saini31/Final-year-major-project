import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { loginStart, registerStart } from "../api/auth";
import { getDeviceInfo } from "../utils/deviceFingerprint";   // NEW
import IntrusionBlockScreen from "../components/IntrusionBlockScreen";   // NEW
import AttemptsWarningPopup from "../components/AttemptsWarningPopup";   // NEW

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? null
    : "Enter a valid email address";
}
function validatePhone(phone) {
  const d = phone.replace(/\D/g, "");
  if (d.length !== 10) return "Phone number must be exactly 10 digits";
  if (!/^[6-9]/.test(d)) return "Must start with 6, 7, 8, or 9";
  return null;
}
function validatePassword(password) {
  if (password.length < 8) return "At least 8 characters";
  if (!/[A-Z]/.test(password)) return "At least one uppercase letter";
  if (!/[0-9]/.test(password)) return "At least one number";
  return null;
}
function normalizePhone(phone) {
  return `+91${phone.replace(/\D/g, "")}`;
}

const registerFields = [
  { name: "username",        label: "Username",         type: "text",     placeholder: "Letters, numbers, underscores" },
  { name: "fullName",        label: "Full name",        type: "text",     placeholder: "Your full name" },
  { name: "email",           label: "Email",            type: "email",    placeholder: "name@example.com" },
  { name: "phone",           label: "Phone number",     type: "tel",      placeholder: "10-digit mobile number" },
  { name: "designation",     label: "Designation",      type: "text",     placeholder: "e.g. Software Engineer" },
  { name: "password",        label: "Password",         type: "password", placeholder: "Min 8 chars, 1 uppercase, 1 number" },
  { name: "confirmPassword", label: "Confirm password", type: "password", placeholder: "Re-enter password" },
];
const loginFields = [
  { name: "username", label: "Username", type: "text",     placeholder: "Your username" },
  { name: "email",    label: "Email",    type: "email",    placeholder: "Registered email" },
  { name: "password", label: "Password", type: "password", placeholder: "Your password" },
];
const initialValues = {
  username: "", fullName: "", email: "", phone: "",
  designation: "", password: "", confirmPassword: "",
};

export default function OtpDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState(location.state?.mode === "register" ? "register" : "login");

  const fields = useMemo(() => (mode === "register" ? registerFields : loginFields), [mode]);
  const [form, setForm]             = useState(initialValues);
  const [errors, setErrors]         = useState({});
  const [submitErr, setSubmitErr]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPass, setShowPass]     = useState(false);
  const [showConf, setShowConf]     = useState(false);

  // IDS states
  const [blockData, setBlockData]   = useState(null);   // {type, timeRemaining, alertType, message}
  const [warnData, setWarnData]     = useState(null);   // {remaining}

  const switchMode = (m) => {
    setMode(m);
    setForm(initialValues);
    setErrors({});
    setSubmitErr("");
    setBlockData(null);
    setWarnData(null);
  };

  const validateField = (name, value) => {
    switch (name) {
      case "username":
        if (value.trim().length < 3) return "At least 3 characters";
        if (!/^[a-zA-Z0-9_]+$/.test(value.trim())) return "Letters, numbers, underscores only";
        return null;
      case "fullName":     return value.trim().length < 2 ? "Full name required" : null;
      case "email":        return validateEmail(value);
      case "phone":        return validatePhone(value);
      case "designation":  return value.trim().length < 2 ? "Designation required" : null;
      case "password":     return mode === "login" ? (value ? null : "Required") : validatePassword(value);
      case "confirmPassword": return value !== form.password ? "Passwords don't match" : null;
      default:             return null;
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: validateField(name, value) }));
    if (submitErr) setSubmitErr("");
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setErrors((p) => ({ ...p, [name]: validateField(name, value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitErr("");
    setBlockData(null);
    setWarnData(null);

    const newErrors = {};
    fields.forEach(({ name }) => {
      const err = validateField(name, form[name] ?? "");
      if (err) newErrors[name] = err;
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSubmitErr("Please fix the errors above.");
      return;
    }

    setSubmitting(true);

    // Get device fingerprint
    const { deviceId, deviceName } = getDeviceInfo();

    try {
      const payload = {
        ...form,
        username: form.username.trim(),
        phone: form.phone ? normalizePhone(form.phone) : "",
        device_id: deviceId,       // attach to request
        device_name: deviceName,
      };

      let result;
      if (mode === "register") {
        result = await registerStart(payload);
      } else {
        result = await loginStart({
          username:    payload.username,
          email:       payload.email,
          password:    payload.password,
          device_id:   deviceId,
          device_name: deviceName,
        });
      }

      // ── IDS response handling ───────────────────────────────────────────
      if (result?.ids_blocked) {
        setBlockData({
          type:          result.block_type,
          timeRemaining: result.time_remaining || 0,
          alertType:     result.alert_type,
          message:       result.message,
        });
        setSubmitting(false);
        return;
      }

      if (result?.success === false) {
        if (result?.show_warning && result?.attempts_remaining != null) {
          setWarnData({ remaining: result.attempts_remaining });
        }

        if (result?.message === "invalid password") {
          setErrors((p) => ({ ...p, password: "Incorrect password" }));
          setSubmitErr("Incorrect password.");
        } else {
          setSubmitErr(result?.message || "Verification failed. Please try again.");
        }
        setSubmitting(false);
        return;
      }

      // ── Normal flow ─────────────────────────────────────────────────────
      navigate("/otp-verify", {
        state: {
          mode,
          profile: { ...payload, device_id: deviceId, device_name: deviceName },
          otpHint: result?.message || "OTP sent.",
          // Pass IDS warning to dashboard if medium risk
          ids_risk_level: result?.risk_level,
          ids_alert_type: result?.alert_type,
        },
      });

    } catch (err) {
      const detail = err?.response?.data?.detail;
      const res    = err?.response?.data;

      // Backend may return IDS block even as non-2xx in some edge cases
      if (res?.ids_blocked) {
        setBlockData({
          type:          res.block_type,
          timeRemaining: res.time_remaining || 0,
          alertType:     res.alert_type,
          message:       res.message,
        });
        setSubmitting(false);
        return;
      }

      // Show attempt warning from error response
      if (res?.show_warning && res?.success === false) {
        setWarnData({ remaining: res.attempts_remaining });
        setSubmitting(false);
        return;
      }

      const fieldErrors = {};
      if (typeof detail === "string") {
        switch (detail) {
          case "username not found":
            fieldErrors.username = "No account with this username";
            setSubmitErr("Username not found.");
            break;
          case "email does not match":
            fieldErrors.email = "Email doesn't match account";
            setSubmitErr("Email does not match.");
            break;
          case "invalid password":
            fieldErrors.password = "Incorrect password";
            setSubmitErr("Incorrect password.");
            break;
          case "username already exists":
            fieldErrors.username = "Username taken";
            setSubmitErr("Username already taken.");
            break;
          case "email already exists":
            fieldErrors.email = "Email already registered";
            setSubmitErr("Email already exists.");
            break;
          default:
            setSubmitErr(`Error: ${detail}`);
        }
      } else {
        setSubmitErr("Something went wrong. Please try again.");
      }
      if (Object.keys(fieldErrors).length > 0) {
        setErrors((p) => ({ ...p, ...fieldErrors }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    const err       = errors[field.name];
    const isPass    = field.name === "password";
    const isConf    = field.name === "confirmPassword";
    const show      = isPass ? showPass : isConf ? showConf : false;
    const toggle    = isPass ? () => setShowPass(v => !v) : isConf ? () => setShowConf(v => !v) : null;
    const inputType = (isPass || isConf) ? (show ? "text" : "password") : field.type;

    return (
      <label key={field.name} className="flex flex-col gap-1.5 text-sm text-slate-200">
        <span className="font-medium">{field.label}</span>
        <div className="relative">
          <input
            name={field.name} type={inputType}
            value={form[field.name]}
            onChange={handleChange} onBlur={handleBlur}
            placeholder={field.placeholder}
            className={`w-full rounded-2xl border bg-slate-950/70 px-4 py-3 text-white outline-none transition pr-10
              ${err ? "border-red-500/70 focus:border-red-400" : "border-white/10 focus:border-cyan-400"}`}
          />
          {(isPass || isConf) && (
            <button type="button" onClick={toggle}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs">
              {show ? "Hide" : "Show"}
            </button>
          )}
        </div>
        {err && <span className="text-xs text-red-400">⚠ {err}</span>}
      </label>
    );
  };

  // ── IDS: block screen overlay ──────────────────────────────────────────────
  if (blockData) {
    return (
      <IntrusionBlockScreen
        blockType={blockData.type}
        timeRemaining={blockData.timeRemaining}
        alertType={blockData.alertType}
        message={blockData.message}
        onRetry={() => { setBlockData(null); setSubmitErr(""); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-white">

      {/* IDS: attempts warning popup */}
      {warnData && (
        <AttemptsWarningPopup
          remaining={warnData.remaining}
          onDismiss={() => setWarnData(null)}
        />
      )}

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8">
        <nav className="flex items-center justify-between border-b border-white/10 pb-5">
          <button onClick={() => navigate("/")}
            className="text-lg font-semibold text-cyan-300 hover:text-cyan-200">
            Secure Hub
          </button>
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1 text-xs uppercase tracking-[0.25em] text-cyan-200">
            Step 1 of 4
          </span>
        </nav>

        <div className="flex flex-1 items-center justify-center py-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}
              className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur md:p-10"
            >
              <p className="mb-3 text-sm uppercase tracking-[0.3em] text-cyan-300">
                {mode === "register" ? "Secure Hub onboarding" : "Secure Hub login"}
              </p>
              <h1 className="text-3xl font-bold text-white md:text-4xl">
                {mode === "register" ? "Create your account" : "Login to Secure Hub"}
              </h1>
              <p className="mt-3 text-sm text-slate-300">
                {mode === "register"
                  ? "Fill in your details. OTP verification follows."
                  : "Username, email and password verified before OTP is sent."}
              </p>

              <form onSubmit={handleSubmit} className="mt-8 grid gap-5 md:grid-cols-2">
                {fields.map(renderField)}

                <div className="md:col-span-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  {mode === "register"
                    ? "After submitting, an OTP will be sent to your phone."
                    : "All three fields are verified before OTP is sent."}
                </div>

                {submitErr && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="md:col-span-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex gap-2">
                    <span>❌</span><span>{submitErr}</span>
                  </motion.div>
                )}

                <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
                  <button type="submit" disabled={submitting}
                    className="rounded-2xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60">
                    {submitting
                      ? (mode === "login" ? "Verifying..." : "Sending OTP...")
                      : (mode === "login" ? "Verify & Get OTP" : "Continue to OTP")}
                  </button>
                  <button type="button" onClick={() => navigate("/")}
                    className="rounded-2xl border border-white/15 px-6 py-3 font-semibold text-slate-200 hover:border-cyan-400">
                    Back to home
                  </button>
                </div>

                <div className="md:col-span-2 mt-2 flex items-center justify-center gap-2 border-t border-white/10 pt-6">
                  {mode === "login" ? (
                    <>
                      <span className="text-sm text-slate-400">New here?</span>
                      <button type="button" onClick={() => switchMode("register")}
                        className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-4">
                        Register now →
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-slate-400">Already have an account?</span>
                      <button type="button" onClick={() => switchMode("login")}
                        className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-4">
                        Login instead →
                      </button>
                    </>
                  )}
                </div>
              </form>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
