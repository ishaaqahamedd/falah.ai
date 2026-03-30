import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings
from app.features.auth.models import User  # noqa: F401
from app.features.personas.models import Persona  # noqa: F401
from app.features.sessions.repository import SessionRepository
from app.features.sessions.service import SessionService

logger = logging.getLogger("livekit-repository")


def _get_async_db_url() -> str:
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
    return db_url


class LivekitRepository:
    """Data-access layer for the LiveKit agent worker.

    Supports two modes:
    1. FastAPI DI — pass an existing AsyncSession via ``__init__``
    2. Agent worker — use the ``create_standalone()`` context manager
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    @classmethod
    @asynccontextmanager
    async def create_standalone(cls) -> AsyncGenerator["LivekitRepository", None]:
        """Self-contained session for the agent worker (no FastAPI DI).

        Creates its own engine, yields a repository, and disposes the engine
        on exit.
        """
        engine = create_async_engine(
            _get_async_db_url(),
            pool_pre_ping=True,
            pool_size=1,
            max_overflow=0,
            connect_args={
                "statement_cache_size": 0,
                "prepared_statement_cache_size": 0,
            },
        )
        session_factory = async_sessionmaker(
            bind=engine, class_=AsyncSession, expire_on_commit=False
        )
        try:
            async with session_factory() as session:
                yield cls(session)
        finally:
            await engine.dispose()

    async def save_session(
        self,
        user_id: str,
        persona_id: str | None,
        persona_snapshot: dict | None,
        transcript: list[dict],
        duration_seconds: int,
        artifacts: list[dict] | None = None,
    ) -> None:
        """Create a completed session and trigger scoring + summary."""
        try:
            service = SessionService(repository=SessionRepository(self._session))
            session_record = await service.create_completed_session(
                user_id=user_id,
                persona_id=persona_id,
                persona_snapshot=persona_snapshot,
                transcript=transcript,
                duration_seconds=duration_seconds,
                artifacts=artifacts,
            )
            logger.info(f"[Agent] Session saved to DB: {session_record.id}")
            await service.auto_summarize_session(session_record)
            logger.info(
                f"[Agent] ai_summary generated for session: {session_record.id}"
            )
        except Exception as e:
            logger.error(f"[Agent] Failed to save session: {e}", exc_info=True)
            await self._session.rollback()

    async def update_session(
        self,
        session_id: str,
        transcript: list[dict],
        duration_seconds: int,
        artifacts: list[dict] | None = None,
    ) -> None:
        """Update a pre-created ACTIVE session to COMPLETED and trigger scoring."""
        try:
            service = SessionService(repository=SessionRepository(self._session))
            session_record = await service.complete_existing_session(
                session_id=session_id,
                transcript=transcript,
                duration_seconds=duration_seconds,
                artifacts=artifacts,
            )
            logger.info(f"[Agent] Session updated in DB: {session_record.id}")
            await service.auto_summarize_session(session_record)
            logger.info(
                f"[Agent] ai_summary generated for session: {session_record.id}"
            )
        except Exception as e:
            logger.error(f"[Agent] Failed to update session: {e}", exc_info=True)
            await self._session.rollback()

    async def save_onboarding_summary(self, user_id: str, summary: str) -> None:
        """Save onboarding AI summary to the User record."""
        user = await self._session.get(User, user_id)
        if user:
            user.onboarding_summary = summary
            await self._session.commit()
            logger.info(f"[Agent] Onboarding summary persisted for user {user_id}")
        else:
            logger.warning(
                f"[Agent] User {user_id} not found — skipping onboarding summary"
            )
