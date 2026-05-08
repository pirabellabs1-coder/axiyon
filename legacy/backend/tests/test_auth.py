"""Auth flow tests."""
from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_signup_and_me(client: AsyncClient):
    r = await client.post(
        "/v1/auth/signup",
        json={
            "email": "claire@helia.io",
            "full_name": "Claire Laporte",
            "password": "correct horse battery staple",
            "org_name": "Helia",
        },
    )
    assert r.status_code == 201, r.text
    tokens = r.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens

    me = await client.get(
        "/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == "claire@helia.io"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await client.post(
        "/v1/auth/signup",
        json={
            "email": "marc@example.com",
            "full_name": "Marc",
            "password": "abcdefghij",
        },
    )
    r = await client.post(
        "/v1/auth/login",
        json={"email": "marc@example.com", "password": "WRONGwrong1!"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_refresh(client: AsyncClient):
    s = await client.post(
        "/v1/auth/signup",
        json={
            "email": "nour@example.com",
            "full_name": "Nour",
            "password": "abcdefghij",
        },
    )
    tokens = s.json()
    r = await client.post(
        "/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert r.status_code == 200
    assert r.json()["access_token"]
