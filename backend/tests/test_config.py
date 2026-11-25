"""Проверки загрузки и валидации настроек процесса."""

import pytest
from pydantic import ValidationError

from app.config import DatabaseSettings, MonitoringSettings, Settings
from app.modules.identity.infrastructure.delivery.settings import DeliverySettings


@pytest.fixture
def configured_environment(monkeypatch):
    monkeypatch.setenv("IDENTITY_DATABASE_URL", "postgresql+psycopg://user:private-db@localhost/db")
    monkeypatch.setenv("IDENTITY_SECRET", "private-identity-secret-long-enough")
    monkeypatch.setenv("IDENTITY_SMSC_API_KEY", "private-sms-key")


def test_settings_load_existing_environment_names(configured_environment, monkeypatch):
    monkeypatch.setenv("IDENTITY_SECURE_COOKIE", "false")
    monkeypatch.setenv("IDENTITY_LOCAL_MAILPIT", "1")
    monkeypatch.setenv("IDENTITY_MAILPIT_PORT", "2525")

    settings = Settings.model_validate({})

    assert not settings.secure_cookie
    assert settings.delivery.local_mailpit
    assert settings.delivery.mailpit_port == 2525
    assert settings.delivery.smsc_key is not None
    assert settings.delivery.smsc_key.get_secret_value() == "private-sms-key"
    assert settings.identity_secret.get_secret_value() == b"private-identity-secret-long-enough"
    assert "private-" not in repr(settings)
    assert "private-" not in settings.model_dump_json()


@pytest.mark.parametrize(
    "name,value",
    [
        ("IDENTITY_SECRET", "private-too-short"),
        ("IDENTITY_DATABASE_URL", ""),
        ("IDENTITY_SECURE_COOKIE", "invalid"),
        ("IDENTITY_SMTP_PORT", "0"),
        ("IDENTITY_SMTP_PORT", "65536"),
        ("IDENTITY_DELIVERY_TIMEOUT_SECONDS", "0"),
    ],
)
def test_invalid_settings_fail_without_disclosing_inputs(
    configured_environment, monkeypatch, name, value
):
    monkeypatch.setenv(name, value)

    with pytest.raises(ValidationError) as error:
        Settings.model_validate({})

    assert "private-" not in str(error.value)


def test_migrations_and_monitoring_do_not_require_identity_credentials(monkeypatch, tmp_path):
    monkeypatch.delenv("IDENTITY_SECRET", raising=False)
    monkeypatch.setenv("IDENTITY_DATABASE_URL", "postgresql+psycopg://localhost/db")
    monkeypatch.setenv("TUTORFLOW_METRICS_DIRECTORY", str(tmp_path))
    monkeypatch.setenv("TUTORFLOW_METRICS_TOKEN", "private-metrics-token")

    assert DatabaseSettings.model_validate({}).database_url.get_secret_value().endswith("/db")
    assert MonitoringSettings().directory == tmp_path
    assert "private-metrics-token" not in repr(MonitoringSettings())
    assert DeliverySettings().smtp_port > 0


def test_identity_policy_can_be_overridden_without_changing_domain_types(
    configured_environment, monkeypatch
):
    monkeypatch.setenv("IDENTITY_POLICY__CODE_ATTEMPTS", "7")
    monkeypatch.setenv("IDENTITY_POLICY__LOGIN_IP__ATTEMPTS", "12")
    monkeypatch.setenv("IDENTITY_POLICY__CODE_LIFETIME", "PT5M")

    settings = Settings.model_validate({})

    assert settings.policy.code_attempts == 7
    assert settings.policy.login_ip.attempts == 12
    assert settings.policy.code_lifetime.total_seconds() == 300


@pytest.mark.parametrize(
    "name,value",
    [
        ("IDENTITY_POLICY__CODE_ATTEMPTS", "0"),
        ("IDENTITY_POLICY__CODE_LIFETIME", "PT0S"),
        ("IDENTITY_POLICY__LOGIN_IP__ATTEMPTS", "-1"),
    ],
)
def test_invalid_identity_policy_is_rejected(configured_environment, monkeypatch, name, value):
    monkeypatch.setenv(name, value)

    with pytest.raises(ValidationError):
        Settings.model_validate({})


@pytest.mark.parametrize(
    "name,value",
    [
        ("IDENTITY_ARGON_MAX_CONCURRENT", "0"),
        ("IDENTITY_ARGON_MEMORY_KIB", "1024"),
        ("IDENTITY_ARGON_TIME_COST", "1"),
        ("IDENTITY_ARGON_WAIT_TIMEOUT_SECONDS", "inf"),
        ("IDENTITY_DELIVERY_TIMEOUT_SECONDS", "inf"),
    ],
)
def test_unsafe_hashing_limits_and_nonfinite_timeouts_are_rejected(
    configured_environment, monkeypatch, name, value
):
    monkeypatch.setenv(name, value)

    with pytest.raises(ValidationError):
        Settings.model_validate({})
