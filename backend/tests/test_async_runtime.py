"""Проверки асинхронных границ backend."""

import asyncio
import inspect
import time
from types import SimpleNamespace

from fastapi.routing import APIRoute

from app.main import create_app
from app.modules.identity.infrastructure.security.passwords import ArgonPasswords


def test_io_routes_are_coroutines():
    application = create_app()

    for route in application.routes:
        if isinstance(route, APIRoute) and route.path.startswith(("/api/v1", "/ready", "/metrics")):
            assert inspect.iscoroutinefunction(route.endpoint), route.path


def test_password_hashing_does_not_block_event_loop(monkeypatch):
    passwords = ArgonPasswords()
    events = []


    def slow_hash(value):
        time.sleep(0.05)
        events.append("hashed")

        return "digest"


    async def heartbeat():
        await asyncio.sleep(0.01)
        events.append("heartbeat")


    async def run():
        result, _ = await asyncio.gather(passwords.hash("password"), heartbeat())

        assert result == "digest"


    monkeypatch.setattr(passwords, "hasher", SimpleNamespace(hash=slow_hash))
    asyncio.run(run())
    assert events == ["heartbeat", "hashed"]
