"""
Intrusion Detection Service
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Risk score calculation, block/lock logic, and alert creation.
All decision-making lives here so routes stay thin.
"""

from datetime import datetime, timedelta
from typing import Optional

from app.database.models import User
from app.modules.intrusion.models import LoginAttempt, TrustedDevice, IntrusionAlert

# â”€â”€ Risk score weights â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
SCORE_UNKNOWN_DEVICE      = 40
SCORE_UA_CHANGED          = 20
SCORE_IP_CHANGED          = 10
SCORE_FAILED_3            = 20
SCORE_FAILED_4            = 30
SCORE_FAILED_5_PLUS       = 40
SCORE_MULTI_IP            = 30
SCORE_PREVIOUSLY_BLOCKED  = 15

# â”€â”€ Thresholds â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
LEVEL_LOW      = 30
LEVEL_MEDIUM   = 60
LEVEL_HIGH     = 80
# above HIGH â†’ CRITICAL

BLOCK_MINUTES  = 30    # temporary block duration
MAX_ATTEMPTS   = 5     # failed attempts before block
MAX_TEMP_BLOCKS_BEFORE_PERMANENT = 3


def _risk_level(score: int) -> str:
    if score <= LEVEL_LOW:
        return "low"
    if score <= LEVEL_MEDIUM:
        return "medium"
    if score <= LEVEL_HIGH:
        return "high"
    return "critical"


# â”€â”€ Core gate â€” call this at the START of every auth route â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def ids_check(db, username: str, device_id: str, user_agent: str, ip_address: str) -> dict:
    """
    Returns a dict:
      {
        "allowed"         : bool,
        "risk_score"      : int,
        "risk_level"      : str,
        "block_type"      : None | "temporary" | "permanent",
        "block_until"     : None | datetime (UTC),
        "time_remaining"  : None | int (seconds),
        "attempts_remaining": None | int,
        "show_warning"    : bool,
        "alert_type"      : None | str,
        "message"         : str,
      }
    """
    now = datetime.utcnow()

    # â”€â”€ 1. Is account locked? â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    user = db.query(User).filter(User.username == username).first()
    if user and user.is_locked:
        return {
            "allowed": False,
            "risk_score": 100,
            "risk_level": "critical",
            "block_type": "permanent",
            "block_until": None,
            "time_remaining": None,
            "attempts_remaining": 0,
            "show_warning": False,
            "alert_type": "account_locked",
            "message": "Your account has been locked due to suspicious activity. Contact admin.",
        }

    # â”€â”€ 2. Is this device temporarily blocked? â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if user and user.blocked_until and user.blocked_until > now:
        remaining = int((user.blocked_until - now).total_seconds())
        return {
            "allowed": False,
            "risk_score": 80,
            "risk_level": "high",
            "block_type": "temporary",
            "block_until": user.blocked_until,
            "time_remaining": remaining,
            "attempts_remaining": 0,
            "show_warning": False,
            "alert_type": "device_blocked",
            "message": f"Too many failed attempts. Try again in {remaining // 60}m {remaining % 60}s.",
        }

    # If a temporary block has expired, clear stale counters so retries start cleanly.
    if user and user.blocked_until and user.blocked_until <= now:
        user.blocked_until = None
        user.failed_attempts = 0
        db.commit()

    # â”€â”€ 3. Calculate risk score â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    score = 0
    signals = []

    # 3a. Unknown device?
    trusted = db.query(TrustedDevice).filter(
        TrustedDevice.username == username,
        TrustedDevice.device_id == device_id,
        TrustedDevice.is_active == True,
    ).first()

    if not trusted:
        score += SCORE_UNKNOWN_DEVICE
        signals.append("unknown_device")

    # 3b. User-agent changed from last successful login?
    last_success = (
        db.query(LoginAttempt)
        .filter(LoginAttempt.username == username, LoginAttempt.success == True)
        .order_by(LoginAttempt.timestamp.desc())
        .first()
    )
    if last_success and last_success.user_agent and last_success.user_agent != user_agent:
        score += SCORE_UA_CHANGED
        signals.append("ua_changed")

    # 3c. IP changed from last successful login?
    if last_success and last_success.ip_address and last_success.ip_address != ip_address:
        score += SCORE_IP_CHANGED
        signals.append("ip_changed")

    # 3d. Recent failed attempts (last 30 min)
    window = now - timedelta(minutes=30)
    recent_fails = (
        db.query(LoginAttempt)
        .filter(
            LoginAttempt.username == username,
            LoginAttempt.success == False,
            LoginAttempt.timestamp >= window,
        )
        .count()
    )

    failed_count = (user.failed_attempts if user else 0)

    if failed_count >= 5:
        score += SCORE_FAILED_5_PLUS
        signals.append("brute_force")
    elif failed_count == 4:
        score += SCORE_FAILED_4
        signals.append("many_failures")
    elif failed_count == 3:
        score += SCORE_FAILED_3
        signals.append("some_failures")

    # 3e. Multiple IPs in the last hour?
    hour_ago = now - timedelta(hours=1)
    distinct_ips = (
        db.query(LoginAttempt.ip_address)
        .filter(
            LoginAttempt.username == username,
            LoginAttempt.timestamp >= hour_ago,
        )
        .distinct()
        .count()
    )
    if distinct_ips >= 3:
        score += SCORE_MULTI_IP
        signals.append("multi_ip")

    # 3f. This device has been blocked before?
    prev_block = (
        db.query(IntrusionAlert)
        .filter(
            IntrusionAlert.username == username,
            IntrusionAlert.device_id == device_id,
            IntrusionAlert.alert_type == "device_blocked",
            IntrusionAlert.resolved == False,
        )
        .first()
    )
    if prev_block:
        score += SCORE_PREVIOUSLY_BLOCKED
        signals.append("prev_blocked")

    level = _risk_level(score)

    # â”€â”€ 4. Attempts remaining warning â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    attempts_remaining = None
    show_warning = False
    if failed_count >= 3:
        attempts_remaining = max(0, MAX_ATTEMPTS - failed_count)
        show_warning = True

    # â”€â”€ 5. Act on risk level â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    # CRITICAL â†’ lock account
    if score > LEVEL_HIGH:
        if user:
            user.is_locked = True
            db.commit()
        _create_alert(db, username, device_id, ip_address, "account_locked", score,
                      f"Critical risk score {score}. Signals: {signals}")
        return {
            "allowed": False,
            "risk_score": score,
            "risk_level": "critical",
            "block_type": "permanent",
            "block_until": None,
            "time_remaining": None,
            "attempts_remaining": 0,
            "show_warning": False,
            "alert_type": "account_locked",
            "message": "Suspicious activity detected. Account locked. Contact admin.",
        }

    # HIGH â†’ block device 30 min
    if score > LEVEL_MEDIUM:
        prior_temp_blocks = (
            db.query(IntrusionAlert)
            .filter(
                IntrusionAlert.username == username,
                IntrusionAlert.alert_type == "device_blocked",
            )
            .count()
        )
        if prior_temp_blocks >= (MAX_TEMP_BLOCKS_BEFORE_PERMANENT - 1):
            if user:
                user.is_locked = True
                user.blocked_until = None
                user.failed_attempts = 0
                db.commit()
            _create_alert(
                db,
                username,
                device_id,
                ip_address,
                "account_locked",
                100,
                f"Escalated to permanent lock after {prior_temp_blocks + 1} temporary blocks.",
            )
            return {
                "allowed": False,
                "risk_score": 100,
                "risk_level": "critical",
                "block_type": "permanent",
                "block_until": None,
                "time_remaining": None,
                "attempts_remaining": 0,
                "show_warning": False,
                "alert_type": "account_locked",
                "message": "Repeated suspicious activity detected. Account permanently locked. Contact admin.",
            }

        if user:
            user.blocked_until = now + timedelta(minutes=BLOCK_MINUTES)
            db.commit()
        _create_alert(db, username, device_id, ip_address, "device_blocked", score,
                      f"High risk score {score}. Signals: {signals}")
        return {
            "allowed": False,
            "risk_score": score,
            "risk_level": "high",
            "block_type": "temporary",
            "block_until": user.blocked_until if user else None,
            "time_remaining": BLOCK_MINUTES * 60,
            "attempts_remaining": 0,
            "show_warning": False,
            "alert_type": "device_blocked",
            "message": f"Suspicious activity detected. Device blocked for {BLOCK_MINUTES} minutes.",
        }

    # MEDIUM â†’ allow but flag
    alert_type = None
    if level == "medium":
        alert_type = "new_device" if "unknown_device" in signals else "suspicious_activity"
        _create_alert(db, username, device_id, ip_address, alert_type, score,
                      f"Medium risk. Signals: {signals}")

    return {
        "allowed": True,
        "risk_score": score,
        "risk_level": level,
        "block_type": None,
        "block_until": None,
        "time_remaining": None,
        "attempts_remaining": attempts_remaining,
        "show_warning": show_warning,
        "alert_type": alert_type,
        "message": "OK",
    }


