from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone

from .models import Persona
from app.features.auth.models import User


class PersonaRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_by_user(self, user_id: UUID, offset: int = 0, limit: int = 50) -> list[Persona]:
        result = await self.session.execute(
            select(Persona)
            .where(Persona.user_id == user_id)
            .order_by(Persona.created_at.desc())
            .offset(offset)
            .limit(limit)
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

    async def list_public(
        self,
        search: Optional[str] = None,
        type_filter: Optional[str] = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[tuple[Persona, str]]:
        """List public community personas with creator name."""
        query = (
            select(Persona, User.full_name)
            .join(User, Persona.user_id == User.id)
            .where(Persona.is_public == True)
        )
        if search:
            pattern = f"%{search}%"
            query = query.where(
                or_(
                    Persona.name.ilike(pattern),
                    Persona.role.ilike(pattern),
                    Persona.type.ilike(pattern),
                )
            )
        if type_filter:
            query = query.where(Persona.type == type_filter)
        query = query.order_by(Persona.use_count.desc(), Persona.created_at.desc())
        query = query.offset(offset).limit(limit)
        result = await self.session.execute(query)
        return list(result.all())

    async def get_public_by_id(self, persona_id: UUID) -> Optional[Persona]:
        """Fetch a single public persona by ID (no user ownership check)."""
        result = await self.session.execute(
            select(Persona).where(Persona.id == persona_id, Persona.is_public == True)
        )
        return result.scalar_one_or_none()

    async def update_briefing_cache(self, persona: Persona, briefing: str) -> Persona:
        persona.cached_briefing = briefing
        persona.briefing_generated_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(persona)
        return persona
