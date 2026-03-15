from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from uuid import UUID

from .models import PitchSession, SessionStatus


class SessionRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, session_record: PitchSession) -> PitchSession:
        self.session.add(session_record)
        await self.session.commit()
        await self.session.refresh(session_record)
        return session_record

    async def get_by_id_and_user(self, session_id: UUID, user_id: UUID) -> Optional[PitchSession]:
        result = await self.session.execute(
            select(PitchSession).where(
                PitchSession.id == session_id,
                PitchSession.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def update(self, session_record: PitchSession) -> PitchSession:
        await self.session.commit()
        await self.session.refresh(session_record)
        return session_record

    async def list_by_user(
        self, user_id: UUID, persona_id: Optional[UUID] = None, limit: int = 20
    ) -> list[PitchSession]:
        query = select(PitchSession).where(PitchSession.user_id == user_id)
        if persona_id:
            query = query.where(PitchSession.persona_id == persona_id)
        query = query.order_by(PitchSession.started_at.desc()).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def list_completed_for_persona(
        self, persona_id: UUID, user_id: UUID, limit: int = 3
    ) -> list[PitchSession]:
        result = await self.session.execute(
            select(PitchSession)
            .where(
                PitchSession.persona_id == persona_id,
                PitchSession.user_id == user_id,
                PitchSession.status == SessionStatus.COMPLETED,
                PitchSession.ai_summary.isnot(None),
            )
            .order_by(PitchSession.ended_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
