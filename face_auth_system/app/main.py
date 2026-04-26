import os
os.environ["SPEECHBRAIN_DISABLE_K2"] = "1"
import warnings
warnings.filterwarnings("ignore")
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.modules.face_auth.routes import router as face_router
from app.modules.voice_auth.routes import router as voice_router
from app.modules.auth.routes import router as auth_router
from app.modules.vault.routes import router as vault_router
from app.database.db import Base, engine
from app.database import models
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

@app.get("/")
def home():
    return {"message": "MFA System Running"}
