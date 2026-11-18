from fastapi import APIRouter

from app.modules.health.router import router as health_router
from app.shared.domain.errors import ProblemCode
from app.shared.presentation.api.errors import problem_responses


def api_v1(*routers: APIRouter) -> APIRouter:
    router = APIRouter(prefix="/api/v1", responses=problem_responses(ProblemCode.INTERNAL_ERROR))
    router.include_router(health_router)
    for child in routers:
        router.include_router(child)
    return router
