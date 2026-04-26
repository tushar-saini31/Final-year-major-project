# FIXED embedding.py
from deepface import DeepFace

def get_face_embedding(image_path):
    try:
        result = DeepFace.represent(
            img_path=image_path,
            model_name="Facenet",
            enforce_detection=False  # returns None gracefully instead of crashing
        )
        if not result:
            return None
        return result[0]["embedding"]
    except Exception as e:
        print("Embedding error:", e)
        return None