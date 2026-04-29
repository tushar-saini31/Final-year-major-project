
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .service import register_face, login_face
from app.core.jwt import create_access_token, verify_token
from app.database.db import get_db
from app.database.models import User
from app.modules.intrusion.service import ids_check, record_attempt
import uuid, os

router = APIRouter(prefix="/face", tags=["Face Auth"])
security = HTTPBearer()

@router.post("/register")
async def register(
    username: str = Form(...),
    file: UploadFile = File(...),
    db=Depends(get_db),
):
    return register_face(username, file, db=db)

@router.post("/login")
async def login(
    request: Request,
    username: str = Form(...),
    file: UploadFile = File(...),
    device_id: str = Form("unknown"),
    device_name: str = Form("Unknown Device"),
    db=Depends(get_db),
):
    ip = request.headers.get("x-client-ip") or (request.client.host if request.client else "127.0.0.1")
    ua = request.headers.get("user-agent", "")

    ids_result = ids_check(db, username, device_id, ua, ip)
    if not ids_result.get("allowed"):
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

    result = login_face(username, file, db=db)
    if result.get("success"):
        user = db.query(User).filter(User.username == username).first()
        role = user.role if user and user.role else "user"
        record_attempt(db, username, device_id, device_name, ua, ip, True, ids_result["risk_score"], ids_result["risk_level"], step_failed=None, alert_type=ids_result.get("alert_type"))
        token = create_access_token(username, role)
        return {
            "success": True,
            "similarity": result["similarity"],
            "role": role,
            "access_token": token,
            "token_type": "bearer"
        }
    record_attempt(db, username, device_id, device_name, ua, ip, False, ids_result["risk_score"], ids_result["risk_level"], step_failed="face", alert_type=ids_result.get("alert_type"))
    user_row = db.query(User).filter(User.username == username).first()
    remaining = max(0, 5 - ((user_row.failed_attempts or 0) if user_row else 0))
    return {
        "success": False,
        "ids_blocked": False,
        "attempts_remaining": remaining,
        "show_warning": remaining <= 2,
        "message": result.get("error") or f"Access denied. Similarity: {(result.get('similarity', 0) * 100):.1f}%",
        "similarity": result.get("similarity"),
    }

@router.get("/protected")
async def protected_route(credentials: HTTPAuthorizationCredentials = Depends(security)):
    username = verify_token(credentials.credentials)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"message": f"Welcome {username}!", "username": username}
