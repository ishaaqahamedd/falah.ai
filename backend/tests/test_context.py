"""Tests for context document endpoints."""

import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient
from app.features.auth.models import User


@pytest.mark.asyncio
async def test_upload_document(client: AsyncClient, test_user: User):
    """Upload a text file with mocked embedding generation."""
    # Create a persona first (upload requires persona_id)
    persona_resp = await client.post(
        "/api/v1/personas/",
        json={
            "name": "Test Investor",
            "role": "Angel Investor",
            "type": "investor",
            "personality": "Direct",
            "focus_areas": "TAM",
            "voice": "Puck",
        },
    )
    persona_id = persona_resp.json()["id"]

    with patch(
        "app.features.context.service.generate_embedding",
        new_callable=AsyncMock,
        return_value=[0.0] * 3072,
    ):
        resp = await client.post(
            "/api/v1/context/upload",
            files={"file": ("test.txt", b"Hello context content", "text/plain")},
            data={
                "persona_id": persona_id,
                "content_type": "document",
                "metadata_json": "{}",
            },
        )
    assert resp.status_code == 201
    data = resp.json()
    assert data["filename"] == "test.txt"


@pytest.mark.asyncio
async def test_list_documents(client: AsyncClient, test_user: User):
    """Upload then list documents for a persona."""
    persona_resp = await client.post(
        "/api/v1/personas/",
        json={
            "name": "Test Investor",
            "role": "Angel Investor",
            "type": "investor",
            "personality": "Direct",
            "focus_areas": "TAM",
            "voice": "Puck",
        },
    )
    persona_id = persona_resp.json()["id"]

    with patch(
        "app.features.context.service.generate_embedding",
        new_callable=AsyncMock,
        return_value=[0.0] * 3072,
    ):
        await client.post(
            "/api/v1/context/upload",
            files={"file": ("doc1.txt", b"First document", "text/plain")},
            data={
                "persona_id": persona_id,
                "content_type": "document",
                "metadata_json": "{}",
            },
        )

    resp = await client.get(f"/api/v1/context/documents?persona_id={persona_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["filename"] == "doc1.txt"


@pytest.mark.asyncio
async def test_upload_unsupported_type(client: AsyncClient, test_user: User):
    """Uploading an unsupported content type should return 400."""
    resp = await client.post(
        "/api/v1/context/upload",
        files={"file": ("archive.zip", b"PK\x03\x04fake", "application/zip")},
        data={"content_type": "document", "metadata_json": "{}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_briefing_no_docs(client: AsyncClient, test_user: User):
    """Briefing for a persona with no docs should return a 'no context' message."""
    persona_resp = await client.post(
        "/api/v1/personas/",
        json={
            "name": "Empty Persona",
            "role": "VC",
            "type": "investor",
            "personality": "Friendly",
            "focus_areas": "Growth",
            "voice": "Puck",
        },
    )
    persona_id = persona_resp.json()["id"]

    resp = await client.get(f"/api/v1/context/briefing?persona_id={persona_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert "no" in data["briefing"].lower() or "no" in data["briefing"].lower()
    assert data["sources"] == 0
    assert data["cached"] is False
