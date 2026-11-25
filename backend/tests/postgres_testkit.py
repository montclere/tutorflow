"""Изолированные асинхронные тестовые схемы PostgreSQL."""

import asyncio
import os
import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import URL, Connection
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.schema import CreateSchema, DropSchema

from app.shared.infrastructure.database import postgres_engine


STARTUP_ATTEMPTS = 80
STARTUP_INTERVAL_SECONDS = 0.25


async def docker(*arguments: str, environment=None) -> str:
    process = await asyncio.create_subprocess_exec(
        "docker",
        *arguments,
        env=environment,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    output, error = await process.communicate()

    if process.returncode:
        raise RuntimeError(error.decode())

    return output.decode().strip()


@asynccontextmanager
async def postgres_url() -> AsyncIterator[URL | str]:
    configured = os.environ.get("TEST_IDENTITY_DATABASE_URL")

    if configured:
        yield configured

        return

    password = secrets.token_urlsafe(24)
    container = await docker(
        "run",
        "--rm",
        "-d",
        "-e",
        "POSTGRES_PASSWORD",
        "-p",
        "127.0.0.1::5432",
        "postgres:17-alpine",
        environment={**os.environ, "POSTGRES_PASSWORD": password},
    )

    try:
        mapping = await docker("port", container, "5432/tcp")
        port = int(mapping.rsplit(":", 1)[1])

        yield URL.create("postgresql+psycopg", "postgres", password, "127.0.0.1", port, "postgres")
    finally:
        await docker("rm", "-f", container)


@asynccontextmanager
async def postgres_cluster() -> AsyncIterator[AsyncEngine]:
    async with postgres_url() as url:
        engine = postgres_engine(url)

        try:
            for attempt in range(STARTUP_ATTEMPTS):
                try:
                    async with engine.connect():
                        break
                except OperationalError:
                    if attempt == STARTUP_ATTEMPTS - 1:
                        raise

                    await asyncio.sleep(STARTUP_INTERVAL_SECONDS)

            yield engine
        finally:
            await engine.dispose()


def migration_config() -> Config:
    return Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))


def change_revision(connection: Connection, revision: str, *, downgrade: bool = False) -> None:
    config = migration_config()
    config.attributes["connection"] = connection

    operation = command.downgrade if downgrade else command.upgrade

    operation(config, revision)


async def migrate(engine: AsyncEngine, revision: str, *, downgrade: bool = False) -> None:
    async with engine.begin() as connection:
        await connection.run_sync(change_revision, revision, downgrade=downgrade)


def compare_schema(connection: Connection) -> None:
    config = migration_config()
    config.attributes["connection"] = connection

    command.check(config)


async def check_schema(engine: AsyncEngine) -> None:
    async with engine.connect() as connection:
        await connection.run_sync(compare_schema)


@asynccontextmanager
async def migrated_schema(
    cluster: AsyncEngine, revision: str = "head"
) -> AsyncIterator[AsyncEngine]:
    schema = f"tutorflow_test_{secrets.token_hex(12)}"

    async with cluster.begin() as connection:
        await connection.execute(CreateSchema(schema))

    engine = postgres_engine(cluster.url.update_query_dict({"options": f"-csearch_path={schema}"}))

    try:
        await migrate(engine, revision)
        yield engine
    finally:
        await engine.dispose()

        async with cluster.begin() as connection:
            await connection.execute(DropSchema(schema, cascade=True))
