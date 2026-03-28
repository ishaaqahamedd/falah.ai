"""Tests for onboarding progress endpoints."""

import pytest
from httpx import AsyncClient
from app.features.auth.models import User


@pytest.mark.asyncio
async def test_update_progress(client: AsyncClient, test_user: User):
    resp = await client.patch(
        "/api/v1/onboarding/progress",
        json={"step": "explore_ui", "status": "completed"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["onboarding_step"] == "explore_ui"
    assert data["onboarding_status"] == "completed"


@pytest.mark.asyncio
async def test_update_invalid_step(client: AsyncClient, test_user: User):
    resp = await client.patch(
        "/api/v1/onboarding/progress",
        json={"step": "nonexistent_step", "status": "completed"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_update_progress_unauthenticated(anon_client: AsyncClient):
    resp = await anon_client.patch(
        "/api/v1/onboarding/progress",
        json={"step": "welcome", "status": "in_progress"},
    )
    assert resp.status_code == 401
