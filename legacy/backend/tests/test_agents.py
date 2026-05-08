"""Agent catalog + lifecycle tests."""
from __future__ import annotations

import pytest
from httpx import AsyncClient


async def _signup(client: AsyncClient) -> str:
    r = await client.post(
        "/v1/auth/signup",
        json={"email": "founder@helia.io", "full_name": "F", "password": "abcdefghij1!"},
    )
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_catalog_list(client: AsyncClient):
    token = await _signup(client)
    r = await client.get(
        "/v1/agents/catalog",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    items = r.json()
    assert len(items) > 5
    slugs = {i["slug"] for i in items}
    assert "sdr-outbound" in slugs
    assert "cfo-assistant" in slugs


@pytest.mark.asyncio
async def test_hire_and_list_agent(client: AsyncClient):
    token = await _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post(
        "/v1/agents",
        json={
            "template_slug": "sdr-outbound",
            "name": "Iris",
            "config": {"icp": "VP Data, Series B+, Europe", "target_count": 10},
            "budget_per_day_eur": 50,
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    agent = r.json()
    assert agent["template_slug"] == "sdr-outbound"
    assert agent["name"] == "Iris"

    r = await client.get("/v1/agents", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1


@pytest.mark.asyncio
async def test_hire_unknown_template_404(client: AsyncClient):
    token = await _signup(client)
    r = await client.post(
        "/v1/agents",
        json={"template_slug": "nope", "name": "X"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 404
