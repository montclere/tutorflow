"""Миграции PostgreSQL через асинхронное подключение."""

import asyncio

from alembic import context
from sqlalchemy import Connection

from app.config import database_url
from app.persistence import target_metadata
from app.shared.infrastructure.database import postgres_engine


def apply_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_online() -> None:
    engine = postgres_engine(database_url())

    try:
        async with engine.connect() as connection:
            await connection.run_sync(apply_migrations)
    finally:
        await engine.dispose()


def run_migrations() -> None:
    connection = context.config.attributes.get("connection")

    if connection is not None:
        apply_migrations(connection)

        return

    if context.is_offline_mode():
        context.configure(url=database_url(), target_metadata=target_metadata, literal_binds=True)

        with context.begin_transaction():
            context.run_migrations()

        return

    asyncio.run(run_online())


run_migrations()
