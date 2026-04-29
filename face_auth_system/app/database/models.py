from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from .db import Base
import uuid

class User(Base):
    __tablename__ = "users"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username         = Column(String(100), unique=True, nullable=True, index=True)
    full_name        = Column(String(100), nullable=False)
    email            = Column(String(100), unique=True, nullable=False, index=True)
    phone            = Column(String(20), unique=True, nullable=True)
    age              = Column(Integer, nullable=True)
    designation      = Column(String(100), nullable=True)
    hashed_password  = Column(String(255), nullable=False)
    role             = Column(String(20), default="user")  # user | admin

    # Verification flags
    is_email_verified = Column(Boolean, default=False)
    is_otp_verified   = Column(Boolean, default=False)
    is_face_enrolled  = Column(Boolean, default=False)
    is_voice_enrolled = Column(Boolean, default=False)

    # Biometric data
    face_embedding    = Column(Text, nullable=True)
    voice_embedding   = Column(Text, nullable=True)

    # OTP
    otp_code          = Column(String(6), nullable=True)
    otp_expires_at    = Column(DateTime, nullable=True)

    created_at        = Column(DateTime, default=datetime.utcnow)
    last_login        = Column(DateTime, nullable=True)

    # ── IDS fields (NEW) ─────────────────────────────────────────────────────
    is_locked         = Column(Boolean, default=False)          # admin must unlock
    blocked_until     = Column(DateTime, nullable=True)         # auto-expires
    failed_attempts   = Column(Integer, default=0)              # resets on success


class BiometricProfile(Base):
    __tablename__ = "biometric_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(100), unique=True, index=True, nullable=False)

    face_embedding   = Column(Text, nullable=True)
    voice_embedding  = Column(Text, nullable=True)

    face_updated_at  = Column(DateTime, nullable=True)
    voice_updated_at = Column(DateTime, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)


class VaultNote(Base):
    __tablename__ = "vault_notes"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username   = Column(String(100), nullable=False, index=True)
    title      = Column(String(255), nullable=False)
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)