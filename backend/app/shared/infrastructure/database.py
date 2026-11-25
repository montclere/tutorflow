"""Асинхронное подключение PostgreSQL и метаданные модулей."""

from sqlalchemy import URL, MetaData
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine


metadata = MetaData()


def postgres_engine(url: str | URL) -> AsyncEngine:
    return create_async_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 5})
