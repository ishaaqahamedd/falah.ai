from fastapi import HTTPException, status
from uuid import UUID

from .models import Persona
from .schemas import PersonaCreate, PersonaUpdate, CommunityPersonaResponse
from .repository import PersonaRepository


class PersonaService:
    def __init__(self, repository: PersonaRepository):
        self.repository = repository

    async def list_personas(self, user_id: UUID) -> list[Persona]:
        return await self.repository.list_by_user(user_id)

    async def create_persona(self, user_id: UUID, data: PersonaCreate) -> Persona:
        scoring = None
        if data.scoring_criteria:
            scoring = [c.model_dump() for c in data.scoring_criteria]

        persona = Persona(
            user_id=user_id,
            type=data.type,
            name=data.name,
            role=data.role,
            personality=data.personality,
            focus_areas=data.focus_areas,
            voice=data.voice,
            scoring_criteria=scoring,
            behavior_rules=data.behavior_rules,
            opening_message=data.opening_message,
        )
        return await self.repository.create(persona)

    async def get_persona(self, persona_id: UUID, user_id: UUID) -> Persona:
        persona = await self.repository.get_by_id_and_user(persona_id, user_id)
        if not persona:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")
        return persona

    async def update_persona(self, persona_id: UUID, user_id: UUID, data: PersonaUpdate) -> Persona:
        persona = await self.get_persona(persona_id, user_id)
        return await self.repository.update(persona, data.model_dump(exclude_unset=True))

    async def delete_persona(self, persona_id: UUID, user_id: UUID) -> None:
        persona = await self.get_persona(persona_id, user_id)
        await self.repository.delete(persona)

    async def list_community_personas(
        self,
        search: str | None = None,
        type_filter: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[CommunityPersonaResponse]:
        rows = await self.repository.list_public(search, type_filter, offset, limit)
        return [
            CommunityPersonaResponse.model_validate(
                {**persona.__dict__, "creator_name": creator_name, "user_id": persona.user_id}
            )
            for persona, creator_name in rows
        ]
