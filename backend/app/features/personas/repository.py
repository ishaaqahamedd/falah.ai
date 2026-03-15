from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone

from .models import Persona


class PersonaRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_by_user(self, user_id: UUID) -> list[Persona]:
        result = await self.session.execute(
            select(Persona)
            .where(Persona.user_id == user_id)
            .order_by(Persona.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_id_and_user(self, persona_id: UUID, user_id: UUID) -> Optional[Persona]:
        result = await self.session.execute(
            select(Persona).where(Persona.id == persona_id, Persona.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def create(self, persona: Persona) -> Persona:
        self.session.add(persona)
        await self.session.commit()
        await self.session.refresh(persona)
        return persona

    async def update(self, persona: Persona, update_data: dict) -> Persona:
        for field, value in update_data.items():
            setattr(persona, field, value)
        await self.session.commit()
        await self.session.refresh(persona)
        return persona

    async def delete(self, persona: Persona) -> None:
        await self.session.delete(persona)
        await self.session.commit()

    async def update_briefing_cache(self, persona: Persona, briefing: str) -> Persona:
        persona.cached_briefing = briefing
        persona.briefing_generated_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(persona)
        return persona
