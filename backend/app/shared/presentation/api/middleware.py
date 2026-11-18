import logging
from uuid import uuid4

from starlette.datastructures import MutableHeaders
from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.shared.domain.errors import Problem

from .errors import problem_response

logger = logging.getLogger(__name__)


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp, max_body_bytes: int = 16_384):
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request = Request(scope)
        request.state.request_id = uuid4()
        request.state.source = request.client.host if request.client else "unknown"

        started = False
        ended = False

        async def send_with_context(message: Message):
            nonlocal started, ended
            if message["type"] == "http.response.start":
                started = True
                headers = MutableHeaders(scope=message)
                headers["Cache-Control"] = "no-store"
                headers["X-Request-ID"] = str(request.state.request_id)
                headers["Referrer-Policy"] = "no-referrer"
            if message["type"] == "http.response.body" and not message.get("more_body"):
                ended = True
            await send(message)

        async def run(inner_receive: Receive):
            try:
                await self.app(scope, inner_receive, send_with_context)
            except Exception as error:
                logger.error(
                    "request_failed request_id=%s error=%s",
                    request.state.request_id,
                    type(error).__name__,
                )
                if not started:
                    response = problem_response(request, Problem("internal_error", 500))
                    await response(scope, inner_receive, send_with_context)
                elif not ended:
                    await send({"type": "http.response.body", "body": b"", "more_body": False})

        if request.method not in {"POST", "PATCH", "PUT", "DELETE"}:
            await run(receive)
            return

        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            if len(body) + len(chunk) > self.max_body_bytes:
                response = problem_response(request, Problem("request_too_large", 413))
                await response(scope, receive, send_with_context)
                return
            body.extend(chunk)
            if not message.get("more_body"):
                break

        first_read = True

        async def read_limited() -> Message:
            nonlocal first_read
            if first_read:
                first_read = False
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await run(read_limited)
