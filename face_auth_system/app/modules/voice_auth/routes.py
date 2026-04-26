import uuid
import os
import random
from fastapi import APIRouter, UploadFile, File, Form, Depends
from .service import register_voice, verify_voice
from app.database.db import get_db

router = APIRouter(prefix="/voice", tags=["Voice Auth"])

PHRASES = [
    "blue sky seven four two",
    "green door nine one five",
    "red fox three eight six",
    "silver moon two five one",
    "golden key eight three nine",
    "open field four six two",
    "black stone five one seven",
    "white cloud six two four",
    "bright sun one nine three",
    "dark river seven two eight",
]

# In-memory store: username -> assigned phrase
# For production, persist this in your DB on the User/BiometricProfile model
_user_phrases: dict[str, str] = {}


@router.get("/challenge")
def get_challenge(username: str = ""):
    """
    Return the same phrase the user enrolled with.
    If username is unknown (first visit before registration), assign and remember one.
    """
    if username and username in _user_phrases:
        return {"phrase": _user_phrases[username]}

    phrase = random.choice(PHRASES)
    if username:
        _user_phrases[username] = phrase
    return {"phrase": phrase}


@router.post("/register")
async def register(
    username: str = Form(...),
    file1: UploadFile = File(...),
    file2: UploadFile = File(...),
    file3: UploadFile = File(...),
    file4: UploadFile = File(...),
    file5: UploadFile = File(...),
    db=Depends(get_db),
):
    # Lock in this user's phrase at registration time if not already set
    if username not in _user_phrases:
        _user_phrases[username] = random.choice(PHRASES)

    paths = []
    try:
        for f in [file1, file2, file3, file4, file5]:
            ext = "webm" if "webm" in (f.content_type or "") else "wav"
            path = f"temp_voice_{uuid.uuid4().hex}.{ext}"
            with open(path, "wb") as out:
                out.write(await f.read())
            paths.append(path)
        return register_voice(username, paths, db=db)
    finally:
        for p in paths:
            if os.path.exists(p):
                os.remove(p)


@router.post("/verify")
async def verify(
    username: str = Form(...),
    expected_phrase: str = Form(...),
    spoken_phrase: str = Form(...),
    file1: UploadFile = File(...),
    file2: UploadFile = File(None),
    file3: UploadFile = File(None),
    db=Depends(get_db),
):
    """
    Accept 1–3 audio samples for verification and use the best-matching one.
    """
    paths = []
    try:
        for f in [file1, file2, file3]:
            if f is None:
                continue
            # Some uploads have no filename; guard against that
            try:
                data = await f.read()
            except Exception:
                continue
            if not data:
                continue
            ext = "webm" if "webm" in (f.content_type or "") else "wav"
            path = f"temp_verify_{uuid.uuid4().hex}.{ext}"
            with open(path, "wb") as out:
                out.write(data)
            paths.append(path)

        if not paths:
            return {"success": False, "reason": "no_audio", "message": "No audio received."}

        return verify_voice(username, paths, expected_phrase, spoken_phrase, db=db)
    finally:
        for p in paths:
            if os.path.exists(p):
                os.remove(p)


@router.post("/debug-audio")
async def debug_audio(file: UploadFile = File(...)):
    import io
    import numpy as np
    import soundfile as sf

    data = await file.read()
    try:
        audio, sr = sf.read(io.BytesIO(data), dtype="float32", always_2d=True)
        mono = audio.mean(axis=1)
        duration = mono.shape[0] / sr
        peak = float(np.abs(mono).max())
        rms = float(np.sqrt(np.mean(mono ** 2)))
        is_too_quiet = rms < 0.01
        is_clipping = peak >= 0.99

        return {
            "ok": True,
            "sample_rate_hz": sr,
            "channels": audio.shape[1],
            "duration_seconds": round(duration, 3),
            "peak_amplitude": round(peak, 5),
            "rms_amplitude": round(rms, 5),
            "total_samples": int(mono.shape[0]),
            "warnings": {
                "too_quiet": is_too_quiet,
                "clipping": is_clipping,
                "too_short": duration < 1.5,
                "too_long": duration > 10.0,
            },
            "diagnosis": (
                "CLIPPING — mic gain too high"
                if is_clipping else
                "TOO QUIET — mic not picking up audio"
                if is_too_quiet else
                "TOO SHORT — speak for at least 1.5 seconds"
                if duration < 1.5 else
                "AUDIO LOOKS OK"
            ),
        }
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
            "bytes_received": len(data),
            "diagnosis": "File could not be decoded",
        }