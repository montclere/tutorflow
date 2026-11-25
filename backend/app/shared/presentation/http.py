"""HTTP-проверки, общие для модулей приложения."""

from fastapi import HTTPException, Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.shared.presentation.problems import problem_response, request_id


def request_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def require_json(request: Request) -> None:
    media_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()

    if media_type != "application/json":
        raise HTTPException(415, "application_json_required")


class RequestBodyLimit:
    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)

            return

        body = bytearray()

        while True:
            message = await receive()

            if message["type"] == "http.disconnect":
                return

            chunk = message.get("body", b"")

            if len(body) + len(chunk) > self.max_bytes:
                response = problem_response(request_id(Request(scope)), 413, "request_too_large")

                await response(scope, receive, send)

                return

            body.extend(chunk)

            if not message.get("more_body", False):
                break

        pending = True


        async def replay_receive() -> Message:
            nonlocal pending

            if pending:
                pending = False

                return {"type": "http.request", "body": bytes(body), "more_body": False}

            return await receive()


        await self.app(scope, replay_receive, send)
