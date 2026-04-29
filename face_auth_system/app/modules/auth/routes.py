import random
import re
import os
from datetime import datetime, timedelta

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, field_validator

from app.database.db import get_db
from app.database.models import User
from app.modules.intrusion.service import ids_check, record_attempt
from app.core.jwt import create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])

OTP_TTL_MINUTES = 5


def _new_otp() -> str:
    return f"{random.randint(0, 999999):06d}"


def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def _check_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def _validate_password_strength(password: str) -> str | None:
    if len(password) < 8:
        return "Password must be at least 8 characters"
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter"
    if not re.search(r"[0-9]", password):
        return "Password must contain at least one number"
    return None


def _normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("91") and len(digits) == 12:
        return f"+{digits}"
    if len(digits) == 10:
        return f"+91{digits}"
    return f"+{digits}"


def _validate_phone(phone: str) -> str | None:
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    if len(digits) != 10:
        return "Phone number must be 10 digits"
    if not re.match(r"^[6-9]", digits):
        return "Phone number must start with 6, 7, 8, or 9"
    return None


def _mask_phone(phone: str) -> str:
    if not phone or len(phone) <= 4:
        return phone
    masked_prefix = "*" * (len(phone) - 4)
    return f"{masked_prefix}{phone[-4:]}"


def _send_otp_sms(phone: str, otp: str) -> None:
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token  = os.getenv("TWILIO_AUTH_TOKEN")
    from_phone  = os.getenv("TWILIO_FROM_PHONE")

    if not account_sid or not auth_token or not from_phone:
        raise HTTPException(
            status_code=500,
            detail="Twilio is not configured.",
        )
    try:
        from twilio.rest import Client
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="Twilio SDK not installed.") from exc

    client = Client(account_sid, auth_token)
    try:
        client.messages.create(
            body=f"Your OTP is {otp}. Do not share it.",
            from_=from_phone,
            to=phone,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to send OTP SMS: {exc}") from exc


def _get_client_ip(request: Request) -> str:
    header_order = [
        "x-forwarded-for",
        "x-real-ip",
        "cf-connecting-ip",
        "true-client-ip",
        "fly-client-ip",
        "x-client-ip",
    ]
    for key in header_order:
        value = request.headers.get(key)
        if value:
            # x-forwarded-for may contain multiple addresses
            return value.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


# ── Pydantic models ───────────────────────────────────────────────────────────

class RegisterStartRequest(BaseModel):
    username: str
    full_name: str
    email: EmailStr
    phone: str
    designation: str | None = None
    password: str
    device_id: str | None = None       # NEW
    device_name: str | None = None     # NEW

    @field_validator("username")
    @classmethod
    def username_valid(cls, v):
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError("Username can only contain letters, numbers, and underscores")
        return v

    @field_validator("full_name")
    @classmethod
    def full_name_valid(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Full name is required")
        return v

    @field_validator("phone")
    @classmethod
    def phone_valid(cls, v):
        err = _validate_phone(v)
        if err:
            raise ValueError(err)
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v):
        err = _validate_password_strength(v)
        if err:
            raise ValueError(err)
        return v


class LoginStartRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    device_id: str | None = None       # NEW
    device_name: str | None = None     # NEW

    @field_validator("username")
    @classmethod
    def username_valid(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("username is required")
        return v

    @field_validator("password")
    @classmethod
    def password_required(cls, v):
        if not v:
            raise ValueError("password is required")
        return v


class OtpVerifyRequest(BaseModel):
    username: str | None = None
    phone: str | None = None
    otp_code: str
    device_id: str | None = None       # NEW
    device_name: str | None = None     # NEW

    @field_validator("otp_code")
    @classmethod
    def otp_code_valid(cls, v):
        code = v.strip()
        if not re.fullmatch(r"\d{6}", code):
            raise ValueError("otp_code must be a 6-digit number")
        return code


class AdminLoginRequest(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def password_required(cls, v):
        if not v or not v.strip():
            raise ValueError("password is required")
        return v


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/register/start")
def register_start(payload: RegisterStartRequest, request: Request, db=Depends(get_db)):
    username = payload.username.strip()

    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=409, detail="username already exists")
    if db.query(User).filter(User.email == str(payload.email).lower()).first():
        raise HTTPException(status_code=409, detail="email already exists")

    normalized_phone = _normalize_phone(payload.phone)
    otp = _new_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES)

    user = User(
        username=username,
        full_name=payload.full_name.strip(),
        email=str(payload.email).strip().lower(),
        phone=normalized_phone,
        designation=(payload.designation.strip() if payload.designation else None),
        hashed_password=_hash_password(payload.password),
        role="user",
        otp_code=otp,
        otp_expires_at=expires_at,
        is_otp_verified=False,
        is_email_verified=False,
    )
    db.add(user)
    db.commit()

    try:
        _send_otp_sms(normalized_phone, otp)
    except HTTPException:
        db.delete(user)
        db.commit()
        raise

    return {
        "success": True,
        "message": f"OTP sent to {_mask_phone(normalized_phone)}.",
        "expires_at": expires_at.isoformat() + "Z",
    }


@router.post("/login/start")
def login_start(payload: LoginStartRequest, request: Request, db=Depends(get_db)):
    username = payload.username.strip()
    email    = str(payload.email).strip().lower()
    ip       = _get_client_ip(request)
    ua       = request.headers.get("user-agent", "")
    device_id   = payload.device_id or "unknown"
    device_name = payload.device_name or "Unknown Device"

    # ── IDS check BEFORE credential verification ──────────────────────────
    ids_result = ids_check(db, username, device_id, ua, ip)

    if not ids_result["allowed"]:
        # Record the blocked attempt
        record_attempt(
            db, username, device_id, device_name, ua, ip,
            success=False,
            risk_score=ids_result["risk_score"],
            risk_level=ids_result["risk_level"],
            step_failed="ids_gate",
            alert_type=ids_result["alert_type"],
        )
        return {
            "success": False,
            "ids_blocked": True,
            "block_type": ids_result["block_type"],
            "block_until": ids_result["block_until"].isoformat() + "Z" if ids_result["block_until"] else None,
            "time_remaining": ids_result["time_remaining"],
            "attempts_remaining": ids_result["attempts_remaining"],
            "alert_type": ids_result["alert_type"],
            "message": ids_result["message"],
        }

    # ── Normal credential check ────────────────────────────────────────────
    user = db.query(User).filter(User.username == username).first()
    if not user:
        record_attempt(db, username, device_id, device_name, ua, ip,
                       False, ids_result["risk_score"], ids_result["risk_level"],
                       step_failed="username_not_found")
        raise HTTPException(status_code=404, detail="username not found")

    if user.email != email:
        record_attempt(db, username, device_id, device_name, ua, ip,
                       False, ids_result["risk_score"], ids_result["risk_level"],
                       step_failed="email_mismatch")
        raise HTTPException(status_code=401, detail="email does not match")

    if not _check_password(payload.password, user.hashed_password):
        record_attempt(db, username, device_id, device_name, ua, ip,
                       False, ids_result["risk_score"], ids_result["risk_level"],
                       step_failed="wrong_password")

        # Return warning if attempts are getting close to limit
        remaining = max(0, 5 - (user.failed_attempts or 0) - 1)
        return {
            "success": False,
            "ids_blocked": False,
            "attempts_remaining": remaining,
            "show_warning": remaining <= 2,
            "message": "invalid password",
        }

    # ── Credentials OK ────────────────────────────────────────────────────
    if not user.phone:
        raise HTTPException(status_code=400, detail="phone number not found for this user")

    otp = _new_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES)
    user.otp_code = otp
    user.otp_expires_at = expires_at
    user.is_otp_verified = False
    db.commit()

    try:
        _send_otp_sms(user.phone, otp)
    except HTTPException:
        user.otp_code = None
        user.otp_expires_at = None
        db.commit()
        raise

    return {
        "success": True,
        "message": f"Credentials verified. OTP sent to {_mask_phone(user.phone)}.",
        "expires_at": expires_at.isoformat() + "Z",
        # IDS info for frontend
        "risk_level": ids_result["risk_level"],
        "show_warning": ids_result["show_warning"],
        "alert_type": ids_result["alert_type"],
        "attempts_remaining": ids_result["attempts_remaining"],
    }


