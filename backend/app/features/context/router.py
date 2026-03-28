from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Request
from typing import Annotated, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.database import get_db
from app.features.auth.router import get_current_user
from app.features.auth.models import User
from app.features.personas.repository import PersonaRepository
from .repository import ContextRepository
from .service import ContextService
from .schemas import (
    BriefingResponse,
    ContextDocumentListItem,
    ContextDocumentResponse,
    ContextSearchResult,
)

router = APIRouter(prefix="/api/v1/context", tags=["context"])
limiter = Limiter(key_func=get_remote_address)


def get_context_service(db: AsyncSession = Depends(get_db)) -> ContextService:
    return ContextService(
        repository=ContextRepository(db),
        persona_repository=PersonaRepository(db),
    )


@router.post("/upload", status_code=201, response_model=ContextDocumentResponse)
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

    try:
        text, meta = service.validate_and_extract_text(
            content, file.content_type, metadata_json
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return await service.upload_document(
        user_id=current_user.id,
        text=text,
        filename=file.filename,
        persona_id=persona_id,
        content_type=content_type,
        metadata=meta,
    )


@router.get("/documents", response_model=list[ContextDocumentListItem])
async def list_documents(
    persona_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: ContextService = Depends(get_context_service),
):
    """List all uploaded context documents for a persona."""
    return await service.list_documents(persona_id, current_user.id)


@router.get("/briefing", response_model=BriefingResponse)
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


@router.get("/search", response_model=list[ContextSearchResult])
async def search_context(
    query: str,
    persona_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: ContextService = Depends(get_context_service),
    top_k: int = 3,
):
    """Semantic search against persona context using pgvector L2 distance."""
    return await service.search_context(query, persona_id, current_user.id, top_k)
