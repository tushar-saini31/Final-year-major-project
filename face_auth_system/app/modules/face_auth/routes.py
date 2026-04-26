
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .service import register_face, login_face
from app.core.jwt import create_access_token, verify_token
from app.database.db import get_db
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
    username: str = Form(...),
    file: UploadFile = File(...),
    db=Depends(get_db),
):
    result = login_face(username, file, db=db)
    if result.get("success"):
        token = create_access_token(username)
        return {
            "success": True,
            "similarity": result["similarity"],
            "access_token": token,
            "token_type": "bearer"
        }
    return result

@router.get("/protected")
async def protected_route(credentials: HTTPAuthorizationCredentials = Depends(security)):
    username = verify_token(credentials.credentials)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"message": f"Welcome {username}!", "username": username}
