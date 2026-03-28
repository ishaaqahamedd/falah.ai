"""Tests for RBAC enforcement — ensures role checks work correctly."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.core.security import create_access_token
from app.features.auth.models import User


@pytest.mark.asyncio
async def test_regular_user_gets_user_role(client: AsyncClient, test_user: User):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    assert resp.json()["role"] == "user"


@pytest.mark.asyncio
async def test_admin_user_gets_admin_role(db_session: AsyncSession, admin_user: User):
    """Admin user can access /me and sees admin role."""
    from main import app

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    token = create_access_token(subject=str(admin_user.id))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.cookies.set("access_token", token)
        resp = await ac.get("/api/v1/auth/me")
        assert resp.status_code == 200
        assert resp.json()["role"] == "admin"

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_invalid_token_returns_401(anon_client: AsyncClient):
    """A garbage token should be rejected."""
    anon_client.cookies.set("access_token", "invalid-token-value")
    resp = await anon_client.get("/api/v1/auth/me")
    assert resp.status_code == 401
