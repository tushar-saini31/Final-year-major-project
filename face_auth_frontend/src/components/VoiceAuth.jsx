import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import IntrusionBlockScreen from "./IntrusionBlockScreen";
import AttemptsWarningPopup from "./AttemptsWarningPopup";

const BASE = "http://127.0.0.1:8000";

export default function VoiceAuth({ username, onSuccess, onFail, mode = "verify", deviceId = null, deviceName = null }) {
  const [phrase, setPhrase] = useState("");
  const [status, setStatus] = useState("idle");
  const [instruction, setInstruction] = useState("");
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingCount, setRecordingCount] = useState(0);
  const [audioBlobs, setAudioBlobs] = useState([]);
  const [similarity, setSimilarity] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [blockData, setBlockData] = useState(null);
  const [warnData, setWarnData] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const stoppingRef = useRef(false);

  // Register: 5 samples. Verify: 3 samples (best-of-3 on backend)
  const REQUIRED = mode === "register" ? 5 : 3;
  const MAX_HOLD_SECONDS = 8;

  useEffect(() => {
    fetchPhrase();
    return () => clearInterval(timerRef.current);
  }, [username]);   // re-fetch if username changes

  const fetchPhrase = async () => {
    try {
      // Pass username so backend returns the SAME phrase used at registration
      const res = await axios.get(`${BASE}/voice/challenge`, {
        params: { username: username || "" },
      });
      setPhrase(res.data.phrase);
      setStatus("idle");
      setInstruction(
        mode === "register"
          ? "Press and hold mic while speaking. Repeat 5 times."
          : "Press and hold mic while speaking. 3 recordings needed."
      );
    } catch {
      setInstruction("Could not load phrase. Check backend is running.");
    }
  };

  const startTranscription = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      const text = Array.from(e.results).map((x) => x[0].transcript).join("");
      setTranscript(text);
    };
    r.start();
    recognitionRef.current = r;
  };

  const stopTranscription = () => {
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
  };

  const startRecording = async () => {
    if (recording || status === "submitting" || status === "success") return;
    try {
      stoppingRef.current = false;
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          // Disable browser DSP — these process each session differently,
          // causing the same voice to produce different waveforms and lower scores.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
        },
      });
      streamRef.current = stream;

      const options = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? { mimeType: "audio/webm;codecs=opus" }
        : MediaRecorder.isTypeSupported("audio/webm")
        ? { mimeType: "audio/webm" }
        : {};

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        handleRecordingDone(blob, mimeType);
      };

      recorder.start(100);
      setRecording(true);
      setStatus("recording");
      setTranscript("");
      startTranscription();

      setTimeLeft(MAX_HOLD_SECONDS);
      let t = MAX_HOLD_SECONDS;
      timerRef.current = setInterval(() => {
        t -= 1;
        setTimeLeft(t);
        if (t <= 0) {
          clearInterval(timerRef.current);
          stopRecording();
        }
      }, 1000);

      setInstruction(`Recording... release to stop (max ${MAX_HOLD_SECONDS}s)`);
    } catch {
      setInstruction("Microphone access denied. Please allow microphone.");
    }
  };

  const stopRecording = () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    clearInterval(timerRef.current);
    stopTranscription();
    try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
    try { streamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch { /* ignore */ }
    setRecording(false);
    setTimeLeft(0);
  };

  const handleRecordingDone = (blob, mimeType) => {
    const newBlobs = [...audioBlobs, blob];
    setAudioBlobs(newBlobs);
    const count = recordingCount + 1;
    setRecordingCount(count);

    if (count < REQUIRED) {
      setStatus("waiting");
      setInstruction(`Good! ${REQUIRED - count} more recording(s) needed`);
    } else {
      setStatus("submitting");
      if (mode === "register") {
        submitRegister(newBlobs, mimeType);
      } else {
        submitVerify(newBlobs, mimeType);
      }
    }
  };

  const toFile = (blob, mimeType) => {
    const ext = mimeType.includes("webm") ? "webm" : "wav";
    return new File([blob], `voice.${ext}`, { type: mimeType });
  };

  const submitRegister = async (blobs, mimeType) => {
    setInstruction("Processing voice registrations...");
    try {
      const form = new FormData();
      form.append("username", username);
      blobs.forEach((blob, i) => {
        form.append(`file${i + 1}`, toFile(blob, mimeType));
      });
      const res = await axios.post(`${BASE}/voice/register`, form);
      setStatus("success");
      setInstruction("Voice enrolled successfully!");
      onSuccess?.(res.data);
    } catch {
      setStatus("failed");
      setInstruction("Registration failed. Try again.");
      onFail?.();
    }
  };

  const submitVerify = async (blobs, mimeType) => {
    setInstruction("Verifying your voice...");
    try {
      const form = new FormData();
      form.append("username", username);
      form.append("expected_phrase", phrase);
      // Fall back to expected phrase if Web Speech API returned nothing
      form.append("spoken_phrase", transcript?.trim() || phrase);
      if (deviceId) form.append("device_id", deviceId);
      if (deviceName) form.append("device_name", deviceName);

      // Send all 3 recordings — backend picks the best-matching one
      blobs.forEach((blob, i) => {
        form.append(`file${i + 1}`, toFile(blob, mimeType));
      });

      const res = await axios.post(`${BASE}/voice/verify`, form);

      if (res.data?.ids_blocked) {
        setBlockData({
          type: res.data.block_type,
          timeRemaining: res.data.time_remaining || 0,
          alertType: res.data.alert_type,
          message: res.data.message,
        });
        setStatus("failed");
        setInstruction(res.data.message || "Access temporarily blocked.");
        onFail?.(res.data);
        return;
      }

      if (res.data.success) {
        setSimilarity(res.data.similarity);
        setStatus("success");
        setInstruction("Voice verified successfully!");
        onSuccess?.(res.data);
      } else {
        if (res.data?.show_warning && res.data?.attempts_remaining != null) {
          setWarnData({ remaining: res.data.attempts_remaining });
        }
        setStatus("failed");
        setInstruction(res.data.message || "Voice verification failed");
        setSimilarity(res.data.similarity ?? null);
        onFail?.(res.data);
      }
    } catch {
      setStatus("failed");
      setInstruction("Verification error. Try again.");
      onFail?.();
    }
  };

  const reset = () => {
    setStatus("idle");
    setTranscript("");
    setAudioBlobs([]);
    setRecordingCount(0);
    setSimilarity(null);
    setRecording(false);
    fetchPhrase();
  };

  const getMicBg = () => {
    if (recording) return "bg-gradient-to-br from-red-600 to-red-700";
    if (status === "success") return "bg-gradient-to-br from-emerald-500 to-emerald-700";
    if (status === "submitting") return "bg-gray-700";
    return "bg-gradient-to-br from-indigo-600 to-violet-700";
  };

  const getMicIcon = () => {
    if (status === "submitting") return "...";
    if (status === "success") return "OK";
    if (recording) return "STOP";
    return "MIC";
  };

  const handlePressStart = (e) => {
    e.preventDefault();
    if (!recording && status !== "submitting" && status !== "success") {
      startRecording();
    }
  };

  const handlePressEnd = (e) => {
    e.preventDefault();
    if (recording) stopRecording();
  };

  if (blockData) {
    return (
      <IntrusionBlockScreen
        blockType={blockData.type}
        timeRemaining={blockData.timeRemaining}
        alertType={blockData.alertType}
        message={blockData.message}
        onRetry={() => setBlockData(null)}
      />
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {warnData && (
        <AttemptsWarningPopup
          remaining={warnData.remaining}
          onDismiss={() => setWarnData(null)}
        />
      )}
      {/* Phrase display */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
        <p className="text-slate-500 text-xs mb-2 tracking-widest uppercase">
          {mode === "register" ? "Enrollment phrase" : "Challenge phrase"}
        </p>
        <p className="text-slate-100 text-xl font-semibold tracking-wide">
          "{phrase || "Loading..."}"
        </p>
        <p className="text-slate-600 text-xs mt-2">
          {mode === "verify"
            ? "You will say this phrase 3 times"
            : "You will say this phrase 5 times"}
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex gap-2 justify-center items-center">
        <span className="text-slate-500 text-xs mr-2">Progress:</span>
        {Array.from({ length: REQUIRED }).map((_, n) => (
          <div
            key={n}
            className={`transition-all duration-300 rounded-full border ${
              recordingCount > n
                ? "bg-emerald-500 border-emerald-500 w-8 h-1.5"
                : recording && recordingCount === n
                ? "bg-red-500 border-red-500 w-8 h-1.5 animate-pulse"
                : "bg-slate-800 border-slate-700 w-8 h-1.5"
            }`}
          />
        ))}
        <span className="text-slate-500 text-xs ml-2">{recordingCount}/{REQUIRED}</span>
      </div>

      {/* Mic button */}
      <div className="flex flex-col items-center gap-3">
        <motion.button
          onPointerDown={handlePressStart}
          onPointerUp={handlePressEnd}
          onPointerCancel={handlePressEnd}
          onPointerLeave={handlePressEnd}
          disabled={status === "submitting" || status === "success"}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`rounded-full flex items-center justify-center text-base font-semibold transition-all duration-200
            ${getMicBg()}
            ${recording
              ? "ring-4 ring-red-500/30 shadow-[0_0_0_16px_rgba(220,38,38,0.08)]"
              : "shadow-[0_4px_20px_rgba(79,70,229,0.35)]"
            }
            ${status === "submitting" || status === "success"
              ? "cursor-not-allowed opacity-70"
              : "cursor-pointer"
            }
          `}
          style={{ width: 88, height: 88 }}
        >
          {getMicIcon()}
        </motion.button>

        {recording && timeLeft > 0 && (
          <div className="w-10 h-10 rounded-full border-2 border-red-500 flex items-center justify-center text-red-500 text-base font-semibold">
            {timeLeft}
          </div>
        )}

        <p className="text-slate-500 text-xs">
          {recording ? "Release to stop recording" : "Press and hold to talk"}
        </p>
      </div>

      {/* Live transcript */}
      {transcript && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 border border-blue-900/50 rounded-lg px-4 py-3 text-center"
        >
          <p className="text-slate-500 text-xs mb-1 uppercase tracking-widest">Detected</p>
          <p className="text-blue-400 text-sm">"{transcript}"</p>
        </motion.div>
      )}

      {/* Status instruction */}
      {instruction && (
        <motion.p
          key={instruction}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`text-center text-sm ${
            status === "success" ? "text-emerald-400"
            : status === "failed" ? "text-red-400"
            : "text-slate-400"
          }`}
        >
          {instruction}
        </motion.p>
      )}

      {/* Similarity score */}
      {similarity !== null && (
        <p className="text-center text-slate-500 text-xs">
          Voice match: {(similarity * 100).toFixed(1)}%
        </p>
      )}

      {/* Try again / re-register buttons */}
      {(status === "failed" || status === "success") && mode === "verify" && (
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-sm cursor-pointer transition-all"
          >
            Try Again
          </button>
        </div>
      )}

      {status === "failed" && similarity !== null && similarity < 0.40 && (
        <p className="text-center text-slate-600 text-xs">
          Score too low ({(similarity * 100).toFixed(0)}%). Try speaking louder and clearer, or re-register your voice.
        </p>
      )}
    </div>
  );
}
