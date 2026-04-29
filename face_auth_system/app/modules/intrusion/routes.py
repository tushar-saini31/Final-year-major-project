"""
Intrusion Detection Routes
───────────────────────────
  GET  /intrusion/live-feed          → last 20 login attempts (monitor page)
  GET  /intrusion/alerts             → all IntrusionAlerts
  GET  /intrusion/attempts/:username → history for one user
  POST /intrusion/trust-device       → user confirms "yes, this was me"
  POST /intrusion/report-suspicious  → user says "no, wasn't me"
  POST /intrusion/admin/unlock/:username
  POST /intrusion/admin/unblock/:username
  POST /intrusion/admin/block-device
  GET  /intrusion/admin/locked-accounts

  ── Demo endpoints (localhost only) ──
  POST /intrusion/demo/simulate-brute-force
  POST /intrusion/demo/simulate-unknown-device
  POST /intrusion/demo/simulate-critical
  POST /intrusion/demo/reset
"""

from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy import desc, or_

from app.database.db import get_db
from app.database.models import User
from app.modules.intrusion.models import LoginAttempt, TrustedDevice, IntrusionAlert
from app.modules.intrusion.service import trust_device, mark_suspicious, _create_alert
from app.core.jwt import decode_token

router = APIRouter(prefix="/intrusion", tags=["Intrusion Detection"])
security = HTTPBearer()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class TrustDeviceRequest(BaseModel):
    username: str
    device_id: str
    device_name: str
    user_agent: str


class ReportSuspiciousRequest(BaseModel):
    username: str


class BlockDeviceRequest(BaseModel):
    username: str
    device_id: str


class SimulateBruteRequest(BaseModel):
    username: str = "demo_user"


def require_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_db),
):
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    username = payload.get("sub")
    role = payload.get("role")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    if role == "admin":
        return username

    user = db.query(User).filter(User.username == username).first()
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return username


# ── Live feed (Security Monitor page polls this) ──────────────────────────────

@router.get("/live-feed")
def live_feed(_admin=Depends(require_admin), db=Depends(get_db)):
    rows = (
        db.query(LoginAttempt)
        .order_by(desc(LoginAttempt.timestamp))
        .limit(30)
        .all()
    )
    return [
        {
            "id": str(r.id),
            "username": r.username,
            "device_name": r.device_name or "Unknown Device",
            "ip_address": r.ip_address or "—",
            "risk_score": r.risk_score,
            "risk_level": r.risk_level,
            "success": r.success,
            "step_failed": r.step_failed,
            "alert_type": r.alert_type,
            "timestamp": r.timestamp.isoformat() + "Z",
        }
        for r in rows
    ]


# ── All alerts ────────────────────────────────────────────────────────────────

@router.get("/alerts")
def get_alerts(_admin=Depends(require_admin), db=Depends(get_db)):
    rows = (
        db.query(IntrusionAlert)
        .order_by(desc(IntrusionAlert.timestamp))
        .limit(100)
        .all()
    )
    return [
        {
            "id": str(r.id),
            "username": r.username,
            "device_id": r.device_id,
            "ip_address": r.ip_address,
            "alert_type": r.alert_type,
            "risk_score": r.risk_score,
            "description": r.description,
            "timestamp": r.timestamp.isoformat() + "Z",
            "resolved": r.resolved,
        }
        for r in rows
    ]


# ── Login history for one user ────────────────────────────────────────────────

@router.get("/attempts/{username}")
def get_attempts(username: str, _admin=Depends(require_admin), db=Depends(get_db)):
    rows = (
        db.query(LoginAttempt)
        .filter(LoginAttempt.username == username)
        .order_by(desc(LoginAttempt.timestamp))
        .limit(50)
        .all()
    )
    return [
        {
            "id": str(r.id),
            "device_name": r.device_name or "Unknown",
            "ip_address": r.ip_address or "—",
            "risk_score": r.risk_score,
            "risk_level": r.risk_level,
            "success": r.success,
            "step_failed": r.step_failed,
            "timestamp": r.timestamp.isoformat() + "Z",
        }
        for r in rows
    ]


# ── Trust device ──────────────────────────────────────────────────────────────

@router.post("/trust-device")
def trust_device_endpoint(payload: TrustDeviceRequest, db=Depends(get_db)):
    trust_device(db, payload.username, payload.device_id,
                 payload.device_name, payload.user_agent)
    return {"success": True, "message": "Device trusted"}


