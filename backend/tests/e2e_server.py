"""Локальный сервер Playwright с отдельной БД и тестовым приёмником кодов."""

import secrets

import uvicorn
from fastapi import HTTPException

from app.main import create_app
from app.modules.identity.delivery import ContactKind
from app.modules.identity.service import Identity
from tests.postgres_testkit import migrated_schema, postgres_cluster


def main():
    messages: dict[str, str] = {}

    def capture(kind: ContactKind, contact: str, code: str) -> None:
        messages[f"{kind}:{contact}"] = code

    with postgres_cluster() as cluster, migrated_schema(cluster) as database:
        identity = Identity(
            database, secrets.token_bytes(32), capture, secure_cookie=False
        )
        app = create_app(identity)

        @app.get("/__e2e/code", include_in_schema=False)
        def test_code(kind: ContactKind, contact: str) -> dict[str, str]:
            code = messages.get(f"{kind}:{contact}")
            if not code:
                raise HTTPException(404)
            return {"code": code}

        uvicorn.run(app, host="127.0.0.1", port=8865)


if __name__ == "__main__":
    main()
