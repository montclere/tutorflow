from fastapi import APIRouter

from app.modules.health.router import router as health_router
from app.shared.presentation.api.errors import validation_response_schema


def api_v1(*routers: APIRouter) -> APIRouter:
    router = APIRouter(prefix="/api/v1", responses={422: validation_response_schema})
    router.include_router(health_router)
    for child in routers:
        router.include_router(child)
    return router
