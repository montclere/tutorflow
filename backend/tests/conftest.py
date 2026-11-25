"""Общие изолированные PostgreSQL-фикстуры и сервисы интеграционных тестов."""

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine
from tests.identity_testkit import IDENTITY_SECRET, Inbox
from tests.postgres_testkit import migrated_schema, postgres_cluster

from app.composition import Services, build_services
from app.main import create_app


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(scope="session")
async def cluster() -> AsyncIterator[AsyncEngine]:
    async with postgres_cluster() as engine:
        yield engine


@pytest.fixture
async def database(cluster: AsyncEngine) -> AsyncIterator[AsyncEngine]:
    async with migrated_schema(cluster) as engine:
        yield engine


@pytest.fixture
def inbox() -> Inbox:
    return Inbox()


@pytest.fixture
async def services(database: AsyncEngine, inbox: Inbox) -> Services:
    return await build_services(database, IDENTITY_SECRET, inbox, secure_cookie=True)


@pytest.fixture
async def client(services: Services) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(
        transport=ASGITransport(app=create_app(services)), base_url="https://test"
    ) as client:
        yield client
