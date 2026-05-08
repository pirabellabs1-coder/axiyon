"""Smoke tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_openapi_published(client: AsyncClient):
    r = await client.get("/v1/openapi.json")
    assert r.status_code == 200
    spec = r.json()
    assert spec["info"]["title"] == "Axion API"
    paths = spec["paths"]
    # Every major route present
    for p in ("/v1/auth/signup", "/v1/agents", "/v1/workflows", "/v1/memory/ingest"):
        assert p in paths, f"Missing route: {p}"
