"""Локальный сервер Playwright с отдельной БД и тестовым приёмником кодов."""

import asyncio
import secrets

import uvicorn
from fastapi import HTTPException
from tests.postgres_testkit import migrated_schema, postgres_cluster

from app.composition import build_services
from app.main import create_app
from app.modules.identity.domain.values import Contact, ContactKind


class Inbox:
    def __init__(self):
        self.messages: dict[str, str] = {}

    async def send(self, contact: Contact, code: str) -> None:
        self.messages[f"{contact.kind}:{contact.value}"] = code


async def main():
    inbox = Inbox()

    async with postgres_cluster() as cluster, migrated_schema(cluster) as database:
        services = await build_services(
            database, secrets.token_bytes(32), inbox, secure_cookie=False
        )
        app = create_app(services)


        @app.get("/__e2e/code", include_in_schema=False)
        async def test_code(kind: ContactKind, contact: str) -> dict[str, str]:
            code = inbox.messages.get(f"{kind}:{contact}")

            if not code:
                raise HTTPException(404)

            return {"code": code}


        await uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=8865)).serve()


if __name__ == "__main__":
    asyncio.run(main())
