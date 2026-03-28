"""Tests for persona CRUD endpoints."""

import pytest
from httpx import AsyncClient
from app.features.auth.models import User


PERSONA_PAYLOAD = {
    "name": "Test Investor",
    "role": "Angel Investor",
    "type": "investor",
    "personality": "Direct and analytical. Focuses on market size.",
    "focus_areas": "TAM/SAM/SOM, unit economics, competitive moat",
    "voice": "Puck",
}


@pytest.mark.asyncio
async def test_create_persona(client: AsyncClient, test_user: User):
    resp = await client.post("/api/v1/personas/", json=PERSONA_PAYLOAD)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == PERSONA_PAYLOAD["name"]
    assert data["role"] == PERSONA_PAYLOAD["role"]
    assert data["is_public"] is False


@pytest.mark.asyncio
async def test_list_personas(client: AsyncClient, test_user: User):
    # Create two personas
    await client.post("/api/v1/personas/", json=PERSONA_PAYLOAD)
    await client.post("/api/v1/personas/", json={**PERSONA_PAYLOAD, "name": "Second Agent"})

    resp = await client.get("/api/v1/personas/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_get_persona(client: AsyncClient, test_user: User):
    create_resp = await client.post("/api/v1/personas/", json=PERSONA_PAYLOAD)
    persona_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/personas/{persona_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == persona_id


@pytest.mark.asyncio
async def test_update_persona(client: AsyncClient, test_user: User):
    create_resp = await client.post("/api/v1/personas/", json=PERSONA_PAYLOAD)
    persona_id = create_resp.json()["id"]

    resp = await client.put(f"/api/v1/personas/{persona_id}", json={"name": "Updated Name"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Name"


@pytest.mark.asyncio
async def test_delete_persona(client: AsyncClient, test_user: User):
    create_resp = await client.post("/api/v1/personas/", json=PERSONA_PAYLOAD)
    persona_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/personas/{persona_id}")
    assert resp.status_code == 204

    # Verify it's gone
    resp = await client.get(f"/api/v1/personas/{persona_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_templates(client: AsyncClient):
    resp = await client.get("/api/v1/personas/templates")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_create_persona_unauthenticated(anon_client: AsyncClient):
    resp = await anon_client.post("/api/v1/personas/", json=PERSONA_PAYLOAD)
    assert resp.status_code == 401
