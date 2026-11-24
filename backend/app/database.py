import os
from functools import lru_cache

from sqlalchemy import Engine, create_engine


@lru_cache(maxsize=1)
def database_engine() -> Engine:
    url = os.environ.get("IDENTITY_DATABASE_URL")
    if not url:
        raise RuntimeError("IDENTITY_DATABASE_URL is required")
    return create_engine(url, pool_pre_ping=True)
