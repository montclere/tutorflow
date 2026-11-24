from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.modules.identity.router import router
from app.modules.identity.service import Identity


class HealthStatus(BaseModel):
    status: Literal["ok"] = "ok"


def create_app(identity: Identity | None = None) -> FastAPI:
    application = FastAPI(title="TutorFlow API")
    application.state.identity = identity
    application.include_router(router)

    @application.get("/health")
    async def health() -> HealthStatus:
        return HealthStatus()

    @application.exception_handler(RequestValidationError)
    async def invalid_request(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        errors = [
            {"loc": item["loc"], "msg": item["msg"], "type": item["type"]}
            for item in error.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={"detail": errors},
            headers={"Cache-Control": "no-store"},
        )

    @application.middleware("http")
    async def prevent_identity_caching(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/v1/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    return application


app = create_app()
