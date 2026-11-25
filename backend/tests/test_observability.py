"""Проверяет единый контракт отказов, изоляцию контекста и отсутствие секретов."""

import asyncio
import io
import json
import logging

from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.dependencies import authentication_service, identity_session
from app.main import create_app
from app.shared.infrastructure.logging import configure_logging


SECRET = "private-password-cookie-email@example.com"


def test_http_problems_and_logs_do_not_disclose_secrets():
    stream = io.StringIO()
    app = create_app()

    configure_logging(stream=stream)


    @app.get("/failure/{item}")
    def failure(item: str):
        raise RuntimeError(SECRET)


    @app.get("/refusal")
    def refusal():
        raise HTTPException(400, SECRET)


    async def requests():
        async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
            failed = await client.get(
                f"/failure/{SECRET}", params={"password": SECRET}, headers={"cookie": SECRET}
            )

            assert failed.status_code == 500
            assert failed.headers["content-type"] == "application/problem+json"
            assert failed.json()["code"] == "internal_error"
            assert failed.json()["request_id"] == failed.headers["x-request-id"]
            assert SECRET not in failed.text

            missing = await client.get(f"/missing/{SECRET}")

            assert missing.json()["code"] == "not_found"
            assert (await client.get("/refusal")).json()["code"] == "http_error"
            assert failed.headers["x-request-id"] != missing.headers["x-request-id"]

            return failed.headers["x-request-id"]


    try:
        identifier = asyncio.run(requests())

        logging.getLogger("sqlalchemy").error("SQL %s", SECRET, extra={"password": SECRET})

        logs = [json.loads(line) for line in stream.getvalue().splitlines()]

        assert SECRET not in stream.getvalue()

        failures = [line for line in logs if line["event"] == "http_request_failed"]

        assert len(failures) == 1
        assert failures[0]["request_id"] == identifier
        assert failures[0]["exception_type"] == "RuntimeError"
        assert failures[0]["frames"]
        assert any(line.get("route") == "/failure/{item}" for line in logs)
    finally:
        configure_logging()


def test_validation_and_default_errors_use_problem_details():
    async def unused_service():
        raise AssertionError("Сценарий не должен выполняться для невалидного запроса")


    async def dependency_placeholder():
        return unused_service


    async def requests():
        app = create_app()
        app.dependency_overrides[identity_session] = dependency_placeholder
        app.dependency_overrides[authentication_service] = dependency_placeholder

        async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
            invalid = await client.post("/api/v1/auth/login", json={"password": SECRET})

            assert invalid.status_code == 422
            assert invalid.json()["code"] == "validation_error"
            assert invalid.json()["errors"]
            assert SECRET not in invalid.text

            extra = await client.post("/api/v1/auth/login", json={SECRET: SECRET})

            assert SECRET not in extra.text

            schema = (await client.get("/openapi.json")).json()
            response_schema = schema["paths"]["/api/v1/auth/login"]["post"]["responses"]["422"]

            assert "application/problem+json" in response_schema["content"]

            denied = await client.get("/api/v1/me")

            assert denied.json()["code"] == "authentication_required"
            assert denied.json()["status"] == denied.status_code == 401
            assert (await client.post("/health")).json()["code"] == "method_not_allowed"


    asyncio.run(requests())


def test_metrics_are_protected_and_do_not_label_user_input(monkeypatch):
    monkeypatch.setenv("TUTORFLOW_METRICS_TOKEN", "metrics-test-token")


    async def requests():
        app = create_app()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
            assert (await client.get("/metrics")).status_code == 403
            await client.get(f"/missing/{SECRET}")
            await client.get(f"/another/{SECRET}")

            response = await client.get(
                "/metrics", headers={"authorization": "Bearer metrics-test-token"}
            )

            assert response.status_code == 200
            assert SECRET not in response.text
            assert 'route="__unmatched__",status="404"' in response.text
            assert "tutorflow_http_request_duration_seconds_bucket" in response.text
            assert "tutorflow_metrics_database_available 0.0" in response.text
            assert 'route="/metrics"' not in response.text


    asyncio.run(requests())


def test_request_context_is_isolated_for_parallel_calls():
    stream = io.StringIO()
    app = create_app()

    configure_logging(stream=stream)


    async def requests():
        async with AsyncClient(transport=ASGITransport(app=app), base_url="https://test") as client:
            first, second = await asyncio.gather(client.get("/health"), client.get("/health"))

            return {first.headers["x-request-id"], second.headers["x-request-id"]}


    try:
        identifiers = asyncio.run(requests())

        assert len(identifiers) == 2

        logs = [json.loads(line) for line in stream.getvalue().splitlines()]

        assert {
            line["request_id"] for line in logs if line["event"] == "http_request_completed"
        } == identifiers
        assert all("request_id" not in line for line in logs if line["event"] == "external_log")
    finally:
        configure_logging()
