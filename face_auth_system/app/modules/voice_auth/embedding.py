import json
import subprocess
import sys

import numpy as np


def _compute_embedding_in_subprocess(audio_path: str):
    args = [
        sys.executable,
        "-m",
        "app.modules.voice_auth.sb_ecapa_worker",
        audio_path,
    ]
    try:
        result = subprocess.run(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        if result.stderr:
            print(result.stderr, end="")

        if result.returncode != 0:
            print("Voice embedding worker failed:")
            print(result.stderr)
            return None

        stdout = result.stdout.strip()

        if not stdout or stdout == "null":
            print("[voice] worker returned null — audio too short or silent")
            return None

        return json.loads(stdout)

    except Exception as e:
        print(f"Voice embedding subprocess error: {e}")
        return None


def get_voice_embedding(audio_path: str):
    try:
        return _compute_embedding_in_subprocess(audio_path)
    except Exception as e:
        print("Voice embedding error:", e)
        return None


def cosine_similarity(a, b):
    a = np.array(a, dtype=np.float32)
    b = np.array(b, dtype=np.float32)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))