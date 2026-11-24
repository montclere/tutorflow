import os
import secrets
import subprocess
import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import URL, Engine, create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.schema import CreateSchema, DropSchema


@contextmanager
def postgres_url() -> Iterator[URL | str]:
    configured = os.environ.get("TEST_IDENTITY_DATABASE_URL")
    if configured:
        yield configured
        return

    password = secrets.token_urlsafe(24)
    deployed = subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "-d",
            "-e",
            "POSTGRES_PASSWORD",
            "-p",
            "127.0.0.1::5432",
            "postgres:17-alpine",
        ],
        env={**os.environ, "POSTGRES_PASSWORD": password},
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    try:
        mapping = subprocess.check_output(
            ["docker", "port", deployed, "5432/tcp"], text=True
        )
        port = int(mapping.strip().rsplit(":", 1)[1])
        yield URL.create(
            "postgresql+psycopg", "postgres", password, "127.0.0.1", port, "postgres"
        )
    finally:
        subprocess.run(
            ["docker", "rm", "-f", deployed], check=True, capture_output=True
        )


@contextmanager
def postgres_cluster() -> Iterator[Engine]:
    with postgres_url() as url:
        engine = create_engine(url)
        try:
            for attempt in range(80):
                try:
                    with engine.connect():
                        break
                except OperationalError:
                    if attempt == 79:
                        raise
                    time.sleep(0.25)
            yield engine
        finally:
            engine.dispose()


@contextmanager
def migrated_schema(cluster: Engine) -> Iterator[Engine]:
    schema = f"tutorflow_test_{secrets.token_hex(12)}"
    with cluster.begin() as connection:
        connection.execute(CreateSchema(schema))
    engine = create_engine(
        cluster.url, connect_args={"options": f"-csearch_path={schema}"}
    )
    try:
        config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
        yield engine
    finally:
        engine.dispose()
        with cluster.begin() as connection:
            connection.execute(DropSchema(schema, cascade=True))
