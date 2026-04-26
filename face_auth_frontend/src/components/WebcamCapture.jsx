import { useRef, useCallback, useState } from "react";

export default function WebcamCapture({ onCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setStreaming(true);
      setError(null);
    } catch (err) {
      setError("Camera access denied. Please allow camera permission.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob && onCapture) {
        onCapture(blob);
      }
    }, "image/jpeg", 0.95);
  }, [onCapture]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
      
      <video
        ref={videoRef}
        width={640}
        height={480}
        autoPlay
        playsInline
        muted
        style={{
          borderRadius: "12px",
          background: "#111",
          display: streaming ? "block" : "none",
        }}
      />

      {!streaming && (
        <div style={{
          width: 640, height: 480, borderRadius: "12px",
          background: "#1a1a1a", display: "flex",
          alignItems: "center", justifyContent: "center",
          color: "#666", fontSize: "16px", border: "2px dashed #333"
        }}>
          Camera is off
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />

      {error && (
        <p style={{ color: "red", margin: 0 }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: "12px" }}>
        {!streaming ? (
          <button onClick={startCamera} style={btnStyle("#1D9E75")}>
            Start Camera
          </button>
        ) : (
          <>
            <button onClick={capturePhoto} style={btnStyle("#185FA5")}>
              Capture Photo
            </button>
            <button onClick={stopCamera} style={btnStyle("#A32D2D")}>
              Stop Camera
            </button>
          </>
        )}
      </div>

    </div>
  );
}

const btnStyle = (bg) => ({
  padding: "10px 24px",
  background: bg,
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  cursor: "pointer",
});