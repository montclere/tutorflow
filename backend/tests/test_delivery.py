import asyncio
from unittest.mock import Mock
from urllib.parse import parse_qs

import pytest

from app.modules.identity.infrastructure import delivery
from app.shared.domain.errors import Problem


def test_smsc_posts_key_and_destination_only_in_body(monkeypatch):
    connection = Mock()
    factory = Mock(return_value=connection)
    monkeypatch.setattr(delivery, "HTTPSConnection", factory, raising=False)
    connection.getresponse.return_value.status = 200
    connection.getresponse.return_value.read.return_value = b'{"id":42,"cnt":1}'
    sms = delivery.ConfiguredDelivery(None, None, delivery.SmscSettings("test-key", "TutorFlow"))
    asyncio.run(sms.send("phone", "+79990000042", "11223344"))
    assert factory.call_args.args == ("smsc.ru",)
    method, path = connection.request.call_args.args
    assert (method, path) == ("POST", "/sys/send.php")
    assert parse_qs(connection.request.call_args.kwargs["body"].decode()) == {
        "apikey": ["test-key"],
        "phones": ["79990000042"],
        "sender": ["TutorFlow"],
        "mes": ["Код TutorFlow: 11223344"],
        "charset": ["utf-8"],
        "fmt": ["3"],
    }
    connection.close.assert_called_once()


@pytest.mark.parametrize(
    "status, payload",
    [
        (503, b"sensitive response"),
        (302, b"redirect"),
        (200, b'{"error_code":3,"error":"secret"}'),
        (200, b'{"id":42,"cnt":0}'),
        (200, b"invalid"),
    ],
)
def test_smsc_rejects_bad_response_without_echo(monkeypatch, status, payload):
    connection = Mock()
    monkeypatch.setattr(delivery, "HTTPSConnection", Mock(return_value=connection), raising=False)
    connection.getresponse.return_value.status = status
    connection.getresponse.return_value.read.return_value = payload
    sms = delivery.ConfiguredDelivery(None, None, delivery.SmscSettings("test-key", "TutorFlow"))
    with pytest.raises(Problem, match="^delivery_unavailable$") as error:
        asyncio.run(sms.send("phone", "+79990000042", "11223344"))
    assert error.value.status == 503
