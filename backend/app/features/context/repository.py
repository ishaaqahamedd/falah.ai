from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from .models import ContextDocument


class ContextRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_document(self, doc: ContextDocument) -> ContextDocument:
        self.session.add(doc)
        await self.session.commit()
        await self.session.refresh(doc)
        return doc

    async def list_by_persona_and_user(
        self, persona_id: UUID, user_id: UUID
    ) -> list[ContextDocument]:
        result = await self.session.execute(
            select(ContextDocument)
            .where(
                ContextDocument.persona_id == persona_id,
                ContextDocument.user_id == user_id,
            )
            .order_by(ContextDocument.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_recent_by_persona(
        self, persona_id: UUID, user_id: UUID, limit: int = 5
    ) -> list[ContextDocument]:
        result = await self.session.execute(
            select(ContextDocument)
            .where(
                ContextDocument.persona_id == persona_id,
                ContextDocument.user_id == user_id,
            )
            .order_by(ContextDocument.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def search_by_embedding(
        self,
        persona_id: UUID,
        user_id: UUID,
        query_embedding: list[float],
        top_k: int = 3,
    ) -> list[ContextDocument]:
        result = await self.session.execute(
            select(ContextDocument)
            .where(
                ContextDocument.persona_id == persona_id,
                ContextDocument.user_id == user_id,
            )
            .order_by(ContextDocument.embedding.l2_distance(query_embedding))
            .limit(top_k)
        )
        return list(result.scalars().all())
