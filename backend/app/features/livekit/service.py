import logging
import time
from typing import Any
from uuid import UUID

from livekit import api
from livekit.protocol.room import CreateRoomRequest

from app.core.config import settings
from app.features.personas.repository import PersonaRepository
from app.features.sessions.repository import SessionRepository
from app.features.onboarding.prompts import (
    get_onboarding_persona_config,
    get_onboarding_system_prompt_suffix,
)

logger = logging.getLogger("livekit-service")


class LivekitService:
    def __init__(
        self, persona_repo: PersonaRepository, session_repo: SessionRepository
    ):
        self.persona_repo = persona_repo
        self.session_repo = session_repo

    async def build_room_metadata(
        self, user_id: UUID, persona_id: str, context: str
    ) -> dict:
        """Build the metadata dict that gets attached to the LiveKit room."""
        metadata: dict[str, Any] = {
            "persona_id": persona_id,
            "context": context,
            "user_id": str(user_id),
        }

        try:
            persona_uuid = UUID(persona_id)
            # Try user-owned first, then fall back to public community agent
            persona = await self.persona_repo.get_by_id_and_user(persona_uuid, user_id)
            if not persona:
                persona = await self.persona_repo.get_public_by_id(persona_uuid)
            if persona:
                metadata["persona_config"] = {
                    "type": str(persona.type),
                    "name": persona.name,
                    "role": persona.role,
                    "personality": persona.personality,
                    "focus_areas": persona.focus_areas,
                    "voice": persona.voice,
                    "scoring_criteria": persona.scoring_criteria,
                    "behavior_rules": persona.behavior_rules,
                    "opening_message": persona.opening_message,
                }
                if persona.cached_briefing:
                    metadata["briefing_context"] = persona.cached_briefing
                    logger.info(
                        f"Injected cached briefing ({len(persona.cached_briefing)} chars) for: {persona.name}"
                    )
                if persona.grounding_enabled:
                    metadata["grounding_enabled"] = True
                    logger.info(f"Google Search grounding enabled for: {persona.name}")

                past_sessions = await self.session_repo.list_completed_for_persona(
                    persona_uuid, user_id, limit=3
                )
                if past_sessions:
                    metadata["session_history"] = [
                        {
                            "summary": s.ai_summary,
                            "date": s.ended_at.strftime("%B %d, %Y")
                            if s.ended_at
                            else "Unknown",
                            "score": s.scorecard.get("overall_score")
                            if s.scorecard
                            else None,
                        }
                        for s in reversed(past_sessions)
                    ]
                    logger.info(
                        f"Injected {len(past_sessions)} session(s) history for adaptive prompting"
                    )

                logger.info(f"Embedded dynamic persona config for: {persona.name}")
        except (ValueError, AttributeError) as e:
            logger.warning(
                f"Could not load dynamic persona config for '{persona_id}': {e}"
            )

        return metadata

    def build_onboarding_metadata(
        self,
        user_id: str,
        user_name: str,
        current_step: str,
        previous_summary: str | None,
    ) -> tuple[str, dict]:
        """Build room name + metadata for an onboarding session."""
        room_name = f"onboarding-{user_id}-{int(time.time())}"
        persona_config = get_onboarding_persona_config(
            user_name, current_step, previous_summary
        )
        metadata = {
            "mode": "onboarding",
            "user_id": user_id,
            "persona_id": "onboarding",
            "persona_config": persona_config,
            "context": get_onboarding_system_prompt_suffix(
                current_step, previous_summary
            ),
        }
        return room_name, metadata

    def generate_token(self, user_id: str, user_name: str, room: str) -> str:
        """Generate a LiveKit access token."""
        token = api.AccessToken(settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET)
        token.with_identity(user_id)
        token.with_name(user_name)
        token.with_grants(
            api.VideoGrants(
                room_join=True,
                room=room,
                can_publish=True,
                can_subscribe=True,
            )
        )
        return token.to_jwt()

    async def create_room(self, room_name: str, metadata_json: str) -> None:
        """Create a LiveKit room via Room Service API."""
        async with api.LiveKitAPI(
            url=settings.LIVEKIT_URL,
            api_key=settings.LIVEKIT_API_KEY,
            api_secret=settings.LIVEKIT_API_SECRET,
        ) as lk_api:
            await lk_api.room.create_room(
                CreateRoomRequest(
                    name=room_name,
                    metadata=metadata_json,
                    empty_timeout=300,
                )
            )
            logger.info(f"Room '{room_name}' created with metadata")
