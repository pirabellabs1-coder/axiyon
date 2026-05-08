"""Pytest fixtures for backend tests."""
from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Force test config before app import
os.environ["ENV"] = "dev"
os.environ["DEBUG"] = "false"
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://axion:axion@localhost:5432/axion_test",
)
os.environ["JWT_SECRET"] = "test-secret-not-for-production"

from axion.db.base import Base  # noqa: E402
import axion.models  # noqa: F401, E402  (registers ORM)
from axion.main import create_app  # noqa: E402


@pytest_asyncio.fixture(scope="session")
async def engine():
    eng = create_async_engine(os.environ["DATABASE_URL"], echo=False, future=True)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest_asyncio.fixture
async def session(engine) -> AsyncGenerator[AsyncSession, None]:
    Maker = async_sessionmaker(engine, expire_on_commit=False)
    async with Maker() as s:
        yield s
        await s.rollback()


@pytest_asyncio.fixture
async def client(engine) -> AsyncGenerator[AsyncClient, None]:
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
