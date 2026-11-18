from uuid import UUID

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError, ProgrammingError

from app.config import Settings
from app.main import create_app

API = "/api/v1"


@pytest.fixture
def client():
    app = create_app(Settings("postgresql+psycopg://postgres@localhost/tutorflow", "t" * 48))

    @app.get("/fake-http-error")
    async def error():
        raise HTTPException(
            401,
            detail="raw sensitive value",
            headers={
                "WWW-Authenticate": 'Basic realm="test fixture"',
            },
        )

    @app.get("/fake-db-offline")
    async def db_offline():
        raise OperationalError("secret statement", {"secret_key": "secret value"}, RuntimeError())

    @app.get("/fake-db-bug")
    async def db_bug():
        raise ProgrammingError("secret statement", {"secret_key": "secret value"}, RuntimeError())

    with TestClient(app) as client:
        yield client


def assert_problem(response, status, code):
    assert response.status_code == status
    assert response.headers["content-type"] == "application/problem+json"
    assert response.headers["cache-control"] == "no-store"
    error = response.json()
    assert error["status"] == status
    assert error["code"] == code
    assert error["type"] == f"urn:tutorflow:problem:{code}"
    assert error["title"] != code
    assert error["request_id"] == str(UUID(response.headers["x-request-id"]))
    assert error["instance"] == f"urn:uuid:{error['request_id']}"
    return error


def test_problem_identifies_occurrence_without_reflecting_url(client):
    first = client.get(f"{API}/unknown-sensitive-path?key=raw")
    second = client.get(f"{API}/unknown-sensitive-path?key=raw")
    assert_problem(first, 404, "resource_not_found")
    assert_problem(second, 404, "resource_not_found")
    assert first.json()["instance"] != second.json()["instance"]
    assert "sensitive" not in first.text
    assert "key=raw" not in first.text


def test_405_lists_get_and_patch_without_documenting_unsupported_method(client):
    response = client.post(f"{API}/me/profile")
    assert_problem(response, 405, "method_not_allowed")
    assert {method.strip() for method in response.headers["allow"].split(",")} == {"GET", "PATCH"}


@pytest.mark.parametrize(
    ("content", "media", "status", "code"),
    [
        (b'{"password": "sensitive",', "application/json", 400, "invalid_request"),
        (b"sensitive", "text/plain", 415, "unsupported_media_type"),
        (b"sensitive", None, 415, "unsupported_media_type"),
        (b"x" * 16_385, "application/json", 413, "request_too_large"),
    ],
)
def test_json_protocol_failures(client, content, media, status, code):
    headers = {"Content-Type": media} if media else {}
    response = client.post(f"{API}/auth/login", content=content, headers=headers)
    assert_problem(response, status, code)
    assert "sensitive" not in response.text


def test_cookie_auth_has_no_fictional_http_challenge(client):
    response = client.get(f"{API}/me")
    assert_problem(response, 403, "authentication_required")
    assert "www-authenticate" not in response.headers
    genuine = client.get("/fake-http-error")
    assert genuine.status_code == 401
    assert genuine.headers["www-authenticate"] == 'Basic realm="test fixture"'
    assert "raw sensitive value" not in genuine.text


def test_trailing_slash_does_not_echo_query_in_a_redirect(client):
    response = client.get(f"{API}/health/?key=sensitive", follow_redirects=False)
    assert_problem(response, 404, "resource_not_found")
    assert "location" not in response.headers


def test_database_failure_has_public_status_without_sql(client, caplog):
    for path, status, code in (
        ("/fake-db-offline", 503, "dependency_unavailable"),
        ("/fake-db-bug", 500, "internal_error"),
    ):
        response = client.get(path)
        assert_problem(response, status, code)
        assert "secret" not in response.text
    assert "secret" not in caplog.text


def test_validation_uses_safe_field_codes_without_echoing_extra_keys(client):
    response = client.get("/api/v1/auth/sessions?limit=sensitive-limit")
    # Authentication is checked before private query validation.
    assert_problem(response, 403, "authentication_required")
    from fastapi import FastAPI

    from app.modules.identity.presentation.schemas import Login
    from app.shared.presentation.api.errors import JsonRoute

    def add_validation_route(app: FastAPI):
        from fastapi import APIRouter

        router = APIRouter(route_class=JsonRoute)

        @router.post("/validation-fixture")
        async def validate(payload: Login):
            return payload.login_contact.type

        app.include_router(router)

    add_validation_route(client.app)
    validation = client.post(
        "/validation-fixture",
        json={
            "login_contact": {"type": "email", "value": "invalid-sensitive-email"},
            "secret-unknown-field": "secret-body-value",
        },
    )
    error = assert_problem(validation, 422, "validation_failed")
    assert {"field": "body", "code": "unknown_field"} in error["errors"]
    assert {"field": "body.password", "code": "required"} in error["errors"]
    assert {"field": "body.login_contact", "code": "invalid_value"} in error["errors"]
    for value in ("invalid-sensitive-email", "secret-unknown-field", "secret-body-value"):
        assert value not in validation.text
