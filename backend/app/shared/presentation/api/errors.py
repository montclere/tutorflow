from uuid import UUID

from fastapi import Request
from fastapi.responses import JSONResponse

from app.shared.domain.errors import Problem


def problem_response(request: Request, problem: Problem, fields: list[dict] | None = None):
    request_id: UUID = request.state.request_id
    route = request.scope.get("route")
    route_path = getattr(route, "path", None)
    instance = (
        route_path
        if route_path and route_path.startswith("/api/v1")
        else ("/api/v1" + (route_path or ""))
    )
    body = {
        "type": f"urn:tutorflow:problem:{problem.code}",
        "title": problem.code,
        "status": problem.status,
        "detail": problem.code,
        "instance": instance,
        "code": problem.code,
        "request_id": str(request_id),
    }
    if fields:
        body["errors"] = fields
    headers = {"Retry-After": str(problem.retry_after)} if problem.retry_after else None
    return JSONResponse(
        body, status_code=problem.status, media_type="application/problem+json", headers=headers
    )


validation_response_schema = {
    "description": "Validation failed",
    "content": {
        "application/problem+json": {
            "schema": {
                "type": "object",
                "required": ["type", "title", "status", "detail", "instance", "code", "request_id"],
                "properties": {
                    "type": {"type": "string"},
                    "title": {"type": "string"},
                    "status": {"type": "integer"},
                    "detail": {"type": "string"},
                    "instance": {"type": "string"},
                    "code": {"type": "string"},
                    "request_id": {"type": "string", "format": "uuid"},
                    "errors": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "field": {"type": "string"},
                                "code": {"type": "string"},
                            },
                        },
                    },
                },
            },
        },
    },
}
