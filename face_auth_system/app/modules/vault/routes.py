from datetime import datetime
from uuid import UUID

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator

from app.database.db import get_db
from app.database.models import User, VaultNote

router = APIRouter(prefix="/vault", tags=["Vault"])


class VerifyUserPasswordRequest(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str):
        v = v.strip()
        if not v:
            raise ValueError("username is required")
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v: str):
        if not v:
            raise ValueError("password is required")
        return v


class VerifyNotePasswordRequest(BaseModel):
    actor_username: str
    password: str

    @field_validator("actor_username")
    @classmethod
    def actor_valid(cls, v: str):
        v = v.strip()
        if not v:
            raise ValueError("actor_username is required")
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v: str):
        if not v:
            raise ValueError("password is required")
        return v


class NoteCreateRequest(BaseModel):
    username: str
    password: str
    title: str
    content: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str):
        v = v.strip()
        if not v:
            raise ValueError("username is required")
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v: str):
        if not v:
            raise ValueError("password is required")
        return v

    @field_validator("title")
    @classmethod
    def title_valid(cls, v: str):
        v = v.strip()
        if not v:
            raise ValueError("title is required")
        return v

    @field_validator("content")
    @classmethod
    def content_valid(cls, v: str):
        v = v.strip()
        if not v:
            raise ValueError("content is required")
        return v


class NoteUpdateRequest(BaseModel):
    actor_username: str
    password: str
    title: str
    content: str

    @field_validator("actor_username")
    @classmethod
    def actor_valid(cls, v: str):
        v = v.strip()
        if not v:
            raise ValueError("actor_username is required")
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v: str):
        if not v:
            raise ValueError("password is required")
        return v

    @field_validator("title")
    @classmethod
    def title_valid(cls, v: str):
        v = v.strip()
        if not v:
            raise ValueError("title is required")
        return v

    @field_validator("content")
    @classmethod
    def content_valid(cls, v: str):
        v = v.strip()
        if not v:
            raise ValueError("content is required")
        return v


def _get_user(db, username: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    return user


def _check_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def _serialize_note(note: VaultNote) -> dict:
    return {
        "id": str(note.id),
        "username": note.username,
        "title": note.title,
        "content": note.content,
        "created_at": note.created_at.isoformat() + "Z" if isinstance(note.created_at, datetime) else None,
        "updated_at": note.updated_at.isoformat() + "Z" if isinstance(note.updated_at, datetime) else None,
    }


@router.post("/verify-user-password")
def verify_user_password(payload: VerifyUserPasswordRequest, db=Depends(get_db)):
    user = _get_user(db, payload.username.strip())
    if not _check_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=403, detail="password mismatch")
    return {"success": True}


@router.post("/notes/{note_id}/verify-password")
def verify_note_password(note_id: UUID, payload: VerifyNotePasswordRequest, db=Depends(get_db)):
    note = db.query(VaultNote).filter(VaultNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="note not found")

    actor_username = payload.actor_username.strip()
    actor = _get_user(db, actor_username)
    if note.username != actor_username:
        raise HTTPException(status_code=403, detail="not authorized for this note")
    if not _check_password(payload.password, actor.hashed_password):
        raise HTTPException(status_code=403, detail="password mismatch")

    return {"success": True}


@router.post("/notes")
def create_note(payload: NoteCreateRequest, db=Depends(get_db)):
    username = payload.username.strip()
    user = _get_user(db, username)

    if not _check_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=403, detail="password mismatch")

    note = VaultNote(
        username=username,
        title=payload.title.strip(),
        content=payload.content.strip(),
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    return {"success": True, "note": _serialize_note(note)}


@router.get("/notes")
def list_notes(viewer_username: str = Query(..., min_length=1), db=Depends(get_db)):
    viewer = viewer_username.strip()
    _get_user(db, viewer)

    notes = db.query(VaultNote).order_by(VaultNote.updated_at.desc()).all()
    return {"success": True, "notes": [_serialize_note(n) for n in notes]}


@router.get("/notes/{note_id}")
def get_note(note_id: UUID, viewer_username: str = Query(..., min_length=1), db=Depends(get_db)):
    viewer = viewer_username.strip()
    _get_user(db, viewer)

    note = db.query(VaultNote).filter(VaultNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="note not found")

    return {"success": True, "note": _serialize_note(note)}


@router.put("/notes/{note_id}")
def update_note(note_id: UUID, payload: NoteUpdateRequest, db=Depends(get_db)):
    actor_username = payload.actor_username.strip()
    actor = _get_user(db, actor_username)

    note = db.query(VaultNote).filter(VaultNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="note not found")

    if note.username != actor_username:
        raise HTTPException(status_code=403, detail="not authorized for this note")
    if not _check_password(payload.password, actor.hashed_password):
        raise HTTPException(status_code=403, detail="password mismatch")

    note.title = payload.title.strip()
    note.content = payload.content.strip()
    db.commit()
    db.refresh(note)

    return {"success": True, "note": _serialize_note(note)}


@router.delete("/notes/{note_id}")
def delete_note(
    note_id: UUID,
    actor_username: str = Query(..., min_length=1),
    password: str = Query(..., min_length=1),
    db=Depends(get_db),
):
    actor_name = actor_username.strip()
    actor = _get_user(db, actor_name)

    note = db.query(VaultNote).filter(VaultNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="note not found")

    if note.username != actor_name:
        raise HTTPException(status_code=403, detail="not authorized for this note")
    if not _check_password(password, actor.hashed_password):
        raise HTTPException(status_code=403, detail="password mismatch")

    db.delete(note)
    db.commit()
    return {"success": True, "message": "note deleted"}
