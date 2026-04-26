import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const carouselItems = [
  "Start with OTP-based personal details verification.",
  "Continue to face authentication after OTP approval.",
  "Finish with voice authentication before dashboard access.",
  "Secure Hub keeps the full security flow in one place.",
];

const features = [
  {
    icon: "01",
    title: "OTP Verification",
    description: "Collect personal details first, then verify the one-time passcode.",
  },
  {
    icon: "02",
    title: "Face Authentication",
    description: "Use the existing face authentication flow after OTP is complete.",
  },
  {
    icon: "03",
    title: "Voice Authentication",
    description: "Add the final voice-based identity check before entering the app.",
  },
  {
    icon: "04",
    title: "Protected Dashboard",
    description: "Allow access only after all authentication layers are complete.",
  },
];

const steps = [
  { num: "01", icon: "OTP", label: "Personal Details", desc: "Enter the required details" },
  { num: "02", icon: "CODE", label: "OTP Verify", desc: "Confirm the one-time code" },
  { num: "03", icon: "FACE", label: "Face Auth", desc: "Continue with face authentication" },
  { num: "04", icon: "VOICE", label: "Voice Auth", desc: "Finish before dashboard access" },
];

export default function Home() {
  const [displayText, setDisplayText] = useState("");
  const [carouselIndex, setCarouselIndex] = useState(0);
  const navigate = useNavigate();
  const fullText = "Secure Hub - Multi-Layer Authentication";

  useEffect(() => {
    let index = 0;
    let timeout;

    const type = () => {
      if (index < fullText.length) {
        setDisplayText(fullText.substring(0, index + 1));
        index += 1;
        timeout = setTimeout(type, 50);
      }
    };

    type();
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCarouselIndex((current) => (current + 1) % carouselItems.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const startOtpFlow = (mode) => {
    navigate("/otp-details", { state: { mode } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent)]" />

      <nav className="flex items-center justify-between px-8 py-5 relative z-10">
        <span className="text-xl font-bold bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">
          Secure Hub
        </span>
        <div className="flex gap-3">
          <button
            onClick={() => startOtpFlow("login")}
            className="px-5 py-2 rounded-xl border border-white/20 hover:border-cyan-300 text-white text-sm font-semibold transition-all duration-200"
          >
            Login
          </button>
          <button
            onClick={() => startOtpFlow("register")}
            className="px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-sm font-semibold transition-all duration-200 hover:scale-105"
          >
            Register
          </button>
        </div>
      </nav>

      <div className="pt-16 pb-16 px-4 flex flex-col items-center text-center relative z-10">
        <motion.div
          className="max-w-3xl"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent leading-tight">
            {displayText}
          </h1>
          <p className="text-slate-300 text-sm italic mb-6">
            Personal details and OTP verification now come first in the flow.
          </p>

          <motion.div
            key={carouselIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-lg text-white/80 font-medium mb-10"
          >
            {carouselItems[carouselIndex]}
          </motion.div>

          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={() => startOtpFlow("register")}
              className="px-8 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-lg transition-all duration-200 hover:scale-105 shadow-lg shadow-cyan-950/50"
            >
              Register New
            </button>
            <button
              onClick={() => startOtpFlow("login")}
              className="px-8 py-3 rounded-xl border border-white/20 hover:border-cyan-300 text-gray-200 hover:text-white font-semibold text-lg transition-all duration-200"
            >
              Login
            </button>
          </div>
        </motion.div>
      </div>

      <section className="py-12 px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-white mb-8">
            Secure Hub Flow
          </h2>
          <div className="flex flex-col md:flex-row items-center gap-4 justify-center">
            {steps.map((step, index) => (
              <div key={step.num} className="flex items-center gap-4">
                <motion.div
                  className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center w-44"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.15 }}
                  whileHover={{ scale: 1.05 }}
                >
                  <p className="text-cyan-300 text-xs font-bold mb-1">{step.num}</p>
                  <div className="text-sm mb-2 font-bold tracking-[0.25em] text-emerald-300">{step.icon}</div>
                  <p className="text-white font-semibold text-sm">{step.label}</p>
                  <p className="text-slate-400 text-xs mt-1">{step.desc}</p>
                </motion.div>
                {index < steps.length - 1 && (
                  <span className="text-slate-500 text-2xl hidden md:block">{">"}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <motion.section
        className="py-16 px-4 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-12">
            Why Secure Hub?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 hover:border-cyan-400 transition-colors duration-300"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-lg font-bold text-cyan-300">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <section className="py-20 px-4 relative z-10 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">
          Ready to begin?
        </h2>
        <p className="text-slate-300 mb-8">
          Start from the registration flow and continue with OTP verification.
        </p>
        <button
          onClick={() => startOtpFlow("register")}
          className="px-10 py-4 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-300 hover:from-cyan-300 hover:to-emerald-200 text-slate-950 font-bold text-lg shadow-xl hover:scale-105 transition-all duration-200"
        >
          Get Started
        </button>
      </section>
    </div>
  );
}