@router.post("/otp/verify")
def otp_verify(payload: OtpVerifyRequest, request: Request, db=Depends(get_db)):
    username = payload.username.strip() if payload.username else ""
    phone    = _normalize_phone(payload.phone) if payload.phone else ""
    code     = payload.otp_code.strip()
    ip       = _get_client_ip(request)
    ua       = request.headers.get("user-agent", "")
    device_id   = payload.device_id or "unknown"
    device_name = payload.device_name or "Unknown Device"

    if not code:
        raise HTTPException(status_code=400, detail="otp_code is required")
    if not username and not phone:
        raise HTTPException(status_code=400, detail="username or phone is required")

    user = None
    if phone:
        user = db.query(User).filter(User.phone == phone).first()
        if not user:
            raise HTTPException(status_code=404, detail="phone number not found.")

    if not user and username:
        user = db.query(User).filter(User.username == username).first()

    if not user:
        raise HTTPException(status_code=404, detail="user not found")

    if not user.otp_code or not user.otp_expires_at:
        raise HTTPException(status_code=400, detail="no OTP pending for this user")

    if datetime.utcnow() > user.otp_expires_at:
        raise HTTPException(status_code=400, detail="OTP expired")

    if code != user.otp_code:
        record_attempt(db, user.username, device_id, device_name, ua, ip,
                       False, 0, "low", step_failed="otp")
        raise HTTPException(status_code=400, detail="invalid OTP")

    user.is_otp_verified = True
    user.is_email_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()

    # Record successful OTP step
    record_attempt(db, user.username, device_id, device_name, ua, ip,
                   True, 0, "low", step_failed=None)

    return {
        "success": True,
        "message": "OTP verified",
        "username": user.username,
    }


@router.post("/admin/login")
def admin_login(payload: AdminLoginRequest, db=Depends(get_db)):
    admin_user = (
        db.query(User)
        .filter(User.role == "admin")
        .order_by(User.created_at.asc())
        .first()
    )
    if not admin_user:
        raise HTTPException(status_code=404, detail="No admin account configured")

    if admin_user.is_locked:
        raise HTTPException(status_code=403, detail="Admin account is locked")

    if not _check_password(payload.password, admin_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid admin password")

    token = create_access_token(admin_user.username, "admin")
    return {
        "success": True,
        "username": admin_user.username,
        "role": "admin",
        "access_token": token,
        "token_type": "bearer",
    }
