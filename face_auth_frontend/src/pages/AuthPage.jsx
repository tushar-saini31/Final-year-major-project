import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import FaceRegister from "../components/FaceRegister";
import FaceLogin from "../components/FaceLogin";

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = location.state?.mode === "register" ? "register" : "login";
  const otpVerified = location.state?.otpVerified || false;
  const profile = location.state?.profile || {};
  const username = profile.username || "";
  const [tab, setTab] = useState(mode);

  useEffect(() => {
    setTab(mode);
  }, [mode]);

  // Guard: if OTP wasn't verified or no username, send back to start
  useEffect(() => {
    if (!otpVerified || !username) {
      navigate("/otp-details", { state: { mode }, replace: true });
    }
  }, [otpVerified, username, navigate, mode]);

  const handleFaceLoginSuccess = () => {
    navigate("/voice-auth", {
      state: { mode: "login", profile },
    });
  };

  const handleFaceRegisterSuccess = () => {
    navigate("/voice-auth", {
      state: { mode: "register", profile },
    });
  };

  const isLogin = tab === "login";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.12),transparent)]" />

      <nav className="flex items-center justify-between px-8 py-5 relative z-10 border-b border-gray-800">
        <button
          onClick={() => navigate("/")}
          className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-pink-500 bg-clip-text text-transparent"
        >
          Secure Hub
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">1</span>
            <span className="text-emerald-400 font-medium">OTP</span>
          </span>
          <span className="h-px w-8 bg-gray-600" />
          <span className="flex items-center gap-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">2</span>
            <span className="text-indigo-400 font-medium">Face</span>
          </span>
          <span className="h-px w-8 bg-gray-600" />
          <span className="flex items-center gap-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-gray-400">3</span>
            <span>Voice</span>
          </span>
          <span className="h-px w-8 bg-gray-600" />
          <span className="flex items-center gap-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-gray-400">4</span>
            <span>Dashboard</span>
          </span>
        </div>
      </nav>

      <div className="flex flex-col items-center px-4 pb-16 pt-8 relative z-10">
        <motion.div
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-pink-500 bg-clip-text text-transparent mb-2">
              {isLogin ? "Face Verification" : "Face Enrollment"}
            </h1>
            <p className="text-gray-400 text-sm">
              {isLogin
                ? "OTP verified. Look into the camera to continue login."
                : "OTP verified. Register your face before voice enrollment."}
            </p>
          </div>

          {/* OTP success banner */}
          {otpVerified && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 bg-emerald-900/30 border border-emerald-700/50 rounded-xl px-4 py-3 mb-6"
            >
              <span className="text-xl">✅</span>
              <div>
                <p className="text-emerald-400 text-sm font-semibold">OTP verification passed</p>
                <p className="text-gray-500 text-xs">
                  {mode === "login"
                    ? "Password + OTP verified. Continuing to face authentication."
                    : "Step 1 complete. Continuing to face authentication."}
                </p>
              </div>
            </motion.div>
          )}

          <motion.div
            key={tab}
            initial={{ opacity: 0, x: tab === "login" ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-8"
          >
            {isLogin ? (
              <FaceLogin
                username={username}
                profile={profile}
                onSuccess={handleFaceLoginSuccess}
              />
            ) : (
              <FaceRegister
                username={username}
                onSuccess={handleFaceRegisterSuccess}
              />
            )}
          </motion.div>

          <p className="text-center text-gray-500 text-sm mt-6">
            Signed in as <span className="font-semibold text-white">{username}</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}