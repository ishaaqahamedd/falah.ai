"""Tests for the /health and / root endpoints."""

import pytest
from unittest.mock import patch
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root_endpoint(client: AsyncClient):
    resp = await client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("healthy", "degraded")
    assert "database" in data["checks"]


@pytest.mark.asyncio
async def test_health_degraded(client: AsyncClient):
    """When the database is unreachable, /health should return 503."""

    class _FailingSession:
        async def __aenter__(self):
            raise ConnectionError("db down")

        async def __aexit__(self, *args):
            pass

    with patch("app.db.database.AsyncSessionLocal", return_value=_FailingSession()):
        resp = await client.get("/health")
    assert resp.status_code == 503
    data = resp.json()
    assert data["status"] == "degraded"
    assert data["checks"]["database"] == "error"
