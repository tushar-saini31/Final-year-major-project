from sqlalchemy import Column, String, Boolean, DateTime, Integer, Float, Text
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from app.database.db import Base
import uuid


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username      = Column(String(100), nullable=False, index=True)
    device_id     = Column(String(255), nullable=True)
    device_name   = Column(String(255), nullable=True)   # "Chrome on Windows"
    user_agent    = Column(Text, nullable=True)
    ip_address    = Column(String(60), nullable=True)
    timestamp     = Column(DateTime, default=datetime.utcnow, index=True)
    success       = Column(Boolean, default=False)
    step_failed   = Column(String(20), nullable=True)    # otp | face | voice | None
    risk_score    = Column(Integer, default=0)
    risk_level    = Column(String(10), default="low")    # low|medium|high|critical
    alert_type    = Column(String(50), nullable=True)    # unknown_device|brute_force|etc


class TrustedDevice(Base):
    __tablename__ = "trusted_devices"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username     = Column(String(100), nullable=False, index=True)
    device_id    = Column(String(255), nullable=False)
    device_name  = Column(String(255), nullable=True)
    user_agent   = Column(Text, nullable=True)
    first_seen   = Column(DateTime, default=datetime.utcnow)
    last_seen    = Column(DateTime, default=datetime.utcnow)
    is_active    = Column(Boolean, default=True)


class IntrusionAlert(Base):
    __tablename__ = "intrusion_alerts"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username     = Column(String(100), nullable=False, index=True)
    device_id    = Column(String(255), nullable=True)
    ip_address   = Column(String(60), nullable=True)
    alert_type   = Column(String(50), nullable=False)
    risk_score   = Column(Integer, default=0)
    description  = Column(Text, nullable=True)
    timestamp    = Column(DateTime, default=datetime.utcnow, index=True)
    resolved     = Column(Boolean, default=False)