import os
import json
from datetime import datetime
from difflib import SequenceMatcher

import numpy as np

from .embedding import get_voice_embedding, cosine_similarity
from app.database.models import BiometricProfile, User

VOICE_DIR = "voice_embeddings"
os.makedirs(VOICE_DIR, exist_ok=True)

# Lowered from 0.60 — ECAPA-TDNN on browser-captured audio realistically
# scores 0.55–0.75 for genuine speakers. 0.60 was too tight.
THRESHOLD = 0.50

WORD_SIM_THRESHOLD = 0.74
MIN_WORD_MATCHES = 2

_WORD_TO_DIGIT = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
}
_DIGIT_TO_WORD = {v: k for k, v in _WORD_TO_DIGIT.items()}


def _normalize_phrase(phrase: str) -> str:
    phrase = phrase.lower().strip()
    tokens = phrase.split()
    normalized = []
    for token in tokens:
        if token.isdigit() and len(token) > 1:
            for digit_char in token:
                normalized.append(_DIGIT_TO_WORD.get(digit_char, digit_char))
        elif token.isdigit() and len(token) == 1:
            normalized.append(_DIGIT_TO_WORD.get(token, token))
        else:
            normalized.append(token)
    return " ".join(normalized)


def _word_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _phrase_word_match(expected: str, spoken: str):
    expected_tokens = _normalize_phrase(expected).split()
    spoken_tokens = _normalize_phrase(spoken).split()

    if not expected_tokens or not spoken_tokens:
        return {
            "passed": False,
            "matched_words": 0,
            "total_expected": len(expected_tokens),
            "threshold_per_word": WORD_SIM_THRESHOLD,
            "word_scores": [],
        }

    used_spoken = set()
    matched = 0
    detailed_scores = []

    for exp in expected_tokens:
        best_idx = None
        best_score = 0.0
        for i, spk in enumerate(spoken_tokens):
            if i in used_spoken:
                continue
            score = _word_similarity(exp, spk)
            if score > best_score:
                best_score = score
                best_idx = i

        detailed_scores.append({"expected": exp, "best_score": round(best_score, 4)})

        if best_idx is not None and best_score >= WORD_SIM_THRESHOLD:
            used_spoken.add(best_idx)
            matched += 1

    required = min(MIN_WORD_MATCHES, len(expected_tokens))
    passed = matched >= required

    return {
        "passed": passed,
        "matched_words": matched,
        "total_expected": len(expected_tokens),
        "required_matches": required,
        "threshold_per_word": WORD_SIM_THRESHOLD,
        "word_scores": detailed_scores,
    }


