from dataclasses import dataclass

from sqlalchemy import Select
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class PostgresRepository:
    db: AsyncSession

    async def rows(self, query: Select) -> list[dict]:
        result = await self.db.execute(query)
        return [dict(row) for row in result.mappings()]

    async def row(self, query: Select) -> dict | None:
        result = await self.db.execute(query)
        row = result.mappings().one_or_none()
        return dict(row) if row is not None else None
