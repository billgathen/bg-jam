import os

os.environ["DATABASE_URL"] = "postgresql+asyncpg://bgjam:bgjam@db:5432/bgjam_test"

import asyncpg
import pytest_asyncio
from httpx import ASGITransport, AsyncClient


async def _ensure_test_database() -> None:
    conn = await asyncpg.connect("postgresql://bgjam:bgjam@db:5432/bgjam")
    try:
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = 'bgjam_test'")
        if not exists:
            await conn.execute("CREATE DATABASE bgjam_test")
    finally:
        await conn.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _setup_database():
    await _ensure_test_database()

    from app import models  # noqa: F401  (registers Song on Base.metadata)
    from app.database import Base, engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def _clean_tables():
    yield
    from app.database import engine
    from app.models import Song

    async with engine.begin() as conn:
        await conn.execute(Song.__table__.delete())


@pytest_asyncio.fixture
async def client():
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