# â”€â”€ Called on every login attempt result â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def record_attempt(
    db,
    username: str,
    device_id: str,
    device_name: str,
    user_agent: str,
    ip_address: str,
    success: bool,
    risk_score: int,
    risk_level: str,
    step_failed: Optional[str] = None,
    alert_type: Optional[str] = None,
):
    attempt = LoginAttempt(
        username=username,
        device_id=device_id,
        device_name=device_name,
        user_agent=user_agent,
        ip_address=ip_address,
        success=success,
        step_failed=step_failed,
        risk_score=risk_score,
        risk_level=risk_level,
        alert_type=alert_type,
    )
    db.add(attempt)

    user = db.query(User).filter(User.username == username).first()
    if user:
        if success:
            user.failed_attempts = 0
            user.blocked_until = None
        else:
            # Do not count IDS gate rejections; this avoids re-block loops.
            if step_failed != "ids_gate":
                user.failed_attempts = (user.failed_attempts or 0) + 1

    db.commit()


def trust_device(db, username: str, device_id: str, device_name: str, user_agent: str):
    """Mark a device as trusted after user confirms 'Yes, this was me'."""
    existing = db.query(TrustedDevice).filter(
        TrustedDevice.username == username,
        TrustedDevice.device_id == device_id,
    ).first()

    if existing:
        existing.last_seen = datetime.utcnow()
        existing.is_active = True
    else:
        db.add(TrustedDevice(
            username=username,
            device_id=device_id,
            device_name=device_name,
            user_agent=user_agent,
        ))
    db.commit()


def mark_suspicious(db, username: str):
    """User said 'No, this wasn't me' â€” lock account immediately."""
    user = db.query(User).filter(User.username == username).first()
    if user:
        user.is_locked = True
        db.commit()
    _create_alert(db, username, None, None, "user_reported_suspicious", 100,
                  "User reported the login as not theirs. Account locked.")


# â”€â”€ Internal helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _create_alert(db, username, device_id, ip_address, alert_type, score, description):
    alert = IntrusionAlert(
        username=username,
        device_id=device_id,
        ip_address=ip_address,
        alert_type=alert_type,
        risk_score=score,
        description=description,
    )
    db.add(alert)
    db.commit()
