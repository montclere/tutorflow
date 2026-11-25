"""Асинхронная доставка кодов через SMTP, Mailpit и SMSC."""

import ssl
from asyncio import to_thread
from email.message import EmailMessage

import aiosmtplib
import httpx
import structlog

from app.modules.identity.application.ports import CodeDelivery, DeliveryUnavailable
from app.modules.identity.domain.values import Contact, ContactKind
from app.modules.identity.infrastructure.delivery.settings import DeliverySettings
from app.shared.infrastructure.metrics import Metrics


SMSC_ENDPOINT = "https://smsc.ru/sys/send.php"


class ConfiguredDelivery:
    def __init__(self, settings: DeliverySettings):
        self.settings = settings

    async def send(self, contact: Contact, code: str) -> None:
        local = self.settings.local_mailpit

        try:
            if contact.kind is ContactKind.EMAIL or local:
                recipient = contact.value

                if contact.kind is ContactKind.PHONE:
                    recipient = f"sms-{contact.value.removeprefix('+')}@tutorflow.invalid"

                await self._email(recipient, code, local)
            else:
                await self._sms(contact.value, code)
        except (OSError, aiosmtplib.SMTPException, httpx.HTTPError, ValueError) as error:
            raise DeliveryUnavailable from error

    async def _email(self, recipient: str, code: str, local: bool) -> None:
        host = "127.0.0.1" if local else self.settings.smtp_host

        if not host:
            raise DeliveryUnavailable

        message = EmailMessage()
        message["From"] = self.settings.smtp_from
        message["To"] = recipient
        message["Subject"] = "Код TutorFlow"

        message.set_content(f"Код подтверждения TutorFlow: {code}")

        refused, _ = await aiosmtplib.send(
            message,
            hostname=host,
            port=self.settings.mailpit_port if local else self.settings.smtp_port,
            username=None if local else self.settings.smtp_user,
            password=None if local else self.settings.smtp_password.get_secret_value() or None,
            use_tls=not local,
            start_tls=False,
            validate_certs=True,
            tls_context=await to_thread(ssl.create_default_context) if not local else None,
            timeout=self.settings.timeout_seconds,
        )

        if refused:
            raise DeliveryUnavailable

    async def _sms(self, contact: str, code: str) -> None:
        if not self.settings.smsc_key:
            raise DeliveryUnavailable

        data = {
            "apikey": self.settings.smsc_key.get_secret_value(),
            "phones": contact.removeprefix("+"),
            "mes": f"Код TutorFlow: {code}",
            "charset": "utf-8",
            "fmt": "3",
        }

        if self.settings.smsc_sender:
            data["sender"] = self.settings.smsc_sender

        async with httpx.AsyncClient(
            timeout=self.settings.timeout_seconds, trust_env=False
        ) as client:
            response = await client.post(SMSC_ENDPOINT, data=data)

            response.raise_for_status()

            result = response.json()

        if (
            not isinstance(result, dict)
            or "error_code" in result
            or "error" in result
            or (type(result.get("id")) is not int)
            or (result["id"] <= 0)
        ):
            raise DeliveryUnavailable


class ObservedCodeDelivery:
    def __init__(self, delegate: CodeDelivery, metrics: Metrics) -> None:
        self.delegate = delegate
        self.metrics = metrics
        self.logger = structlog.get_logger(__name__)

    async def send(self, contact: Contact, code: str) -> None:
        channel = contact.kind.value

        try:
            await self.delegate.send(contact, code)
        except DeliveryUnavailable:
            self.metrics.delivery.labels(channel, "failed").inc()
            await self.logger.awarning("delivery_failed", channel=channel)

            raise
        else:
            self.metrics.delivery.labels(channel, "accepted").inc()
            await self.logger.ainfo("delivery_accepted", channel=channel)
