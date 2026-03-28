from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Request
from typing import Annotated, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address
import logging

from app.db.database import get_db
from app.features.auth.router import get_current_user
from app.features.auth.models import User
from app.features.personas.repository import PersonaRepository
from .repository import ContextRepository
from .service import ContextService

import json

logger = logging.getLogger("context-router")

router = APIRouter(prefix="/api/v1/context", tags=["context"])
limiter = Limiter(key_func=get_remote_address)

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {"text/plain", "application/pdf", "text/csv", "text/markdown"}


def get_context_service(db: AsyncSession = Depends(get_db)) -> ContextService:
    return ContextService(
        repository=ContextRepository(db),
        persona_repository=PersonaRepository(db),
    )


@router.post("/upload", status_code=201)
@limiter.limit("10/minute")
async def upload_document(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    service: ContextService = Depends(get_context_service),
    file: UploadFile = File(...),
    persona_id: Optional[UUID] = Form(None),
    content_type: str = Form("document"),
    metadata_json: str = Form("{}"),
):
    """Upload a document, extract text, generate embedding, and save to Vector DB."""
    content = await file.read()

    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024*1024)}MB")

    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File is not valid UTF-8 text")

    meta = {}
    try:
        meta = json.loads(metadata_json)
    except (json.JSONDecodeError, TypeError):
        logger.warning(f"Invalid metadata JSON from user {current_user.id}, ignoring")
        meta = {}

    doc = await service.upload_document(
        user_id=current_user.id,
        text=text,
        filename=file.filename,
        persona_id=persona_id,
        content_type=content_type,
        metadata=meta,
    )
    return {
        "id": str(doc.id),
        "user_id": str(doc.user_id),
        "persona_id": str(doc.persona_id) if doc.persona_id else None,
        "filename": doc.filename,
        "content_type": doc.content_type,
        "content": doc.content[:200] + "..." if len(doc.content) > 200 else doc.content,
        "created_at": doc.created_at.isoformat(),
    }


@router.get("/documents")
async def list_documents(
    persona_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: ContextService = Depends(get_context_service),
):
    """List all uploaded context documents for a persona."""
    docs = await service.list_documents(persona_id, current_user.id)
    return [
        {
            "id": str(d.id),
            "filename": d.filename,
            "content_type": d.content_type,
            "created_at": d.created_at.isoformat(),
        }
        for d in docs
    ]


@router.get("/briefing")
async def get_pre_call_briefing(
    persona_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: ContextService = Depends(get_context_service),
    force_refresh: bool = False,
    limit: int = 5,
):
    """Fetch the most recent documents for a persona and generate a summary briefing.
    Returns cached briefing if available, unless force_refresh=True."""
    return await service.get_briefing(persona_id, current_user.id, force_refresh, limit)


@router.get("/search")
async def search_context(
    query: str,
    persona_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: ContextService = Depends(get_context_service),
    top_k: int = 3,
):
    """Semantic search against persona context using pgvector L2 distance."""
    docs = await service.search_context(query, persona_id, current_user.id, top_k)
    return [{"id": d.id, "content": d.content, "filename": d.filename} for d in docs]
