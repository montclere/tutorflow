from sqlalchemy.ext.asyncio import create_async_engine


def build_engine(url: str, *, pool_size: int = 5, max_overflow: int = 10):
    return create_async_engine(
        url,
        pool_pre_ping=True,
        hide_parameters=True,
        pool_size=pool_size,
        max_overflow=max_overflow,
        connect_args={"options": "-c timezone=UTC"},
    )
