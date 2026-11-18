import os
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.maintenance import prune_pickup


def test_error_reports_omit_exception_request_and_query(caplog):
    app = create_app(Settings("postgresql+psycopg://postgres@localhost/tutorflow", "t" * 32))
    secret = "test-sensitive-child-name"

    @app.post("/private-fault")
    async def fault():
        raise RuntimeError(secret)

    with TestClient(app) as client:
        response = client.post(
            "/private-fault?contact=private@example.org",
            json={"password": "test-sensitive-password", "code": "89887766"},
        )
    assert response.status_code == 500
    assert response.json()["code"] == "internal_error"
    assert response.headers["X-Request-ID"] == response.json()["request_id"]
    assert "RuntimeError" in caplog.text
    for value in (secret, "private@example.org", "test-sensitive-password", "89887766"):
        assert value not in caplog.text
        assert value not in response.text


def test_local_pickup_deletes_only_expired_files(tmp_path):
    directory = tmp_path / "inbox"
    directory.mkdir(mode=0o700)
    old = directory / "old.txt"
    new = directory / "new.txt"
    old.write_text("test old message")
    new.write_text("test fresh message")
    now = datetime.now(UTC)
    earlier = (now - timedelta(minutes=11)).timestamp()
    os.utime(old, (earlier, earlier))
    prune_pickup(directory, now - timedelta(minutes=10))
    assert not old.exists()
    assert new.read_text() == "test fresh message"
