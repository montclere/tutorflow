FROM ghcr.io/astral-sh/uv:0.12.7 AS uv
FROM python:3.12-slim-trixie
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PATH="/app/.venv/bin:$PATH"
WORKDIR /app
COPY --from=uv /uv /usr/local/bin/uv
COPY .python-version pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project --no-python-downloads
COPY app ./app
COPY alembic.ini ./
COPY migrations ./migrations
USER 10001:10001
