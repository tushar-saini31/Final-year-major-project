import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import VoiceAuth from "../components/VoiceAuth";
import { useAuth } from "../context/AuthContext";

export default function VoiceAuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginAndComplete, completeAuth, user, profile: savedProfile } = useAuth();

  const mode = location.state?.mode === "register" ? "register" : "login";
  const profile = location.state?.profile || savedProfile || {};
  const username = profile.username || user || "";

  const handleVoiceSuccess = () => {
    if (mode === "register") {
      loginAndComplete(username, "voice-enrolled-session", profile, "user");
      navigate("/dashboard", { replace: true });
      return;
    }
    completeAuth();
    navigate("/dashboard", { replace: true });
  };

  const handleVoiceFail = () => null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent)]" />

      <nav className="flex items-center justify-between px-8 py-5 relative z-10 border-b border-gray-800">
        <button
          onClick={() => navigate("/")}
          className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-pink-500 bg-clip-text text-transparent"
        >
          Secure Hub
        </button>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">1</span>
            <span className="text-emerald-400 font-medium">OTP</span>
          </span>
          <span className="w-8 h-px bg-gray-600" />
          <span className="flex items-center gap-1">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">2</span>
            <span className="text-emerald-400 font-medium">Face</span>
          </span>
          <span className="w-8 h-px bg-gray-600" />
          <span className="flex items-center gap-1">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">3</span>
            <span className="text-indigo-400 font-medium">Voice</span>
          </span>
          <span className="w-8 h-px bg-gray-600" />
          <span className="flex items-center gap-1">
            <span className="w-6 h-6 rounded-full bg-gray-700 text-gray-400 text-xs flex items-center justify-center font-bold">4</span>
            <span>Dashboard</span>
          </span>
        </div>
      </nav>

      <div className="flex flex-col items-center px-4 py-12 relative z-10">
        <motion.div
          className="w-full max-w-xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl">
              V
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent mb-2">
              {mode === "register" ? "Voice Enrollment" : "Voice Authentication"}
            </h1>
            <p className="text-gray-400 text-sm">
              {mode === "register"
                ? "Step 3 of 4 — record your voice 5 times to finish enrollment"
                : "Step 3 of 4 — speak the phrase 3 times to verify your voice"}
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-8">
            {username ? (
              <VoiceAuth
                username={username}
                mode={mode === "register" ? "register" : "verify"}
                deviceId={profile?.device_id}
                deviceName={profile?.device_name}
                onSuccess={handleVoiceSuccess}
                onFail={handleVoiceFail}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-red-400 mb-4">No username found. Please start from OTP details.</p>
                <button
                  onClick={() => navigate("/")}
                  className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all"
                >
                  Go Home
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-gray-600 text-xs mt-6">
            {mode === "register"
              ? "Complete voice enrollment to enter the dashboard."
              : "After voice verification, you will enter the dashboard."}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
