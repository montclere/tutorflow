"""Доставка одноразовых кодов по одному выбранному каналу."""

import asyncio
import json
import os
import smtplib
import ssl
from dataclasses import dataclass, field
from email.message import EmailMessage
from http.client import HTTPException, HTTPSConnection
from pathlib import Path
from urllib.parse import urlencode
from uuid import uuid4


class DeliveryUnavailable(Exception):
    """Доставка не подтверждена транспортом."""


@dataclass(frozen=True)
class SmtpSettings:
    host: str
    port: int
    sender: str
    username: str | None
    password: str | None = field(repr=False)
    tls: bool = True


@dataclass(frozen=True)
class SmscSettings:
    api_key: str = field(repr=False)
    sender: str


class ConfiguredDelivery:
    def __init__(
        self, local_inbox: str | None, smtp: SmtpSettings | None, smsc: SmscSettings | None = None
    ):
        self.local_inbox = Path(local_inbox) if local_inbox else None
        self.smtp = smtp
        self.smsc = smsc

    async def send(self, contact_type: str, contact: str, code: str) -> None:
        try:
            if contact_type == "email" and self.smtp is not None:
                await asyncio.to_thread(self._send_email, self.smtp, contact, code)
            elif contact_type == "phone" and self.local_inbox is not None:
                await asyncio.to_thread(self._write_pickup, contact, code)
            elif contact_type == "phone" and self.smsc is not None:
                await asyncio.to_thread(self._send_sms, self.smsc, contact, code)
            else:
                raise DeliveryUnavailable("delivery_unavailable")
        except (OSError, smtplib.SMTPException, HTTPException, ValueError):
            raise DeliveryUnavailable("delivery_unavailable") from None

    def _write_pickup(self, contact: str, code: str):
        assert self.local_inbox is not None
        self.local_inbox.mkdir(mode=0o700, parents=True, exist_ok=True)
        if self.local_inbox.is_symlink() or self.local_inbox.stat().st_mode & 0o077:
            raise OSError("Локальный приёмник должен быть закрытой папкой")
        with os.fdopen(
            os.open(
                self.local_inbox / f"{uuid4()}.txt", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600
            ),
            "w",
            encoding="utf-8",
        ) as output:
            output.write(f"phone: {contact}\n{code}\n")

    @staticmethod
    def _send_email(settings: SmtpSettings, contact: str, code: str):
        message = EmailMessage()
        message["From"] = settings.sender
        message["To"] = contact
        message["Subject"] = "Код подтверждения TutorFlow"
        message.set_content(f"Код подтверждения: {code}")
        transport = (
            smtplib.SMTP_SSL(
                settings.host, settings.port, timeout=8, context=ssl.create_default_context()
            )
            if settings.tls
            else smtplib.SMTP(settings.host, settings.port, timeout=8)
        )
        with transport:
            if settings.username and settings.password:
                transport.login(settings.username, settings.password)
            transport.send_message(message)

    @staticmethod
    def _send_sms(settings: SmscSettings, contact: str, code: str):
        body = urlencode(
            {
                "apikey": settings.api_key,
                "phones": contact.lstrip("+"),
                "sender": settings.sender,
                "mes": f"Код TutorFlow: {code}",
                "charset": "utf-8",
                "fmt": "3",
            }
        ).encode()
        connection = HTTPSConnection("smsc.ru", timeout=8, context=ssl.create_default_context())
        try:
            connection.request(
                "POST",
                "/sys/send.php",
                body=body,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            response = connection.getresponse()
            if response.status != 200:
                raise DeliveryUnavailable("delivery_unavailable")
            data = json.loads(response.read(4096))
            if (
                not isinstance(data, dict)
                or "error_code" in data
                or "error" in data
                or type(data.get("id")) is not int
                or type(data.get("cnt")) is not int
                or data["id"] <= 0
                or data["cnt"] <= 0
            ):
                raise DeliveryUnavailable("delivery_unavailable")
        finally:
            connection.close()
