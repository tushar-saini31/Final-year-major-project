import os
os.environ["SPEECHBRAIN_DISABLE_K2"] = "1"
import warnings
warnings.filterwarnings("ignore")
import bcrypt

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.modules.face_auth.routes import router as face_router
from app.modules.voice_auth.routes import router as voice_router
from app.modules.auth.routes import router as auth_router
from app.modules.vault.routes import router as vault_router
from app.modules.intrusion.routes import router as intrusion_router

from app.database.db import Base, engine, SessionLocal
from app.database import models
from app.database.models import User
from app.modules.intrusion import models as intrusion_models
from app.database.schema import ensure_schema
from app.core import jwt

Base.metadata.create_all(bind=engine)
ensure_schema(engine)

app = FastAPI(title="MFA System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(face_router)
app.include_router(voice_router)
app.include_router(auth_router)
app.include_router(vault_router)
app.include_router(intrusion_router)


def ensure_single_admin_user():
    db = SessionLocal()
    try:
        admin_password = "SecureHubAdmin@#123"
        password_hash = bcrypt.hashpw(admin_password.encode(), bcrypt.gensalt()).decode()

        admins = (
            db.query(User)
            .filter(User.role == "admin")
            .order_by(User.created_at.asc())
            .all()
        )

        if not admins:
            admin_user = User(
                username="securehub_admin",
                full_name="Secure Hub Admin",
                email="admin@securehub.local",
                phone=None,
                designation="Administrator",
                hashed_password=password_hash,
                role="admin",
                is_email_verified=True,
                is_otp_verified=True,
            )
            db.add(admin_user)
            db.commit()
            return

        primary_admin = admins[0]
        primary_admin.hashed_password = password_hash
        for extra_admin in admins[1:]:
            extra_admin.role = "user"

        db.commit()
    finally:
        db.close()


ensure_single_admin_user()


@app.get("/")
def home():
    return {"message": "MFA System Running"}