def _normalize_vec(vec: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


def _upsert_voice_embedding(db, username: str, payload: dict):
    if db is None:
        return

    profile = db.query(BiometricProfile).filter(
        BiometricProfile.username == username
    ).first()
    if profile is None:
        profile = BiometricProfile(username=username)
        db.add(profile)

    profile.voice_embedding = json.dumps(payload)
    profile.voice_updated_at = datetime.utcnow()

    user = db.query(User).filter(User.username == username).first()
    if user:
        user.voice_embedding = json.dumps(payload)
        user.is_voice_enrolled = True

    db.commit()


def _load_voice_embedding_from_db(db, username: str):
    if db is None:
        return None
    profile = db.query(BiometricProfile).filter(
        BiometricProfile.username == username
    ).first()
    if not profile or not profile.voice_embedding:
        return None
    try:
        return json.loads(profile.voice_embedding)
    except Exception:
        return None


def _load_stored_embedding(db, username: str):
    payload = _load_voice_embedding_from_db(db, username)
    if payload is not None:
        return payload

    stored_path = f"{VOICE_DIR}/{username}.json"
    if os.path.exists(stored_path):
        try:
            with open(stored_path, "r") as f:
                return json.load(f)
        except Exception:
            return None

    return None


def _best_similarity(stored_payload, new_embedding: list) -> float:
    """
    Compare a new embedding against all stored registration embeddings.
    Returns the highest similarity found (individual or average-vector).
    """
    new_vec = np.array(new_embedding, dtype=np.float32)

    if isinstance(stored_payload, dict) and stored_payload.get("type") == "multi":
        embeddings = stored_payload["embeddings"]

        individual_scores = [
            float(cosine_similarity(emb, new_vec))
            for emb in embeddings
        ]
        max_individual = max(individual_scores)

        avg_vec = _normalize_vec(
            np.mean([np.array(e, dtype=np.float32) for e in embeddings], axis=0)
        )
        avg_score = float(cosine_similarity(avg_vec.tolist(), new_vec))

        best = max(max_individual, avg_score)

        print(
            f"[voice] individual scores={[round(s, 4) for s in individual_scores]} "
            f"avg_score={avg_score:.4f} best={best:.4f}"
        )
        return best

    return float(cosine_similarity(stored_payload, new_vec))


def register_voice(username: str, audio_paths: list, db=None):
    individual_embeddings = []

    for path in audio_paths:
        raw = get_voice_embedding(path)
        if raw is None:
            continue
        vec = _normalize_vec(np.array(raw, dtype=np.float32))
        individual_embeddings.append(vec.tolist())

    if not individual_embeddings:
        return {"error": "Could not process any voice recording"}

    print(f"[voice] registered {len(individual_embeddings)} raw embeddings")

    # Drop outliers — remove any embedding that is far from the others
    # This handles the case where one recording was bad (cough, noise, wrong phrase)
    if len(individual_embeddings) >= 3:
        avg_vec = _normalize_vec(
            np.mean([np.array(e, dtype=np.float32) for e in individual_embeddings], axis=0)
        )
        scored = [
            (cosine_similarity(emb, avg_vec.tolist()), emb)
            for emb in individual_embeddings
        ]
        scored.sort(key=lambda x: x[0], reverse=True)

        # Print all scores vs average
        for i, (score, _) in enumerate(scored):
            print(f"[voice] embedding[{i}] vs avg = {score:.4f}")

        # Keep only embeddings within 0.15 of the best score
        best_score = scored[0][0]
        filtered = [emb for score, emb in scored if score >= best_score - 0.15]
        print(f"[voice] kept {len(filtered)}/{len(individual_embeddings)} embeddings after outlier removal")
        individual_embeddings = filtered

    payload = {
        "type": "multi",
        "embeddings": individual_embeddings,
    }

    avg_vec = _normalize_vec(
        np.mean([np.array(e, dtype=np.float32) for e in individual_embeddings], axis=0)
    )
    legacy_list = avg_vec.tolist()

    _upsert_voice_embedding(db, username, payload)

    with open(f"{VOICE_DIR}/{username}.json", "w") as f:
        json.dump(legacy_list, f)

    return {
        "message": f"Voice registered using {len(individual_embeddings)} recording(s)",
        "samples_stored": len(individual_embeddings),
    }


def verify_voice(
    username: str,
    audio_paths: list,          # NOW accepts a list — 1 to 3 paths
    expected_phrase: str,
    spoken_phrase: str,
    db=None,
):
    # ── Phrase check ──────────────────────────────────────────────────────────
    expected_norm = _normalize_phrase(expected_phrase)
    spoken_norm = _normalize_phrase(spoken_phrase)
    phrase_check = _phrase_word_match(expected_phrase, spoken_phrase)

    print(
        f"[voice] phrase check expected='{expected_norm}' spoken='{spoken_norm}' "
        f"matched={phrase_check['matched_words']}/{phrase_check['total_expected']} "
        f"required={phrase_check['required_matches']} threshold={phrase_check['threshold_per_word']}"
    )

    if not phrase_check["passed"]:
        return {
            "success": False,
            "reason": "wrong_phrase",
            "message": f"Phrase mismatch. Say at least {phrase_check['required_matches']} matching words.",
            "debug": {
                "expected_normalized": expected_norm,
                "spoken_normalized": spoken_norm,
                "phrase_check": phrase_check,
            },
        }

    # ── Load stored embeddings ────────────────────────────────────────────────
    stored_payload = _load_stored_embedding(db, username)
    if stored_payload is None:
        return {
            "success": False,
            "reason": "not_registered",
            "message": "Voice not registered for this user",
        }

    # ── Compute new embeddings for every submitted sample ────────────────────
    new_embeddings = []
    for path in audio_paths:
        raw = get_voice_embedding(path)
        if raw is None:
            print(f"[voice] skipping {path} — embedding returned null")
            continue
        vec = _normalize_vec(np.array(raw, dtype=np.float32))
        new_embeddings.append(vec.tolist())

    if not new_embeddings:
        return {
            "success": False,
            "reason": "processing_error",
            "message": "Could not process the submitted voice recording(s)",
        }

    # ── Best-of-N similarity across all submitted samples ────────────────────
    try:
        all_scores = [_best_similarity(stored_payload, emb) for emb in new_embeddings]
        similarity = max(all_scores)
        print(f"[voice] per-sample scores={[round(s,4) for s in all_scores]} best={similarity:.4f}")
    except Exception as exc:
        print(f"[voice] similarity computation failed for {username}: {exc}")
        return {
            "success": False,
            "reason": "embedding_mismatch",
            "message": "Stored voice embedding is incompatible. Please re-register your voice.",
        }

    passed = similarity >= THRESHOLD
    print(
        f"[voice] user={username} similarity={similarity:.4f} "
        f"threshold={THRESHOLD} result={'PASS' if passed else 'FAIL'}"
    )

    if passed:
        return {
            "success": True,
            "similarity": round(similarity, 4),
            "phrase_check": {
                "matched_words": phrase_check["matched_words"],
                "total_expected": phrase_check["total_expected"],
                "required_matches": phrase_check["required_matches"],
            },
        }

    return {
        "success": False,
        "reason": "voice_mismatch",
        "similarity": round(similarity, 4),
        "message": "Voice does not match. Please try again or re-register.",
    }