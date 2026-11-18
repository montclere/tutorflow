from dataclasses import replace

import pytest

from app.config import Settings


def production_settings() -> Settings:
    return Settings(
        "postgresql+psycopg://tutorflow@db/tutorflow",
        "s" * 32,
        app_env="production",
        browser_origin="https://tutorflow.invalid",
        smtp_host="smtp.invalid",
        smtp_sender="app@example.invalid",
        smsc_api_key="fake-test-key",
        smsc_sender="test",
    )


def test_production_configuration_uses_secure_session_cookie():
    assert production_settings().cookie_name == "__Host-tutorflow_session"


@pytest.mark.parametrize(
    "overrides",
    [
        {"secure_cookie": False},
        {"local_inbox": "/tmp/dev-inbox"},
        {"browser_origin": "http://tutorflow.invalid"},
        {"smtp_host": None},
        {"smtp_tls": False},
        {"smsc_api_key": None},
    ],
)
def test_production_rejects_development_or_incomplete_configuration(overrides):
    with pytest.raises(ValueError):
        replace(production_settings(), **overrides)
