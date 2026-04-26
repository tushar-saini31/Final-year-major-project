import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { loginStart, registerStart } from "../api/auth";

// ── Validation helpers ────────────────────────────────────────────────────────

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return "Enter a valid email address (e.g. name@example.com)";
  return null;
}

function validatePhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return "Phone number must be exactly 10 digits";
  if (!/^[6-9]/.test(digits)) return "Phone number must start with 6, 7, 8, or 9";
  return null;
}

function validatePassword(password) {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  return null;
}

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, "");
  return `+91${digits}`;
}

// ── Field definitions ────────────────────────────────────────────────────────

const registerFields = [
  { name: "username",        label: "Username",         type: "text",     placeholder: "Letters, numbers, underscores only" },
  { name: "fullName",        label: "Full name",        type: "text",     placeholder: "Enter your full name" },
  { name: "email",           label: "Email",            type: "email",    placeholder: "name@example.com" },
  { name: "phone",           label: "Phone number",     type: "tel",      placeholder: "10-digit mobile number" },
  { name: "designation",     label: "Designation",      type: "text",     placeholder: "e.g. Software Engineer" },
  { name: "password",        label: "Password",         type: "password", placeholder: "Min 8 chars, 1 uppercase, 1 number" },
  { name: "confirmPassword", label: "Confirm password", type: "password", placeholder: "Re-enter password" },
];

const loginFields = [
  { name: "username", label: "Username", type: "text",     placeholder: "Enter your username (no spaces)" },
  { name: "email",    label: "Email",    type: "email",    placeholder: "Enter your registered email" },
  { name: "password", label: "Password", type: "password", placeholder: "Enter your password" },
];

