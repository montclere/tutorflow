"""Настройки приложения и способы доставки кода."""

import os
from dataclasses import dataclass, field
from urllib.parse import urlsplit

CHALLENGE_MINUTES = 10
SESSION_IDLE_HOURS = 24


@dataclass(frozen=True)
class Settings:
    database_url: str = field(repr=False)
    secret_key: str = field(repr=False)
    secure_cookie: bool = True
    browser_origin: str | None = None
    local_inbox: str | None = None
    smtp_host: str | None = None
    smtp_port: int = 465
    smtp_sender: str | None = None
    smtp_username: str | None = None
    smtp_password: str | None = field(default=None, repr=False)
    invitation_hours: int = 72
    challenge_minutes: int = CHALLENGE_MINUTES
    challenge_attempts: int = 5
    session_days: int = 7
    session_idle_hours: int = SESSION_IDLE_HOURS
    anonymous_minutes: int = 30
    max_active_sessions: int = 10
    app_env: str = "development"
    smtp_tls: bool = True
    smsc_api_key: str | None = field(default=None, repr=False)
    smsc_sender: str | None = None
    lesson_min_minutes: int = 15
    lesson_max_minutes: int = 240
    lesson_horizon_days: int = 365
    lesson_max_series: int = 26

    def __post_init__(self):
        if self.app_env not in {"development", "production"}:
            raise ValueError("TUTORFLOW_APP_ENV должен быть development или production")
        if self.app_env == "production":
            origin = urlsplit(self.browser_origin or "")
            if (
                origin.scheme != "https"
                or not origin.hostname
                or origin.username
                or origin.path
                or origin.query
                or origin.fragment
            ):
                raise ValueError("Для production требуется точный HTTPS origin")
            if not self.secure_cookie or self.local_inbox or not self.smtp_tls:
                raise ValueError("Для production требуются Secure cookie и штатная доставка")
            if not self.smtp_host or not self.smtp_sender:
                raise ValueError("Для production требуется настроенный SMTP")
            if not self.smsc_api_key or not self.smsc_sender:
                raise ValueError("Для production требуется настроенный SMSC")
        if not self.database_url.startswith("postgresql+psycopg://"):
            raise ValueError("Требуется URL PostgreSQL с драйвером psycopg")
        if len(self.secret_key.encode()) < 32:
            raise ValueError("TUTORFLOW_SECRET_KEY должен содержать минимум 32 байта")
        if self.local_inbox and self.secure_cookie:
            raise ValueError("Локальный приёмник доступен только в режиме разработки")
        if bool(self.smtp_host) != bool(self.smtp_sender):
            raise ValueError("Для SMTP требуются адрес сервера и отправитель")
        if not self.smtp_tls and (self.smtp_host != "mailpit" or self.smtp_username):
            raise ValueError("SMTP без TLS разрешён только для локального Mailpit без авторизации")
        if bool(self.smtp_username) != bool(self.smtp_password):
            raise ValueError("Для SMTP-аутентификации нужны имя пользователя и пароль")

    @property
    def cookie_name(self) -> str:
        return "__Host-tutorflow_session" if self.secure_cookie else "tutorflow_dev_session"

    @classmethod
    def from_env(cls):
        return cls(
            app_env=os.getenv("TUTORFLOW_APP_ENV", "development"),
            database_url=os.environ["TUTORFLOW_DATABASE_URL"],
            secret_key=os.environ["TUTORFLOW_SECRET_KEY"],
            secure_cookie=os.getenv("TUTORFLOW_INSECURE_LOCAL_HTTP") != "1",
            browser_origin=os.getenv("TUTORFLOW_BROWSER_ORIGIN"),
            local_inbox=os.getenv("TUTORFLOW_LOCAL_INBOX"),
            smtp_tls=os.getenv("TUTORFLOW_LOCAL_SMTP") != "1",
            smsc_api_key=os.getenv("TUTORFLOW_SMSC_API_KEY"),
            smsc_sender=os.getenv("TUTORFLOW_SMSC_SENDER"),
            smtp_host=os.getenv("TUTORFLOW_SMTP_HOST"),
            smtp_port=int(os.getenv("TUTORFLOW_SMTP_PORT", "465")),
            smtp_sender=os.getenv("TUTORFLOW_SMTP_SENDER"),
            smtp_username=os.getenv("TUTORFLOW_SMTP_USERNAME"),
            smtp_password=os.getenv("TUTORFLOW_SMTP_PASSWORD"),
        )
