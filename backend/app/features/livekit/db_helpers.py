import logging

from app.core.config import settings

logger = logging.getLogger("persona-agent")


def _get_async_db_url() -> str:
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
    return db_url


def _create_agent_session():
    """Create a fresh async engine + session factory scoped to the agent worker's event loop."""
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

    engine = create_async_engine(
        _get_async_db_url(),
        pool_pre_ping=True,
        pool_size=1,
        max_overflow=0,
        connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
    )
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    return engine, session_factory


async def save_session_to_db(
    user_id: str,
    persona_id: str | None,
    persona_snapshot: dict | None,
    transcript: list[dict],
    duration_seconds: int,
):
    """Save a completed session and auto-trigger scoring + summary."""
    from app.features.auth.models import User  # noqa: F401
    from app.features.personas.models import Persona  # noqa: F401
    from app.features.sessions.service import SessionService
    from app.features.sessions.repository import SessionRepository

    engine, SessionLocal = _create_agent_session()
    try:
        async with SessionLocal() as db:
            try:
                service = SessionService(repository=SessionRepository(db))
                session_record = await service.create_completed_session(
                    user_id=user_id,
                    persona_id=persona_id,
                    persona_snapshot=persona_snapshot,
                    transcript=transcript,
                    duration_seconds=duration_seconds,
                )
                logger.info(f"[Agent] Session saved to DB: {session_record.id}")
            except Exception as e:
                logger.error(f"[Agent] Failed to save session: {e}", exc_info=True)
                await db.rollback()
    finally:
        await engine.dispose()


async def update_session_in_db(
    session_id: str,
    transcript: list[dict],
    duration_seconds: int,
):
    """Update a pre-created ACTIVE session to COMPLETED and trigger scoring."""
    from app.features.auth.models import User  # noqa: F401
    from app.features.personas.models import Persona  # noqa: F401
    from app.features.sessions.service import SessionService
    from app.features.sessions.repository import SessionRepository

    engine, SessionLocal = _create_agent_session()
    try:
        async with SessionLocal() as db:
            try:
                service = SessionService(repository=SessionRepository(db))
                session_record = await service.complete_existing_session(
                    session_id=session_id,
                    transcript=transcript,
                    duration_seconds=duration_seconds,
                )
                logger.info(f"[Agent] Session updated in DB: {session_record.id}")
            except Exception as e:
                logger.error(f"[Agent] Failed to update session: {e}", exc_info=True)
                await db.rollback()
    finally:
        await engine.dispose()


async def save_onboarding_summary(user_id: str, summary: str):
    """Save onboarding AI summary to the User record."""
    from app.features.auth.models import User

    engine, SessionLocal = _create_agent_session()
    try:
        async with SessionLocal() as db:
            user = await db.get(User, user_id)
            if user:
                user.onboarding_summary = summary
                await db.commit()
                logger.info(f"[Agent] Onboarding summary persisted for user {user_id}")
            else:
                logger.warning(f"[Agent] User {user_id} not found — skipping onboarding summary")
    finally:
        await engine.dispose()
