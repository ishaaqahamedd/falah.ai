"""Tests for LiveKit token endpoints."""

import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient
from app.features.auth.models import User


@pytest.mark.asyncio
async def test_get_token(client: AsyncClient, test_user: User):
    """GET /api/v1/livekit/token should return a token + room."""
    with (
        patch.object(
            __import__(
                "app.features.livekit.service", fromlist=["LivekitService"]
            ).LivekitService,
            "create_room",
            new_callable=AsyncMock,
        ),
        patch.object(
            __import__(
                "app.features.livekit.service", fromlist=["LivekitService"]
            ).LivekitService,
            "generate_token",
            return_value="fake-jwt-token",
        ),
    ):
        resp = await client.get(
            "/api/v1/livekit/token?room=test-room&persona_id=investor_1"
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["token"] == "fake-jwt-token"
    assert data["room"] == "test-room"


@pytest.mark.asyncio
async def test_get_onboarding_token(client: AsyncClient, test_user: User):
    """GET /api/v1/livekit/onboarding-token should return a token + room."""
    with (
        patch.object(
            __import__(
                "app.features.livekit.service", fromlist=["LivekitService"]
            ).LivekitService,
            "create_room",
            new_callable=AsyncMock,
        ),
        patch.object(
            __import__(
                "app.features.livekit.service", fromlist=["LivekitService"]
            ).LivekitService,
            "generate_token",
            return_value="fake-onboarding-jwt",
        ),
    ):
        resp = await client.get("/api/v1/livekit/onboarding-token")
    assert resp.status_code == 200
    data = resp.json()
    assert data["token"] == "fake-onboarding-jwt"
    assert "room" in data


@pytest.mark.asyncio
async def test_get_token_unauthenticated(anon_client: AsyncClient):
    resp = await anon_client.get("/api/v1/livekit/token?room=test-room")
    assert resp.status_code == 401
