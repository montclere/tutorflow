"""HTTP-проверки, общие для модулей приложения."""

from fastapi import HTTPException, Request


def require_json(request: Request) -> None:
    media_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()

    if media_type != "application/json":
        raise HTTPException(415, "application_json_required")
