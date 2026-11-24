import os

from alembic import context
from sqlalchemy import create_engine

from app.modules.identity.models import IdentityBase
from app.modules.scheduling.models import SchedulingBase

target_metadata = [IdentityBase.metadata, SchedulingBase.metadata]


def run_migrations() -> None:
    url = os.environ.get("IDENTITY_DATABASE_URL")
    connection = context.config.attributes.get("connection")
    if connection is not None:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
        return

    if not url:
        raise ValueError("Укажите IDENTITY_DATABASE_URL")
    if context.is_offline_mode():
        context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
        with context.begin_transaction():
            context.run_migrations()
        return

    engine = create_engine(url)
    try:
        with engine.connect() as connection:
            context.configure(connection=connection, target_metadata=target_metadata)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()


run_migrations()
