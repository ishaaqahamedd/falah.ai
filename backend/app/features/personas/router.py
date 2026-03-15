from fastapi import APIRouter, Depends
from typing import Annotated
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.features.auth.router import get_current_user
from app.features.auth.models import User
from .schemas import PersonaCreate, PersonaUpdate, PersonaResponse
from .repository import PersonaRepository
from .service import PersonaService

router = APIRouter(prefix="/api/v1/personas", tags=["personas"])


def get_persona_service(db: AsyncSession = Depends(get_db)) -> PersonaService:
    return PersonaService(repository=PersonaRepository(db))


@router.get("/", response_model=list[PersonaResponse])
async def list_personas(
    current_user: Annotated[User, Depends(get_current_user)],
    service: PersonaService = Depends(get_persona_service),
):
    """List all personas owned by the current user."""
    return await service.list_personas(current_user.id)


@router.get("/templates")
async def list_templates():
    """Return starter persona templates for quick-start creation."""
    from .templates import PERSONA_TEMPLATES
    return PERSONA_TEMPLATES


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
