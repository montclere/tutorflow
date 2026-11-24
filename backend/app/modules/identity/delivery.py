import json
import os
import smtplib
from email.message import EmailMessage
from http.client import HTTPException, HTTPSConnection
from typing import Literal
from urllib.parse import urlencode

ContactKind = Literal["email", "phone"]


class DeliveryUnavailable(Exception):
    """Провайдер не подтвердил приём сообщения."""


class EnvironmentDelivery:
    """SMTP для почты и SMSC для телефона. Локально оба канала допускают Mailpit."""

    def send(self, kind: ContactKind, contact: str, code: str) -> None:
        local = os.environ.get("IDENTITY_LOCAL_MAILPIT") == "1"
        try:
            if kind == "email" or local:
                recipient = contact
                if kind == "phone":
                    recipient = f"sms-{contact.removeprefix('+')}@tutorflow.invalid"
                self._email(recipient, code, local)
            else:
                self._sms(contact, code)
        except (OSError, HTTPException, ValueError) as exc:
            raise DeliveryUnavailable from exc

    @staticmethod
    def _email(recipient: str, code: str, local: bool) -> None:
        message = EmailMessage()
        message["From"] = os.environ.get(
            "IDENTITY_SMTP_FROM", "tutorflow@tutorflow.invalid"
        )
        message["To"] = recipient
        message["Subject"] = "Код TutorFlow"
        message.set_content(f"Код подтверждения TutorFlow: {code}")
        if local:
            port = int(os.environ.get("IDENTITY_MAILPIT_PORT", "1025"))
            with smtplib.SMTP("127.0.0.1", port, timeout=8) as smtp:
                smtp.send_message(message)
            return

        host = os.environ.get("IDENTITY_SMTP_HOST")
        if not host:
            raise DeliveryUnavailable
        with smtplib.SMTP_SSL(
            host, int(os.environ.get("IDENTITY_SMTP_PORT", "465")), timeout=8
        ) as smtp:
            username = os.environ.get("IDENTITY_SMTP_USER")
            if username:
                smtp.login(username, os.environ.get("IDENTITY_SMTP_PASSWORD", ""))
            smtp.send_message(message)

    @staticmethod
    def _sms(contact: str, code: str) -> None:
        api_key = os.environ.get("IDENTITY_SMSC_API_KEY")
        if not api_key:
            raise DeliveryUnavailable
        data = {
            "apikey": api_key,
            "phones": contact.removeprefix("+"),
            "mes": f"Код TutorFlow: {code}",
            "charset": "utf-8",
            "fmt": "3",
        }
        sender = os.environ.get("IDENTITY_SMSC_SENDER")
        if sender:
            data["sender"] = sender
        connection = HTTPSConnection("smsc.ru", timeout=8)
        try:
            connection.request(
                "POST",
                "/sys/send.php",
                body=urlencode(data).encode(),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response = connection.getresponse()
            if response.status != 200:
                raise DeliveryUnavailable
            result = json.loads(response.read(4096))
            if (
                not isinstance(result, dict)
                or "error_code" in result
                or "error" in result
            ):
                raise DeliveryUnavailable
            if type(result.get("id")) is not int or result["id"] <= 0:
                raise DeliveryUnavailable
        finally:
            connection.close()
