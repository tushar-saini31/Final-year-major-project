# FIXED service.py
import os
import uuid
import json
from datetime import datetime
import numpy as np
from .embedding import get_face_embedding
from .matcher import cosine_similarity
from app.database.models import BiometricProfile
from app.database.models import User

EMBEDDING_DIR = "embeddings"
os.makedirs(EMBEDDING_DIR, exist_ok=True)


def _upsert_face_embedding(db, username: str, embedding_list: list[float]):
    if db is None:
        return

    profile = db.query(BiometricProfile).filter(BiometricProfile.username == username).first()
    if profile is None:
        profile = BiometricProfile(username=username)
        db.add(profile)

    profile.face_embedding = json.dumps(embedding_list)
    profile.face_updated_at = datetime.utcnow()

    # Also keep a copy in `users` for easy viewing in pgAdmin.
    user = db.query(User).filter(User.username == username).first()
    if user:
        user.face_embedding = json.dumps(embedding_list)
        user.is_face_enrolled = True

    db.commit()


def register_face(username, file, db=None):
    path = f"temp_{username}_{uuid.uuid4().hex}.jpg"
    try:
        with open(path, "wb") as f:
            f.write(file.file.read())

        embedding = get_face_embedding(path)

        if embedding is None:
            return {"error": "No face detected"}

        # Keep existing file-based storage (backward-compatible).
        np.save(f"{EMBEDDING_DIR}/{username}.npy", embedding)

        # Store in DB as JSON list for durable persistence.
        embedding_list = np.asarray(embedding).astype(float).tolist()
        _upsert_face_embedding(db, username, embedding_list)
        return {"message": "Face registered successfully"}

    finally:
        if os.path.exists(path):
            os.remove(path)  # always cleanup, even on error


def _load_face_embedding_from_db(db, username: str):
    if db is None:
        return None

    profile = db.query(BiometricProfile).filter(BiometricProfile.username == username).first()
    if not profile or not profile.face_embedding:
        return None

    try:
        return json.loads(profile.face_embedding)
    except Exception:
        return None


def login_face(username, file, db=None):
    path = f"temp_login_{username}_{uuid.uuid4().hex}.jpg"
    try:
        with open(path, "wb") as f:
            f.write(file.file.read())

        new_embedding = get_face_embedding(path)

        if new_embedding is None:
            return {"error": "No face detected"}

        # Prefer DB storage; fall back to legacy .npy files if needed.
        stored_embedding = _load_face_embedding_from_db(db, username)
        if stored_embedding is None:
            stored_path = f"{EMBEDDING_DIR}/{username}.npy"
            if not os.path.exists(stored_path):
                return {"error": "User not found"}
            stored_embedding = np.load(stored_path).tolist()

        similarity = cosine_similarity(stored_embedding, np.asarray(new_embedding).tolist())
        print("Similarity:", similarity)

        if similarity > 0.65:
            if db is not None:
                user = db.query(User).filter(User.username == username).first()
                if user:
                    user.last_login = datetime.utcnow()
                    db.commit()
            return {"success": True, "similarity": float(similarity)}
        else:
            return {"success": False, "similarity": float(similarity)}

    finally:
        if os.path.exists(path):
            os.remove(path)
