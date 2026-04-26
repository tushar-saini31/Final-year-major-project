import { useState } from "react";
import WebcamCapture from "./WebcamCapture";
import { registerFace } from "../api/faceAuth";

export default function FaceRegister({ username: initialUsername = "", onSuccess }) {
  const [username, setUsername] = useState(initialUsername);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCapture = async (blob) => {
    if (!username.trim()) {
      setStatus({ type: "error", msg: "Please enter a username first" });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const result = await registerFace(username, blob);
      setStatus({ type: "success", msg: result.message || "Registered!" });
      onSuccess?.({ username, ...result });
    } catch (err) {
      setStatus({ type: "error", msg: "Registration failed. Try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "700px", margin: "0 auto" }}>
      <h2>Register Face</h2>
      <input
        type="text"
        placeholder="Enter username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={inputStyle}
      />
      <WebcamCapture onCapture={handleCapture} />
      {loading && <p style={{ color: "#888" }}>Registering...</p>}
      {status && (
        <p style={{ color: status.type === "success" ? "green" : "red" }}>
          {status.msg}
        </p>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 14px", fontSize: "14px",
  borderRadius: "8px", border: "1px solid #444",
  marginBottom: "16px", background: "#111", color: "#fff",
  boxSizing: "border-box",
};