# ── User reports suspicious login ─────────────────────────────────────────────

@router.post("/report-suspicious")
def report_suspicious(payload: ReportSuspiciousRequest, db=Depends(get_db)):
    mark_suspicious(db, payload.username)
    return {"success": True, "message": "Account locked. Contact admin to restore."}


# ── Admin: unlock account ─────────────────────────────────────────────────────

@router.post("/admin/unlock/{username}")
def admin_unlock(username: str, _admin=Depends(require_admin), db=Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_locked = False
    user.failed_attempts = 0
    user.blocked_until = None
    db.commit()

    # Resolve alerts
    db.query(IntrusionAlert).filter(
        IntrusionAlert.username == username,
        IntrusionAlert.resolved == False,
    ).update({"resolved": True})
    db.commit()

    return {"success": True, "message": f"{username} unlocked"}


# ── Admin: unblock device (clear temporary block) ────────────────────────────

@router.post("/admin/unblock/{username}")
def admin_unblock(username: str, _admin=Depends(require_admin), db=Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.blocked_until = None
    user.failed_attempts = 0
    db.commit()

    # Resolve unresolved temporary block alerts for this user.
    db.query(IntrusionAlert).filter(
        IntrusionAlert.username == username,
        IntrusionAlert.alert_type == "device_blocked",
        IntrusionAlert.resolved == False,
    ).update({"resolved": True})
    db.commit()

    return {"success": True, "message": f"{username} device unblocked"}


# ── Admin: permanently lock account ──────────────────────────────────────────

@router.post("/admin/lock/{username}")
def admin_lock(username: str, _admin=Depends(require_admin), db=Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_locked = True
    user.blocked_until = None
    db.commit()

    _create_alert(
        db,
        username,
        None,
        None,
        "account_locked",
        100,
        "Manually locked by admin",
    )
    return {"success": True, "message": f"{username} permanently locked"}


# ── Admin: manually block a device ───────────────────────────────────────────

@router.post("/admin/block-device")
def admin_block_device(payload: BlockDeviceRequest, _admin=Depends(require_admin), db=Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.blocked_until = datetime.utcnow() + timedelta(hours=24)
    db.commit()
    _create_alert(db, payload.username, payload.device_id, None,
                  "admin_block", 100, "Manually blocked by admin")
    return {"success": True, "message": "Device blocked for 24 hours"}


# ── Admin: list locked accounts ───────────────────────────────────────────────

@router.get("/admin/locked-accounts")
def locked_accounts(_admin=Depends(require_admin), db=Depends(get_db)):
    users = db.query(User).filter(User.is_locked == True).all()
    return [
        {"username": u.username, "email": u.email, "full_name": u.full_name}
        for u in users
    ]


@router.get("/admin/restricted-accounts")
def restricted_accounts(_admin=Depends(require_admin), db=Depends(get_db)):
    now = datetime.utcnow()
    users = (
        db.query(User)
        .filter(
            or_(
                User.is_locked == True,
                User.blocked_until > now,
            )
        )
        .order_by(User.is_locked.desc(), User.blocked_until.desc())
        .all()
    )
    return [
        {
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
            "is_locked": bool(u.is_locked),
            "is_temporarily_blocked": bool(u.blocked_until and u.blocked_until > now),
            "blocked_until": u.blocked_until.isoformat() + "Z" if u.blocked_until else None,
        }
        for u in users
    ]


# ── Stats summary for admin dashboard ─────────────────────────────────────────

@router.get("/admin/stats")
def admin_stats(_admin=Depends(require_admin), db=Depends(get_db)):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0)
    total_alerts = db.query(IntrusionAlert).filter(IntrusionAlert.timestamp >= today).count()
    blocked = db.query(User).filter(
        User.blocked_until != None,
        User.blocked_until > datetime.utcnow(),
    ).count()
    locked = db.query(User).filter(User.is_locked == True).count()
    high_risk = db.query(LoginAttempt).filter(
        LoginAttempt.timestamp >= today,
        LoginAttempt.risk_score > 60,
    ).count()
    total_attempts = db.query(LoginAttempt).filter(LoginAttempt.timestamp >= today).count()
    success_today = db.query(LoginAttempt).filter(
        LoginAttempt.timestamp >= today,
        LoginAttempt.success == True,
    ).count()

    return {
        "total_alerts_today": total_alerts,
        "blocked_devices": blocked,
        "locked_accounts": locked,
        "high_risk_attempts": high_risk,
        "total_attempts_today": total_attempts,
        "successful_logins_today": success_today,
    }


# ════════════════════════════════════════════════════════════════════
#  DEMO ENDPOINTS  (for presentation / viva demo only)
# ════════════════════════════════════════════════════════════════════

@router.post("/demo/simulate-brute-force")
def demo_brute_force(payload: SimulateBruteRequest, _admin=Depends(require_admin), db=Depends(get_db)):
    """Simulate 5 failed login attempts to trigger a block."""
    username = payload.username
    for i in range(5):
        db.add(LoginAttempt(
            username=username,
            device_id="demo-device-brute",
            device_name="Demo Browser",
            user_agent="Demo/BruteForce",
            ip_address="192.168.1.99",
            success=False,
            step_failed="otp",
            risk_score=40 + i * 10,
            risk_level="high" if i >= 3 else "medium",
            alert_type="brute_force",
        ))

    # Set failed_attempts on user if exists
    user = db.query(User).filter(User.username == username).first()
    if user:
        user.failed_attempts = 5
        user.blocked_until = datetime.utcnow() + timedelta(minutes=30)
    db.commit()

    db.add(IntrusionAlert(
        username=username,
        device_id="demo-device-brute",
        ip_address="192.168.1.99",
        alert_type="device_blocked",
        risk_score=80,
        description="Demo: 5 failed attempts — device blocked 30 minutes",
    ))
    db.commit()
    return {"success": True, "message": f"Brute force simulated for {username}"}


@router.post("/demo/simulate-unknown-device")
def demo_unknown_device(payload: SimulateBruteRequest, _admin=Depends(require_admin), db=Depends(get_db)):
    """Simulate a login from an unknown device (medium risk)."""
    username = payload.username
    db.add(LoginAttempt(
        username=username,
        device_id="unknown-demo-device-xyz",
        device_name="Firefox on Linux",
        user_agent="Mozilla/5.0 (X11; Linux) Gecko Firefox/115",
        ip_address="10.0.0.55",
        success=False,
        step_failed=None,
        risk_score=45,
        risk_level="medium",
        alert_type="new_device",
    ))
    db.add(IntrusionAlert(
        username=username,
        device_id="unknown-demo-device-xyz",
        ip_address="10.0.0.55",
        alert_type="new_device",
        risk_score=45,
        description="Demo: Login attempt from unknown device",
    ))
    db.commit()
    return {"success": True, "message": "Unknown device attempt simulated"}


@router.post("/demo/simulate-critical")
def demo_critical(payload: SimulateBruteRequest, _admin=Depends(require_admin), db=Depends(get_db)):
    """Simulate a critical attack — locks the account."""
    username = payload.username
    db.add(LoginAttempt(
        username=username,
        device_id="attacker-device-critical",
        device_name="Unknown Device",
        user_agent="curl/7.88 (attack simulation)",
        ip_address="185.220.101.1",
        success=False,
        step_failed="otp",
        risk_score=95,
        risk_level="critical",
        alert_type="account_locked",
    ))
    db.add(IntrusionAlert(
        username=username,
        device_id="attacker-device-critical",
        ip_address="185.220.101.1",
        alert_type="account_locked",
        risk_score=95,
        description="Demo: Critical risk score — account locked",
    ))
    user = db.query(User).filter(User.username == username).first()
    if user:
        user.is_locked = True
    db.commit()
    return {"success": True, "message": f"Critical attack simulated. {username} is now locked."}


@router.post("/demo/reset")
def demo_reset(_admin=Depends(require_admin), db=Depends(get_db)):
    """Clear all demo data and unlock demo accounts."""
    # Remove demo login attempts
    db.query(LoginAttempt).filter(
        LoginAttempt.device_id.in_([
            "demo-device-brute",
            "unknown-demo-device-xyz",
            "attacker-device-critical",
        ])
    ).delete(synchronize_session=False)

    # Remove demo alerts
    db.query(IntrusionAlert).filter(
        IntrusionAlert.device_id.in_([
            "demo-device-brute",
            "unknown-demo-device-xyz",
            "attacker-device-critical",
        ])
    ).delete(synchronize_session=False)

    # Unlock demo_user
    user = db.query(User).filter(User.username == "demo_user").first()
    if user:
        user.is_locked = False
        user.failed_attempts = 0
        user.blocked_until = None

    db.commit()
    return {"success": True, "message": "Demo data reset complete"}