const initialValues = {
  username:        "",
  fullName:        "",
  email:           "",
  phone:           "",
  designation:     "",
  password:        "",
  confirmPassword: "",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function OtpDetailsPage() {
  const navigate  = useNavigate();
  const location  = useLocation();

  // mode can be switched locally without navigating away
  const [mode, setMode] = useState(
    location.state?.mode === "register" ? "register" : "login"
  );

  const fields = useMemo(() => (mode === "register" ? registerFields : loginFields), [mode]);

  const [form,       setForm]       = useState(initialValues);
  const [errors,     setErrors]     = useState({});
  const [submitErr,  setSubmitErr]  = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPass,   setShowPass]   = useState(false);
  const [showConf,   setShowConf]   = useState(false);

  // Switch mode and reset everything
  const switchMode = (newMode) => {
    setMode(newMode);
    setForm(initialValues);
    setErrors({});
    setSubmitErr("");
    setShowPass(false);
    setShowConf(false);
  };

  const heading    = mode === "register" ? "Create your Secure Hub account" : "Login to Secure Hub";
  const subheading = mode === "register"
    ? "Fill in your details to get started. OTP verification follows."
    : "Enter your username, email and password. All three are verified before your OTP is sent.";

  // ── Per-field validation ───────────────────────────────────────────────────

  const validateField = (name, value) => {
    switch (name) {
      case "username": {
        const trimmed = value.trim();
        if (trimmed.length < 3) return "Username must be at least 3 characters";
        if (!/^[a-zA-Z0-9_]+$/.test(trimmed))
          return "Username can only contain letters, numbers, and underscores — no spaces";
        return null;
      }
      case "fullName":
        return value.trim().length < 2 ? "Full name is required" : null;
      case "email":
        return validateEmail(value);
      case "phone":
        return validatePhone(value);
      case "designation":
        return value.trim().length < 2 ? "Designation is required" : null;
      case "password":
        if (mode === "login") return value.length === 0 ? "Password is required" : null;
        return validatePassword(value);
      case "confirmPassword":
        return value !== form.password ? "Passwords do not match" : null;
      default:
        return null;
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    }
    if (submitErr) setSubmitErr("");
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitErr("");

    const newErrors = {};
    fields.forEach(({ name }) => {
      const err = validateField(name, form[name] ?? "");
      if (err) newErrors[name] = err;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSubmitErr("Please fix the errors above before continuing.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        ...form,
        username: form.username.trim(),
        phone: form.phone ? normalizePhone(form.phone) : "",
      };

      let result;
      if (mode === "register") {
        result = await registerStart(payload);
      } else {
        result = await loginStart({
          username: payload.username,
          email:    payload.email,
          password: payload.password,
        });
      }

      const otpHint = result?.message || "OTP sent to your registered phone number.";

      navigate("/otp-verify", {
        state: { mode, profile: payload, otpHint },
      });

    } catch (err) {
      const detail = err?.response?.data?.detail;
      const status = err?.response?.status;
      console.error("API error:", status, detail);

      const fieldErrors = {};

      if (typeof detail === "string") {
        switch (detail) {
          case "username not found":
            fieldErrors.username = "No account found with this username";
            setSubmitErr("Username not found. Please check and try again.");
            break;
          case "email does not match":
            fieldErrors.email = "This email doesn't match the account";
            setSubmitErr("Email does not match the registered account.");
            break;
          case "invalid password":
            fieldErrors.password = "Incorrect password";
            setSubmitErr("Incorrect password. Please try again.");
            break;
          case "username already exists":
            fieldErrors.username = "This username is already taken";
            setSubmitErr("Username already taken. Please choose another.");
            break;
          case "email already exists":
            fieldErrors.email = "An account with this email already exists";
            setSubmitErr("An account with this email already exists.");
            break;
          default:
            setSubmitErr(`Error: ${detail}`);
        }
      } else if (Array.isArray(detail)) {
        const messages = detail.map((d) => {
          const field = d.loc?.[d.loc.length - 1] ?? "field";
          return `${field}: ${d.msg}`;
        });
        setSubmitErr(`Validation errors — ${messages.join(" | ")}`);
      } else {
        setSubmitErr("Something went wrong. Please check your details and try again.");
      }

      if (Object.keys(fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render field ──────────────────────────────────────────────────────────

  const renderField = (field) => {
    const err        = errors[field.name];
    const isPassword = field.name === "password";
    const isConfirm  = field.name === "confirmPassword";
    const show       = isPassword ? showPass : isConfirm ? showConf : false;
    const toggle     = isPassword
      ? () => setShowPass((v) => !v)
      : isConfirm
      ? () => setShowConf((v) => !v)
      : null;

    const inputType = (isPassword || isConfirm)
      ? (show ? "text" : "password")
      : field.type;

    return (
      <label key={field.name} className="flex flex-col gap-1.5 text-sm text-slate-200">
        <span className="font-medium">{field.label}</span>
        <div className="relative">
          <input
            name={field.name}
            type={inputType}
            value={form[field.name]}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={field.placeholder}
            autoComplete={
              isPassword || isConfirm
                ? mode === "login" ? "current-password" : "new-password"
                : "off"
            }
            className={`w-full rounded-2xl border bg-slate-950/70 px-4 py-3 text-white outline-none transition pr-10
              ${err
                ? "border-red-500/70 focus:border-red-400"
                : "border-white/10 focus:border-cyan-400"
              }`}
          />
          {(isPassword || isConfirm) && (
            <button
              type="button"
              onClick={toggle}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
            >
              {show ? "Hide" : "Show"}
            </button>
          )}
        </div>
        {err && <span className="text-xs text-red-400">⚠ {err}</span>}
        {field.name === "username" && !err && (
          <span className="text-xs text-slate-500">No spaces — only letters, numbers, underscores</span>
        )}
        {field.name === "phone" && !err && (
          <span className="text-xs text-slate-500">Enter 10 digits — +91 will be added automatically</span>
        )}
        {field.name === "password" && mode === "register" && !err && form.password.length > 0 && (
          <span className="text-xs text-slate-500">
            {form.password.length >= 8 && /[A-Z]/.test(form.password) && /[0-9]/.test(form.password)
              ? "✓ Password looks good"
              : "Needs: 8+ chars, 1 uppercase, 1 number"}
          </span>
        )}
      </label>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8">

        {/* Nav */}
        <nav className="flex items-center justify-between border-b border-white/10 pb-5">
          <button
            onClick={() => navigate("/")}
            className="text-lg font-semibold text-cyan-300 transition hover:text-cyan-200"
          >
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
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur md:p-10"
            >
              <p className="mb-3 text-sm uppercase tracking-[0.3em] text-cyan-300">
                Secure Hub {mode === "register" ? "onboarding" : "login"}
              </p>
              <h1 className="text-3xl font-bold text-white md:text-4xl">{heading}</h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-300 md:text-base">{subheading}</p>

              <form onSubmit={handleSubmit} className="mt-8 grid gap-5 md:grid-cols-2">
                {fields.map(renderField)}

                {/* Info banner */}
                <div className="md:col-span-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  {mode === "register"
                    ? "After submitting, an OTP will be sent to your phone via SMS."
                    : "Your username, email, and password are verified first. If valid, we send OTP via SMS to your registered number."}
                </div>

                {/* Submit error */}
                {submitErr && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="md:col-span-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-start gap-2"
                  >
                    <span className="mt-0.5">❌</span>
                    <span>{submitErr}</span>
                  </motion.div>
                )}

                {/* Action buttons */}
                <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-2xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting
                      ? mode === "login" ? "Verifying credentials..." : "Sending OTP..."
                      : mode === "login" ? "Verify & Get OTP" : "Continue to OTP verification"}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="rounded-2xl border border-white/15 px-6 py-3 font-semibold text-slate-200 transition hover:border-cyan-400 hover:text-white"
                  >
                    Back to home
                  </button>
                </div>

                {/* ── Switch mode link ───────────────────────────────────── */}
                <div className="md:col-span-2 mt-2 flex items-center justify-center gap-2 border-t border-white/10 pt-6">
                  {mode === "login" ? (
                    <>
                      <span className="text-sm text-slate-400">New to Secure Hub?</span>
                      <button
                        type="button"
                        onClick={() => switchMode("register")}
                        className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-4 transition"
                      >
                        Register now →
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-slate-400">Already have an account?</span>
                      <button
                        type="button"
                        onClick={() => switchMode("login")}
                        className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-4 transition"
                      >
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
