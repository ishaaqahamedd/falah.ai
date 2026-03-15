from fastapi import APIRouter, Depends
from typing import Annotated, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.features.auth.router import get_current_user
from app.features.auth.models import User
from .schemas import SessionCreate, SessionUpdate, SessionResponse, SessionListItem
from .repository import SessionRepository
from .service import SessionService

import logging

logger = logging.getLogger("sessions-router")

router = APIRouter(prefix="/api/v1/sessions", tags=["sessions"])


def get_session_service(db: AsyncSession = Depends(get_db)) -> SessionService:
    return SessionService(repository=SessionRepository(db))


@router.post("/", response_model=SessionResponse, status_code=201)
async def create_session(
    body: SessionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    service: SessionService = Depends(get_session_service),
):
    """Create a new pitch session record when a room starts."""
    return await service.create_session(current_user.id, body)


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: UUID,
    body: SessionUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    service: SessionService = Depends(get_session_service),
):
    """Update a session with transcript, scores, etc."""
    return await service.update_session(session_id, current_user.id, body)


@router.post("/{session_id}/score", response_model=SessionResponse)
async def trigger_scoring(
    session_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: SessionService = Depends(get_session_service),
):
    """Trigger AI scoring + summary generation for a completed session."""
    session = await service.trigger_scoring(session_id, current_user.id)
    logger.info(f"Session {session_id} scored: {session.scorecard.get('overall_score', '?')}/10")
    return session


@router.get("/", response_model=list[SessionListItem])
async def list_sessions(
    current_user: Annotated[User, Depends(get_current_user)],
    service: SessionService = Depends(get_session_service),
    persona_id: Optional[UUID] = None,
    limit: int = 20,
):
    """List pitch sessions, optionally filtered by persona."""
    return await service.list_sessions(current_user.id, persona_id, limit)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: SessionService = Depends(get_session_service),
):
    """Get full session detail including scorecard and transcript."""
    return await service.get_session(session_id, current_user.id)
