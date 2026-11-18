import os

from alembic import context
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

from app.persistence import metadata

url = context.config.attributes.get("database_url") or os.environ["TUTORFLOW_DATABASE_URL"]
if not url.startswith("postgresql+psycopg://"):
    raise ValueError("Миграции используют PostgreSQL через psycopg")

if context.is_offline_mode():
    context.configure(url=url, target_metadata=metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = create_engine(url, poolclass=NullPool, hide_parameters=True)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()
