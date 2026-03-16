from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Annotated
from sqlalchemy.ext.asyncio import AsyncSession
import json
import logging
import time

from app.features.auth.router import get_current_user
from app.features.auth.models import User
from app.features.personas.repository import PersonaRepository
from app.features.sessions.repository import SessionRepository
from app.features.onboarding.prompts import get_onboarding_persona_config, get_onboarding_system_prompt_suffix
from app.db.database import get_db
from .service import LivekitService

logger = logging.getLogger("livekit-router")
router = APIRouter(prefix="/api/v1/livekit", tags=["livekit"])


def get_livekit_service(db: AsyncSession = Depends(get_db)) -> LivekitService:
    return LivekitService(
        persona_repo=PersonaRepository(db),
        session_repo=SessionRepository(db),
    )


@router.get("/token")
async def get_livekit_token(
    current_user: Annotated[User, Depends(get_current_user)],
    service: LivekitService = Depends(get_livekit_service),
    room: str = Query(..., description="The ID of the room to join"),
    persona_id: str = Query("investor_1", description="Persona ID config"),
    context: str = Query("", description="Context/transcript from the prep room"),
    session_id: str = Query("", description="Pre-created session ID for agent to update"),
):
    try:
        metadata = await service.build_room_metadata(current_user.id, persona_id, context)
        if session_id:
            metadata["session_id"] = session_id
        metadata_json = json.dumps(metadata)
        logger.info(f"Room metadata payload: {len(metadata_json)} bytes")

        await service.create_room(room, metadata_json)
        jwt_token = service.generate_token(str(current_user.id), current_user.full_name, room)

        return {"token": jwt_token, "room": room}
    except Exception as e:
        logger.error(f"Token generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/onboarding-token")
async def get_onboarding_token(
    current_user: Annotated[User, Depends(get_current_user)],
    service: LivekitService = Depends(get_livekit_service),
):
    """Generate a lightweight LiveKit token for the onboarding agent (no session/scoring)."""
    try:
        current_step = current_user.onboarding_step or "welcome"
        room_name = f"onboarding-{current_user.id}-{int(time.time())}"

        persona_config = get_onboarding_persona_config(current_user.full_name, current_step)

        metadata = {
            "mode": "onboarding",
            "user_id": str(current_user.id),
            "persona_id": "onboarding",
            "persona_config": persona_config,
            "context": get_onboarding_system_prompt_suffix(current_step),
        }
        metadata_json = json.dumps(metadata)
        logger.info(f"Onboarding room metadata: {len(metadata_json)} bytes")

        await service.create_room(room_name, metadata_json)
        jwt_token = service.generate_token(str(current_user.id), current_user.full_name, room_name)

        return {"token": jwt_token, "room": room_name}
    except Exception as e:
        logger.error(f"Onboarding token generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
