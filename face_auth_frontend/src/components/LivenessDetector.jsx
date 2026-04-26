import { useRef, useEffect, useState, useCallback } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const LEFT_EYE  = { top: 159, bottom: 145, left: 33,  right: 133 };
const RIGHT_EYE = { top: 386, bottom: 374, left: 362, right: 263 };

function getEAR(landmarks, eye) {
  const dist = (a, b) => {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  };
  return dist(landmarks[eye.top], landmarks[eye.bottom]) /
         dist(landmarks[eye.left], landmarks[eye.right]);
}

// 3D depth check using Z coordinates
function getDepthVariance(landmarks) {
  const zValues = landmarks.map(l => l.z);
  const mean = zValues.reduce((a, b) => a + b, 0) / zValues.length;
  const variance = zValues.reduce((a, b) => a + (b - mean) ** 2, 0) / zValues.length;
  return Math.sqrt(variance); // std deviation of Z
}

// Left cheek vs right cheek depth difference
function getFaceSymmetryDepth(landmarks) {
  const leftCheek  = landmarks[234]?.z ?? 0;
  const rightCheek = landmarks[454]?.z ?? 0;
  return Math.abs(leftCheek - rightCheek);
}

export default function LivenessDetector({ onLive, onFail }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef      = useRef(null);

  const [status, setStatus]           = useState("idle");
  const [instruction, setInstruction] = useState("");
  const [progress, setProgress]       = useState({
    blink: false, headMove: false, depth: false
  });
  const [scores, setScores] = useState({
    depth: 0, movement: 0, symmetry: 0
  });

  // Liveness refs
  const blinkCountRef   = useRef(0);
  const eyeClosedRef    = useRef(false);
  const baseNoseXRef    = useRef(null);
  const headMovedRef    = useRef(false);
  const frameCountRef   = useRef(0);

  // Anti-spoof refs (accumulate over frames)
  const depthScoresRef     = useRef([]);
  const prevNosePosRef     = useRef(null);
  const totalMovementRef   = useRef(0);
  const symmetryScoresRef  = useRef([]);

  const BLINK_THRESHOLD      = 0.18;
  const HEAD_MOVE_THRESHOLD  = 0.04;
  const REQUIRED_BLINKS      = 2;
  const MAX_FRAMES           = 350;

  // Anti-spoof thresholds
  const DEPTH_THRESHOLD      = 0.02;   // real face Z std dev > this
  const MOVEMENT_THRESHOLD   = 0.05;   // total nose movement > this
  const SYMMETRY_THRESHOLD   = 0.005;  // cheek depth diff > this

  const loadModel = useCallback(async () => {
    setStatus("loading");
    setInstruction("Loading model...");
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
    });
    setStatus("detecting");
    setInstruction("Blink 2 times, then slowly turn your head");
  }, []);

  const startCamera = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
    });
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    await loadModel();
  }, [loadModel]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const captureBlob = useCallback(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      stopCamera();
      onLive?.(blob);
    }, "image/jpeg", 0.95);
  }, [onLive, stopCamera]);

  useEffect(() => {
    if (status !== "detecting") return;

    const detect = () => {
      const video = videoRef.current;
      const lm    = landmarkerRef.current;
      if (!video || !lm || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      frameCountRef.current += 1;

      if (frameCountRef.current > MAX_FRAMES) {
        setStatus("failed");
        setInstruction("Check timed out. Please try again.");
        stopCamera();
        onFail?.();
        return;
      }

      const results   = lm.detectForVideo(video, performance.now());
      const landmarks = results?.faceLandmarks?.[0];

      if (landmarks) {

        // ── Liveness: Blink ──────────────────────────────
        const avgEAR = (getEAR(landmarks, LEFT_EYE) + getEAR(landmarks, RIGHT_EYE)) / 2;
        if (avgEAR < BLINK_THRESHOLD && !eyeClosedRef.current) {
          eyeClosedRef.current = true;
        } else if (avgEAR >= BLINK_THRESHOLD && eyeClosedRef.current) {
          eyeClosedRef.current = false;
          blinkCountRef.current += 1;
        }

        // ── Liveness: Head movement ───────────────────────
        const noseX = landmarks[1].x;
        if (baseNoseXRef.current === null) baseNoseXRef.current = noseX;
        if (Math.abs(noseX - baseNoseXRef.current) > HEAD_MOVE_THRESHOLD) {
          headMovedRef.current = true;
        }

        // ── Anti-spoof: Depth variance ────────────────────
        const depthStd = getDepthVariance(landmarks);
        depthScoresRef.current.push(depthStd);
        if (depthScoresRef.current.length > 60) depthScoresRef.current.shift();
        const avgDepth = depthScoresRef.current.reduce((a, b) => a + b, 0) /
                         depthScoresRef.current.length;

        // ── Anti-spoof: Nose micro-movement ───────────────
        const nosePos = { x: landmarks[1].x, y: landmarks[1].y };
        if (prevNosePosRef.current) {
          const dx = nosePos.x - prevNosePosRef.current.x;
          const dy = nosePos.y - prevNosePosRef.current.y;
          totalMovementRef.current += Math.sqrt(dx * dx + dy * dy);
        }
        prevNosePosRef.current = nosePos;

        // ── Anti-spoof: Face symmetry depth ───────────────
        const symDiff = getFaceSymmetryDepth(landmarks);
        symmetryScoresRef.current.push(symDiff);
        if (symmetryScoresRef.current.length > 60) symmetryScoresRef.current.shift();
        const avgSymmetry = symmetryScoresRef.current.reduce((a, b) => a + b, 0) /
                            symmetryScoresRef.current.length;

        // ── Evaluate checks ───────────────────────────────
        const blinked      = blinkCountRef.current >= REQUIRED_BLINKS;
        const moved        = headMovedRef.current;
        const depthOk      = avgDepth > DEPTH_THRESHOLD;
        const movementOk   = totalMovementRef.current > MOVEMENT_THRESHOLD;
        const symmetryOk   = avgSymmetry > SYMMETRY_THRESHOLD;

        const spoofPassed  = [depthOk, movementOk, symmetryOk].filter(Boolean).length >= 2;

        setProgress({ blink: blinked, headMove: moved, depth: spoofPassed });
        setScores({
          depth:    parseFloat(avgDepth.toFixed(4)),
          movement: parseFloat(totalMovementRef.current.toFixed(4)),
          symmetry: parseFloat(avgSymmetry.toFixed(4)),
        });

        // ── Update instruction ────────────────────────────
        if (!blinked) {
          setInstruction(`Blink ${REQUIRED_BLINKS - blinkCountRef.current} more time(s)`);
        } else if (!moved) {
          setInstruction("Now slowly turn your head left or right");
        } else if (!spoofPassed) {
          setInstruction("Hold still for a moment...");
        }

        // ── All passed ────────────────────────────────────
        if (blinked && moved && spoofPassed) {
          setStatus("passed");
          setInstruction("Verified! Capturing...");
          captureBlob();
          return;
        }

        // ── Spoof detected early ──────────────────────────
        if (frameCountRef.current > 120 && !spoofPassed &&
            depthScoresRef.current.length >= 60) {
          const allFailed = !depthOk && !movementOk;
          if (allFailed) {
            setStatus("failed");
            setInstruction("Spoof detected — please use a real face.");
            stopCamera();
            onFail?.();
            return;
          }
        }
      }

      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(rafRef.current);
  }, [status, captureBlob, stopCamera, onFail]);

  const reset = () => {
    blinkCountRef.current      = 0;
    eyeClosedRef.current       = false;
    baseNoseXRef.current       = null;
    headMovedRef.current       = false;
    frameCountRef.current      = 0;
    depthScoresRef.current     = [];
    prevNosePosRef.current     = null;
    totalMovementRef.current   = 0;
    symmetryScoresRef.current  = [];
    setProgress({ blink: false, headMove: false, depth: false });
    setScores({ depth: 0, movement: 0, symmetry: 0 });
    setStatus("idle");
    setInstruction("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>

      <video
        ref={videoRef}
        width={640} height={480}
        autoPlay playsInline muted
        style={{
          borderRadius: "12px", background: "#111",
          display: status !== "idle" ? "block" : "none",
          border: status === "failed" ? "2px solid #E24B4A"
               : status === "passed" ? "2px solid #1D9E75"
               : "2px solid #333"
        }}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {status === "idle" && (
        <div style={{
          width: 640, height: 200, borderRadius: "12px",
          background: "#1a1a1a", display: "flex",
          alignItems: "center", justifyContent: "center",
          color: "#666", fontSize: "16px", border: "2px dashed #333"
        }}>
          Press Start to begin verification
        </div>
      )}

      {instruction && (
        <div style={{
          background: status === "passed" ? "#0a3d2e"
                    : status === "failed" ? "#3d0a0a" : "#0d1f36",
          color: status === "passed" ? "#1D9E75"
               : status === "failed" ? "#E24B4A" : "#85B7EB",
          padding: "10px 20px", borderRadius: "8px",
          fontSize: "15px", textAlign: "center", maxWidth: 640,
          border: `1px solid ${status === "passed" ? "#1D9E75"
                             : status === "failed" ? "#E24B4A" : "#185FA5"}`
        }}>
          {instruction}
        </div>
      )}

      {/* Liveness + Anti-spoof checklist */}
      {(status === "detecting" || status === "passed") && (
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { label: "Blink",        ok: progress.blink },
            { label: "Head move",    ok: progress.headMove },
            { label: "3D depth",     ok: progress.depth },
          ].map(({ label, ok }) => (
            <span key={label} style={{
              color: ok ? "#1D9E75" : "#666",
              fontSize: "13px", display: "flex", alignItems: "center", gap: "6px"
            }}>
              <span style={{
                width: 16, height: 16, borderRadius: "50%",
                background: ok ? "#1D9E75" : "#333",
                display: "inline-block", flexShrink: 0
              }}/>
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Live debug scores — remove in production */}
      {status === "detecting" && (
        <div style={{
          fontSize: "11px", color: "#555", fontFamily: "monospace",
          display: "flex", gap: "16px"
        }}>
          <span>depth: {scores.depth}</span>
          <span>movement: {scores.movement}</span>
          <span>symmetry: {scores.symmetry}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: "12px" }}>
        {status === "idle" && (
          <button onClick={startCamera} style={btn("#1D9E75")}>
            Start Verification
          </button>
        )}
        {(status === "failed" || status === "passed") && (
          <button onClick={reset} style={btn("#555")}>Try Again</button>
        )}
        {status === "detecting" && (
          <button onClick={() => { stopCamera(); reset(); }} style={btn("#A32D2D")}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

const btn = (bg) => ({
  padding: "10px 24px", background: bg, color: "#fff",
  border: "none", borderRadius: "8px", fontSize: "14px", cursor: "pointer"
});