"""ASGI-граница ID запроса, длительности и безопасной обработки исключений."""

import sys
from time import perf_counter
from uuid import uuid4

import structlog
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.shared.presentation.problems import problem_response


METHODS = {"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "TRACE", "CONNECT"}


class RequestObservability:
    def __init__(self, app: ASGIApp, metrics) -> None:
        self.app = app
        self.metrics = metrics
        self.logger = structlog.get_logger(__name__)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)

            return

        identifier = str(uuid4())
        scope.setdefault("state", {})["request_id"] = identifier
        tokens = structlog.contextvars.bind_contextvars(request_id=identifier)
        started = False
        status = 500
        begin = perf_counter()


        async def observed_send(message: Message) -> None:
            nonlocal started, status

            if message["type"] == "http.response.start":
                started = True
                status = message["status"]
                headers = [
                    (key, value)
                    for key, value in message.get("headers", [])
                    if key.lower() != b"x-request-id"
                ]

                headers.append((b"x-request-id", identifier.encode()))

                message = {**message, "headers": headers}

            await send(message)


        try:
            await self.app(scope, receive, observed_send)
        except Exception:
            self.metrics.failures.labels("after_response" if started else "before_response").inc()
            await self.logger.aerror("http_request_failed", exc_info=sys.exc_info())

            if started:
                raise RuntimeError("response_failed") from None

            response = problem_response(identifier, 500, "internal_error")

            await response(scope, receive, observed_send)
        finally:
            elapsed = perf_counter() - begin
            route = getattr(scope.get("route"), "path", "__unmatched__")
            method = scope["method"] if scope["method"] in METHODS else "OTHER"

            if route != "/metrics":
                self.metrics.requests.labels(method, route, str(status)).inc()
                self.metrics.duration.labels(method, route).observe(elapsed)
                await self.logger.ainfo(
                    "http_request_completed",
                    method=method,
                    route=route,
                    status=status,
                    duration_seconds=round(elapsed, 6),
                )

            structlog.contextvars.reset_contextvars(**tokens)
