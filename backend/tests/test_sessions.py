"""Tests for session lifecycle endpoints."""

import pytest
from httpx import AsyncClient
from app.features.auth.models import User


@pytest.mark.asyncio
async def test_create_session(client: AsyncClient, test_user: User):
    resp = await client.post("/api/v1/sessions/", json={})
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "active"
    assert data["user_id"] == str(test_user.id)


@pytest.mark.asyncio
async def test_list_sessions(client: AsyncClient, test_user: User):
    await client.post("/api/v1/sessions/", json={})
    await client.post("/api/v1/sessions/", json={})

    resp = await client.get("/api/v1/sessions/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_get_session(client: AsyncClient, test_user: User):
    create_resp = await client.post("/api/v1/sessions/", json={})
    session_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/sessions/{session_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == session_id


@pytest.mark.asyncio
async def test_update_session(client: AsyncClient, test_user: User):
    create_resp = await client.post("/api/v1/sessions/", json={})
    session_id = create_resp.json()["id"]

    transcript = [
        {
            "role": "agent",
            "text": "Hello, tell me about your startup.",
            "timestamp": 0.0,
        },
        {"role": "user", "text": "We're building an AI platform.", "timestamp": 5.0},
    ]
    resp = await client.patch(
        f"/api/v1/sessions/{session_id}",
        json={"transcript": transcript, "duration_seconds": 120, "status": "completed"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert data["duration_seconds"] == 120
    assert len(data["transcript"]) == 2


@pytest.mark.asyncio
async def test_get_nonexistent_session(client: AsyncClient, test_user: User):
    import uuid

    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/api/v1/sessions/{fake_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_session_unauthenticated(anon_client: AsyncClient):
    resp = await anon_client.post("/api/v1/sessions/", json={})
    assert resp.status_code == 401
