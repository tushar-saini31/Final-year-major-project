import { useState } from "react";
import LivenessDetector from "./LivenessDetector";
import { loginFace } from "../api/faceAuth";
import { useAuth } from "../context/AuthContext";

export default function FaceLogin({
  username: initialUsername = "",
  onSuccess,
  profile = null,
}) {
  const [username, setUsername] = useState(initialUsername);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("liveness");

  const { login } = useAuth();

  const handleLive = async (blob) => {
    if (!username.trim()) {
      setStatus({ type: "error", msg: "Please enter a username first" });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const result = await loginFace(username, blob);
      if (result.success) {
        login(username, result.access_token, profile);
        onSuccess?.({ username, ...result });
      } else {
        setStatus({
          type: "error",
          msg: `Access denied. Similarity: ${(result.similarity * 100).toFixed(1)}%`,
        });
        setStep("result");
      }
    } catch {
      setStatus({ type: "error", msg: "Login failed. Try again." });
      setStep("result");
    } finally {
      setLoading(false);
    }
  };

  const handleFail = () => {
    setStatus({ type: "error", msg: "Liveness check failed. Please try again." });
    setStep("result");
  };

  const reset = () => {
    setStatus(null);
    setStep("liveness");
  };

  return (
    <div style={{ padding: "24px", maxWidth: "700px", margin: "0 auto" }}>
      <input
        type="text"
        placeholder="Enter username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        style={inputStyle}
      />

      {step === "liveness" && (
        <LivenessDetector onLive={handleLive} onFail={handleFail} />
      )}

      {loading && (
        <p style={{ color: "#888", marginTop: "16px" }}>Verifying face...</p>
      )}

      {status && (
        <div style={{ marginTop: "16px" }}>
          <p style={{ color: status.type === "success" ? "#1D9E75" : "#E24B4A", fontSize: "16px" }}>
            {status.msg}
          </p>
          <button onClick={reset} style={btn}>Try Again</button>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  fontSize: "14px",
  borderRadius: "8px",
  border: "1px solid #444",
  marginBottom: "16px",
  background: "#111",
  color: "#fff",
  boxSizing: "border-box",
};

const btn = {
  padding: "10px 24px",
  background: "#555",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  cursor: "pointer",
};
