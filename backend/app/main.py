"""Фабрика ASGI-приложения."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import DBAPIError, DisconnectionError, OperationalError, SQLAlchemyError
from sqlalchemy.exc import TimeoutError as DatabaseTimeout
from starlette.exceptions import HTTPException

from app.api_v1 import api_v1
from app.composition import build_routers
from app.config import Settings
from app.modules.identity.application.ports import CodeDelivery
from app.shared.domain.errors import Problem, ProblemCode
from app.shared.infrastructure.db.engine import build_engine
from app.shared.presentation.api.errors import (
    framework_problem,
    include_problem_schema,
    problem_response,
    validation_problem,
)
from app.shared.presentation.api.middleware import RequestContextMiddleware

logger = logging.getLogger(__name__)


def create_app(
    settings: Settings | None = None, *, delivery: CodeDelivery | None = None
) -> FastAPI:
    settings = settings or Settings.from_env()
    engine = build_engine(settings.database_url)
    rate_engine = build_engine(settings.database_url, pool_size=4, max_overflow=0)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        try:
            yield
        finally:
            await rate_engine.dispose()
            await engine.dispose()

    app = FastAPI(title="TutorFlow", version="1.0.0", lifespan=lifespan, redirect_slashes=False)
    app.add_middleware(RequestContextMiddleware)
    app.include_router(api_v1(*build_routers(settings, engine, rate_engine, delivery)))

    include_problem_schema(app)

    @app.exception_handler(Problem)
    async def domain_error(request: Request, problem: Problem):
        return problem_response(request, problem)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError):
        return validation_problem(request, error)

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, error: HTTPException):
        return framework_problem(request, error)

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request: Request, error: SQLAlchemyError):
        logger.error(
            "database_error request_id=%s error=%s", request.state.request_id, type(error).__name__
        )
        unavailable = isinstance(
            error, (OperationalError, DisconnectionError, DatabaseTimeout)
        ) or (isinstance(error, DBAPIError) and error.connection_invalidated)
        code = ProblemCode.DEPENDENCY_UNAVAILABLE if unavailable else ProblemCode.INTERNAL_ERROR
        return problem_response(request, Problem(code))

    return app
