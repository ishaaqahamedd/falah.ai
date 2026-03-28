"""Tests for authentication endpoints."""

import pytest
from httpx import AsyncClient
from app.features.auth.models import User


@pytest.mark.asyncio
async def test_me_returns_user(client: AsyncClient, test_user: User):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == test_user.email
    assert data["full_name"] == test_user.full_name
    assert data["role"] == "user"


@pytest.mark.asyncio
async def test_me_unauthenticated(anon_client: AsyncClient):
    resp = await anon_client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_logout(client: AsyncClient):
    resp = await client.post("/api/v1/auth/logout")
    assert resp.status_code == 200
    assert resp.json()["message"] == "Logged out"
