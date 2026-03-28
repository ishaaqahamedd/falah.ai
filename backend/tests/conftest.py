"""Shared test fixtures — in-memory SQLite async database + authenticated test client."""

import uuid
from typing import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.database import Base, get_db
from app.core.security import create_access_token
from app.features.auth.models import User

# ---------------------------------------------------------------------------
# In-memory SQLite engine (no external DB required)
# ---------------------------------------------------------------------------
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DB_URL, echo=False)
TestingSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


# SQLite doesn't enforce FK constraints by default — enable them
@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


# ---------------------------------------------------------------------------
# DB session fixture — creates tables, yields session, drops tables
# ---------------------------------------------------------------------------
@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ---------------------------------------------------------------------------
# Test user fixture
# ---------------------------------------------------------------------------
@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        full_name="Test User",
        role="user",
        auth_provider="google",
        google_id="google-test-123",
        onboarding_status="completed",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def admin_user(db_session: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email="admin@example.com",
        full_name="Admin User",
        role="admin",
        auth_provider="google",
        google_id="google-admin-123",
        onboarding_status="completed",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Auth token fixture
# ---------------------------------------------------------------------------
@pytest.fixture
def auth_token(test_user: User) -> str:
    return create_access_token(subject=str(test_user.id))


@pytest.fixture
def admin_token(admin_user: User) -> str:
    return create_access_token(subject=str(admin_user.id))


# ---------------------------------------------------------------------------
# Async HTTP test client — overrides DB dependency
# ---------------------------------------------------------------------------
@pytest.fixture
async def client(db_session: AsyncSession, auth_token: str) -> AsyncGenerator[AsyncClient, None]:
    from main import app

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.cookies.set("access_token", auth_token)
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def anon_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Client with no auth — for testing 401 responses."""
    from main import app

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
