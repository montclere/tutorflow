"""Фабрика приложения FastAPI и общие HTTP-обработчики."""

from asyncio import Lock, to_thread
from contextlib import asynccontextmanager
from functools import cache
from pathlib import Path
from typing import Literal

from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api_v1 import PREFIX, router
from app.composition import Services
from app.dependencies import resolve_services
from app.monitoring import monitoring_router
from app.shared.infrastructure.logging import configure_logging
from app.shared.infrastructure.metrics import process_metrics
from app.shared.presentation.observability import RequestObservability
from app.shared.presentation.problems import PROBLEM_RESPONSES, http_problem, validation_problem


class HealthStatus(BaseModel):
    status: Literal["ok"] = "ok"


@cache
def expected_revisions() -> set[str]:
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))

    config.set_main_option("script_location", str(root / "migrations"))

    return set(ScriptDirectory.from_config(config).get_heads())


@asynccontextmanager
async def application_lifespan(application: FastAPI):
    try:
        yield
    finally:
        if application.state.owns_services and application.state.services is not None:
            await application.state.services.engine.dispose()


def create_app(services: Services | None = None) -> FastAPI:
    configure_logging()

    metrics = services.metrics if services is not None else process_metrics()
    application = FastAPI(
        title="TutorFlow API", responses=PROBLEM_RESPONSES, lifespan=application_lifespan
    )
    application.state.services = services
    application.state.owns_services = services is None
    application.state.services_lock = Lock()

    application.include_router(router)
    application.include_router(monitoring_router(metrics, resolve_services))


    @application.get("/health")
    async def health() -> HealthStatus:
        return HealthStatus()


    @application.get("/ready")
    async def ready(request: Request) -> HealthStatus:
        try:
            async with (await resolve_services(request)).engine.connect() as connection:
                revisions = set(
                    await connection.scalars(text("SELECT version_num FROM alembic_version"))
                )
        except (HTTPException, SQLAlchemyError):
            raise HTTPException(503, "database_unavailable") from None

        if revisions != await to_thread(expected_revisions):
            raise HTTPException(503, "database_schema_not_ready")

        return HealthStatus()


    application.add_exception_handler(StarletteHTTPException, http_problem)
    application.add_exception_handler(RequestValidationError, validation_problem)


    @application.middleware("http")
    async def prevent_identity_caching(request: Request, call_next):
        response = await call_next(request)

        if request.url.path.startswith(f"{PREFIX}/"):
            response.headers["Cache-Control"] = "no-store"

        return response


    application.add_middleware(RequestObservability, metrics=metrics)

    return application


app = create_app()
