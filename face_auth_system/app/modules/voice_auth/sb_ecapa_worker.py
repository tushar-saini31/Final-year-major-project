import json
import os
import sys
import subprocess
import tempfile

def _ffmpeg_convert(input_path: str, output_path: str) -> bool:
    """Convert any audio to 16kHz mono WAV using ffmpeg.

    FIX: Removed afftdn (spectral denoiser) and loudnorm from the filter chain.
    Both filters are adaptive — they analyze each recording's noise floor
    independently, so the same voice produces different waveforms each session,
    causing cosine similarity to drop below the 0.60 threshold even for the
    correct speaker. A simple highpass/lowpass + resample is consistent and
    sufficient for ECAPA-TDNN.
    """
    audio_filter = "highpass=f=80,lowpass=f=8000,aresample=16000"
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-ar", "16000",
        "-ac", "1",
        "-af", audio_filter,
        "-sample_fmt", "s16",
        "-f", "wav",
        output_path
    ]
    print(f"[worker] ffmpeg cmd: {' '.join(cmd)}", file=sys.stderr)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[worker] ffmpeg FAILED:\n{result.stderr}", file=sys.stderr)
        return False
    print(f"[worker] ffmpeg OK → {output_path}", file=sys.stderr)
    return True


def _load_wav_16k_mono(path: str):
    import numpy as np
    import torch
    import soundfile as sf
    from scipy.signal import resample_poly

    print(f"[worker] input file: {path}", file=sys.stderr)
    print(f"[worker] file size: {os.path.getsize(path)} bytes", file=sys.stderr)

    converted = path + "_16k.wav"
    ffmpeg_ok = _ffmpeg_convert(path, converted)

    if ffmpeg_ok and os.path.exists(converted):
        read_path = converted
        print(f"[worker] using ffmpeg output: {read_path}", file=sys.stderr)
    else:
        read_path = path
        print(f"[worker] ffmpeg failed, reading original: {read_path}", file=sys.stderr)

    try:
        audio, sr = sf.read(read_path, dtype="float32", always_2d=True)
        print(f"[worker] sf.read OK — sr={sr} channels={audio.shape[1]} samples={audio.shape[0]}", file=sys.stderr)
    except Exception as e:
        print(f"[worker] sf.read FAILED: {e}", file=sys.stderr)
        if os.path.exists(converted):
            os.remove(converted)
        raise
    finally:
        if ffmpeg_ok and os.path.exists(converted):
            try:
                os.remove(converted)
            except:
                pass

    # Mix to mono
    audio = audio.mean(axis=1)

    # Resample if ffmpeg wasn't available and sr is wrong
    if sr != 16000:
        print(f"[worker] resampling {sr} → 16000", file=sys.stderr)
        audio = resample_poly(audio, 16000, sr).astype(np.float32)

    # Amplitude stats before normalization
    peak = float(np.abs(audio).max())
    rms = float(np.sqrt(np.mean(audio ** 2)))
    print(f"[worker] before norm — peak={peak:.5f} rms={rms:.5f} duration={len(audio)/16000:.2f}s", file=sys.stderr)

    # Normalize amplitude
    if peak > 0:
        audio = audio / peak

    # FIX: Energy-based silence trimming replaces the old hard threshold.
    # Old approach: np.where(np.abs(audio) > 0.01) was too aggressive after
    # loudnorm amplified background noise — the threshold cut differently each
    # session, producing different-length tensors and lower similarity scores.
    # New approach: compute per-frame RMS energy, find the noise floor as the
    # bottom 10th percentile of frame energies, then keep frames above 3x that
    # floor. This adapts to the actual recording's noise level rather than using
    # a fixed amplitude value, so trimming is consistent across sessions.
    frame_size = 160  # 10ms at 16kHz
    energies = np.array([
        np.sqrt(np.mean(audio[i:i + frame_size] ** 2))
        for i in range(0, len(audio) - frame_size, frame_size)
    ])
    if len(energies) > 0:
        noise_floor = np.percentile(energies, 10)
        silence_threshold = max(noise_floor * 3.0, 0.005)
        active_frames = np.where(energies > silence_threshold)[0]
        if len(active_frames) > 0:
            start = active_frames[0] * frame_size
            end = min((active_frames[-1] + 1) * frame_size, len(audio))
            audio = audio[start:end]
            print(f"[worker] after energy trim: {len(audio)/16000:.2f}s", file=sys.stderr)
        else:
            print(f"[worker] WARNING — audio is all silence after normalization!", file=sys.stderr)
    else:
        print(f"[worker] WARNING — audio too short to compute frame energies!", file=sys.stderr)

    # Pad to minimum 2.5s (increased from 1.5s — ECAPA-TDNN needs more context)
    min_len = int(16000 * 2.5)
    if len(audio) < min_len:
        audio = np.pad(audio, (0, min_len - len(audio)))
        print(f"[worker] padded to {len(audio)/16000:.2f}s", file=sys.stderr)

    return torch.from_numpy(audio.astype(np.float32)).unsqueeze(0)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: sb_ecapa_worker.py <audio_path>")

    try:
        import numpy as np
        import torch
        from speechbrain.inference.speaker import EncoderClassifier
        from speechbrain.utils.fetching import LocalStrategy
    except ModuleNotFoundError as exc:
        print(
            "[worker] Missing dependency for voice embeddings. "
            "Install dependencies with `pip install -r requirements.txt`.",
            file=sys.stderr,
        )
        print(f"[worker] import error: {exc}", file=sys.stderr)
        print("null")
        return

    audio_path = sys.argv[1]
    print(f"[worker] ===== START =====", file=sys.stderr)
    if not os.path.exists(audio_path):
        print(f"[worker] audio file not found: {audio_path}", file=sys.stderr)
        print("null")
        return

    savedir = os.path.join("voice_model", "ecapa_voxceleb")
    classifier = EncoderClassifier.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb",
        savedir=savedir,
        run_opts={"device": "cpu"},
        local_strategy=LocalStrategy.COPY,
    )

    try:
        wav = _load_wav_16k_mono(audio_path)
    except Exception as exc:
        print(f"[worker] failed to load audio: {exc}", file=sys.stderr)
        print("null")
        return
    duration = wav.shape[-1] / 16000
    print(f"[worker] final tensor duration={duration:.2f}s shape={wav.shape}", file=sys.stderr)

    if wav.shape[-1] < 8000:
        print(f"[worker] TOO SHORT — returning null", file=sys.stderr)
        print("null")
        return

    with torch.no_grad():
        emb = classifier.encode_batch(wav).squeeze().cpu().numpy().astype(np.float32)

    norm = np.linalg.norm(emb)
    print(f"[worker] embedding norm={norm:.4f} dim={emb.shape}", file=sys.stderr)

    if norm > 0:
        emb = emb / norm

    print(f"[worker] ===== DONE =====", file=sys.stderr)
    print(json.dumps(emb.tolist()))


if __name__ == "__main__":
    main()
