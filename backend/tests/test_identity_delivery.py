"""Проверки TLS для доставки кода регистрации."""

import ssl
from unittest.mock import AsyncMock, patch

import pytest
from pydantic import SecretStr

from app.modules.identity.application.ports import DeliveryUnavailable
from app.modules.identity.domain.values import Contact, ContactKind
from app.modules.identity.infrastructure.delivery.sender import ConfiguredDelivery
from app.modules.identity.infrastructure.delivery.settings import DeliverySettings


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
@pytest.mark.br_001
async def test_smtp_requires_a_trusted_certificate():
    delivery = ConfiguredDelivery(DeliverySettings(smtp_host="smtp.example.com"))
    contact = Contact(ContactKind.EMAIL, "teacher@example.com")

    with patch(
        "app.modules.identity.infrastructure.delivery.sender.aiosmtplib.send",
        new_callable=AsyncMock,
    ) as smtp:
        smtp.side_effect = ssl.SSLCertVerificationError("certificate verify failed")

        with pytest.raises(DeliveryUnavailable):
            await delivery.send(contact, "12345678")

    context = smtp.call_args.kwargs["tls_context"]

    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.check_hostname


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
@pytest.mark.parametrize(
    "result,accepted", [({"id": 1}, True), ({"error_code": 1}, False), ({"id": True}, False)]
)
async def test_sms_provider_result_is_checked_asynchronously(monkeypatch, result, accepted):
    from urllib.parse import parse_qs

    import httpx


    settings = DeliverySettings(smsc_key=SecretStr("test-key"))
    received = []


    async def provider(request):
        received.append(parse_qs((await request.aread()).decode()))

        return httpx.Response(200, json=result)


    client_type = httpx.AsyncClient


    def client(**kwargs):
        return client_type(transport=httpx.MockTransport(provider), **kwargs)


    monkeypatch.setattr(
        "app.modules.identity.infrastructure.delivery.sender.httpx.AsyncClient", client
    )

    delivery = ConfiguredDelivery(settings)
    contact = Contact(ContactKind.PHONE, "+15551234567")

    if accepted:
        await delivery.send(contact, "12345678")
    else:
        with pytest.raises(DeliveryUnavailable):
            await delivery.send(contact, "12345678")

    assert received[0]["phones"] == ["15551234567"]
    assert received[0]["apikey"] == ["test-key"]


@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
async def test_sms_timeout_becomes_a_retryable_delivery_failure(monkeypatch):
    import httpx


    async def provider(request):
        raise httpx.ReadTimeout("test-timeout", request=request)


    client_type = httpx.AsyncClient


    def client(**kwargs):
        return client_type(transport=httpx.MockTransport(provider), **kwargs)


    monkeypatch.setattr(
        "app.modules.identity.infrastructure.delivery.sender.httpx.AsyncClient", client
    )

    settings = DeliverySettings(smsc_key=SecretStr("test-key"))

    with pytest.raises(DeliveryUnavailable):
        await ConfiguredDelivery(settings).send(
            Contact(ContactKind.PHONE, "+15551234567"), "12345678"
        )
