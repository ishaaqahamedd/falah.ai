from fastapi import APIRouter, Depends, Query
from typing import Annotated, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.features.auth.router import get_current_user
from app.features.auth.models import User
from .schemas import (
    PersonaCreate,
    PersonaUpdate,
    PersonaResponse,
    CommunityPersonaResponse,
)
from .repository import PersonaRepository
from .service import PersonaService

router = APIRouter(prefix="/api/v1/personas", tags=["personas"])


def get_persona_service(db: AsyncSession = Depends(get_db)) -> PersonaService:
    return PersonaService(repository=PersonaRepository(db))


@router.get("/", response_model=list[PersonaResponse])
async def list_personas(
    current_user: Annotated[User, Depends(get_current_user)],
    service: PersonaService = Depends(get_persona_service),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List all personas owned by the current user."""
    return await service.list_personas(current_user.id, offset, limit)


@router.get("/templates")
async def list_templates():
    """Return starter persona templates for quick-start creation."""
    from .templates import PERSONA_TEMPLATES

    return PERSONA_TEMPLATES


@router.get("/community", response_model=list[CommunityPersonaResponse])
async def list_community_personas(
    current_user: Annotated[User, Depends(get_current_user)],
    service: PersonaService = Depends(get_persona_service),
    search: Optional[str] = Query(None, description="Search by name, role, or type"),
    type: Optional[str] = Query(None, description="Filter by persona type"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List all public community personas."""
    return await service.list_community_personas(search, type, offset, limit)


@router.post("/", response_model=PersonaResponse, status_code=201)
async def create_persona(
    data: PersonaCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    service: PersonaService = Depends(get_persona_service),
):
    """Create a new custom persona."""
    return await service.create_persona(current_user.id, data)


@router.get("/{persona_id}", response_model=PersonaResponse)
async def get_persona(
    persona_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: PersonaService = Depends(get_persona_service),
):
    """Get a specific persona by ID."""
    return await service.get_persona(persona_id, current_user.id)


@router.put("/{persona_id}", response_model=PersonaResponse)
async def update_persona(
    persona_id: UUID,
    data: PersonaUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    service: PersonaService = Depends(get_persona_service),
):
    """Update an existing persona."""
    return await service.update_persona(persona_id, current_user.id, data)


@router.delete("/{persona_id}", status_code=204)
async def delete_persona(
    persona_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: PersonaService = Depends(get_persona_service),
):
    """Delete a persona."""
    await service.delete_persona(persona_id, current_user.id)
